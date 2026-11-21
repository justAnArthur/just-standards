## Done when
The check passes on the PR's branch, and the app's build, lint and tests run as the repo's AGENTS.md says: nothing the installed Next major removed is left in `next.config`, the source or the package.json scripts, and what it did is done the supported way.

## Make what is missing
Each hit names what was removed; replace it as the upgrade guide for that version says:
- **`next lint` in a script (16):** `npx @next/codemod@canary next-lint-to-eslint-cli .`, or call `eslint .` (or `biome check`) directly. `next build` no longer lints, so CI runs the lint script itself.
- **`eslint` in next.config (16):** delete the option.
- **`serverRuntimeConfig` / `publicRuntimeConfig` / `next/config` (16):** read `process.env.X` on the server and `process.env.NEXT_PUBLIC_X` in the client; `await connection()` before reading a value that must come at runtime rather than build time.
- **`experimental.ppr`, `dynamicIO`, `useCache`, `experimental_ppr` (16):** delete them. Turn on `cacheComponents` only if the app adopted Cache Components (it is not a rename: it changes what the build rejects).
- **`revalidateTag('tag')` (16):** `revalidateTag('tag', 'max')`, or `updateTag('tag')` in a Server Action that must show the change at once.
- **A parallel route slot without `default.js` (16):** add `default.tsx` to the slot returning `null` (or calling `notFound()`).
- **A webpack config under Turbopack (16):** move what it does to the top-level `turbopack` option (`turbopack.rules`, `turbopack.resolveAlias`); if a plugin can't be moved, build with `next build --webpack` and say why in the PR.
- **`unstable_rootParams` (16):** `next/root-params`. **AMP (16):** remove it; the pages stay as they are.
- **`viewTransition` (16.3), `appNewScrollHandler` (16.4), the removed `devIndicators` options:** delete them.
- **`@next/font` (15):** import from `next/font/google` or `next/font/local`, and drop the package.
- **`runtime = 'experimental-edge'` (15):** `'edge'` (or delete it; Node.js is the default).

## Stacks
- **Payload + Next:** `withPayload` keeps working without the removed options; upgrade `payload` and `@payloadcms/*` with Next.
- **next-intl:** `createNextIntlPlugin` adds nothing the check reads.

## Hand off only when
A plugin the build needs only works through a webpack config and has no Turbopack equivalent: build with `--webpack`, name the plugin in the PR.

## Don't
- Don't pin `next` back to an older major to make the check pass.
- Don't keep a removed option "for later": it does nothing or fails the build.
