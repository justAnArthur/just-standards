## Done when
The check passes on the PR's preview: the site states who operates it, in plain text, on the home page's footer, the contact page or an imprint page: the legal name with its form (s.r.o., a.s.), the registered address, the company ID and the register entry (SK: IČO and "zapísaná v Obchodnom registri Mestského súdu …, oddiel …, vložka č. …"), the tax IDs when it is a VAT payer (DIČ, IČ DPH), and an e-mail or phone.

## Make what is missing
- Take every fact from the business context or from the site's own terms (VOP), which usually open with them. Never from memory.
- Put the block in the shared footer as small text ("Prevádzkovateľ: …"), and in full on the contact page. A franchise site names the franchisee as the operator.
- Keep the same block in every language version, with the labels translated and the facts unchanged.

## Stacks
- **Next.js / Payload:** a `company` or `settings` global the footer and the contact page read; the JSON-LD `Organization` (`legalName`, `vatID`, `taxID`, `address`) reads it too.
- **Astro / static:** a data file read by the footer.

## Hand off only when
A fact (the IČO, the register entry, the VAT ID) is neither on the site nor in the business context.

## Don't
- Never invent or reformat an ID beyond spacing: copy it as registered.
- Don't put the facts only in an image or a PDF.
