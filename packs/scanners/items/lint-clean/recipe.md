## Done when
The check passes on the PR's branch: the repo's `lint` script exits 0 on a fresh install of the committed code, and nothing else changed behaviour (typecheck, tests and build still pass).

## Make what is missing
- **No `lint` script:** add one that runs the linter the repo already configures (`biome.json` → `"lint": "biome check"`, `eslint.config.*` → `"lint": "eslint ."`). With neither, add the one `AGENTS.md` or the stack names, with its recommended config, and fix what it reports.
- **It fails:** the evidence names the first errors as `file:line message (rule)`. Run the script yourself to see them all. Fix the code, not the rules: an unused variable is removed, a missing dependency in a hook is added (or the effect restructured), an `any` gets a real type.
- **Autofix first:** `biome check --write` or `eslint . --fix` fixes the formatting and the safe rules in one pass; review the diff before committing it, and commit it apart from hand fixes.
- **A rule that is wrong for the repo** (it fights the framework, a generated folder is linted): change the config with a comment saying why, or ignore the generated folder (`.next/`, `dist/`, `payload-types.ts`, `importMap.js`). Never by disabling the rule for the whole repo to make the errors disappear.
- **The lint script itself is broken** (`next lint` is gone in Next 16): replace it with the linter it wrapped (`eslint .` with `eslint-config-next`).

## Stacks
- **Next.js 16:** `next lint` was removed; use `eslint .` with the flat config `eslint-config-next` exports.
- **Biome:** `biome check` lints and checks formatting; a formatting-only failure is fixed by `biome check --write`.
- **Monorepo:** the root `lint` runs each workspace's; fix in the workspace the error names.

## Hand off only when
Never: the errors and the fixes are in the repo.

## Don't
- Don't add `eslint-disable` / `biome-ignore` comments to silence errors, except one line with a reason where the rule is provably wrong there.
- Don't make the lint script lint less (narrower globs, `|| true`, `--max-warnings` games) to pass.
- Don't mix a mass reformat with behaviour changes in one commit.
