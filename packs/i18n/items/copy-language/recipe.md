## Done when
The check passes on the PR's preview: on every language version, the visible text (headings, copy, buttons, menus, form labels, the footer, alt text) is in the page's declared language, and text in languages with diacritics (Slovak, Czech, Faroese) is written with them.

## Make what is missing
- **Untranslated strings:** find where each quoted string comes from: a hard-coded string in a component, a translation file missing the key (falling back to another language), or a CMS entry not localized. Put the string in the translation files or the CMS locale, and translate it from the site's own wording in the other language, in the site's voice and with its terms.
- **Missing diacritics:** correct the text at its source, in every place it appears (the CMS entry, the translation file); keep URL slugs as they are.
- Translate only what the site already says; never add claims.

## Stacks
- **Next.js:** messages in `messages/<locale>.json` (next-intl) or the dictionaries the `[locale]` layout loads; components call `t()` rather than embedding text.
- **Payload / Strapi:** localized fields (`localized: true`) and the entry filled in for every locale.
- **Astro:** content collections per locale, or the i18n dictionary.

## Hand off only when
The text is legal wording (terms, privacy) whose translation the business must approve: add it as a draft in the PR and say so.

## Don't
- Don't machine-translate brand names, product names or legal entity names.
- Don't strip diacritics from slugs or IDs in the same change: that breaks links.
