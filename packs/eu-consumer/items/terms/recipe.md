## Done when
The check passes on the PR's preview: the home page links, in its language, to the terms (Slovak: "Všeobecné obchodné podmienky", "Podmienky prenájmu", "Reklamačný poriadok"; English: "Terms and conditions", "Rental conditions"; German: "AGB"; Faroese: "Leigutreytir"), and the linked page answers 200. The complaints procedure is linked too, or is a section of the terms.

## Make what is missing
- **The link:** add it to the shared footer, labelled from the locale's translations, and to the booking flow's last step before payment.
- **A broken page:** restore the route or point the link at where the terms now live; a PDF is fine when it answers 200.
- **No terms at all:** they are a legal text. If the business context or the booking engine holds them (Camasys and similar engines keep the rental terms), publish those. Otherwise hand off.

## Stacks
- **Next.js / Payload:** the footer global and a `pages` entry for the terms, per locale.
- **Astro / static:** the footer component and a Markdown page.

## Hand off only when
The terms exist nowhere: not on the site, in the booking engine, nor in the business context.

## Don't
- Never write terms from scratch or copy another company's.
- Don't link the terms only inside the booking engine: the consumer must reach them before starting a booking.
