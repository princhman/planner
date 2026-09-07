# Production deployment

The production application has two independently hosted parts:

- Cloudflare Workers runs the SvelteKit server and serves static assets.
- Convex stores application data, runs backend functions, and verifies WorkOS
  access tokens.

Both deployments are driven from GitHub Actions. No generated build output or
credential file is required in the repository.

## Configuration in source control

`wrangler.jsonc` is the source of truth for the Worker name, compatibility date,
static-assets binding, observability, source maps, and non-secret runtime
variables. The SvelteKit adapter emits the Worker to
`.svelte-kit/cloudflare/_worker.js`; Wrangler uploads that module and the other
files in `.svelte-kit/cloudflare`.

Production is served by Worker `quextro-planner-production` on the Custom Domain
`planner.quextro.com`. Its `workers.dev` and preview URLs are disabled in source
control. Cloudflare manages the Custom Domain DNS record and TLS certificate.

The production Convex URL and WorkOS client ID are intentionally committed as
Wrangler variables. They are identifiers exposed to the browser, not
credentials. Change them in `wrangler.jsonc`, regenerate types with `bun run
cf:types`, and commit both files when moving to another production project.

The Worker derives its public origin from each incoming request. There is no
deployment-specific `ORIGIN` variable, so `workers.dev` and custom domains use
the same artifact.

## One-time GitHub setup

Use the existing GitHub environment named `Production`, protect it as
appropriate, and add these environment secrets:

| Secret | Source | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Tokens | Deploy Workers Scripts. Scope it to the target account. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard | Selects the target Cloudflare account. |
| `CONVEX_DEPLOY_KEY` | Convex production deployment settings | Deploys backend functions non-interactively. |
| `WORKOS_API_KEY` | WorkOS dashboard | Performs server-side authentication calls. |
| `PRIVATE_KEY` | Existing RSA private key | Encrypts the `/auth` handoff payload. Preserve newlines in the GitHub secret. |

Never add these values to `wrangler.jsonc`, `.env.example`, workflow YAML, or a
committed `.env` file.

The Cloudflare token needs Worker Scripts edit permission. It does not need
account-wide administrator permissions. The Convex key should be a production
deploy key with `deployment:deploy` permission.

## Automated deployment

The initial Worker and Custom Domain have already been deployed. To enable
future Worker deployments from GitHub, add the remaining
`CLOUDFLARE_API_TOKEN` secret to the `Production` environment. Until it exists,
the workflow reports a notice and skips only the Worker deployment; verification
and the Convex deployment continue to run.

1. Add or verify the five GitHub environment secrets above.
2. Confirm that the WorkOS production application allows:
   - callback URL `https://planner.quextro.com/auth/callback`
   - logout return URL `https://planner.quextro.com`
3. Push to `main`, or run the `Verify and deploy` workflow manually.
4. Open the deployment URL from the Cloudflare step and test login, token
   refresh, logout, and a Convex-backed planner edit.

The workflow deploys Convex first. This prevents a new frontend from calling
backend functions that have not been published yet. The Worker deployment then
uploads `WORKOS_API_KEY` and `PRIVATE_KEY` as Cloudflare secrets in the same
operation.

## Local Wrangler deployment

GitHub Actions is the normal production path. For an authenticated emergency
deployment from a trusted workstation:

```sh
bun install --frozen-lockfile
bun run check
bun run deploy:dry-run
bunx wrangler whoami
bun run deploy
```

Set secrets interactively if they have not been uploaded for this Worker:

```sh
bunx wrangler secret put WORKOS_API_KEY
bunx wrangler secret put PRIVATE_KEY
```

Do not paste secret values into command arguments or shell history.

## Updating infrastructure

- After changing `wrangler.jsonc`, run `bun run cf:types` and commit
  `worker-configuration.d.ts`.
- Keep `compatibility_date` current and run the complete verification suite
  before committing an update.
- Add non-secret Worker bindings and variables to `wrangler.jsonc`.
- Add secret names to the deployment workflow and their values to the protected
  GitHub environment.
- Update Convex functions and schema under `src/convex`; the workflow publishes
  them before the Worker.

## Operations and rollback

Stream production logs:

```sh
bun run cf:tail
```

List and inspect recent Worker versions:

```sh
bunx wrangler versions list
bunx wrangler versions view <VERSION_ID>
```

Rollback the Worker:

```sh
bunx wrangler rollback <VERSION_ID>
```

A Worker rollback does not roll back Convex schema or functions. If a release
changes both sides incompatibly, revert the Git commit and run the GitHub
workflow so both are deployed from the same source revision.

The former Worker `quextro-planner` should remain available until authentication
and planner writes have been verified on the Custom Domain. It can then be
removed explicitly with `bunx wrangler delete quextro-planner`; deletion is not
part of the automated workflow.

## Secret rotation

Update a GitHub environment secret and rerun the workflow. Wrangler replaces
the matching Worker secret without exposing its value in logs. When rotating
the RSA key, update the consumer of the matching public key before switching
`PRIVATE_KEY`, or deploy a compatibility window that accepts both keys.
