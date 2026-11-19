import { useHost } from '@just-apps/app-kit'
import { reduce, type SessionModel } from '@just-apps/claude-code'
import type { Worker } from '@justanarthur/modo-ui-standards'
import { useEffect, useMemo, useRef, useState } from 'react'
import { native, STANDARDS_EXIT, STANDARDS_LINE, type StandardsExit, type StandardsLine } from './native/commands'
import { allRuns, endRun, fixArgs, foldRun, parseRecords, type Run, type RunRecord, recorded, sessionOf, starting } from './runs'
import { messageOf } from './use-standards'

interface Options {
  paths: { checkout: string; workspace: string }
  /** The workspace has loaded: sync and list the runs. */
  ready: boolean
  workers: Worker[]
  /** Re-checks one cell, for a run whose PR merged. */
  recheck: (business: string, asset: string, item: string) => void
}

/**
 * The fix runs: the recorded ones (`standards runs`, synced on load), and the ones this window starts, folded live
 * from `standards fix --interactive`, whose permission questions are answered on the run's stdin.
 */
export function useRuns({ paths, ready, workers, recheck }: Options) {
  const host = useHost()
  const call = useMemo(() => native(host), [host])
  const [records, setRecords] = useState<RunRecord[]>([])
  // This window's runs by process key, and finished runs' sessions by run id, once read.
  const [mine, setMine] = useState<Record<string, Run>>({})
  const [sessions, setSessions] = useState<Record<string, SessionModel>>({})
  const [error, setError] = useState<string>()
  const keys = useRef(new Set<string>())

  const json = (args: string[]) => call('standards_json', { ...paths, args })
  const list = async () => setRecords(parseRecords(await json(['runs'])))
  const relist = useRef(list)
  relist.current = list

  const update = (key: string, f: (run: Run) => Run) => setMine(all => (all[key] ? { ...all, [key]: f(all[key]) } : all))

  useEffect(() => {
    if (!ready) return
    void (async () => {
      try {
        for (const record of parseRecords(await json(['runs', 'sync'])))
          if (record.pr?.state === 'merged') for (const item of record.items) recheck(record.business, record.asset, item)
      } catch (e) {
        console.error('[standards] runs sync:', e)
      }
      try {
        await list()
        setError(undefined)
      } catch (e) {
        setError(messageOf(e))
      }
    })()
  }, [ready, paths])

  useEffect(() => {
    const offLine = host.on(STANDARDS_LINE, payload => {
      const { key, line } = payload as StandardsLine
      if (keys.current.has(key)) update(key, run => foldRun(run, line))
    })
    const offExit = host.on(STANDARDS_EXIT, payload => {
      const { key, code, stderr } = payload as StandardsExit
      if (!keys.current.delete(key)) return
      update(key, run => endRun(run, code, stderr))
      relist.current().catch(e => console.error('[standards] runs:', e))
    })
    return () => {
      offLine()
      offExit()
    }
  }, [host])

  /** Starts a fix run; its process key opens it in the pane until, and after, the CLI names it. */
  function start(business: string, asset: string, items: string[], worker: string) {
    const key = crypto.randomUUID()
    const model = workers.find(w => w.id === worker)?.model ?? ''
    keys.current.add(key)
    setMine(all => ({ ...all, [key]: starting(key, business, asset, items, worker, model) }))
    call('standards_start', { ...paths, key, args: fixArgs(business, asset, items, worker) }).catch(e => {
      keys.current.delete(key)
      update(key, run => endRun(run, 1, messageOf(e)))
    })
    return key
  }

  /** Answers the run's permission question: the line goes to Claude Code, and the question leaves the session. */
  function respond(key: string, line: string) {
    update(key, run => ({ ...run, session: reduce(run.session, line) }))
    call('standards_write', { key, line }).catch(e => console.error('[standards] answer:', e))
  }

  const stop = (key: string) => call('standards_kill', { key }).catch(e => console.error('[standards] stop:', e))

  const all = useMemo(() => allRuns(records, Object.values(mine)), [records, mine])

  /** A run by its process key or its id, with its session once read; and that key, while it is this window's. */
  function find(ref: string): { run: Run; key?: string } | undefined {
    const key = mine[ref] ? ref : Object.keys(mine).find(k => mine[k].record.id === ref)
    if (key) return { run: mine[key], key }
    const record = records.find(r => r.id === ref)
    return record && { run: { ...recorded(record), session: sessions[ref] ?? recorded(record).session } }
  }

  /** Reads a finished run's transcript, once. */
  async function read(id: string) {
    if (sessions[id]) return
    const session = sessionOf(await json(['runs', 'transcript', id]))
    setSessions(all => ({ ...all, [id]: session }))
  }

  return { all, error, find, read, start, respond, stop, loaded: (id: string) => id in sessions }
}

export type Runs = ReturnType<typeof useRuns>
