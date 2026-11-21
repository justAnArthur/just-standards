## Done when
The check passes on the PR's branch, and on the preview each third-party script still loads (once per visit, not again on client navigation) and does what it did: no component renders a `<script src>` or an inline analytics or pixel snippet; they go through `next/script` with a `strategy`.

## Make what is missing
- **`<script src="…">`:** `import Script from 'next/script'`, then `<Script src="…" strategy="afterInteractive" />` (the default) in the layout or page that needs it. `lazyOnload` for chat widgets and anything not needed at first paint; `beforeInteractive` only for what must run before hydration (a consent manager), in the root layout.
- **Inline snippets** (GA, GTM, Meta Pixel): `<Script id="…">{`…`}</Script>`; an inline script needs an `id`. For Google Analytics and Tag Manager prefer `@next/third-parties/google` (`<GoogleAnalytics gaId>`, `<GoogleTagManager gtmId>`).
- **Load it where it's used:** a script one page needs goes in that page or its layout, not the root layout.
- Keep the consent gating the site has: a tag that waited for consent still waits.
- Keep the `nonce` the CSP gives: `<Script nonce={nonce}>` forwards it.

## Stacks
- **Next.js App Router:** `next/script` works in Server Components; `onLoad`, `onReady` and `onError` need a Client Component.
- **Payload + Next:** scripts set in a CMS global (a "head scripts" field) render through one component; change that component.

## Hand off only when
Never: the scripts and their IDs are in the repo.

## Don't
- Don't move JSON-LD (`type="application/ld+json"`) into next/script: data is fine as a plain `<script>`.
- Don't use `strategy="worker"` in the App Router: the docs say it doesn't work there yet.
