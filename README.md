# Planner

SvelteKit frontend with a Convex backend for synced planner data.

## Local development

Install dependencies:

```sh
pnpm install
```

Start the frontend:

```sh
pnpm dev
```

Start Convex in a separate terminal:

```sh
pnpm dev:convex
```

When `pnpm dev:convex` starts for the first time, copy the deployment URL it prints and add it to `.env.local`:

```sh
PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

Then restart the frontend dev server so Vite picks up the env var.

## How Convex is enabled

Convex is considered available when both of these are true:

1. `PUBLIC_CONVEX_URL` is set in the frontend environment.
2. The generated Convex API exists, which is created by running `pnpm dev:convex`.

If a user is signed in and Convex is available, the app now boots directly into the Convex-backed repository. Otherwise it falls back to the local browser repository.


Compress video command:
