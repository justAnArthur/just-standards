import { z } from 'zod'

export const AssetKind = z.enum(['website', 'webapp', 'mobile', 'repo', 'social', 'newsletter', 'api'])
export type AssetKind = z.infer<typeof AssetKind>

const Follow = z.object({
  status: z.number().default(200),
  content_type: z.string().optional(),
  max_bytes: z.number().optional(),
})

/** Assertions on one value: a header, an attribute, a file, a field. A bare assertion means "exists". */
const value = {
  equals: z.string().optional(),
  matches: z.string().optional(),
  not_matches: z.string().optional(),
  /** chars for text, items for lists */
  min_length: z.number().optional(),
  max_length: z.number().optional(),
  absolute_url: z.boolean().optional(),
  json: z.boolean().optional(),
  /** fetch the value as a URL and expect this of the response */
  follow: Follow.optional(),
}
export const ValueAssertion = z.object(value)
export type ValueAssertion = z.infer<typeof ValueAssertion>

const HttpExpect = z.union([
  z.object({ status: z.number() }).strict(),
  z.object({ header: z.string(), ...value }).strict(),
  z.object({ body: z.literal(true), ...value }).strict(),
  z.object({ select: z.string(), attr: z.string().optional(), ...value }).strict(),
])
export type HttpExpect = z.infer<typeof HttpExpect>

const RepoExpect = z.union([
  z.object({ file: z.string(), ...value }).strict(),
  /** a path that must not be tracked */
  z.object({ untracked: z.string() }).strict(),
])
export type RepoExpect = z.infer<typeof RepoExpect>

export const GithubField = z.enum(['description', 'topics', 'homepage', 'license', 'readme', 'archived', 'private'])
export type GithubField = z.infer<typeof GithubField>
const GithubExpect = z.object({ field: GithubField, ...value }).strict()
export type GithubExpect = z.infer<typeof GithubExpect>

export const Check = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('http'),
    requests: z.array(z.object({ path: z.string().default('/'), expect: z.array(HttpExpect).min(1) })).min(1),
  }),
  z.object({ kind: z.literal('repo'), expect: z.array(RepoExpect).min(1) }),
  z.object({ kind: z.literal('github'), expect: z.array(GithubExpect).min(1) }),
  z.object({ kind: z.literal('script'), file: z.string().default('check.ts') }),
  z.object({
    kind: z.literal('ai'),
    prompt: z.string(),
    model: z.string().default('haiku'),
    /** Pages of the asset's URL the model reads, as served (scripts, styles and SVG removed) */
    pages: z.array(z.string()).default(['/']),
  }),
])
export type Check = z.infer<typeof Check>

export const Item = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  title: z.string(),
  /** a column head in the grid, under 20 characters */
  label: z.string().max(20).optional(),
  why: z.string(),
  applies_to: z.array(AssetKind).min(1),
  owner_role: z.string().optional(),
  check: Check,
})
export type Item = z.infer<typeof Item>

export const Pack = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  title: z.string(),
  description: z.string().optional(),
  /** in order; `since` is the pack version that added the item */
  items: z.array(z.union([z.string(), z.object({ id: z.string(), since: z.number().int().positive() })])),
  changelog: z.array(z.object({ version: z.number(), date: z.string(), notes: z.string() })).default([]),
})
export type Pack = z.infer<typeof Pack>

export const Asset = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: AssetKind,
  url: z.url().optional(),
  /** owner/name on GitHub */
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).optional(),
  /** local checkout; `~` allowed */
  path: z.string().optional(),
  stack: z.string().optional(),
  /** The name of a secret in the workspace's `secrets.yml` that holds the Vercel project's Protection Bypass for Automation, for checking PR previews */
  vercel_bypass: z.string().optional(),
})
export type Asset = z.infer<typeof Asset>

export const Business = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  assets: z.array(Asset).min(1),
  /** `website` follows the latest version, `website@1` stays on it */
  packs: z.array(z.string().regex(/^[a-z0-9-]+(@\d+)?$/)),
  worker: z.string().optional(),
  waivers: z
    .array(z.object({ item: z.string(), asset: z.string().optional(), reason: z.string(), until: z.iso.date().optional() }))
    .default([]),
})
export type Business = z.infer<typeof Business>

/** Claude Code's `--permission-mode` values. */
export const PermissionMode = z.enum(['manual', 'acceptEdits', 'auto', 'dontAsk', 'plan', 'bypassPermissions'])
export type PermissionMode = z.infer<typeof PermissionMode>

export const Worker = z.object({
  id: z.string(),
  runtime: z.literal('claude-code'),
  profile: z.string().default('~/.claude'),
  model: z.string(),
  effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
  // Claude Code renamed `default` to `manual`; older workers.yml files still say `default`.
  permission_mode: z.preprocess(mode => (mode === 'default' ? 'manual' : mode), PermissionMode.default('acceptEdits')),
  allow: z.array(z.string()).default([]),
})
export type Worker = z.infer<typeof Worker>

export type State = 'pass' | 'fail' | 'error'

export interface Outcome {
  state: State
  evidence: string
}

export interface Result extends Outcome {
  business: string
  asset: string
  /** `pack/item` */
  item: string
  item_version: number
  checked_at: string
  ms: number
}

/** One fix run, as `standards fix` records it in `.state/runs/<id>/run.json`. */
export interface RunRecord {
  id: string
  business: string
  asset: string
  /** `pack/item` */
  items: string[]
  worker: string
  model: string
  branch: string
  worktree: string
  started_at: string
  finished_at?: string
  /** Left out while it runs. */
  ms?: number
  state: 'running' | 'done' | 'failed' | 'stopped'
  pr?: { url: string; number: number; state: 'open' | 'merged' | 'closed'; draft?: boolean }
  /** How the worktree got its dependencies; left out when it has no lockfile. */
  setup?: { command: string; ok: boolean; error?: string }
  /** The run's items checked on the PR's preview deployment. */
  preview?: Preview
  cost_usd?: number
  session_id?: string
  /** Why it failed or stopped. */
  error?: string
  /** What the worker said it did, through the `finish` tool. */
  summary?: string
  /** What a person must provide before the PR can merge, through the `finish` tool. The PR is then a draft. */
  missing?: string[]
}

/** The run's items checked on the preview deployment of the PR's head commit. */
export interface Preview {
  /** The head commit the preview was looked up for. */
  sha: string
  checked_at: string
  /** Left out when there is no preview deployment (yet). */
  url?: string
  results: Result[]
  /** Why nothing was checked: no deployment yet, or a protected one. */
  note?: string
}
