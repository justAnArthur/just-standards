## Done when
The check passes on the PR's preview: the rental terms, FAQ, fees or cover pages linked from the home page state, in plain text: the minimum driver age, the deposit (its amount or how it is set), the insurance and its excess, the fuel policy, the mileage limits, the rules for travel abroad, and cancellation.

## Make what is missing
- Find each missing term in the site's own documents first: the general terms (VOP), the rental contract summary, the fees page, the booking engine's text in the repo. Quote or restate it on the rental terms or FAQ page, in each language the site has.
- Add an FAQ entry per missing term, with the answer taken from those documents or the business context.
- Link the rental terms page and the FAQ from the footer of every page and from the booking flow.

## Stacks
- **Next.js / Payload:** the terms and FAQ as CMS entries rendered on the server.
- **Astro / static:** Markdown pages in the content folder.

## Hand off only when
A term (the minimum age, the deposit, the excess, the fuel or mileage policy, cross-border rules, cancellation) is stated nowhere on the site, in its documents or in the business context: that is a business decision.

## Don't
- Never invent a rule, an amount or an age; a wrong term binds the business.
- Don't put the terms only in a PDF or an image.
