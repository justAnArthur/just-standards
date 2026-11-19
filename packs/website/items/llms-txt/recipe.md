Serve `/llms.txt` in the llmstxt.org format: an `# H1` with the site name, a `> ` one-paragraph summary, then `## ` sections of Markdown links to the most useful pages, each with a short note.

Build it from the real pages (the sitemap or routes), not from memory. Keep it under a few hundred lines.

- **Next.js:** a `public/llms.txt`, or `app/llms.txt/route.ts` that builds it from the CMS for Payload sites.
- **Astro / static:** `public/llms.txt`.
