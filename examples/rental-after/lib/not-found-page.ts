// The 404 page. proxy.ts answers it for any path that names no page, before rendering starts: a plain HTML document
// with the logo, the way home and no scripts. (A notFound() thrown while a page renders answers 404 in Next 16.4 but
// leaves the body empty until JavaScript runs; this page is complete as served.)
import { LOGO } from '@/components/logo-art'
import { company } from '@/content/business'
import { t } from '@/content/dictionary'
import { type Locale, pathOf } from '@/lib/i18n'

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const STYLE = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#14202B;background:#fff;line-height:1.5}
header{border-bottom:1px solid #D6DEE6}header div,main{max-width:72rem;margin:0 auto;padding:12px 24px}
header a{display:inline-block}header svg{height:36px;width:auto;display:block}
main{padding-top:80px;padding-bottom:80px}p.code{color:#0E5A8A;font-weight:600;margin:0}
h1{font-size:2.25rem;line-height:1.2;margin:8px 0 16px;letter-spacing:-.01em}p.text{font-size:1.125rem;color:#4B5966;margin:0 0 32px}
nav ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:16px}
a.button{display:inline-block;padding:12px 20px;border-radius:6px;font-weight:600;text-decoration:none}
a.primary{background:#0E5A8A;color:#fff}a.secondary{border:1px solid #D6DEE6;color:#14202B}
p.other{margin-top:40px}p.other a{color:#0E5A8A}
a:focus-visible{outline:3px solid #C2410C;outline-offset:2px}
footer{border-top:1px solid #D6DEE6;color:#4B5966;font-size:.875rem}footer p{max-width:72rem;margin:0 auto;padding:24px}
`

export function notFoundHtml(lang: Locale) {
  const d = t(lang)
  const other: Locale = lang === 'sk' ? 'en' : 'sk'
  const otherText = other === 'en' ? 'Page not found. Go to the English home page' : 'Stránka sa nenašla. Prejsť na slovenskú úvodnú stránku'
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>${escape(`${d.notFound.title} · ${company.brand}`)}</title>
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<style>${STYLE}</style>
</head>
<body>
<header><div><a href="${pathOf('home', lang)}" aria-label="${escape(`${d.home}: ${company.brand}`)}"><svg viewBox="0 0 ${LOGO.width} ${LOGO.height}" role="img" aria-label="${company.brand}">${LOGO.inner}</svg></a></div></header>
<main>
<p class="code">404</p>
<h1>${escape(d.notFound.title)}</h1>
<p class="text">${escape(d.notFound.text)}</p>
<nav aria-label="${escape(d.nav.label)}"><ul>
<li><a class="button primary" href="${pathOf('home', lang)}">${escape(d.notFound.home)}</a></li>
<li><a class="button secondary" href="${pathOf('fleet', lang)}">${escape(d.notFound.fleet)}</a></li>
<li><a class="button secondary" href="${pathOf('contact', lang)}">${escape(d.nav.contact)}</a></li>
</ul></nav>
<p class="other" lang="${other}"><a href="${pathOf('home', other)}" hreflang="${other}">${escape(otherText)}</a></p>
</main>
<footer><p>${escape(company.legalName)} · ${escape(d.footer.fictional)}</p></footer>
</body>
</html>
`
}
