## Done when
The check passes on the PR's branch: the committed lockfile pins no package version with a critical or high advisory in OSV, and the repo's own typecheck, lint, tests and build pass with the new versions.

## Make what is missing
The evidence names each `package@version → advisory severity, fixed in X`. For each:
1. **Find who pulls it in:** `bun pm why <name>`, `pnpm why <name>`, `npm explain <name>` or `yarn why <name>`.
2. **A direct dependency:** raise it in `package.json` to the fixed version, staying within the same major (`^1.4.2` → `^1.4.9`), and reinstall so the lockfile changes with it.
3. **A transitive one:** first upgrade the direct dependency that brings it in, within its major, to a release that depends on a fixed version. Only when no such release exists, pin the transitive one: `overrides` (npm, Bun), `pnpm.overrides`, or `resolutions` (Yarn), to the fixed version within its major, with a comment naming the advisory.
4. **Reinstall with the repo's package manager** (the one whose lockfile is committed), so only the lockfile and `package.json` change.
5. **Run the repo's typecheck, lint, tests and build** (as `AGENTS.md` / `package.json` say), and read the changelog of every major-version-adjacent bump for breaking notes.
6. Read the advisory (`https://osv.dev/vulnerability/<id>`) when the fix needs more than a version (a config flag, a removed API).

## Stacks
- **Next.js:** a Next advisory is fixed by the latest patch of the same minor line (`next@15.1.x`); keep `eslint-config-next` on the same version.
- **Payload:** all `@payloadcms/*` packages move together to one version.
- **Monorepo:** raise it where it is declared (the workspace's `package.json`), and in the root `overrides` only when several workspaces need it.

## Hand off only when
The only fixed version is a new major (or there is none yet), and moving to it changes the app's behaviour beyond what its tests cover: name the package, the advisory, and what the major changes.

## Don't
- Don't delete and regenerate the whole lockfile: it moves hundreds of packages at once. Upgrade the named ones.
- Don't cross a major version in this change unless that is the only fix (then see the hand-off).
- Don't remove the lockfile, or switch package managers, to make the check pass.
