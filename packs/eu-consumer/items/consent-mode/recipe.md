## Done when
The check passes on the PR's preview: on a page with Google tags (gtag.js, GTM), before any choice, `gtag('consent', 'default', …)` sets `ad_storage`, `analytics_storage`, `ad_user_data` and `ad_personalization` to `denied` before the first `config`, and any Google Analytics hit sent before a choice carries `gcs=G100`. After the visitor accepts, the CMP sends `gtag('consent', 'update', …)` with what they granted.

## Make what is missing
Put the default first in `<head>`, before the GTM or gtag snippet:
```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500 });
</script>
```
Then make the consent manager call `gtag('consent', 'update', { … })` with the visitor's choice (most CMPs have a Consent Mode v2 switch: Cookiebot, CookieYes, Complianz, Usercentrics). With GTM, the CMP's community template on the Consent Initialization trigger sets the same defaults.

## Stacks
- **Next.js:** a `<Script id="consent-default" strategy="beforeInteractive">` in the root layout, before `GoogleTagManager` / `GoogleAnalytics` from `@next/third-parties`.
- **Payload + Next:** the same; the GTM ID can come from a site-settings global, the defaults stay in code.
- **Astro / static:** an inline script first in the base layout's `<head>`.

## Hand off only when
Never for the code. Which signals the visitor's categories map to is in the CMP's documentation.

## Don't
- Don't default any signal to `granted` "for the EU only later": the default is what runs before the choice.
- Don't set v1 signals only (`ad_storage`, `analytics_storage`): Google Ads needs `ad_user_data` and `ad_personalization` too.
- Don't place the default after the GTM snippet or in a tag GTM fires later.
