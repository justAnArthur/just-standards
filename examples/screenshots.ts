#!/usr/bin/env bun
// Screenshots of the two example sites side by side: the first screen on a desktop and a phone, the 404 page, and how a
// link to the home page looks in Google and when shared (drawn from the page's own <title>, description and Open Graph
// tags). Uses the last builds of `bun examples/run.ts`; writes examples/results/screens/{before,after}-<shot>.jpg.
//
//   bun examples/screenshots.ts
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { closeBrowser, sharedBrowser } from '../core/browser.ts'
import { select } from '../core/html.ts'

const ROOT = import.meta.dir
const OUT = join(ROOT, 'results/screens')
const SITES = [
  { name: 'before', dir: join(ROOT, 'rental-before'), port: 3101 },
  { name: 'after', dir: join(ROOT, 'rental-after'), port: 3102 },
]
const SHOTS = [
  { name: 'home-desktop', path: '/', viewport: { width: 1440, height: 900 }, scale: 1 },
  { name: 'home-mobile', path: '/', viewport: { width: 390, height: 844 }, scale: 2 },
  { name: 'not-found', path: '/this-page-does-not-exist', viewport: { width: 1280, height: 720 }, scale: 1 },
]

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function waitFor(url: string) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).status < 500) return
    } catch {}
    await Bun.sleep(500)
  }
  throw new Error(`${url} didn't come up`)
}

/** What a search result and a shared link show, from the page's own tags. */
async function previewOf(base: string) {
  const html = await (await fetch(base)).text()
  const first = async (selector: string, attr?: string) => {
    const [element] = await select(html, selector)
    return element ? (attr ? element.attrs[attr] : element.text.trim()) : undefined
  }
  const image = await first('meta[property="og:image"]', 'content')
  return {
    title: (await first('head > title')) ?? '',
    description: await first('meta[name="description"]', 'content'),
    ogTitle: await first('meta[property="og:title"]', 'content'),
    ogDescription: await first('meta[property="og:description"]', 'content'),
    siteName: await first('meta[property="og:site_name"]', 'content'),
    image: image && new URL(image, base).href.replace(/^https?:\/\/[^/]+/, base.replace(/\/$/, '')),
    video: await first('meta[property="og:video"]', 'content'),
    host: new URL(base).host,
  }
}

/** A Google result and a social card, side by side, drawn the way those surfaces lay a link out. */
function previewHtml(p: Awaited<ReturnType<typeof previewOf>>) {
  const card = p.image
    ? `<img src="${escape(p.image)}" alt="" style="width:100%;aspect-ratio:1200/630;object-fit:cover;display:block">`
    : `<div style="aspect-ratio:1200/630;background:#e9edf1;display:flex;align-items:center;justify-content:center;color:#7a8794;font-size:18px">no og:image: the platform shows no picture</div>`
  return `<!doctype html><html><body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#fff">
<div style="display:flex;gap:40px;padding:32px;width:1136px">
  <section style="flex:1">
    <div style="font-size:13px;color:#5f6368;margin-bottom:10px;letter-spacing:.02em">GOOGLE RESULT</div>
    <div style="font-size:14px;color:#202124">${escape(p.siteName ?? p.host)}</div>
    <div style="font-size:12px;color:#4d5156;margin-bottom:4px">${escape(p.host)}</div>
    <div style="font-size:20px;color:#1a0dab;line-height:1.3;margin-bottom:4px">${escape(p.title || '(no title)')}</div>
    <div style="font-size:14px;color:#4d5156;line-height:1.58">${escape(p.description ?? '(no meta description: Google picks text from the page)')}</div>
  </section>
  <section style="width:520px">
    <div style="font-size:13px;color:#5f6368;margin-bottom:10px;letter-spacing:.02em">SHARED LINK${p.video ? ' · plays og:video' : ''}</div>
    <div style="border:1px solid #dadde1;border-radius:8px;overflow:hidden">
      ${card}
      <div style="padding:12px 14px;background:#f2f3f5">
        <div style="font-size:12px;color:#65676b;text-transform:uppercase">${escape(p.host)}</div>
        <div style="font-size:16px;font-weight:600;color:#050505;margin:4px 0">${escape(p.ogTitle ?? p.title ?? '')}</div>
        <div style="font-size:14px;color:#65676b">${escape(p.ogDescription ?? (p.ogTitle ? '' : 'no og:description'))}</div>
      </div>
    </div>
  </section>
</div></body></html>`
}

await mkdir(OUT, { recursive: true })
const servers = SITES.map(site =>
  Bun.spawn([join(site.dir, 'node_modules/.bin/next'), 'start', '-p', String(site.port)], { cwd: site.dir, stdout: 'ignore', stderr: 'ignore' }),
)
try {
  await Promise.all(SITES.map(site => waitFor(`http://localhost:${site.port}/`)))
  const browser = await sharedBrowser()
  for (const site of SITES) {
    const base = `http://localhost:${site.port}`
    for (const shot of SHOTS) {
      const context = await browser.newContext({ viewport: shot.viewport, deviceScaleFactor: shot.scale, locale: 'sk-SK' })
      const page = await context.newPage()
      await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: join(OUT, `${site.name}-${shot.name}.jpg`), type: 'jpeg', quality: 82 })
      await context.close()
    }
    const context = await browser.newContext({ viewport: { width: 1200, height: 520 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    await page.setContent(previewHtml(await previewOf(`${base}/`)), { waitUntil: 'networkidle' })
    await page.screenshot({ path: join(OUT, `${site.name}-previews.jpg`), type: 'jpeg', quality: 85, fullPage: true })
    await context.close()
    console.log(`${site.name}: ${SHOTS.length + 1} screenshots`)
  }
} finally {
  await closeBrowser()
  for (const server of servers) server.kill()
}
