## Done when
The check passes on the PR's preview, and a stranger can tell from the first screen alone what the site offers, to whom, and what to do next: the heading, the line under it and the primary button say it in plain words.

- **Heading:** the product or service in plain words, plus the audience when it fits: `Rental software for independent car-hire fleets`. A slogan that needs the rest of the page to make sense doesn't count.
- **Line under it:** one sentence with the main outcome, in the site's own terms.
- **Primary button:** a specific next step (`Book a car`, `Get a quote`), linked to where it actually goes.

## Make what is missing
Write the copy from facts on the site and in the business context: what it rents or sells, where, to whom. Keep the design; change copy, and the layout only to add a missing line or button, with the design system's own components. Keep every language version in step (Payload locales, i18n files, WPML). In the PR body, put the old and new heading, line and button side by side.

## Stacks
- **Next.js / Payload + Next:** the hero's copy usually lives in the CMS (a hero block or the home page's fields); change it there through a seed or migration only if the repo does content that way, else in the component's fallback copy and say in the PR which CMS fields to update.
- **Astro / static:** the home page's template.

## Hand off only when
The copy lives only in a CMS the worker can't write to, and the repo has no seed or migration for it: ship the code change and give the new copy, per language, in the PR.

## Don't
- Never invent figures, awards or claims the site doesn't support elsewhere.
- Don't remove an opening-hours notice or promotion the business relies on: move it below the line, don't delete it.
- Don't change brand-mandated wording (franchise rules in the business context).
