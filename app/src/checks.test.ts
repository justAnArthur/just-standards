import { expect, test } from 'bun:test'
import type { CellStatus, Result } from '@justanarthur/modo-ui-standards'
import { applyLine, argsOf, checkingCount, endChecks, isChecking, lastChecked, startChecks, withoutChecking } from './checks'
import type { Status } from './model'

const result = (asset: string, item: string, state: Result['state'], at = '2026-11-19T10:00:00.000Z'): Result => ({
  business: 'acme',
  asset,
  item,
  item_version: 1,
  state,
  evidence: `${item} on ${asset}`,
  checked_at: at,
  ms: 10,
})

const cell = (asset: string, item: string, state: CellStatus['state'], extra: Partial<CellStatus> = {}): CellStatus => ({
  asset,
  item,
  title: item,
  state,
  ...extra,
})

const status: Status = {
  acme: [
    cell('site', 'website/og-video', 'fail', { result: result('site', 'website/og-video', 'fail') }),
    cell('site', 'website/icons', 'stale', { result: result('site', 'website/icons', 'pass', '2026-10-01T00:00:00.000Z') }),
    cell('site', 'website/llms-txt', 'waived', { waiver: { item: 'website/llms-txt', reason: 'no' } }),
    cell('repo', 'repo/license', 'unchecked'),
  ],
  other: [cell('site', 'website/icons', 'pass')],
}

const line = (r: Result) => JSON.stringify({ type: 'result', ...r })
const states = (s: Status, business = 'acme') => s[business]!.map(c => (isChecking(c) ? 'checking' : c.state))

test('args: the scope as CLI flags', () => {
  expect(argsOf({})).toEqual(['check'])
  expect(argsOf({ business: 'acme', asset: 'site', item: 'website/icons' })).toEqual(['check', 'acme', '--item', 'website/icons', '--asset', 'site'])
})

test('start: every cell in scope is checking, waived ones stay', () => {
  const all = startChecks(status, {})
  expect(states(all)).toEqual(['checking', 'checking', 'waived', 'checking'])
  expect(states(all, 'other')).toEqual(['checking'])
  expect(checkingCount(all)).toBe(4)

  const one = startChecks(status, { business: 'acme', asset: 'site', item: 'website/icons' })
  expect(states(one)).toEqual(['fail', 'checking', 'waived', 'unchecked'])
  expect(states(one, 'other')).toEqual(['pass'])
})

test('lines: each result lands on its cell as it streams in', () => {
  let s = startChecks(status, { business: 'acme' })
  s = applyLine(s, line(result('site', 'website/og-video', 'pass', '2026-11-19T12:00:00.000Z')))
  expect(states(s)).toEqual(['pass', 'checking', 'waived', 'checking'])
  expect(s.acme![0]!.result?.checked_at).toBe('2026-11-19T12:00:00.000Z')
  expect(s.acme![0]).not.toHaveProperty('run')

  s = applyLine(s, line(result('site', 'website/icons', 'error')))
  expect(states(s)).toEqual(['pass', 'error', 'waived', 'checking'])
  expect(lastChecked(s)).toBe('2026-11-19T12:00:00.000Z')
})

test('lines: anything but a known cell result changes nothing', () => {
  const s = startChecks(status, {})
  expect(applyLine(s, 'Camasys · 10 checks')).toBe(s)
  expect(applyLine(s, '{"type":"cell"}')).toBe(s)
  expect(applyLine(s, line({ ...result('site', 'website/icons', 'pass'), business: 'nobody' }))).toBe(s)
})

test('end: cells the run never reported go back to their last state', () => {
  let s = startChecks(status, {})
  s = applyLine(s, line(result('repo', 'repo/license', 'fail')))
  const ended = endChecks(s, { business: 'acme' })
  expect(states(ended)).toEqual(['fail', 'stale', 'waived', 'fail'])
  expect(states(ended, 'other')).toEqual(['checking'])
  expect(ended.acme![1]).toEqual(status.acme![1]!)
})

test('totals leave the checking marks out', () => {
  expect(withoutChecking(startChecks(status, {}))).toEqual(status)
})
