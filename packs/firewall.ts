// Shared by the security, content and i18n packs and the website items that read pages whole.

/**
 * Why an answer is the host's firewall rather than the site: a bot challenge (Vercel and Cloudflare mark it) or a rate
 * limit. Checks report it as an error, since the page itself was never read; undefined for a real answer.
 */
export function challenged(response: { status: number; headers: Headers }) {
  for (const header of ['x-vercel-mitigated', 'cf-mitigated']) {
    const value = response.headers.get(header)
    if (value) return `the host's firewall answered ${response.status} (${header}: ${value}) instead of the site, so the checker was treated as a bot and nothing was read`
  }
  if (response.status === 429) return `the host answered 429 (rate limited) instead of the page`
}
