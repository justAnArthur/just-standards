import { describe, expect, test } from 'bun:test'
import type { CellStatus } from '@justanarthur/modo-ui-standards'
import { cellPane, parseMerged, runView } from './pr'
import { type Run, type RunRecord, recorded } from './runs'

const record = (patch: Partial<RunRecord> = {}): RunRecord => ({
  id: '20261119-101500-acadsys-og-video',
  business: 'acadsys',
  asset: 'site',
  items: ['website/og-video'],
  worker: 'sonnet-fixer',
  model: 'sonnet',
  branch: 'standards/og-video',
  worktree: '/Users/you/Projects/acadsys-www/.worktrees/std-og-video',
  started_at: '2026-11-19T10:15:00.000Z',
  state: 'done',
  pr: { url: 'https://github.com/utegsk/acadsys-www/pull/42', number: 42, state: 'open' },
  ...patch,
})

describe('run view', () => {
  test('a run that ended with a PR opens on it, and the transcript stays a pick away', () => {
    expect(runView(record())).toBe('pr')
    expect(runView(record(), 'transcript')).toBe('transcript')
  })

  test('a running run, or one without a PR, shows its transcript', () => {
    expect(runView(record({ state: 'running', pr: undefined }))).toBe('transcript')
    expect(runView(record({ state: 'failed', pr: undefined }), 'pr')).toBe('transcript')
  })
})

describe('cell pane', () => {
  const cell: CellStatus = { asset: 'site', item: 'website/og-video', title: 'og:video', state: 'fail' }
  const runs: Run[] = [
    recorded(record()),
    recorded(record({ id: 'older', started_at: '2026-11-18T10:00:00.000Z', pr: { url: 'https://github.com/x/y/pull/7', number: 7, state: 'closed' } })),
  ]

  test('a pr-open cell opens its run, Back returns to the cell', () => {
    const open = { ...cell, run: { state: 'pr-open' as const, url: 'https://github.com/utegsk/acadsys-www/pull/42', number: 42 } }
    expect(cellPane(open, runs, 'acadsys')).toEqual({
      kind: 'run',
      key: '20261119-101500-acadsys-og-video',
      back: { kind: 'cell', key: 'site:website/og-video' },
    })
  })

  test('any other cell opens itself', () => {
    expect(cellPane(cell, runs, 'acadsys')).toEqual({ kind: 'cell', key: 'site:website/og-video' })
    const running = { ...cell, run: { state: 'running' as const, worker: 'sonnet-fixer' } }
    expect(cellPane(running, runs, 'acadsys')).toEqual({ kind: 'cell', key: 'site:website/og-video' })
  })

  test("a PR the runs don't know opens the cell", () => {
    const stray = { ...cell, run: { state: 'pr-open' as const, url: 'https://github.com/a/b/pull/1', number: 1 } }
    expect(cellPane(stray, runs, 'acadsys').kind).toBe('cell')
  })
})

test('pr merge prints the synced record', () => {
  const merged = record({ pr: { url: 'https://github.com/utegsk/acadsys-www/pull/42', number: 42, state: 'merged' } })
  expect(parseMerged(`${JSON.stringify(merged)}\n`)).toEqual(merged)
})
