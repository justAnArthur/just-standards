import { join } from 'node:path'
import type { Check, Outcome } from '../schema.ts'
import type { Context } from './context.ts'
import { resolve } from './http.ts'

type PsiCheck = Extract<Check, { kind: 'psi' }>

const psiUrl = () => process.env.STANDARDS_PSI_URL ?? 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

interface Experience {
  metrics?: Record<string, { percentile: number }>
}
interface Answer {
  loadingExperience?: Experience
  originLoadingExperience?: Experience
  lighthouseResult?: {
    categories?: { performance?: { score: number | null } }
    audits?: Record<string, { numericValue?: number }>
  }
  error?: { message: string }
}

/** The optional `psi-key` in the workspace's `secrets.yml`: without one, PageSpeed Insights works at a lower rate limit. */
async function keyOf(wsDir: string | undefined) {
  if (!wsDir) return undefined
  const file = Bun.file(join(wsDir, 'secrets.yml'))
  if (!(await file.exists())) return undefined
  const value = (Bun.YAML.parse(await file.text()) as Record<string, unknown> | null)?.['psi-key']
  return typeof value === 'string' && value ? value : undefined
}

const ms = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`)

export async function psi(check: PsiCheck, { asset, wsDir }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const page = resolve(check.path, asset.url)
  const query = new URLSearchParams({ url: page, strategy: check.strategy, category: 'performance' })
  const key = await keyOf(wsDir)
  if (key) query.set('key', key)
  let answer: Answer
  try {
    const response = await fetch(`${psiUrl()}?${query}`, { signal: AbortSignal.timeout(120_000) })
    answer = (await response.json()) as Answer
    if (!response.ok || answer.error) return { state: 'error', evidence: `PageSpeed Insights: ${answer.error?.message ?? response.status}` }
  } catch (error) {
    return { state: 'error', evidence: `PageSpeed Insights did not answer for ${page}: ${(error as Error).message}` }
  }

  const failures: string[] = []
  const notes: string[] = []
  if (check.field) {
    // The page's own field data, else its origin's; a site with too little Chrome traffic has neither, and the lab run stands in.
    const experience = answer.loadingExperience?.metrics ? answer.loadingExperience : answer.originLoadingExperience
    const metrics = experience?.metrics
    const audits = answer.lighthouseResult?.audits ?? {}
    const source = metrics ? (experience === answer.loadingExperience ? 'field' : 'field, origin') : 'lab: no field data'
    const lcp = metrics ? metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile : audits['largest-contentful-paint']?.numericValue
    const inp = metrics ? metrics.INTERACTION_TO_NEXT_PAINT?.percentile : undefined
    const rawCls = metrics ? metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile : audits['cumulative-layout-shift']?.numericValue
    const cls = rawCls === undefined ? undefined : metrics ? rawCls / 100 : rawCls
    const measure = (name: string, value: number | undefined, limit: number | undefined, show: (v: number) => string) => {
      if (limit === undefined || value === undefined) return
      const line = `${name} ${show(value)}`
      if (value > limit) failures.push(`${line}, over ${show(limit)}`)
      else notes.push(line)
    }
    measure('LCP', lcp, check.field.lcp_ms, ms)
    measure('INP', inp, check.field.inp_ms, ms)
    measure('CLS', cls, check.field.cls, value => value.toFixed(2))
    notes.push(`(${source}, ${check.strategy})`)
  }
  if (check.lab?.performance !== undefined) {
    const score = answer.lighthouseResult?.categories?.performance?.score
    if (score === null || score === undefined) failures.push('no Lighthouse performance score')
    else if (score < check.lab.performance) failures.push(`Lighthouse performance ${Math.round(score * 100)}, under ${Math.round(check.lab.performance * 100)}`)
    else notes.push(`Lighthouse performance ${Math.round(score * 100)}`)
  }
  if (failures.length > 0) return { state: 'fail', evidence: `${page}: ${[...failures, ...notes].join('; ')}` }
  return { state: 'pass', evidence: `${page}: ${notes.join('; ')}` }
}
