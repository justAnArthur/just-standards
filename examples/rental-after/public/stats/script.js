// A stand-in for a self-hosted Umami tracker: the same tag and data-website-id, page views sent to this site's own
// /api/stats. It is loaded only after the visitor allows statistics (components/ConsentBanner.tsx). No cookies, no ID.
;(() => {
  const script = document.currentScript
  const website = script && script.getAttribute('data-website-id')
  const send = () => {
    const body = JSON.stringify({
      website,
      path: location.pathname,
      referrer: document.referrer || null,
      language: document.documentElement.lang,
      screen: `${screen.width}x${screen.height}`,
    })
    if (!(navigator.sendBeacon && navigator.sendBeacon('/api/stats', body))) fetch('/api/stats', { method: 'POST', body, keepalive: true })
  }
  send()
  // client-side navigations
  const push = history.pushState
  history.pushState = function (...args) {
    push.apply(this, args)
    setTimeout(send, 0)
  }
  addEventListener('popstate', send)
})()
