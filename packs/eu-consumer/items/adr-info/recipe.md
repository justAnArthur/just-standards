## Done when
The check passes on the PR's preview: the terms or the complaints procedure tell a consumer which body resolves disputes out of court (Slovakia: the Slovenská obchodná inšpekcia or another ADR entity on the Ministry of Economy's list, under zákon č. 391/2015 Z. z.; zákon č. 108/2024 Z. z. § 5(1)(q) asks for it before the contract, with a link to the web page that lists that body), and no page still links the EU ODR platform (`ec.europa.eu/consumers/odr`), which closed on 20 July 2025.

## Make what is missing
- Add a short section "Alternatívne riešenie sporov" to the complaints procedure (or the terms): the consumer's right to ask the trader for redress first, then to turn to the ADR body, with its name, address and web address. For Slovakia, the Slovenská obchodná inšpekcia (www.soi.sk), with the address its site gives for alternative dispute resolution; name a different body only if the business context does.
- Remove every link and sentence pointing to the ODR platform.
- Do it in every language version of the page.

## Stacks
- **Next.js / Payload:** the complaints procedure is usually a `pages` entry or a rich-text global; edit its content, per locale.
- **Astro / static:** the Markdown page.

## Hand off only when
The site's terms are a document the operator controls outside the repo (a PDF from the booking engine) and the business context has no editable copy.

## Don't
- Don't name an ADR body for a country the operator is not in.
- Don't link the closed ODR platform, or replace it with another EU portal as if it handled disputes.
