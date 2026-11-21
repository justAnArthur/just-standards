## Done when
The check passes on the PR's preview: the FAQ page the home page links carries `FAQPage` JSON-LD whose `mainEntity` lists each question on the page as a `Question` with its `acceptedAnswer` text, every question written as it is in the page's visible text.

## Make what is missing
- Build the JSON-LD from the same FAQ entries the page renders (CMS or file), so the two can't drift: `{"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": <question>, "acceptedAnswer": {"@type": "Answer", "text": <answer as plain text>}}]}`.
- Render the questions and answers in the HTML as served (an accordion with the answer in the DOM, collapsed, is fine).
- One FAQPage per language version, from that language's entries.

## Stacks
- **Next.js:** the JSON-LD in the FAQ page's server component.
- **Payload + Next:** an `faq` collection or global; the page and the JSON-LD read it.
- **Astro / static:** the FAQ data file feeds both.

## Hand off only when
Never: the questions and answers are on the site.

## Don't
- Don't put questions in the JSON-LD that the page doesn't show, or answers that differ from the page's.
- Don't add FAQPage to pages that aren't FAQs.
