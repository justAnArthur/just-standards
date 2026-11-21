## Done when
The check passes on the PR's preview: the footer of every page links a phone (`tel:`), an e-mail (`mailto:`) or the contact page; every `tel:` link holds only a number a phone can dial (`tel:+421900200200`); and every phone number written out in the page's text is such a link.

## Make what is missing
- Take the phone, e-mail and contact page from the site itself or the business context; never invent one.
- **A tel: link with words in it** (`tel:+421 900 200 200 (linka je spoplatnená…)`): keep the note as visible text next to the link, and put only the number in the `href`, in international form without spaces.
- **A number in plain text:** wrap it in `<a href="tel:+…">`. When the number comes from a CMS rich-text field, add the link in the component that renders contacts, or convert numbers in the rich-text renderer.
- **No footer contact:** add the contact block (phone, e-mail, a link to the contact page) to the shared footer, so every page has it.

## Stacks
- **Next.js:** the shared footer in the root layout (or `app/[locale]/layout.tsx`); a small `PhoneLink` component that builds the `href` from the displayed number (`'tel:' + number.replace(/[^\d+]/g, '')`).
- **Payload + Next / Strapi:** a `contact` global the footer and the contact page read.
- **Astro / static:** the footer component in the layout.

## Hand off only when
The business has no phone, e-mail or contact page on the site or in the business context.

## Don't
- Don't put the price note or opening hours inside the `href`.
- Don't link national-format numbers without the country code: a visitor from abroad can't dial them.
