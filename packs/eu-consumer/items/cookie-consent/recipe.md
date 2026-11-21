## Done when
The check passes on the PR's preview: a first-time visitor on a phone who clicks nothing gets no tracker cookie (`_ga`, `_fbp`, `_gcl_*`, `_hj*`, `_clck`, `_uet*`, `_ttp`, `li_*`… or any third party's) and sends nothing to a tracker (Google Analytics and Ads hits, Meta Pixel, Hotjar, Clarity, TikTok, LinkedIn, Bing UET… the list is in `core/trackers.ts`); the banner shows reject on its first layer, as one click, next to accept; and after reject, nothing tracks.

## Make what is missing
- **Trackers before a choice:** every tag waits for consent. With Google tags, set Consent Mode v2 defaults to denied before the tag loads (`eu-consumer/consent-mode`); a hit marked `gcs=G100` is Consent Mode's cookieless ping and passes. Meta Pixel, Hotjar, Clarity, TikTok, LinkedIn and UET load only from the consent callback (or GTM triggers on the consent categories), never from a plain `<script>` in the layout.
- **No reject on the first layer:** configure the consent manager to show "Reject all" (in the page's language: "Odmietnuť všetko", "Alle ablehnen") as a button of the same size and level as "Accept all", not only behind "Settings". Cookiebot: the "Deny" button in the banner template; CookieYes and Complianz: enable "Reject all" on the first layer; a custom banner: add the button, wired to the same store as accept.
- **Tracking after reject:** the reject handler must update consent to denied (`gtag('consent', 'update', …)`) and not load the deferred tags.
- **No banner at all, while tags run:** add the consent manager the repo already uses elsewhere; if none, a small first-party banner component from the design system that stores the choice in a first-party cookie and gates the tags.

## Stacks
- **Next.js:** load tags with `next/script` (`strategy="afterInteractive"`) only after the consent state allows it; `@next/third-parties` `GoogleTagManager` with the Consent Mode defaults set in a `beforeInteractive` script.
- **GTM:** consent settings on every tag (built-in consent checks), the CMP's template on the Consent Initialization trigger.
- **Astro / static:** the CMP's script first in `<head>`, tags as `type="text/plain" data-category="…"` placeholders it activates.

## Hand off only when
The consent manager is a paid account whose settings the repo can't change: say exactly which switch (first-layer reject) to turn on.

## Don't
- Don't make reject a faint text link while accept is a button, and don't pre-tick categories.
- Don't drop analytics to pass: `analytics/analytics-present` still wants it, after consent.
- Don't detect the check's browser and behave differently.
