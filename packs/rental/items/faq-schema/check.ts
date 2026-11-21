import type { Context } from '../../../../core/checks/context.ts'
import { decode } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { FAQ } from '../../../ai-visibility/pages.ts'
import { fold, jsonLd, page, pathOf, some, textOf, type Node, typesOf, unreachable } from '../../../local-business/shared.ts'
import { homeOf } from '../../shared.ts'

const plain = (value: unknown) => fold(decode(typeof value === 'string' ? value : '').replace(/<[^>]+>/g, ' '))

/** The questions of the page's FAQPage nodes, and how many lack an answer. */
export async function questionsOf(html: string) {
  const { nodes, invalid } = await jsonLd(html)
  const faqs = nodes.filter(node => typesOf(node).includes('FAQPage'))
  const questions: { name: string; answered: boolean }[] = []
  for (const faq of faqs) {
    const entities = Array.isArray(faq.mainEntity) ? faq.mainEntity : faq.mainEntity ? [faq.mainEntity] : []
    for (const raw of entities) {
      const question = (raw ?? {}) as Node
      const answer = (Array.isArray(question.acceptedAnswer) ? question.acceptedAnswer[0] : question.acceptedAnswer) as Node | undefined
      questions.push({ name: typeof question.name === 'string' ? question.name : '', answered: Boolean(answer && plain(answer.text)) })
    }
  }
  return { faqs: faqs.length, questions, invalid }
}

export default async function faqSchema(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const home = await homeOf(ctx)
  if (!home) return unreachable(ctx)
  const link = home.own.find(link => FAQ.test(link.text) || /\/(faq|casto-kladene|caste-otazky|otazky|questions|hilfe|help)\b/i.test(pathOf(link.href)))
  if (!link) return { state: 'fail', evidence: `the home page links no FAQ page (by a link such as "FAQ" or "Časté otázky")` }
  const faq = await page(link.href)
  const path = pathOf(faq.final)
  if (faq.status !== 200 || !faq.html) return { state: 'fail', evidence: `the FAQ link ${path} answers ${faq.status || 'nothing'}` }

  const { faqs, questions, invalid } = await questionsOf(faq.html)
  if (faqs === 0) return { state: 'fail', evidence: `${path} has no FAQPage JSON-LD${invalid ? ` (${invalid} JSON-LD block${invalid > 1 ? 's' : ''} don't parse)` : ''}` }
  if (questions.length === 0) return { state: 'fail', evidence: `${path}: FAQPage has no Question in mainEntity` }

  const text = ` ${fold(await textOf(faq.html))} `
  const unseen = questions.filter(question => !plain(question.name) || !text.includes(` ${plain(question.name)} `))
  const unanswered = questions.filter(question => !question.answered)
  const problems = [
    unseen.length && `${unseen.length} of ${questions.length} questions aren't in the page's text: ${some(unseen.map(q => `"${q.name.trim() || '(no name)'}"`), 3, ', ')}`,
    unanswered.length && `${unanswered.length} have no acceptedAnswer text`,
  ].filter(Boolean)
  if (problems.length) return { state: 'fail', evidence: `${path}: ${problems.join('; ')}` }
  return { state: 'pass', evidence: `${path} carries FAQPage JSON-LD with ${questions.length} questions, each in the page's text and answered` }
}
