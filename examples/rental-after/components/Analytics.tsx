/**
 * The statistics script, held back until consent. A consent manager's placeholder: `type="text/plain"` keeps the
 * browser from running it, and ConsentBanner turns it into a script once the visitor allows statistics.
 * `/stats/script.js` stands in for a self-hosted Umami: same tag, same `data-website-id`, and the hits go to this
 * site's own `/api/stats`, never to a third party.
 */
export function Analytics() {
  const websiteId = process.env.ANALYTICS_WEBSITE_ID || '5f0c3c1e-0000-4000-8000-00000000e1a5'
  return <script type="text/plain" data-category="analytics" data-src="/stats/script.js" data-website-id={websiteId} />
}
