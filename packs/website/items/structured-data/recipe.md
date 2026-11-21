## Done when
The check passes on the PR's preview, and search engines and AI answers can read who is behind the site: the home page carries one `<script type="application/ld+json">` whose JSON parses, with a schema.org `Organization` (or `Person` for a personal site, `LocalBusiness`/`AutoRental` for a business with branches) and a `WebSite`, in an `@graph`.

- **Organization:** `name`, `url`, `logo` (absolute), `sameAs` (the social profiles the site links to), and the legal name, address and phone when the site or the business context states them.
- **WebSite:** `name`, `url`, and `inLanguage`.
- A product site may add `SoftwareApplication` or `Product` with only the facts the site states.

## Make what is missing
Build it from the business context (legal entity, IDs, locations, hours) and what the site itself shows (footer, contact page). Keep it in one module so every page and every site in the repo renders the same facts.

## Stacks
- **Next.js:** render it in the root layout or home page: `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />`.
- **Payload + Next:** read the organization's facts from the site-settings global, not from constants scattered across components.
- **Astro / static:** the same tag in `<head>`.

## Hand off only when
A legal fact (the registered name, a company ID) is needed and is neither on the site nor in the business context: ship the rest and list what is missing.

## Don't
- Never invent ratings, reviews, prices, opening hours or an address.
- Don't let a string with `</script>` into the JSON unescaped.
