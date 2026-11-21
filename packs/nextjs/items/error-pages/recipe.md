## Done when
The check passes on the PR's branch, and on the preview an unknown URL answers 404 with the site's own page (logo, a line saying the page isn't there, a link home), while a thrown error in a page or the root layout shows the site's own error page with a way to retry: `app/not-found` (or `app/global-not-found`) and `app/global-error` exist, and every `error` and `global-error` file is a Client Component.

## Make what is missing
- **`app/not-found.tsx`:** a Server Component with the site's header or logo, the heading and text from the site's own copy (its dictionary, CMS or content files, in every locale it has), and `<Link href="/">` home. Export `metadata` with a title. It renders inside the root layout, so it gets its styles and fonts.
- **Several root layouts, or a root layout under `[locale]`:** `app/global-not-found.tsx` instead, with `experimental.globalNotFound: true` in next.config. It renders on its own: import the global CSS and font, and return `<html lang>` and `<body>`.
- **`app/global-error.tsx`:** `'use client'`, its own `<html>` and `<body>` (it replaces the root layout), the brand's colours inline or from the global CSS import, a short apology and a button calling `retry()` (Next 16.3+; `reset()` before).
- **Route-level `error.tsx`** where a segment fetches data that can fail (a booking flow, a CMS page): `'use client'`, the same `retry()` button.

## Stacks
- **next-intl:** `app/[locale]/not-found.tsx` handles `notFound()` inside locales; the root `app/not-found.tsx` (or `global-not-found`) is still needed for URLs no route matches. Read the locale with `next/root-params` or fall back to the default locale.
- **Payload + Next:** the `(payload)` admin keeps its own not-found; add the site's in `(frontend)`, and `global-not-found` because the app has two root layouts.

## Hand off only when
Never: the copy comes from the site's own content and dictionary.

## Don't
- Don't export `metadata` from `global-error`: it's a Client Component; use React's `<title>`.
- Don't make the root not-found a Client Component: Next sends it with every page.
- Don't answer 200 for a missing page to show the branded page.
