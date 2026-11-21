## Done when
The check passes on the PR's branch, the app builds, and each page behaves as before: nothing the installed Next major (or React 19) marks deprecated is used, each replaced by what the docs name.

## Make what is missing
Each hit names the replacement:
- **`<Image priority>` (16):** `preload` keeps the same preloading; `loading="eager"` if the image only must not lazy-load. Keep it on the one LCP image per page.
- **`next/legacy/image` (16):** `next/image`, with `width`/`height` or `fill` and `sizes`; `layout`/`objectFit` props become `style` or classes.
- **`unstable_cacheLife` / `unstable_cacheTag` (16):** import `cacheLife` and `cacheTag` from `next/cache`.
- **`experimental.turbopack` (16):** move the object to the top-level `turbopack`.
- **`runtime = 'edge'`, `preferredRegion` (16):** delete them; Node.js is the default runtime. Edge-only request handling moves to `proxy.ts`.
- **`useFormState` (React 19):** `useActionState` from `react`; it also returns `isPending`.
- **`serverComponentsExternalPackages`, `bundlePagesExternals` (15):** the top-level `serverExternalPackages` and `bundlePagesRouterDependencies`.
- **`onLoadingComplete` (14):** `onLoad`.

## Stacks
- **Payload + Next:** the generated `(payload)` files follow the Payload release; update them by upgrading Payload, not by hand.

## Hand off only when
Never: everything needed is in the repo.

## Don't
- Don't silence the deprecation warning instead of moving off the API.
- Don't change behaviour while renaming: a preloaded image stays preloaded.
