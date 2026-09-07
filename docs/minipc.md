# princhman-minipc checkout

GitHub is the canonical source for this project. `princhman-minipc` contains a
normal checkout of the private `princhman/planner` repository; source code must
not be copied between machines with `scp`, shared folders, or untracked archive
files.

## Initial checkout

The machine already has an SSH key authorized for the `princhman` GitHub
account. Clone into the standard projects directory:

```sh
mkdir -p ~/Projects
git clone git@github.com:princhman/planner.git ~/Projects/planner
cd ~/Projects/planner
bun install --frozen-lockfile
```

The required Bun version is declared by `packageManager` in `package.json`.
Install Bun from its official installer if `bun --version` is unavailable, then
open a new shell before installing dependencies.

## Updating the checkout

Keep the checkout reproducible and avoid machine-only source changes:

```sh
cd ~/Projects/planner
git status --short
git pull --ff-only
bun install --frozen-lockfile
bun run check
```

Commit changes on a branch and push them to GitHub. Production deployment is
performed by `.github/workflows/deploy.yml` after changes reach `main`; the mini
PC does not need persistent Cloudflare, Convex, or WorkOS production credentials.

## Local development secrets

`.env.local`, `.dev.vars`, private keys, build output, and Wrangler state are
ignored by Git. If local authentication is required, create `.env.local` from
`.env.example` and obtain development-only values through the team secret
channel. Never copy the production GitHub environment secrets into the checkout.

## Recovery

The checkout is disposable. If it becomes inconsistent, preserve any intentional
commits by pushing them, move the checkout aside, and clone the GitHub repository
again. Convex data and Cloudflare deployments are remote services and are not
stored on this machine.
