## Done when
The check passes on the PR's branch, the feature that used each variable still works on the preview, and the browser bundle carries no token or secret: no `NEXT_PUBLIC_` name says SECRET, TOKEN, PASSWORD, PRIVATE or SERVICE_ROLE, and Client Components read only `NEXT_PUBLIC_` variables (or ones next.config's `env` inlines on purpose).

## Make what is missing
- **A secret under `NEXT_PUBLIC_`:** rename it without the prefix (`CMS_API_TOKEN`) everywhere it is read and in every env template, and move each read to the server: a Server Component, a Server Action, a route handler, or a `server-only` data module (`import 'server-only'` at its top). A Client Component that called the API directly calls that route handler or Server Action instead.
- **A server variable read in a Client Component:** read it in the Server Component that renders it and pass the value as a prop, or, if it is public by nature (a site URL, a locale list), rename it `NEXT_PUBLIC_…`.
- Update `.env.example` (and the deploy's env settings, listed in the PR) with the new names.

## Stacks
- **Strapi / headless CMS clients:** the API token belongs to the server-side fetch helper; public pages fetch through Server Components, and client-side search goes through a route handler that adds the token.
- **Payload + Next:** `getPayload()` runs server-side already; keep `PAYLOAD_SECRET` and the database URL unprefixed.

## Hand off only when
Never for the code. A secret that was already deployed under `NEXT_PUBLIC_` is public: name rotating it at its provider as what a person must do, alongside the PR.

## Don't
- Don't keep the old `NEXT_PUBLIC_` name "for compatibility": it still lands in the bundle.
- Don't pass a secret to a Client Component as a prop: that publishes it too.
