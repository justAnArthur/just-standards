## Done when
The check passes on the PR's branch: for a repo serving several sites, `AGENTS.md` (or the README) has a table with one row per site: its domain, the folder, config or env that makes it, and its languages.

## Make what is missing
- Find the sites from the code: per-site folders (`sites/<name>`, `apps/<name>`), a sites or tenants config, domain mappings in middleware or `proxy.ts`, env files per deployment, `vercel.json` or the hosting projects named in workflows.
- Take each domain from the config, the business context, or the assets of this repo in the standards workspace; never guess one.
- Say what is shared (components, CMS) and what is per site (theme, content, locale), so a change lands in the right place.

## Hand off only when
A site's domain is in neither the code nor the business context.

## Don't
- Don't list sites that only appear in old branches or comments.
