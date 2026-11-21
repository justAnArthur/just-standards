## Done when
The check passes on the PR's preview and on the production domain (a preview has its own certificate), and browsers trust the connection with no warning: the certificate chains to a trusted root, names the host, has 21 days or more left, and the connection uses TLS 1.2 or newer; the home page loads no script, style, image or frame over `http://`.

## Make what is missing
- **Mixed content:** change each `http://` subresource the evidence lists to `https://` (or to a path on the site's own origin). When the resource lives in the CMS (an image URL stored with `http://`), fix the URL at its source: the CMS's public URL setting (`serverURL`, `PAYLOAD_PUBLIC_SERVER_URL`, Strapi's `url`) or the media adapter's base URL, not by string replacement in a component.
- **An expiring certificate:** find why it didn't renew: a DNS record that no longer points at the host (ACME's HTTP challenge fails), a CAA record that excludes the host's CA, or a manually uploaded certificate. Fix the record or switch to the host's managed certificate.

## Stacks
- **Vercel, Netlify, GitHub Pages, Cloudflare:** certificates are managed and renew themselves while the domain's DNS points at them; a near-expiry certificate there means the DNS moved.
- **Traefik or Dokploy:** the `certresolver` on the router and the ACME storage; check the proxy logs for the failed challenge.
- **Next.js:** `next/image` remote patterns and `<Image src>` must use `https://`.

## Hand off only when
- Renewal needs access to the DNS zone or the server the worker doesn't have: give the exact record or command.
- The certificate was bought and uploaded by hand: a person renews it.

## Don't
- Don't "fix" mixed content with protocol-relative URLs (`//cdn…`) or by turning off the check: use `https://`.
- Don't add `upgrade-insecure-requests` as the only fix: it hides the broken URL instead of fixing it.
