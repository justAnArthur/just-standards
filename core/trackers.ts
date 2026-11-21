// What counts as tracking before consent: requests to known trackers' endpoints, and the cookies they set.
// Loading a tag manager (gtm.js, gtag/js) is not tracking by itself: it is how Consent Mode waits for a choice. Its
// collect endpoints are.

/** A tracker by the host (and path) of its requests. */
export const TRACKERS: { name: string; match: RegExp }[] = [
  { name: 'Google Analytics', match: /^https?:\/\/([\w-]+\.)*(google-analytics\.com|analytics\.google\.com)\/(g\/)?collect\b/ },
  { name: 'Google Analytics', match: /^https?:\/\/[\w.:-]+\/g\/collect\?.*\btid=G-/ },
  { name: 'Google Ads', match: /^https?:\/\/([\w-]+\.)*(doubleclick\.net|googleadservices\.com|googlesyndication\.com)\// },
  { name: 'Google Ads', match: /^https?:\/\/(www\.)?google\.[a-z.]+\/(pagead|ads\/ga-audiences|ccm\/collect)/ },
  { name: 'Meta Pixel', match: /^https?:\/\/(connect\.facebook\.net\/[^/]+\/fbevents\.js|connect\.facebook\.net\/signals\/|www\.facebook\.com\/tr\b)/ },
  { name: 'Hotjar', match: /^https?:\/\/([\w-]+\.)*(hotjar\.com|hotjar\.io)\// },
  { name: 'Microsoft Clarity', match: /^https?:\/\/([\w-]+\.)*clarity\.ms\// },
  { name: 'TikTok Pixel', match: /^https?:\/\/analytics\.tiktok\.com\// },
  { name: 'LinkedIn Insight', match: /^https?:\/\/(snap\.licdn\.com\/li\.lms-analytics|px\.ads\.linkedin\.com|dc\.ads\.linkedin\.com)\// },
  { name: 'Microsoft Ads (UET)', match: /^https?:\/\/bat\.bing\.com\// },
  { name: 'X (Twitter) Pixel', match: /^https?:\/\/(static\.ads-twitter\.com|analytics\.twitter\.com|t\.co\/i\/adsct)/ },
  { name: 'Pinterest Tag', match: /^https?:\/\/(s\.pinimg\.com\/ct\/|ct\.pinterest\.com\/)/ },
  { name: 'Snap Pixel', match: /^https?:\/\/(sc-static\.net\/scevent|tr\.snapchat\.com)/ },
  { name: 'Yandex Metrica', match: /^https?:\/\/mc\.yandex\.(ru|com)\// },
  { name: 'Segment', match: /^https?:\/\/(cdn\.segment\.com|api\.segment\.io)\// },
  { name: 'Mixpanel', match: /^https?:\/\/(cdn\.mxpnl\.com|api(-js)?\.mixpanel\.com)\// },
  { name: 'Heap', match: /^https?:\/\/(cdn\.heapanalytics\.com|heapanalytics\.com)\// },
  { name: 'Criteo', match: /^https?:\/\/([\w-]+\.)*criteo\.(com|net)\// },
  { name: 'Taboola', match: /^https?:\/\/([\w-]+\.)*taboola\.com\// },
  { name: 'Outbrain', match: /^https?:\/\/([\w-]+\.)*outbrain\.com\// },
]

/**
 * The tracker a request goes to, or undefined. A Google Analytics hit that says Consent Mode has both storages denied
 * (`gcs=G100`) is a cookieless ping Consent Mode sends by design, not a tracker firing.
 */
export function trackerOf(url: string) {
  const found = TRACKERS.find(tracker => tracker.match.test(url))
  if (!found) return undefined
  if (/[?&]gcs=G100\b/.test(url)) return undefined
  return found.name
}

/** Cookie names trackers set; a site's own session, CSRF, load-balancer and consent cookies are not among them. */
const TRACKER_COOKIES: { name: string; match: RegExp }[] = [
  { name: 'Google Analytics', match: /^(_ga|_ga_\w+|_gid|_gat\w*|__utm[a-z])$/ },
  { name: 'Google Ads', match: /^(_gcl_\w+|IDE|test_cookie|NID|__gads|__gpi|FPGCLAW|FPAU)$/ },
  { name: 'Meta Pixel', match: /^(_fbp|_fbc|fr)$/ },
  { name: 'Hotjar', match: /^_hj\w+$/ },
  { name: 'Microsoft Clarity', match: /^(_clck|_clsk|CLID|MUID)$/ },
  { name: 'Microsoft Ads (UET)', match: /^(_uetsid|_uetvid|_uetmsclkid)$/ },
  { name: 'TikTok Pixel', match: /^(_ttp|_tt_enable_cookie|tt_\w+)$/ },
  { name: 'LinkedIn Insight', match: /^(li_\w+|lidc|bcookie|bscookie|UserMatchHistory|AnalyticsSyncHistory|lms_\w+)$/ },
  { name: 'Pinterest Tag', match: /^(_pin_unauth|_pinterest_\w+|_epik)$/ },
  { name: 'Snap Pixel', match: /^(_scid|_scid_r|sc_at)$/ },
  { name: 'Yandex Metrica', match: /^_ym_\w+$/ },
  { name: 'Segment', match: /^ajs_\w+$/ },
  { name: 'Mixpanel', match: /^mp_\w+_mixpanel$/ },
  { name: 'Heap', match: /^_hp2_\w+$/ },
]

/** Why a cookie set before any choice is non-essential: a tracker's name, or a third party's domain. Undefined for the site's own. */
export function trackingCookie(cookie: { name: string; domain: string }, site: string) {
  const named = TRACKER_COOKIES.find(tracker => tracker.match.test(cookie.name))
  if (named) return named.name
  const domain = cookie.domain.replace(/^\./, '')
  if (siteOf(domain) !== site) return `third party (${domain})`
}

const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'])

/** The registrable domain of a host, without a public-suffix list: `www.avis.sk` → `avis.sk`, `a.b.co.uk` → `b.co.uk`. */
export function siteOf(host: string) {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.')
  if (labels.length <= 2 || /^\d+$/.test(labels.at(-1) as string)) return labels.join('.')
  const two = labels.at(-2) as string
  const keep = (labels.at(-1) as string).length === 2 && SECOND_LEVEL.has(two) ? 3 : 2
  return labels.slice(-keep).join('.')
}
