import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'

const LIMIT_MS = 800
const RUNS = 3

/** Time from sending the request to the response's headers, redirects included: the first byte a browser gets. */
async function firstByte(url: string) {
  const started = performance.now()
  const response = await get(url)
  const ms = performance.now() - started
  await response.body?.cancel()
  return { ms, status: response.status, url: response.url }
}

export default async function ttfb({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const runs: Awaited<ReturnType<typeof firstByte>>[] = []
  try {
    // one after another, so they don't compete with each other
    for (let i = 0; i < RUNS; i++) runs.push(await firstByte(asset.url))
  } catch (error) {
    return { state: 'error', evidence: `${asset.url} did not respond: ${(error as Error).message}` }
  }
  const last = runs.at(-1)!
  if (last.status !== 200) return { state: 'fail', evidence: `${last.url} answered ${last.status}` }
  const times = runs.map(run => Math.round(run.ms)).sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)]!
  const where = `${last.url}${last.url.replace(/\/$/, '') === asset.url.replace(/\/$/, '') ? '' : ` (from ${asset.url})`}`
  const detail = `median ${median} ms of ${times.join(', ')} ms`
  if (median > LIMIT_MS) return { state: 'fail', evidence: `${where}: first byte after ${detail}, over ${LIMIT_MS} ms` }
  return { state: 'pass', evidence: `${where}: first byte after ${detail}` }
}
