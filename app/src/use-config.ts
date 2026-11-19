import { useHost } from '@just-apps/app-kit'
import type { Business, ClaudeProfile, Worker } from '@justanarthur/modo-ui-standards'
import { useEffect, useMemo, useState } from 'react'
import { businessArgs, toProfiles, workerArgs } from './config'
import { native } from './native/commands'

interface Paths {
  checkout: string
  workspace: string
}

/**
 * The writes to the workspace's config, each through the CLI, which validates it first: a refusal rejects with its
 * stderr. `refresh` reads the workspace again after each.
 */
export function useConfig(paths: Paths, refresh: () => Promise<void>) {
  const host = useHost()
  const call = useMemo(() => native(host), [host])
  const json = (args: string[]) => call('standards_json', { ...paths, args })
  const then = async <T>(done: Promise<T>) => {
    const value = await done
    await refresh()
    return value
  }

  return {
    /** Writes the business; one whose id changed leaves its old file. */
    saveBusiness: (business: Business, was?: string) =>
      then(
        (async () => {
          await json(businessArgs(business))
          if (was && was !== business.id) await json(['business', 'remove', was])
        })(),
      ),
    removeBusiness: (id: string) => then(json(['business', 'remove', id])),
    saveWorker: (worker: Worker, was?: string) =>
      then(
        (async () => {
          await json(workerArgs(worker))
          if (was && was !== worker.id) await json(['worker', 'remove', was])
        })(),
      ),
    removeWorker: (id: string) => then(json(['worker', 'remove', id])),
    /** "Always allow": each rule onto the worker's `allow`, once. */
    allow: (worker: string, rules: string[]) =>
      then(
        (async () => {
          for (const rule of rules) await json(['worker', 'allow', worker, rule])
        })(),
      ),
    /** Clones the asset's repo (or reuses a checkout of it) and resolves to the path it set. */
    clone: (business: string, asset: string) =>
      then(json(['clone', business, asset]).then(out => (JSON.parse(out) as { path: string }).path)),
  }
}

export type Config = ReturnType<typeof useConfig>

/** The Claude Code profiles on this machine, read once. */
export function useProfiles() {
  const host = useHost()
  const [profiles, setProfiles] = useState<ClaudeProfile[]>()
  useEffect(() => {
    const call = native(host)
    Promise.all([call('list_profiles', { extra: [] }), call('home_dir')])
      .then(([infos, home]) => setProfiles(toProfiles(infos, home)))
      .catch(error => {
        console.error('[standards] profiles:', error)
        setProfiles([])
      })
  }, [host])
  return profiles
}
