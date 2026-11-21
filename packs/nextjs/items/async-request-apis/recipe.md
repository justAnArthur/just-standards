## Done when
The check passes on the PR's branch and the app builds: every `page`, `layout`, `route`, `default` and metadata image file awaits `params` and `searchParams` (or unwraps them with React's `use` in a Client Component), every `cookies()`, `headers()` and `draftMode()` from `next/headers` is awaited, no `UnsafeUnwrapped*` cast is left, and the pages render what they did before.

## Make what is missing
- Run the official codemod first, from the app's folder: `npx @next/codemod@canary next-async-request-api .`. Then fix what it leaves: its `@next-codemod-error` comments and `UnsafeUnwrapped` casts.
- **Server Components, `generateMetadata`, route handlers:** make the function `async`, type the prop as a Promise (`params: Promise<{ slug: string }>`, or the generated `PageProps<'/blog/[slug]'>`, `LayoutProps`, `RouteContext` helpers from `next typegen`), and `const { slug } = await params`.
- **Client Components** (`'use client'` pages): `const { slug } = use(params)` with `use` from React.
- **`cookies()` / `headers()` / `draftMode()`:** `const store = await cookies()`, then `store.get('…')`. A helper that reads them becomes `async`, and its callers await it.
- **Next 16 metadata images** (`opengraph-image`, `icon`…): their `params` and `id` are Promises too; `generateImageMetadata` and a nested `generateStaticParams` still get plain params.

## Stacks
- **next-intl:** `const { locale } = await params` in layouts and `generateMetadata`, then `setRequestLocale(locale)`.
- **Payload + Next:** the generated `(payload)` admin files already follow this; only the site's own `(frontend)` files need it.

## Hand off only when
Never: everything needed is in the repo.

## Don't
- Don't cast to `UnsafeUnwrapped*` or `as any` to silence the types: 16 removed the sync access they stood for.
- Don't await inside a `'use cache'` function: read the values outside and pass them in as arguments.
