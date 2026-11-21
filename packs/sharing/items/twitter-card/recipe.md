## Done when
The check passes on the PR's preview, and a link on X shows a full-width picture with the title: the home page has `<meta name="twitter:card" content="summary_large_image">`. X takes the title, description and image from Open Graph when `twitter:title`, `twitter:description` and `twitter:image` are absent.

## Make what is missing
Nothing to make: the card uses the `og:image` (see `website/og-image` and `sharing/og-image-size`). Add `twitter:site` only when the site links to its own X account.

## Stacks
- **Next.js:** `metadata.twitter = { card: 'summary_large_image' }` in the root layout; a page that sets its own `twitter` object repeats `card`.
- **Payload + Next:** the same in `generateMetadata`; no CMS field is needed.
- **Astro / static:** the `<meta>` tag in the layout's `<head>`.

## Hand off only when
Never.

## Don't
- Don't use `property="twitter:card"`: X reads `name=`.
- Don't set `summary_large_image` while the `og:image` is a small logo: fix the image too, or the card shows a blurry, cropped logo.
