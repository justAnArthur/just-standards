## Done when
The check passes on the PR's preview, and no sampled page shows filler text (Lorem ipsum), a to-do (TODO, FIXME), an unfilled template (`{{name}}`, `{name}`, `${x}`), a code value rendered as text (`undefined`, `null`, `NaN`, `[object Object]`) or a link built from one (`/cars/undefined`), or a "coming soon" / "under construction" section.

## Make what is missing
- **Find where each leftover comes from** (the evidence names the page and quotes the text): a CMS entry, a translation file, a component.
- **A code value as text:** the data is missing or arrives under another name. Fix the field mapping, and render nothing (or the section without that line) when the value is absent: `price != null && …`, not a string of `undefined`. A `NaN` price usually means a string was parsed as a number with a comma decimal (`"22,50"`).
- **An unfilled template:** the variable isn't passed to the translation (`t('hello', { name })`) or the CMS text holds a token nothing replaces.
- **Filler, to-dos, "coming soon":** write the real text from facts on the site and in the business context, in the site's language and voice. When there is nothing true to say yet, remove the section; don't ship a "coming soon".

## Stacks
- **Next.js / React:** guard optional values in JSX; `next-intl` and `i18next` report missing interpolation values in development.
- **Payload / Strapi:** required fields on the collection, so an entry can't be published half-filled.
- **Astro / static:** the same guards in the components.

## Hand off only when
The missing text is a business fact (a price, an address, an opening date) found neither on the site nor in the business context: ask with the exact place it goes.

## Don't
- Don't replace a placeholder with made-up facts.
- Don't hide a section with CSS: remove it or fill it.
