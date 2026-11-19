import { useHost, useStore } from '@just-apps/app-kit'
import { useEffect, useMemo, useRef, useState } from 'react'
import { applyLine, argsOf, endChecks, type Scope, startChecks } from './checks'
import { type CliWorkspace, type Model, type Status, tildify, toModel, toStatus } from './model'
import { native, STANDARDS_EXIT, STANDARDS_LINE, type StandardsExit, type StandardsLine } from './native/commands'

export const DEFAULT_CHECKOUT = '~/Projects/justanarthur/just-standards'
export const DEFAULT_WORKSPACE = '~/Projects/justanarthur/standards-workspace'

export function usePaths() {
  const [checkout, setCheckout, checkoutLoaded] = useStore('paths.checkout', DEFAULT_CHECKOUT)
  const [workspace, setWorkspace, workspaceLoaded] = useStore('paths.workspace', DEFAULT_WORKSPACE)
  return { checkout, setCheckout, workspace, setWorkspace, loaded: checkoutLoaded && workspaceLoaded }
}

export type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; model: Model }

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** The workspace and its cells from the CLI, and the check runs that update the cells as their results stream in. */
export function useStandards() {
  const host = useHost()
  const call = useMemo(() => native(host), [host])
  const { checkout, workspace, loaded } = usePaths()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [status, setStatus] = useState<Status>({})
  const [runs, setRuns] = useState<Scope[]>([])
  const [failure, setFailure] = useState<string>()
  const live = useRef(new Map<string, Scope>())
  const loads = useRef(0)

  const track = (key: string, scope?: Scope) => {
    if (scope) live.current.set(key, scope)
    else live.current.delete(key)
    setRuns([...live.current.values()])
  }

  async function reload() {
    const seq = ++loads.current
    setLoad({ kind: 'loading' })
    const json = (args: string[]) => call('standards_json', { checkout, workspace, args })
    try {
      const [printed, cells, home] = await Promise.all([json(['workspace']), json(['status']), call('home_dir')])
      if (seq !== loads.current) return
      const cli = JSON.parse(printed) as CliWorkspace
      setStatus(toStatus(cells))
      setLoad({ kind: 'ready', model: toModel({ ...cli, dir: tildify(cli.dir, home) }) })
    } catch (error) {
      if (seq === loads.current) setLoad({ kind: 'error', message: messageOf(error) })
    }
  }

  useEffect(() => {
    if (loaded) void reload()
  }, [call, loaded, checkout, workspace])

  useEffect(() => {
    const offLine = host.on(STANDARDS_LINE, payload => {
      const { key, line } = payload as StandardsLine
      if (live.current.has(key)) setStatus(status => applyLine(status, line))
    })
    const offExit = host.on(STANDARDS_EXIT, payload => {
      const { key, code, stderr } = payload as StandardsExit
      const scope = live.current.get(key)
      if (!scope) return
      track(key)
      setStatus(status => endChecks(status, scope))
      if (code) setFailure(stderr.trim() || `standards check exited with ${code}`)
    })
    return () => {
      offLine()
      offExit()
    }
  }, [host])

  async function check(scope: Scope = {}) {
    const key = crypto.randomUUID()
    track(key, scope)
    setFailure(undefined)
    setStatus(status => startChecks(status, scope))
    try {
      await call('standards_start', { key, checkout, workspace, args: argsOf(scope) })
    } catch (error) {
      track(key)
      setStatus(status => endChecks(status, scope))
      setFailure(messageOf(error))
    }
  }

  function stop() {
    for (const key of live.current.keys()) call('standards_kill', { key }).catch(error => console.error('[standards] stop:', error))
  }

  return { load, status, runs, failure, dismissFailure: () => setFailure(undefined), reload, check, stop }
}

export type Standards = ReturnType<typeof useStandards>
