import { useHost, useStore } from '@just-apps/app-kit'
import { Onboarding } from '@justanarthur/modo-ui-standards'
import { useMemo, useState } from 'react'
import { onProfile } from './config'
import { PROFILE_KEY, Refused, useBusinessForm } from './forms'
import { type Model, tildify } from './model'
import { native } from './native/commands'
import type { Config } from './use-config'
import { useProfiles } from './use-config'
import { useGithub } from './use-github'
import { messageOf, usePaths } from './use-standards'

interface SetupProps {
  /** The workspace once it loads; none while its folder is missing. */
  model?: Model
  /** The folder is missing: the first step is still to do. */
  missing: boolean
  /** Why the workspace didn't load, other than a missing folder. */
  problem?: string
  config: Config
  onFinish: () => void
}

/** First launch: the workspace folder, the Claude Code profile, GitHub and a first business, each through the CLI. */
export function Setup({ model, missing, problem, config, onFinish }: SetupProps) {
  const host = useHost()
  const call = useMemo(() => native(host), [host])
  const { checkout, workspace, setWorkspace } = usePaths()
  const github = useGithub(checkout)
  const profiles = useProfiles()
  const [profile, setProfile] = useStore(PROFILE_KEY, '')
  const [error, setError] = useState<string>()
  const business = useBusinessForm(config, undefined, () => {})

  /** A folder from the system's dialog, `~` for the home folder; none when cancelled. */
  async function pick(prompt: string) {
    const [dir, home] = await Promise.all([call('pick_folder', { prompt }), call('home_dir')])
    return dir ? { dir, home } : undefined
  }

  async function choose() {
    setError(undefined)
    try {
      const picked = await pick('Choose the just-standards workspace folder')
      if (picked) setWorkspace(tildify(picked.dir, picked.home))
    } catch (e) {
      setError(messageOf(e))
    }
  }

  async function create() {
    setError(undefined)
    try {
      const picked = await pick('Choose a folder for the new workspace')
      if (!picked) return
      const out = await call('standards_json', { checkout, workspace: '', args: ['workspace', 'init', picked.dir] })
      setWorkspace(tildify((JSON.parse(out) as { dir: string }).dir, picked.home))
    } catch (e) {
      setError(messageOf(e))
    }
  }

  /** The preset workers move to the profile picked, then the app opens. */
  async function finish() {
    setError(undefined)
    try {
      for (const worker of onProfile(model?.workers ?? [], profile)) await config.saveWorker(worker)
      onFinish()
    } catch (e) {
      setError(messageOf(e))
    }
  }

  const message = [problem, error, business.refusal.message].filter(Boolean).join('\n\n')
  return (
    <div className="flex flex-col">
      {message && (
        <div className="mx-auto w-full max-w-xl px-6 pt-6">
          <Refused message={message} className="m-0" />
        </div>
      )}
      <Onboarding
        workspace={missing ? undefined : workspace}
        onPickWorkspace={choose}
        onCreateWorkspace={create}
        profiles={profiles ?? []}
        profile={profile || undefined}
        onProfileChange={setProfile}
        github={github}
        business={model?.businesses[0]?.name}
        businessForm={{ ...business.props, packs: model?.packs ?? [] }}
        onFinish={finish}
        className={message ? 'pt-6' : undefined}
      />
    </div>
  )
}
