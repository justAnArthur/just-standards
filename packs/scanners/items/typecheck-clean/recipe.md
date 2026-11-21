## Done when
The check passes on the PR's branch: the repo's typecheck (its `typecheck` script, else `tsc --noEmit`) exits 0 on a fresh install of the committed code, and lint, tests and build still pass.

## Make what is missing
- **No typecheck script:** add `"typecheck": "tsc --noEmit"` to `package.json` (Next.js: `"next typegen && tsc --noEmit"`, so route types exist on a fresh clone). The check falls back to `tsc --noEmit` without one, but a script is what workers and CI run.
- **It fails:** the evidence names the first errors as `file:line TSxxxx message`. Run the typecheck yourself to see them all, and fix the types at their source: a wrong prop, a missing null check, an outdated call after a dependency upgrade.
- **Generated types** (Payload's `payload-types.ts`, Next's route types, a GraphQL codegen) that are missing on a fresh clone: generate them in the typecheck script (`payload generate:types`, `next typegen`) or commit them, as the repo already does for the others.
- **Errors only in a dependency's types:** `skipLibCheck: true` is the usual setting; otherwise upgrade the `@types/*` package that disagrees.

## Stacks
- **Next.js:** `next build` typechecks too, but with `typescript.ignoreBuildErrors` it doesn't; this check catches what that hides.
- **Monorepo:** each workspace's tsconfig is checked by its own `check`/`typecheck` script; fix in the workspace the error names.

## Hand off only when
Never: the errors and their fixes are in the repo.

## Don't
- Don't add `// @ts-ignore`, `// @ts-expect-error` or `as any` to silence errors, except one line with a reason where the types are provably wrong (a library bug, with a link).
- Don't loosen `tsconfig.json` (`strict: false`, `noImplicitAny: false`, narrower `include`) to pass.
- Don't turn on `typescript.ignoreBuildErrors` or similar.
