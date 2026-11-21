import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'

/** Words of visible text the main content needs as served: a short landing page has a few hundred, an empty app shell a handful. */
export const MIN_WORDS = 120

// Not `[hidden]`: Next.js streams suspended content into `<div hidden>` and moves it with a script; a crawler still reads it.
const HIDDEN = 'script, style, noscript, template, svg, iframe, head'
const CHROME = 'header, nav, footer, aside, [role="banner"], [role="navigation"], [role="contentinfo"], dialog'

const words = (text: string) => text.split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length
const collapse = (text: string) => text.replace(/&nbsp;|&#160;/g, ' ').replace(/&[a-z]+;|&#\d+;/g, '').replace(/\s+/g, ' ').trim()

/** The visible text inside the elements matching `selector`, with `drop` removed first. */
async function textOf(html: string, selector: string, drop: string) {
  const visible = await new HTMLRewriter()
    .on(drop, { element: element => void element.remove() })
    .transform(new Response(html))
    .text()
  let text = ''
  let depth = 0
  await new HTMLRewriter()
    .on(selector, {
      element(element) {
        depth++
        element.onEndTag(() => void depth--)
      },
      text(chunk) {
        if (depth > 0) text += chunk.text
      },
    })
    .on('img[alt]', {
      element(element) {
        if (depth > 0) text += ` ${element.getAttribute('alt')} `
      },
    })
    .on('*', {
      // block boundaries separate words
      element: () => void (text += ' '),
    })
    .transform(new Response(visible))
    .text()
  return collapse(text)
}

/** What a crawler that runs no JavaScript reads on the page: its h1s and the words of its main content. */
export async function served(html: string) {
  const h1 = (await textOf(html, 'h1', HIDDEN)).trim()
  const hasMain = /<main[\s>]/i.test(html)
  const main = hasMain ? await textOf(html, 'main, [role="main"]', HIDDEN) : ''
  // a page without <main>, or whose <main> is empty while the content sits next to it: the body without its header, nav and footer
  const body = await textOf(html, 'body', `${HIDDEN}, ${CHROME}`)
  const content = words(main) >= MIN_WORDS ? main : body.length > main.length ? body : main
  return { h1, where: content === main && hasMain ? 'main' : 'the body outside header, nav and footer', words: words(content), sample: content.slice(0, 80) }
}

/** The home page's HTML as served, before any JavaScript runs, carries an h1 and its main content. */
export default async function serverRendered({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  let response: Response
  try {
    response = await get(asset.url)
  } catch (error) {
    return { state: 'error', evidence: `${asset.url} did not respond (${(error as Error).message})` }
  }
  if (response.status !== 200) return { state: 'error', evidence: `${asset.url} answered ${response.status}` }
  const page = await served(await response.text())
  const problems = [
    !page.h1 && 'no h1 with text in the HTML as served',
    page.words < MIN_WORDS && `${page.words} words of visible text in ${page.where}, under ${MIN_WORDS}: the content comes only with JavaScript`,
  ].filter(Boolean)
  if (problems.length > 0) return { state: 'fail', evidence: `${asset.url}: ${problems.join('; ')}` }
  return { state: 'pass', evidence: `h1 "${page.h1.slice(0, 60)}"; ${page.words} words in ${page.where} as served` }
}
