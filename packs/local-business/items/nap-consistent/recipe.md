## Done when
The check passes on the PR's preview: the business name, each location's street address and every phone number in the JSON-LD also appear in the visible text of the footer, the contact page or the location's page, written the same way (formatting aside).

## Make what is missing
- Render the text and the JSON-LD from one source (the branch data, the company settings), so they can't drift.
- When the JSON-LD and the text disagree, the business context decides; if it says nothing, the contact page's text does. Change the other to match.
- Show each location's address and phone in the HTML as served on its page and on the contact page, not only inside a client-side map or listbox.
- If the JSON-LD has no telephone or address at all, fix `local-business/locations-schema` first.

## Stacks
- **Next.js:** one typed `branches` / `company` module read by the footer, the contact page and the JSON-LD builder.
- **Payload + Next:** a `company` global and a `branches` collection read by the footer, the pages and the JSON-LD.
- **Astro / static:** one data file read by the layout and the JSON-LD.

## Hand off only when
The site and the business context give two different addresses or phone numbers for the same location and nothing says which is right.

## Don't
- Don't delete a phone or address from the JSON-LD to make the check pass; show it in the text instead.
- Don't hard-code one site's phone into shared code that serves several sites.
