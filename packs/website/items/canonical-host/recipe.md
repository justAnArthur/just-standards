## Done when
The check passes on the PR's preview and, once merged, on the production domain (a preview has only its own host, so the host redirects show only there), and the site lives on exactly one origin: `https://<canonical host>` answers 200; the other name (`www.` added or removed) and `http://` both redirect to it permanently (301 or 308), in one hop each. `http://<other host>` may take two hops (to `https://<other host>`, then to the canonical host), as HSTS preloading asks.

Pick the host the site's canonical tags, sitemap and `metadataBase` already use; when they disagree, the one in the business context, else the one that answers 200 today.

## Stacks
- **Vercel:** add both names to the project's domains and set the other one to redirect (308) to the canonical one; Vercel redirects `http://` itself. In code, a `redirects()` entry in `next.config` with `has: [{ type: 'host', value: '<other host>' }]` does the same where the domain settings can't be changed.
- **Next.js self-hosted, behind Traefik, nginx or Dokploy:** a host redirect in the proxy config (`redirectregex` middleware, `return 301 https://<canonical>$request_uri`), plus the HTTP→HTTPS entry point redirect.
- **Cloudflare:** a redirect rule (or Page Rule) for the other host; "Always Use HTTPS" for `http://`.
- **GitHub Pages:** a custom domain set in the repo's Pages settings redirects `www`/apex itself once both DNS records exist; "Enforce HTTPS" handles `http://`.

## Hand off only when
- The other name has no DNS record and the DNS zone is not managed from this repo: give the exact record to add (`CNAME www → <canonical host>` or the host's A/ALIAS record).
- The redirect has to be set in a hosting dashboard (Vercel domains, Cloudflare) the worker has no account for: give the exact setting.

## Don't
- Don't redirect with 302 or 307: search engines then keep both hosts.
- Don't redirect every path to the home page: keep the path and query.
- Don't add a redirect in shared code without a host condition: in a repo that serves several sites, it would send them all to one.
