## Done when
The check passes on the PR's preview: the business's name, its address, phone number and (when it serves customers at set times) its opening hours are in the visible text of the home page or the contact page, and the JSON-LD says the same.

## Make what is missing
- Take the facts from the business context, the site's own contact page and its existing JSON-LD. Put them in the footer (name, address, phone) and the contact page (each branch with its address, phone and hours), as text, not as an image or only inside a map embed.
- Make the JSON-LD (`Organization`, `LocalBusiness` or a subtype such as `AutoRental`) carry the same name, `address`, `telephone` and `openingHoursSpecification`, generated from the same data the page renders, so they cannot drift.
- Where text and JSON-LD disagree, the business context decides; if it says nothing, the text the visitor sees wins.

## Stacks
- **Next.js / Payload:** one settings global or config file holds the facts; the footer, the contact page and the JSON-LD all read it.
- **Astro / static:** a data file (`src/data/business.json`) read by the layout and the JSON-LD component.

## Hand off only when
An address, phone or set of hours is neither on the site nor in the business context, or two sources disagree and the context does not say which is right.

## Don't
- Never invent an address, a phone number or hours.
- Don't put the facts in JSON-LD only: the check reads the visible text.
- Don't change a fact on one page only; every page that states it reads the same source.
