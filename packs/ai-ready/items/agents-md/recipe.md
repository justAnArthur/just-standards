## Done when
The check passes on the PR's branch: `AGENTS.md` (or `CLAUDE.md`) at the root shows, as commands in code, how to install, run, build, test and lint, one for each script `package.json` has, and each command works as written.

## Make what is missing
Write it from the repo, not from memory:
- **Commands:** read `package.json` scripts, the lockfile (`bun.lock`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`), `Makefile`, `.github/workflows/*` and the Dockerfile. List install, dev, build, typecheck, lint and test, each as a fenced or inline command (`pnpm install`, `pnpm run dev`…). Run each one you list that needs no secret, and fix the line if it doesn't work.
- **Where things live:** one line per top-level folder that matters (routes, components, CMS config, content, scripts).
- **Rules of the house:** what the repo's config enforces (formatter, lint rules, commit style from `commitlint` or the history, branch and PR rules from the workflows), the env vars needed to run (point at `.env.example`).
- Keep `CLAUDE.md` as `@AGENTS.md` (Claude Code imports it), so both agents read one file.

## Stacks
- **Next.js:** dev server port, where `app/` is, `next.config` flags that matter (cacheComponents).
- **Payload + Next:** how to start the admin (`/admin`), migrate (`payload migrate`), seed, and regenerate types and the import map.
- **Monorepo:** the root commands, and how to run one package (`--filter`).

## Hand off only when
Never: everything needed is in the repo.

## Don't
- Don't list a command you didn't see in the repo or didn't run.
- Don't paste the README: say what an agent needs, briefly.
- Don't overwrite a toolkit-owned `.github/AGENTS.md`; write the root file.
