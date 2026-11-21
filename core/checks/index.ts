import type { Outcome } from '../schema.ts'
import { ai } from './ai.ts'
import type { Context } from './context.ts'
import { crawlCheck } from './crawl.ts'
import { dns } from './dns.ts'
import { psi } from './psi.ts'
import { github } from './github.ts'
import { http } from './http.ts'
import { repo } from './repo.ts'
import { script } from './script.ts'

export type { Context } from './context.ts'

export async function runCheck(ctx: Context): Promise<Outcome> {
  const { check } = ctx.item
  try {
    if (check.kind === 'http') return await http(check, ctx)
    if (check.kind === 'repo') return await repo(check, ctx)
    if (check.kind === 'github') return await github(check, ctx)
    if (check.kind === 'script') return await script(check, ctx)
    if (check.kind === 'crawl') return await crawlCheck(check, ctx)
    if (check.kind === 'dns') return await dns(check, ctx)
    if (check.kind === 'psi') return await psi(check, ctx)
    return await ai(check, ctx)
  } catch (error) {
    return { state: 'error', evidence: (error as Error).message }
  }
}
