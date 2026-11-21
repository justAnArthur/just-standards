## Done when
The check passes on the PR's preview: the home page, as served (before JavaScript), carries the booking search with a pick-up place field and date fields, or a clear "Book" / "Find cars" / "Hľadaj vozidlá" link into the booking flow that answers 200.

## Make what is missing
- Put the booking search (or the button into it) in the home page's server-rendered HTML, near the top, using the design system's form and button components.
- When the search widget is client-only, render a plain link to the booking flow (`/rezervacia/auto`, the booking engine's URL) in the server HTML as well, so it works before and without the widget.
- Give the fields real labels ("Miesto vyzdvihnutia", "Dátum od"), not only placeholders.
- The booking flow's URL comes from the repo's config or the existing links; never invent a booking engine URL or ID.

## Stacks
- **Next.js:** the search form as a server component shell with the interactive parts as client islands; the link is a plain `<Link href>`.
- **Payload + Next:** the booking URL and default location from a `settings` global.
- **Astro / static:** the form in the page with a `client:load` island, and a plain link next to it.

## Hand off only when
The booking engine itself is down or needs an account or key the repo doesn't have.

## Don't
- Don't link the "manage my booking" page as the entry, or a blog post about booking.
- Don't break the booking flow's UTM or locale parameters in the link.
