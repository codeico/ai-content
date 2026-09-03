import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Vendor-neutrality gate for packages/ai (docs/AI_ARCHITECTURE.md, roadmap
 * Phase 4 "AI Router Safety"). The router speaks the OpenAI-compatible wire
 * format and nothing else: no vendor SDK, no vendor-specific headers, no
 * vendor-specific environment variables, no hardcoded model names. A future
 * provider that genuinely needs one of these adds it behind its own adapter,
 * and updates this list on purpose.
 */
const AI_SRC = join(import.meta.dirname, '..', 'packages', 'ai', 'src');

const sources = readdirSync(AI_SRC)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => ({ name, text: readFileSync(join(AI_SRC, name), 'utf8') }));

const code = sources.map(({ text }) =>
  text
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n'),
);

const VENDOR_IDENTIFIERS = [
  'openrouter',
  'HTTP-Referer',
  'X-Title',
  'anthropic',
  'x-api-key',
  'gemini',
  'generativelanguage',
  'azure',
  'api-version',
  'together.ai',
  'groq',
  'mistral',
  'ollama',
];

const VENDOR_ENV_VARS = [/OPENROUTER_/, /OPENAI_API_KEY/, /ANTHROPIC_/, /GEMINI_/, /AZURE_/];

const MODEL_NAME_PATTERNS = [
  /gpt-[0-9]/i,
  /claude-/i,
  /llama-?[0-9]/i,
  /mixtral/i,
  /gemini-/i,
  /o[134]-mini/i,
];

describe('packages/ai vendor neutrality', () => {
  it('has source files to check', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it('depends on no vendor SDK', () => {
    const pkg = JSON.parse(readFileSync(join(AI_SRC, '..', 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const deps = Object.keys(pkg.dependencies ?? {});
    for (const dep of deps) {
      expect(dep, `dependency ${dep}`).not.toMatch(
        /openai|anthropic|openrouter|google|ai-sdk|langchain/i,
      );
    }
    for (const text of code) {
      expect(text).not.toMatch(/from ['"]openai['"]/);
      expect(text).not.toMatch(/from ['"]@anthropic-ai/);
      expect(text).not.toMatch(/from ['"]@openrouter/);
      expect(text).not.toMatch(/from ['"]ai['"]/);
    }
  });

  it('mentions no vendor identifier or vendor-specific header', () => {
    for (const [i, text] of code.entries()) {
      const lower = text.toLowerCase();
      for (const id of VENDOR_IDENTIFIERS) {
        expect(lower, `${sources[i]?.name} mentions ${id}`).not.toContain(id.toLowerCase());
      }
    }
  });

  it('reads only the neutral AI_ROUTER_* environment variables', () => {
    const allEnvReads = code.flatMap((text) => text.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) ?? []);
    const envLike = allEnvReads.filter((name) => name.includes('_'));
    for (const name of envLike) {
      for (const forbidden of VENDOR_ENV_VARS) {
        expect(name).not.toMatch(forbidden);
      }
    }
  });

  it('hardcodes no model name', () => {
    for (const [i, text] of code.entries()) {
      for (const pattern of MODEL_NAME_PATTERNS) {
        expect(text, `${sources[i]?.name} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('sends only the two headers the OpenAI-compatible format requires', () => {
    const provider = sources.find((s) => s.name === 'openai-compatible-provider.ts');
    expect(provider).toBeDefined();
    const headerBlock = provider!.text.match(/headers:\s*\{([\s\S]*?)\}/);
    expect(headerBlock, 'headers object literal').not.toBeNull();
    const keys = (headerBlock?.[1] ?? '')
      .split('\n')
      .map((line) => line.trim().split(':')[0]?.replace(/['"]/g, '').trim())
      .filter((key): key is string => Boolean(key));
    expect(keys.sort()).toEqual(['Authorization', 'Content-Type']);
  });
});

/**
 * The rule the product must keep, not just the package: neutrality is
 * worthless if the first caller in apps/web hardcodes a vendor's model name or
 * reads a vendor's key directly, bypassing createAIProvider. Scanning the
 * application surface means the gate still bites once AI features land.
 */
const APP_ROOTS = [
  join(import.meta.dirname, '..', 'apps', 'web', 'src'),
  join(import.meta.dirname, '..', 'packages', 'shared', 'src'),
];

function collectSources(dir: string): { path: string; text: string }[] {
  const found: { path: string; text: string }[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectSources(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      found.push({ path: full, text: readFileSync(full, 'utf8') });
    }
  }

  return found;
}

describe('application code keeps the AI router replaceable', () => {
  const appSources = APP_ROOTS.flatMap(collectSources).map(({ path, text }) => ({
    path,
    // Comments may legitimately name a vendor when explaining why we avoid it.
    text: text
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
      })
      .join('\n'),
  }));

  it('finds application sources to check', () => {
    expect(appSources.length).toBeGreaterThan(0);
  });

  it('reads no vendor-specific environment variable outside the router', () => {
    for (const { path, text } of appSources) {
      for (const forbidden of VENDOR_ENV_VARS) {
        expect(text, `${path} reads a vendor env var`).not.toMatch(forbidden);
      }
    }
  });

  it('hardcodes no vendor model name', () => {
    for (const { path, text } of appSources) {
      for (const pattern of MODEL_NAME_PATTERNS) {
        expect(text, `${path} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('imports no vendor SDK', () => {
    for (const { path, text } of appSources) {
      expect(text, path).not.toMatch(/from ['"]openai['"]/);
      expect(text, path).not.toMatch(/from ['"]@anthropic-ai/);
      expect(text, path).not.toMatch(/from ['"]@openrouter/);
    }
  });
});
