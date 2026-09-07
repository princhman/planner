# Quextro Planner

SvelteKit application deployed as a Cloudflare Worker, with Convex providing the
database and realtime backend and WorkOS providing authentication.

## Development

Requirements: Bun 1.2.4 or newer and access to the Quextro Convex project.

```sh
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

Run Convex in a second terminal when changing backend functions:

```sh
bun run dev:convex
```

Useful checks:

```sh
bun run check
bun run deploy:dry-run
bun run dev:worker
```

`bun run dev` gives the fastest SvelteKit development loop. `bun run
dev:worker` builds first and serves the generated Worker through Wrangler, so it
is the closer local approximation of production.

## Deployment

Production deploys are defined in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). A push to `main`
first verifies the generated Worker, then deploys Convex and Cloudflare in that
order. Pull requests run the same checks without changing either platform.

The complete setup, required GitHub secrets, first-deploy steps, rollback
commands, and authentication configuration are in
[`docs/deployment.md`](docs/deployment.md).

Instructions for cloning and maintaining the checkout on `princhman-minipc` are
in [`docs/minipc.md`](docs/minipc.md).

Cloudflare configuration lives in [`wrangler.jsonc`](wrangler.jsonc). Do not
put credentials in that file; production secrets are uploaded from GitHub
Actions.
