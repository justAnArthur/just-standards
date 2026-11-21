## Done when
The check passes on the PR's preview: the prices on the home, fleet and pricing pages show their currency, and the pages say whether they include VAT ("ceny s DPH", "incl. VAT"), as text a reader and a crawler can see.

## Make what is missing
- One `Price` component in the design system that renders the amount with its currency, used for every price.
- A VAT note next to prices or once in the header or footer ("Všetky ceny sú uvedené s DPH"), true to the site's data: if the prices are with VAT, say so; if a switch exists, its default state says which.
- Whether prices include VAT comes from the site's own pricing data or terms, or the business context.

## Stacks
- **Next.js:** the `Price` component; the VAT note in the layout's server component.
- **Payload + Next:** a `pricesIncludeVat` setting in a global that the note reads.
- **Astro / static:** the component and the note in the layout.

## Hand off only when
Neither the site, its terms nor the business context says whether the prices include VAT.

## Don't
- Don't change prices or VAT arithmetic; only show what is already true.
- Don't show a currency the booking engine doesn't charge in.
