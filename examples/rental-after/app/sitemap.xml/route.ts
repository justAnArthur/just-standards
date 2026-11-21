import { CONTENT_UPDATED } from '@/content/business'
import { defaultLocale, locales, pageIds, pathOf } from '@/lib/i18n'
import { absolute } from '@/lib/site'

/** Every page in both languages, each with its alternates (hreflang) and when its content last changed. */
export function GET() {
  const urls = pageIds.flatMap(page =>
    locales.map(lang => {
      const alternates = [
        ...locales.map(other => `<xhtml:link rel="alternate" hreflang="${other}" href="${absolute(pathOf(page, other))}"/>`),
        `<xhtml:link rel="alternate" hreflang="x-default" href="${absolute(pathOf(page, defaultLocale))}"/>`,
      ]
      return `<url><loc>${absolute(pathOf(page, lang))}</loc><lastmod>${CONTENT_UPDATED}</lastmod>${alternates.join('')}</url>`
    }),
  )
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
