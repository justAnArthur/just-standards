## Done when
The check passes on the PR's preview: the home page, the FAQ, the terms or the pricing page answer in plain text all but at most two of the eight questions a customer of this kind of business asks (for a rental: deposit, minimum age, insurance and excess, cross-border travel, fuel policy, mileage, payment cards, cancellation).

## Make what is missing
- Read the check's evidence for the unanswered questions.
- Find each answer in what the site and the repo already hold: the rental terms (VOP), the fees page, the booking engine's settings, the business context. Write it as an FAQ entry: the question as a customer would ask it, then a two- or three-sentence answer that quotes the rule (amounts, ages, limits).
- Put the entries on the FAQ page (create `/faq` linked from the footer and the main menu if there is none), with `FAQPage` JSON-LD built from the same entries.
- Keep every language version in step.

## Stacks
- **Next.js / Payload:** an `faq` collection or a block on the FAQ page, rendered on the server; the JSON-LD comes from the same data.
- **Astro / static:** a content collection or a Markdown page.

## Hand off only when
A rule (the deposit amount, the minimum age, the cancellation fee) is neither on the site, in its terms, nor in the business context.

## Don't
- Never invent a rule, an amount or a limit; an answer that is wrong is worse than none.
- Don't hide the answers in an accordion that renders only on the client (see `ai-visibility/server-rendered`).
