## Done when
The check passes on the PR's preview: every sampled page (the home page and up to 19 pages of the sitemap) links, in its footer, to a privacy policy named in the page's language, and that page answers 200. Slovak: "Ochrana osobných údajov" or "Informácie o spracúvaní osobných údajov"; English: "Privacy policy"; German: "Datenschutz"; Faroese: "Persónsupplýsingar" or "Dátuvernd".

## Make what is missing
- **A page without the link:** the footer is shared, so the page usually renders another layout or doesn't render the footer in its HTML (a client-only footer, a layout without it). Make every public layout render the same footer on the server.
- **A link in the wrong language:** take the label from the locale's translations, as the other footer links do.
- **No policy at all:** the policy's content is a legal text. Build the page from the processing the site actually does (the forms it has, the cookies and tools it loads, the booking engine) and from the operator's identity in the business context, in each site language. Mark it for legal review in the PR.

## Stacks
- **Next.js / Payload:** the footer links come from a global (`footer`, `navigation`); add the policy there once, per locale.
- **Astro / static:** the footer component in the base layout.

## Hand off only when
There is no policy and the business context names no operator or data controller to write it for.

## Don't
- Don't link only the cookie policy: it is not the privacy policy.
- Don't link a PDF or another domain's policy when the operator is a different company from the one that runs the site.
- Don't add the link to some layouts only.
