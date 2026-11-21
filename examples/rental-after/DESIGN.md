# Design system

Príklad Rent's look: calm navy with one warm accent, Inter, generous spacing, flat car illustrations. The tokens live in
three places that must agree: `brand/tokens.json` (source, read by `scripts/brand-media.ts`), the `@theme` block in
`app/globals.css` (Tailwind utilities) and this page.

## Tokens

### Colour

| token | value | Tailwind | use |
|---|---|---|---|
| brand | `#0E5A8A` | `bg-brand`, `text-brand` | links, primary buttons, the mark |
| brand-deep | `#0A3550` | `bg-brand-deep` | hero, consent banner, share images, theme colour |
| accent | `#F5B400` | `bg-accent` | the one call to action per screen (search cars, book at this branch), checkmarks; always with `ink` text |
| ink | `#14202B` | `text-ink`, `bg-ink` | body text, footer background |
| muted | `#4B5966` | `text-muted` | secondary text (7:1 on white) |
| line | `#D6DEE6` | `border-line` | borders, dividers |
| surface | `#F3F6F9` | `bg-surface` | alternating sections, image backgrounds |
| focus | `#C2410C` | (`:focus-visible`) | the 3 px focus ring |
| success / danger | `#1F7A3E` / `#B42318` | `text-success`, `text-danger` | booking notes and errors |

Every text colour meets WCAG AA on the background it is used on: white on brand-deep and brand, ink on accent, muted on
white and surface.

### Type

Inter 400 and 600 (`app/fonts.ts`, self-hosted WOFF2 subsets with every Slovak letter), fallback `system-ui`.

| role | class |
|---|---|
| hero h1 | `text-3xl sm:text-5xl font-semibold tracking-tight` |
| page h1 | `text-3xl sm:text-4xl font-semibold tracking-tight` |
| section h2 | `text-2xl sm:text-3xl font-semibold tracking-tight` |
| card h3 | `text-lg font-semibold` |
| body | `text-base`, `leading-relaxed` in long copy; `.prose` for legal pages |
| small | `text-sm text-muted` |

### Space, radius, layout

- Spacing on Tailwind's 4 px scale; sections `py-14`, cards `p-5`/`p-6`, grids `gap-6`.
- Radius: `rounded-md` (6 px) for buttons and fields, `rounded-lg` (8–10 px) for cards and the booking form.
- Content width `max-w-6xl` (72 rem) with `px-4 sm:px-6`; reading width `max-w-3xl`.
- Motion: none beyond hover colours; `prefers-reduced-motion` turns transitions off.

## Components

| component | file | notes |
|---|---|---|
| Header | `components/Header.tsx` | skip link, logo (inline SVG), main nav with `aria-current`, language switch to the same page, "book" button |
| Footer | `components/Footer.tsx` | operator and IDs, contacts, branches with hours, legal links, cookie settings, ADR note, fictional-company note, current year |
| PageHeader / Breadcrumbs | `components/PageHeader.tsx` | breadcrumb trail, the page's h1 and lead on `bg-surface` |
| BookingForm | `components/BookingForm.tsx` | GET form: pick-up, return point, dates and times; works without JavaScript |
| FleetCard | `components/FleetCard.tsx` | picture, seats, gearbox, luggage, price "od 29 € za deň s DPH" |
| LocationCard / Hours | `components/LocationCard.tsx` | address, hours, `tel:` and `mailto:` links, map link |
| ConsentBanner | `components/ConsentBanner.tsx` | bottom banner, decline and allow as equal buttons |
| RichText | `components/RichText.tsx` | links phone numbers, e-mails and web addresses in copy |
| Logo | `components/Logo.tsx` | generated paths from `brand/` |

Buttons: primary `bg-brand text-white`, call to action `bg-accent text-ink`, secondary `border border-line`; all
`rounded-md px-4..5 py-2.5..3 font-semibold`. Links in copy are underlined.

## Imagery

Flat side-view car illustrations (`brand/illustrations/*.svg`, rendered to `public/fleet/*.png`): no make, no model, no
badge, since the class is promised and the car isn't. Share images and the og:video are composed from the logo, the
headline in Inter and an illustration on brand-deep (`scripts/brand-media.ts`).
