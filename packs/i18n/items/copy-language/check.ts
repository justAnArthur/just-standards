import { ai } from '../../../../core/checks/ai.ts'
import type { Context } from '../../../../core/checks/context.ts'
import { pathOf } from '../../../../core/crawl.ts'
import { sameUrl } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { crawled, isOutcome, langOf, type Locale, oneLanguage, primary, siteOf } from '../../locales.ts'

/** Languages read, and pages per language besides its home: the model reads every page whole. */
const LANGUAGES = 4
const INNER = 1

const names = new Intl.DisplayNames(['en'], { type: 'language' })

/** Per language: its home, and inner pages from the crawl whose `<html lang>` is that language. */
export async function samplesOf(locales: Locale[], pages: { url: string; final: string; html: string }[], inner = INNER) {
  const langs = await Promise.all(pages.map(page => langOf(page.html)))
  return locales.slice(0, LANGUAGES).map(locale => ({
    locale,
    pages: [
      locale.home,
      ...pages
        .filter((page, i) => primary(langs[i]) === locale.language && !locales.some(other => sameUrl(other.home, page.final)))
        .slice(0, inner)
        .map(page => page.final),
    ],
  }))
}

/** For each language, an AI reads its home and a page of the crawl in it: the visible text is in that language, with its diacritics. */
export default async function copyLanguage(ctx: Context): Promise<Outcome> {
  const site = await siteOf(ctx)
  if (isOutcome(site)) return site
  const single = oneLanguage(site)
  if (single) return single
  const pages = await crawled(ctx.asset.url as string)
  if (isOutcome(pages)) return pages
  const template = (await Bun.file(`${ctx.item.dir}/prompt.md`).text()).trim()

  const outcomes = await Promise.all(
    (await samplesOf(site.locales, pages)).map(async ({ locale, pages }) => {
      const language = `${names.of(locale.language)} (${locale.code})`
      const outcome = await ai({ kind: 'ai', model: 'haiku', prompt: template.replaceAll('{language}', language), pages }, ctx)
      return { ...outcome, evidence: `${locale.code}: ${outcome.evidence} (read ${pages.map(pathOf).join(', ')})` }
    }),
  )
  const state = outcomes.some(o => o.state === 'fail') ? 'fail' : outcomes.some(o => o.state === 'error') ? 'error' : 'pass'
  const shown = state === 'pass' ? outcomes : outcomes.filter(o => o.state === state)
  return { state, evidence: shown.map(o => o.evidence).join(' | ') }
}
