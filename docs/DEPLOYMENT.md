# Deployment

## Where this runs

- **Repo:** `codeico/ai-content` (private)
- **Production:** https://ai-content-bang-codes-projects.vercel.app
- **Vercel project:** `ai-content`, team `team_G63wGYWSsbPLgCyEAEc4oTUg`

## Things that cost time to rediscover

**Root directory must be the repo root, not `apps/web`.** This is a monorepo
and `apps/web` depends on `@ai-content/ai`, `@ai-content/database` and
`@ai-content/shared`. Point Vercel at `apps/web` and `npm install` runs inside
it, the workspace packages never install, and the build fails with unresolved
imports that look like a code problem rather than a configuration one.

**Preview feedback must be off.** With it enabled the build succeeds and the
_upload_ fails with `Cannot patch preview comments when immutable static file
upload is enabled`. The error names a Next canary version as the fix; turning
the toolbar off is cheaper and production does not need it.

**SSO protection blocks everything.** A new project defaults to
`ssoProtection: all_except_custom_domains`, which returns 302 on every route
including the manifest and icons — so the app looks broken and the PWA cannot
install. It has to be cleared explicitly.

**The Vercel MCP tools report 404 for projects that exist.** `get_project` and
`get_project_deployment_protection` both failed against a live project. Use the
CLI, or the REST API directly with the token at
`~/Library/Application Support/com.vercel.cli/auth.json`.

## Credentials

Neither is stored in this repo.

- **GitHub:** a token lives in the macOS keychain. `git credential fill`
  retrieves it. There is no `gh` CLI installed and the SSH key on this machine
  is not registered with GitHub, so HTTPS is the working path.
- **Vercel:** the CLI is authenticated already; the token is in the auth.json
  path above for API calls the CLI cannot make.

## Environment variables

Three, all marked sensitive in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`AI_ROUTER_BASE_URL`, `AI_ROUTER_API_KEY` and `AI_ROUTER_MODEL` are **not set**.
Caption generation renders its honest not-configured state without them.

Watch for `VERCEL_OIDC_TOKEN`: `vercel link` writes it into the local
`.env.local`, so a script that uploads every variable in that file will push it
to the project. It does not belong there.

## Deploying

```
git push origin main
vercel deploy --prod --yes
```

Verify against production rather than the build log — a green build has already
been followed by a failed upload here at least once:

```
curl -s -o /dev/null -w "%{http_code}\n" https://ai-content-bang-codes-projects.vercel.app/login
```
