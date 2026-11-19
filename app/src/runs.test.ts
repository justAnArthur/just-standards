import { describe, expect, test } from 'bun:test'
import { allow, deny, initialSession, reduce } from '@just-apps/claude-code'
import type { CellStatus } from '@justanarthur/modo-ui-standards'
import type { Status } from './model'
import { fixScript, stamped } from './native/fix-script'
import {
  allRuns,
  endRun,
  fixArgs,
  foldRun,
  LOST,
  overlayRuns,
  parseRecords,
  type Run,
  type RunRecord,
  recorded,
  sessionOf,
  starting,
  toTranscript,
} from './runs'

const script = () =>
  fixScript({
    id: '20261119-101500-acadsys-og-video',
    business: 'acadsys',
    asset: 'site',
    items: ['website/og-video'],
    worker: 'sonnet-fixer',
    model: 'sonnet',
    path: '/Users/you/Projects/acadsys-www',
    repo: 'utegsk/acadsys-www',
    site: 'https://acadsys.com',
    started_at: '2026-11-19T10:15:00.000Z',
  })

const t0 = Date.parse('2026-11-19T10:15:00.000Z')
const cli = (type: 'run', event: 'started' | 'finished', run: RunRecord) => JSON.stringify({ type, event, run })
const claude = (line: string) => JSON.stringify({ type: 'claude', line })

/** `standards fix --interactive` up to its permission question, as the CLI prints it. */
function opened() {
  const s = script()
  let at = t0
  const lines = [cli('run', 'started', s.started), ...s.opening.map(step => claude(stamped(step, (at += step.delay))))]
  return { s, lines, at }
}

const fresh = () => starting('key-1', 'acadsys', 'site', ['website/og-video'], 'sonnet-fixer', 'sonnet')

describe('foldRun', () => {
  test('the started record replaces the provisional one; claude lines build the transcript and the question', () => {
    const { s, lines } = opened()
    const run = lines.reduce(foldRun, fresh())
    expect(run.record).toEqual(s.started)
    expect(run.live).toBe(true)
    expect(run.session.pending).toEqual([
      expect.objectContaining({ kind: 'permission', requestId: s.requestId, tool: 'Bash', toolUseId: 'toolu_curl' }),
    ])
    const items = toTranscript(run.session.turns)
    expect(items.map(i => (i.kind === 'tool' ? `tool:${i.name}` : i.kind))).toEqual([
      'thinking',
      'text',
      'tool:Grep',
      'tool:Read',
      'text',
      'tool:Edit',
      'tool:Bash',
      'text',
      'tool:Bash',
    ])
    const build = items.find(i => i.kind === 'tool' && i.id === 'toolu_build')
    expect(build).toMatchObject({ result: expect.stringContaining('Compiled successfully'), ms: 2200 })
    // The question's tool has no result yet.
    expect(items.at(-1)).toMatchObject({ id: 'toolu_curl', result: undefined })
  })

  // On Allow or Deny the app reduces its own control response into the session, as ai-desktop does: the question leaves.
  test('an allow answers the question; the finished record carries the PR', () => {
    const { s, lines, at } = opened()
    let run = lines.reduce(foldRun, fresh())
    run = { ...run, session: reduce(run.session, allow(s.requestId)) }
    expect(run.session.pending).toEqual([])
    let t = at
    const rest = [...s.allowed.map(step => claude(stamped(step, (t += step.delay)))), cli('run', 'finished', s.finish('allowed', new Date(t).toISOString()))]
    run = rest.reduce(foldRun, run)
    expect(run.record.state).toBe('done')
    expect(run.record.pr).toMatchObject({ url: expect.stringMatching(/^https:\/\/github.com\/utegsk\/acadsys-www\/pull\/\d+$/), state: 'open' })
    expect(run.session.lastResult?.costUsd).toBe(0.38)
    expect(toTranscript(run.session.turns).at(-1)).toMatchObject({ kind: 'text', text: expect.stringContaining('Opened https://github.com') })
  })

  test('a deny ends the run failed with no pull request', () => {
    const { s, lines } = opened()
    let run = lines.reduce(foldRun, fresh())
    run = { ...run, session: reduce(run.session, deny(s.requestId, 'Denied by the user.')) }
    run = [...s.denied.map(step => claude(stamped(step, t0))), cli('run', 'finished', s.finish('denied', '2026-11-19T10:20:00.000Z'))].reduce(foldRun, run)
    expect(run.record).toMatchObject({ state: 'failed', error: 'no pull request' })
    expect(toTranscript(run.session.turns).find(i => i.id === 'toolu_curl')).toMatchObject({ is_error: true })
  })

  test('the finished line drops a question nobody answered', () => {
    const { s, lines } = opened()
    const run = [...lines, cli('run', 'finished', s.finish('stopped', '2026-11-19T10:16:00.000Z'))].reduce(foldRun, fresh())
    expect(run.record).toMatchObject({ state: 'stopped', error: 'stopped by SIGTERM' })
    expect(run.session.pending).toEqual([])
  })

  test('anything else on stdout is skipped', () => {
    const run = fresh()
    expect(foldRun(run, 'not json')).toBe(run)
    expect(foldRun(run, JSON.stringify({ type: 'result', state: 'pass' }))).toBe(run)
  })
})

describe('endRun', () => {
  test('a run the CLI refused takes its stderr as the failure', () => {
    const ended = endRun(fresh(), 1, 'acadsys/site has no path: no local checkout\n')
    expect(ended.live).toBe(false)
    expect(ended.record).toMatchObject({ state: 'failed', error: 'acadsys/site has no path: no local checkout' })
  })

  test('a killed run that never printed its end is stopped', () => {
    expect(endRun(fresh(), null, '').record.state).toBe('stopped')
  })

  test('a run that printed its end keeps that record', () => {
    const { s } = opened()
    const done = foldRun(fresh(), cli('run', 'finished', s.finish('allowed', '2026-11-19T10:20:00.000Z')))
    expect(endRun(done, 0, '').record).toEqual(done.record)
  })
})

test('parseRecords: bare records from runs and runs sync, and fix lines', () => {
  const { s } = opened()
  const ndjson = [JSON.stringify(s.started), cli('run', 'finished', s.finish('allowed', '2026-11-19T10:20:00.000Z')), claude('{}'), 'Syncing…'].join('\n')
  expect(parseRecords(ndjson).map(r => r.state)).toEqual(['running', 'done'])
})

test('sessionOf: a finished run read back from events.ndjson', () => {
  const s = script()
  const events = [...s.opening, ...s.allowed].map(step => stamped(step, t0)).join('\n')
  const session = sessionOf(events)
  expect(session.pending).toEqual([])
  expect(toTranscript(session.turns).filter(i => i.kind === 'tool')).toHaveLength(7)
})

describe('runs and cells', () => {
  const record = (id: string, at: string, extra: Partial<RunRecord> = {}): RunRecord => ({
    id,
    business: 'acme',
    asset: 'site',
    items: ['website/og-video'],
    worker: 'sonnet-fixer',
    model: 'sonnet',
    branch: 'standards/og-video',
    worktree: '/w',
    started_at: at,
    state: 'done',
    ...extra,
  })
  const cell = (item: string, state: CellStatus['state']): CellStatus => ({ asset: 'site', item, title: item, state })
  const status: Status = { acme: [cell('website/og-video', 'fail'), cell('website/icons', 'fail')] }
  const runOf = (status: Status, item = 'website/og-video') => status.acme!.find(c => c.item === item)?.run
  const pr = (number: number, state: 'open' | 'merged' | 'closed' = 'open') => ({ url: `https://github.com/acme/site/pull/${number}`, number, state })

  test('a live run shows its worker on every cell it covers', () => {
    const live: Run = { ...recorded(record('r1', '2026-11-19T10:00:00Z', { items: ['website/og-video', 'website/icons'] })), live: true }
    const shown = overlayRuns(status, [live])
    expect(runOf(shown)).toEqual({ state: 'running', worker: 'sonnet-fixer' })
    expect(runOf(shown, 'website/icons')).toEqual({ state: 'running', worker: 'sonnet-fixer' })
  })

  test('the latest run’s open PR shows until the cell passes', () => {
    const older = recorded(record('r1', '2026-11-18T10:00:00Z', { pr: pr(11) }))
    expect(runOf(overlayRuns(status, [older]))).toEqual({ state: 'pr-open', url: pr(11).url, number: 11 })
    const passing: Status = { acme: [cell('website/og-video', 'pass')] }
    expect(runOf(overlayRuns(passing, [older]))).toBeUndefined()
    // A newer run without a PR (or with a merged one) hides the older PR.
    const newer = recorded(record('r2', '2026-11-19T10:00:00Z', { state: 'failed', error: 'no pull request' }))
    expect(runOf(overlayRuns(status, [older, newer]))).toBeUndefined()
    expect(runOf(overlayRuns(status, [recorded(record('r3', '2026-11-19T10:00:00Z', { pr: pr(12, 'merged') }))]))).toBeUndefined()
  })

  test('a running record with no live process is stale: stopped, never running', () => {
    const stale = recorded(record('r1', '2026-11-19T10:00:00Z', { state: 'running' }))
    expect(stale.record).toMatchObject({ state: 'stopped', error: LOST })
    expect(runOf(overlayRuns(status, [stale]))).toBeUndefined()
  })

  test('allRuns: one per id, this window’s first, newest first', () => {
    const mine: Run = { record: record('r2', '2026-11-19T10:00:00Z', { state: 'running' }), session: initialSession, live: true }
    const all = allRuns([record('r1', '2026-11-18T10:00:00Z'), record('r2', '2026-11-19T10:00:00Z', { state: 'running' }), record('r3', '2026-11-19T11:00:00Z')], [mine])
    expect(all.map(r => [r.record.id, r.live])).toEqual([
      ['r3', false],
      ['r2', true],
      ['r1', false],
    ])
  })
})

test('fixArgs: the CLI call', () => {
  expect(fixArgs('acme', 'site', ['website/og-video', 'website/icons'], 'opus-fixer')).toEqual([
    'fix',
    'acme',
    'site',
    'website/og-video',
    'website/icons',
    '--worker',
    'opus-fixer',
    '--interactive',
  ])
})
