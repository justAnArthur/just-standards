## Done when
The check passes on the PR's preview: the home page (its footer, on every page) links an accessibility statement in the page's language, the page answers 200, and it says which standard the site is measured against (WCAG 2.1 AA / EN 301 549) under which law (the European Accessibility Act, in Slovakia Act 351/2022).

## Make what is missing
Write the statement from what the site is and what the checks found, in every site language:
- **Who and what:** the operator from the business context, the site's domain, the services it offers online (booking a car or van).
- **The standard:** "This site aims to conform to WCAG 2.1 level AA (EN 301 549 v3.2.1), as the European Accessibility Act (Directive (EU) 2019/882) and Act No. 351/2022 Coll. require."
- **Status:** partly or fully conformant. List the known gaps honestly from the `accessibility` items still failing (axe rules, keyboard, third-party widgets such as the booking engine), each with what is being done.
- **Feedback:** how to report a barrier (the contact e-mail and phone from the business context) and the date of the last review.
- **Enforcement:** the market-surveillance authority the national law names for services, with how to contact it; take its name from the law itself (Act 351/2022 in Slovakia), not from memory.
Link it in the footer next to the privacy policy: "Vyhlásenie o prístupnosti" (sk), "Accessibility statement" (en), "Erklärung zur Barrierefreiheit" (de), and the Faroese from the site's own translations.

## Stacks
- **Next.js / Payload:** a page in the CMS's pages collection per locale, and the footer link in the footer global.
- **Astro / static:** a page in `src/pages/[lang]/` and the footer component.

## Hand off only when
The business context names no operator or contact to put in the statement. Mark the text for legal review in the PR.

## Don't
- Don't claim full conformance while `accessibility` items fail.
- Don't link a generic statement of another company or a PDF.
