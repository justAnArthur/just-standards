## Done when
The check passes on the PR's preview, and every page in the sitemap has a `<meta name="description">` of 70–160 characters that says what that page offers, different from every other page's.

## Make what is missing
- Write each from the page's own content: one or two plain sentences on what a visitor finds or can do there, in the page's language.
- **Collections:** a template per collection built from the document's facts (a car's class, seats and transmission from the fleet data; a branch's city and hours; a post's summary or first paragraph, shortened to a sentence). A CMS SEO description, when set, wins.
- **Too short:** a booking or account page's "Manage your booking" becomes what the visitor can do there and with what (the reservation number, the email).
- **Too long:** rewrite to one sentence; don't cut mid-word.

## Stacks
- **Next.js:** `description` in `generateMetadata` per route; the root layout's description is only the fallback, and a fallback on every page is a duplicate.
- **Payload + Next:** `meta.description` from the SEO plugin, falling back to the collection template; make the field part of the editors' form so new documents get one.
- **Astro / static:** a `description` prop on the layout, required.

## Hand off only when
Nothing on this item needs a person: descriptions are written from what each page says.

## Don't
- Put the same site-wide description on every page, or make them unique by appending the URL or the title.
- Claim prices, discounts, ratings or availability the page doesn't state.
- Pad a short description with keywords to reach 70 characters.
