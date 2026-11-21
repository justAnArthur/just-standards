## Done when
The check passes on the PR's preview: `robots.txt` lets GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and Google-Extended fetch the site, and the site answers 200 (no 403, no challenge page) to each crawler's user agent.

## Make what is missing
- **robots.txt:** remove every `Disallow: /` (or `/*`) in a group that names one of these crawlers, and in the `User-agent: *` group when the crawler has no group of its own. Keep the `Disallow` lines for private paths (`/api`, `/admin`). Don't add a group per crawler unless one is needed: a crawler with its own group ignores the `*` group.
- **The CDN:** a 403 or a challenge to a crawler's user agent comes from bot protection, not from the app. On Vercel it is the Firewall's bot rules or "Bot Protection"; on Cloudflare it is "Block AI bots" / "AI Scrapers and Crawlers" under Security, or a WAF rule on the user agent. When that setting lives in the dashboard and not in the repo, say so in the PR and name the setting.
- Check by hand: `curl -A 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)' -I <url>`.

## Stacks
- **Next.js:** `app/robots.ts` returning `MetadataRoute.Robots`, or `public/robots.txt`; never both. A `middleware.ts` (or `proxy.ts`) that blocks on the user agent is the other place to look.
- **Payload + Next:** the same; Payload's admin stays disallowed (`/admin`).
- **Astro / static:** `public/robots.txt`.

## Hand off only when
The block is a CDN or hosting setting the worker has no access to (a Cloudflare zone, a Vercel project's firewall). Name the setting and the user agents it blocks.

## Don't
- Don't allow crawlers on preview or staging hosts that are meant to stay out of search: change production's rules only.
- Don't block by IP range or add a `Crawl-delay` to slow them down; that also hides the site.
- Don't add per-bot `Allow: /` groups that drop the `Disallow` lines the `*` group had.
