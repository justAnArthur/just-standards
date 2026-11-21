## Done when
The check passes: the domain (the site's host without `www.`) has an SPF record (`v=spf1 … ~all` or `-all`) and `_dmarc.<domain>` has a DMARC record with `p=quarantine` or `p=reject`. DKIM is set up for every service that sends as the domain (the check can't read DKIM without the selector; say which you verified).

## Make what is missing
These are DNS records, not code. In the PR or the run's summary, write the exact records to add, built from what the domain sends with today:
- **SPF:** one record listing every sender (`include:_spf.google.com`, `include:spf.brevo.com`, the booking engine's servers…), ending in `~all`. Find the senders in the existing SPF, the MX records, and the services the repo and business context name (newsletter, booking confirmations, contact form).
- **DMARC:** start at `v=DMARC1; p=quarantine; rua=mailto:<reports address>` once SPF and DKIM pass for every sender; with `p=none` already in place and clean reports, move it to `quarantine`.
- If the repo manages DNS as code (Terraform, `vercel.json` domains, Cloudflare config), make the change there.

## Hand off only when
DNS is managed outside the repo: a person adds the records at the DNS provider. Hand over the exact records.

## Don't
- Don't publish a second SPF record: there must be one per domain.
- Don't jump to `p=reject` before every legitimate sender passes; booking confirmations would bounce.
- Don't use `+all`.
