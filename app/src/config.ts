import { type ProfileInfo, profileId } from '@just-apps/claude-code'
import type { Business, ClaudeProfile, Worker } from '@justanarthur/modo-ui-standards'
import { tildify } from './model'

/** What a refused write said: messages under the fields a form shows, and the rest as one message above it. */
export interface Refusal {
  fields: Record<string, string>
  message?: string
}

const BUSINESS_FIELD = /^(name|id|packs|assets\.\d+\.(id|kind|url|repo|path|stack))$/
const WORKER_FIELD = /^(id|model|profile|allow(\.\d+)?)$/

/**
 * The engine's stderr for a refused `business set` or `worker set`: a schema error lists each issue as
 * `  <path>: <message>` under a `business:` or `worker:` line; a business naming a missing pack says `no pack <id>`.
 */
export function parseRefusal(stderr: string, form: 'business' | 'worker'): Refusal {
  const shown = form === 'business' ? BUSINESS_FIELD : WORKER_FIELD
  const fields: Record<string, string> = {}
  const rest: string[] = []
  for (const line of stderr.trim().split('\n')) {
    const issue = line.match(/^\s+([\w.()]+): (.+)$/)
    // `packs.1` is the second pack's pattern: the form shows packs as one field.
    const path = issue?.[1]?.replace(/^(packs|allow)\.\d+$/, form === 'business' ? '$1' : '$&')
    if (issue && path && shown.test(path)) {
      fields[path] ??= issue[2]!
      continue
    }
    const pack = line.match(/no pack (\S+)$/)
    if (form === 'business' && pack) {
      fields.packs = `There is no pack ${pack[1]}.`
      continue
    }
    if (/^(business|worker):$/.test(line.trim())) continue
    rest.push(line.trim())
  }
  return { fields, message: rest.filter(Boolean).join('\n') || undefined }
}

/** What the engine's schema lets through but a worker can't run without: an id and a model. */
export function workerGaps(worker: Worker): Refusal {
  const fields: Record<string, string> = {}
  if (!worker.id.trim()) fields.id = 'Give the worker an id.'
  else if (/\s/.test(worker.id)) fields.id = 'An id has no spaces.'
  if (!worker.model.trim()) fields.model = 'Pick a model.'
  return { fields }
}

/** The business as `business set --json` takes it: its fields, the empty ones left out. */
export const businessArgs = (business: Business) => ['business', 'set', '--json', JSON.stringify(business)]

export const workerArgs = (worker: Worker) => ['worker', 'set', '--json', JSON.stringify(worker)]

/** Each rule "Always allow" adds, for `worker allow`: the session's `addRules` suggestions, `Tool(content)` or `Tool`. */
export function allowRules(suggestions: { type: string; rules?: { toolName: string; ruleContent?: string }[] }[]) {
  return suggestions.flatMap(s => (s.type === 'addRules' && s.rules ? s.rules : [])).map(r => (r.ruleContent ? `${r.toolName}(${r.ruleContent})` : r.toolName))
}

/** `list_profiles` as the kit's profiles: `~` paths, named as ai-desktop names them, with the account signed in. */
export const toProfiles = (infos: ProfileInfo[], home: string): ClaudeProfile[] =>
  infos.map(info => ({
    configDir: tildify(info.configDir, home),
    label: profileId(info.configDir),
    signedIn: info.signedIn || Boolean(info.baseUrl),
    account: info.email ?? (info.baseUrl ? 'API key' : undefined),
  }))

/** The presets `workspace init` writes, which the profile picked in onboarding runs. */
export const PRESETS = ['sonnet-fixer', 'opus-fixer', 'opus-reviewer']

/** The preset workers still on another profile than the one picked: each to rewrite with `worker set`. */
export const onProfile = (workers: Worker[], profile: string) =>
  workers.filter(w => PRESETS.includes(w.id) && w.profile !== profile).map(w => ({ ...w, profile }))

/** A new worker on the profile the app knows of. */
export const newWorker = (profile: string): Worker => ({
  id: '',
  runtime: 'claude-code',
  profile,
  model: 'sonnet',
  permission_mode: 'acceptEdits',
  allow: [],
})

export const newBusiness = (): Business => ({ id: '', name: '', assets: [], packs: [], waivers: [] })
