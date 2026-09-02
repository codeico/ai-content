# AI Architecture

Phase 4 establishes the AI infrastructure layer. It is infrastructure only:
nothing in the application calls it yet (no caption generation, no content
analysis — those arrive in later phases).

## Layers

```text
Application code
      ↓
AIProvider (packages/ai/src/provider.ts)         — provider-neutral contract
      ↓
OpenAICompatibleProvider                         — one adapter for the OpenAI chat-completions wire format
      ↓
Configurable endpoint  (AI_ROUTER_BASE_URL)      — any OpenAI-compatible server
      ↓
Underlying model       (chosen per request)
```

Application code imports `@ai-content/ai` and depends only on `AIProvider`,
`AIChatRequest`, `AIChatResponse`, and `AIError`. It never calls `fetch` and
never sees the raw upstream JSON.

**OpenRouter is not an architectural dependency.** Nothing in the code names a
vendor. Any server implementing `POST {base}/chat/completions` with a Bearer
token works: a hosted router, a self-hosted gateway, or a local model server.
Wherever a URL such as `https://openrouter.ai/api/v1` appears in this document,
it is an *example of an OpenAI-compatible endpoint only*.

## Provider-neutral contract

```ts
interface AIProvider {
  chat(request: AIChatRequest): Promise<AIChatResponse>;
}

interface AIChatRequest {
  model: string; // required — supplied by the caller, no default
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxOutputTokens?: number;
}

interface AIChatResponse {
  text: string;
  model: string;
  finishReason?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}
```

## OpenAI-compatible contract (adapter side)

The adapter sends:

```text
POST {AI_ROUTER_BASE_URL}/chat/completions
Authorization: Bearer {AI_ROUTER_API_KEY}
Content-Type: application/json

{ "model": "...", "messages": [...], "temperature"?: n, "max_tokens"?: n }
```

and reads `choices[0].message.content`, `choices[0].finish_reason`, `model`,
and `usage.{prompt_tokens,completion_tokens,total_tokens}`. Extra vendor fields
are ignored. The base URL is normalised: trailing slashes and an accidental
trailing `/chat/completions` are stripped, so `.../v1`, `.../v1/`, and
`.../v1/chat/completions` all produce the same request URL.

## Environment

| Variable             | Scope       | Required? |
| -------------------- | ----------- | --------- |
| `AI_ROUTER_BASE_URL` | server-only | Optional  |
| `AI_ROUTER_API_KEY`  | server-only | Optional  |

Both are validated by the existing `futureProviderEnvSchema` in
`@ai-content/shared/env`. They are optional at boot: login, workspace, and
content pages render without them. `createAIProvider()` throws
`AIError('not_configured')` naming the missing variable(s) — and only when
something actually tries to use AI.

There is no `AI_ROUTER_DEFAULT_MODEL`; no caller needs one yet.

## Server-only secret handling

- Neither variable has a `NEXT_PUBLIC_` prefix, so neither is inlined into a
  browser bundle.
- `createAIProvider()` throws if a `window` global exists (same guard as the
  Supabase admin client).
- The key is held in a non-enumerable closure on the provider instance:
  `JSON.stringify(provider)` and `console.log(provider)` do not print it.
- `AIError` messages are fixed strings plus the HTTP status. Upstream bodies,
  request headers, and driver error text are never copied into messages.
- The key is never written to the database and never returned from any
  function.

## Example request flow

```ts
import { createAIProvider, AIError } from '@ai-content/ai';

// Server-side only (Server Action, route handler, server component).
const ai = createAIProvider(); // throws AIError('not_configured') if env is missing

try {
  const result = await ai.chat({
    model: 'some-model-id', // caller decides
    messages: [
      { role: 'system', content: 'You are concise.' },
      { role: 'user', content: 'Say hello.' },
    ],
    temperature: 0.3,
    maxOutputTokens: 100,
  });
  result.text; // "Hello."
} catch (error) {
  if (error instanceof AIError) {
    error.code; // 'authentication' | 'rate_limited' | 'timeout' | ...
    error.status; // upstream HTTP status when applicable
  }
}
```

## Timeouts, errors, retries

- Per-attempt timeout via `AbortController`, default 30 s → `AIError('timeout')`.
- Error codes: `not_configured`, `authentication` (401/403), `rate_limited`
  (429), `bad_request` (other 4xx), `upstream_error` (5xx), `network`,
  `timeout`, `malformed_response` (non-JSON or unexpected shape).
- Retry: at most one extra attempt, only for `rate_limited`, `upstream_error`,
  `network`, `timeout`. Honours a numeric `Retry-After` up to 5 s; otherwise
  waits 500 ms. Never retries auth, 4xx, or malformed responses. No queue, no
  background retry.

## Testing strategy

`tests/ai-provider.test.ts` injects a mocked `fetch` into
`OpenAICompatibleProvider`, so the suite is deterministic and never contacts a
real endpoint or needs `AI_ROUTER_API_KEY`. It covers configuration (missing
vars, normalisation, browser guard), the outgoing request (URL, headers, body,
optional params), response normalisation, every error class, retry
behaviour with fake timers, and explicit assertions that the API key and the
word "Authorization" never appear in errors, responses, or the serialised
provider.
