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
