## Done when
The check passes on the PR's branch, and the repo's lint script runs clean (or with only the warnings it had): the app has an `eslint.config.mjs` built on `eslint-config-next/core-web-vitals` (plus `eslint-config-next/typescript` in a TypeScript app), or a Biome config with its linter on, and `package.json` has a `lint` script that runs it.

## Make what is missing
- **No linter:** `eslint` and `eslint-config-next` (the same version as `next`) as dev dependencies, and the docs' flat config:
  `import nextVitals from 'eslint-config-next/core-web-vitals'`, `import nextTs from 'eslint-config-next/typescript'`, `export default defineConfig([...nextVitals, ...nextTs, globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts'])])`. Add `"lint": "eslint ."`.
- **An ESLint config without Next's rules:** spread `nextVitals` first in it; keep the repo's own rules after it.
- **Prettier in the repo:** add `eslint-config-prettier/flat` last, so formatting rules don't fight.
- Run the lint script. Fix what it reports that the change introduced; for existing violations, keep them as warnings and list the count in the PR rather than rewriting unrelated code.

## Stacks
- **Biome repos:** keep Biome; its `next` and `react` domains turn on by themselves when `next` is a dependency. Don't add ESLint beside it.
- **Monorepos:** a shared config package is fine when it builds on `eslint-config-next`; set `settings.next.rootDir` to the app's folder.

## Hand off only when
Never: everything needed is in the repo and on npm.

## Don't
- Don't turn rules off to make the lint pass.
- Don't put the lint back into `next build`: it no longer runs there; CI runs the lint script.
