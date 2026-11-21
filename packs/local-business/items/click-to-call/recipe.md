## Done when
The check passes on the PR's preview: every phone number in the visible text of the sampled pages is inside a `tel:` link and every e-mail address inside a `mailto:` link, and every `tel:` value is the number in E.164 form (`tel:+421900200200`), with nothing else in it.

## Make what is missing
- One `Phone` and one `Email` component that take the number or address and render the link, used everywhere a number or address is shown: header, footer, contact, location pages, and the rich text of posts and terms (a rich-text serializer that links phone numbers and e-mails it finds).
- `href` from the number, normalized: `+`, the country code, the digits, no spaces or text (`tel:+421900200200`); the visible text keeps its usual spacing ("+421 900 200 200").
- A note about the number ("the line costs 0.60 €/min") goes next to the link, not into its `href`.
- A national number ("0900 200 200") gets its country code from the business context or the site's own other numbers.

## Stacks
- **Next.js:** the components in the design system; the CMS rich text renderer maps text nodes through a phone/e-mail linker.
- **Payload + Next:** a `phone` field type with validation to E.164 in the CMS, so editors can't enter text into it.
- **Astro / static:** the components, and a remark/rehype plugin for Markdown content.

## Hand off only when
Never: the numbers and addresses are already on the site.

## Don't
- Don't hide the number to pass the check; link it.
- Don't put the note, the price per minute or a trailing character (`}`) into the `href`.
- Don't link numbers that aren't phone numbers (company IDs, IBANs).
