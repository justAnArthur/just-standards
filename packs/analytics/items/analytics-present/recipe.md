## Done when
The check passes on the PR's preview: the home page's HTML loads a known analytics tool (Umami, GA4 or GTM, Plausible, Matomo, Fathom, Simple Analytics, PostHog, Vercel Analytics), either directly or as a consent-gated placeholder (`<script type="text/plain" data-category="analytics">`) that the consent manager runs after the visitor agrees.

## Make what is missing
- Use the tool the business already uses on its other sites (the business context, or a sibling site in the same repo), with its existing instance (a self-hosted Umami, the GTM container).
- Add it once in the root layout so every page gets it, with its site or website ID from an environment variable. A cookie-free tool (Umami, Plausible, Fathom, Simple Analytics) may load directly; GA4, GTM and PostHog wait for consent.
- Put the new variable in `.env.example`.

## Stacks
- **Next.js:** `next/script` in `app/layout.tsx` (`strategy="afterInteractive"`), `@next/third-parties/google` for GA4 or GTM, or `@vercel/analytics`. Note: `@vercel/analytics` injects its script on the client, so the check may not see it; prefer a loader the HTML carries.
- **Astro / static:** a `<script>` in the base layout.

## Hand off only when
The tool needs an account or a site ID that is neither in the repo, its env files, nor the business context.

## Don't
- Don't load GA4, GTM or another cookie-setting tool before consent (that is `eu-consumer/cookie-consent`).
- Don't add a second tool next to one that is already there.
- Don't hard-code a production ID that preview deployments would then pollute; read it from the environment.
