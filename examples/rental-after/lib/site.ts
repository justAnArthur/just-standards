// The site's public origin. Canonicals, hreflang, the sitemap, Open Graph URLs and JSON-LD are absolute on it.
// Set SITE_URL to the production origin when deploying; it defaults to the local port the example runs on.
export const SITE_URL = (process.env.SITE_URL || 'http://localhost:3102').replace(/\/+$/, '')

export const absolute = (path: string) => `${SITE_URL}${path}`

export const isHttps = SITE_URL.startsWith('https://')
