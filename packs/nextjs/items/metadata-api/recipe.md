## Done when
The check passes on the PR's branch: no file in `app/` writes `<head>`, `next/head`, `<meta name|property>` or a page `<title>` by hand, the root layout (or each page) exports `metadata` or `generateMetadata`, and the served HTML carries the same title, description and tags as before.

## Make what is missing
- **Static tags in the root layout:** move them into `export const metadata: Metadata = { title: { default, template }, description, openGraph, twitter, robots, icons, alternates }`. `metadataBase` makes relative image URLs absolute.
- **Per page:** `export async function generateMetadata({ params })` reading the same data the page reads (the call is deduplicated).
- **`<meta name="viewport">` and `theme-color`:** `export const viewport: Viewport`.
- **Verification tags** (Google, Bing): `metadata.verification`.
- **Scripts in `<head>`:** `next/script` with the right `strategy`, in the layout's body.
- **JSON-LD** stays a `<script type="application/ld+json">` in the page: that one is right by hand.

## Stacks
- **Next 15–16:** a page's `openGraph` replaces the layout's whole object: repeat the layout's `images` (and `videos`) on pages that set their own.
- **Payload + Next:** read the SEO fields (the plugin's `meta` group) in `generateMetadata`, with the site settings global as the fallback.
- **Pages router** (`pages/`): `next/head` is its API; the check only reads `app/`.

## Hand off only when
Never: everything needed is in the repo.

## Don't
- Don't keep a `<head>` in the root layout "for one tag": Next renders its own and merges.
- Don't drop a tag while moving it: diff the served HTML's `<head>` before and after.
