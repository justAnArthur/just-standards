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
  /** a missing value passes: for assertions on something that may be absent, such as `meta[name=robots]` */
  optional: z.boolean().optional(),
  /** the value, resolved against the page, is the page's own URL (a self-referencing canonical) */
  self: z.boolean().optional(),
}
export const ValueAssertion = z.object(value)
export type ValueAssertion = z.infer<typeof ValueAssertion>

const HttpExpect = z.union([
  z.object({ status: z.number() }).strict(),
  z.object({ header: z.string(), ...value }).strict(),
  z.object({ body: z.literal(true), ...value }).strict(),
  z
    .object({
      select: z.string(),
      attr: z.string().optional(),
      /** how many elements may match: `max_count: 1` for one h1 */
      min_count: z.number().int().nonnegative().optional(),
      max_count: z.number().int().nonnegative().optional(),
      /** in a crawl: no two pages share the value (titles, descriptions) */
      unique: z.boolean().optional(),
      ...value,
    })
    .strict(),
])
export type HttpExpect = z.infer<typeof HttpExpect>

const RepoExpect = z.union([
  z.object({ file: z.string(), ...value }).strict(),
  /** a path that must not be tracked */
  z.object({ untracked: z.string() }).strict(),
  // at least `min` tracked files match the glob, such as `brand/**/*.svg` or `{AGENTS,CLAUDE}.md`
  z
    .object({
      glob: z.string(),
      min: z.number().int().nonnegative().default(1),
      /** at most this many: `max: 0` forbids the files */
      max: z.number().int().nonnegative().optional(),
      /** globs left out of the count: `**\/.env.example` */
      except: z.array(z.string()).default([]),
    })
    .strict(),
  /** a regex over the tracked files matching `in`; `none` fails on any match instead of requiring one */
  z.object({ grep: z.string(), in: z.string().default('**/*'), none: z.boolean().default(false) }).strict(),
])
export type RepoExpect = z.infer<typeof RepoExpect>

export const GithubField = z.enum(['description', 'topics', 'homepage', 'license', 'readme', 'archived', 'private'])
export type GithubField = z.infer<typeof GithubField>
const GithubExpect = z.object({ field: GithubField, ...value }).strict()
export type GithubExpect = z.infer<typeof GithubExpect>

const Impact = z.enum(['minor', 'moderate', 'serious', 'critical'])

/**
 * Assertions over what a `browser` visit collected, on every page visited:
 * - `axe`: no violation of WCAG 2.2 A/AA rules with one of `impact`;
 * - `console`: no `console.error` or uncaught exception, except messages matching `ignore`;
 * - `transfer`: bytes over the wire (compressed, headers included) of everything the page loaded, and of its scripts;
 * - `trackers`: before any interaction, no request to a known tracker and no tracker or third-party cookie
 *   (`core/trackers.ts`); `allow_cookies` names cookies that are fine anyway.
 */
const BrowserExpect = z.union([
  z.object({ axe: z.object({ impact: z.array(Impact).min(1).default(['serious', 'critical']) }) }).strict(),
  z.object({ console: z.object({ ignore: z.string().optional() }) }).strict(),
  z.object({ transfer: z.object({ total_kb: z.number().positive().optional(), js_kb: z.number().positive().optional() }) }).strict(),
  z.object({ trackers: z.object({ allow_cookies: z.string().optional() }) }).strict(),
])
export type BrowserExpect = z.infer<typeof BrowserExpect>

export const Check = z.discriminatedUnion('kind', [
  /**
   * A real Chromium (playwright-core) loads each page in a fresh incognito context and collects: every request (URL,
   * type, bytes, third party, tracker), the cookies set before any interaction, console errors and uncaught exceptions,
   * optionally axe-core's violations (`axe`, implied by an `axe` expectation) and where focus lands on `keyboard.tabs`
   * Tab presses. Production URLs are read from a preview being checked, with its bypass header.
   *
   * Judging is declarative where it can be: `expect` (see BrowserExpect). What a list can't say goes in `script`, the
   * item's own module:
   *   export async function probe(page, visit): unknown  // optional; runs in the settled page, may click; kept as visit.probe
   *   export default async function (visits: Visit[], ctx: Context): Outcome
   * Both may be given; the outcome fails when either does.
   *
   *   check:
   *     kind: browser
   *     pages: [/]        # paths of the asset's URL
   *     sample: 2         # and two pages sampled from the sitemap
   *     viewport: desktop
   *     expect:
   *       - axe: { impact: [serious, critical] }
   */
  z.object({
    kind: z.literal('browser'),
    pages: z.array(z.string()).min(1).default(['/']),
    /** pages sampled across the sitemap, on the asset's host, besides `pages` */
    sample: z.number().int().min(0).max(10).default(0),
    /** mobile: 390×844 at 2× with touch; desktop: 1366×900 */
    viewport: z.enum(['mobile', 'desktop']).default('mobile'),
    /** emulate `prefers-reduced-motion: reduce` */
    reduced_motion: z.boolean().default(false),
    /** run axe-core on each page (WCAG 2.2 A and AA rules) */
    axe: z.boolean().default(false),
    /** press Tab this many times from the top of the page, recording each stop */
    keyboard: z.object({ tabs: z.number().int().positive().max(200).default(40) }).optional(),
    expect: z.array(BrowserExpect).default([]),
    /** the item's module: `probe` and a default judge (see above) */
    script: z.string().optional(),
  }),
  z.object({
    kind: z.literal('http'),
    requests: z
      .array(
        z.object({
          path: z.string().default('/'),
          /** sent with the request: a crawler's `user-agent` */
          headers: z.record(z.string(), z.string()).optional(),
          expect: z.array(HttpExpect).min(1),
        }),
      )
      .min(1),
  }),
  /** The home page and a sample of the sitemap's pages on the asset's host, each held to `expect`. One crawl serves every item. */
  z.object({ kind: z.literal('crawl'), pages: z.number().int().positive().max(100).default(20), expect: z.array(HttpExpect).min(1) }),
  /** DNS records of the asset's domain (its URL's host without `www.`), read over DNS-over-HTTPS; one matching record is enough. */
  z.object({
    kind: z.literal('dns'),
    records: z
      .array(
        z.object({
          /** `@` for the domain itself, else a label under it: `_dmarc` */
          name: z.string().default('@'),
          type: z.enum(['TXT', 'MX', 'CAA', 'A', 'AAAA', 'CNAME']),
          expect: ValueAssertion.default({}),
        }),
      )
      .min(1),
  }),
  /** PageSpeed Insights: Chrome's field data (CrUX p75, falling back to the lab run when there is none) and the Lighthouse score. */
  z.object({
    kind: z.literal('psi'),
    path: z.string().default('/'),
    strategy: z.enum(['mobile', 'desktop']).default('mobile'),
    field: z.object({ lcp_ms: z.number().optional(), inp_ms: z.number().optional(), cls: z.number().optional() }).optional(),
    lab: z.object({ performance: z.number().min(0).max(1).optional() }).optional(),
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

/** What an item is about; the grid groups its columns by it. */
export const Category = z.enum([
  'seo',
  'sharing',
  'ai',
  'performance',
  'accessibility',
  'security',
  'privacy',
  'legal',
  'content',
  'conversion',
  'i18n',
  'analytics',
  'ops',
  'brand',
  'docs',
  'code',
])
export type Category = z.infer<typeof Category>

/** `must`: broken, illegal, or losing money. `should`: expected of a good asset. `nice`: polish. "Perfect" is every must and should passing. */
export const Severity = z.enum(['must', 'should', 'nice'])
export type Severity = z.infer<typeof Severity>

export const ItemKey = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'a pack/item key')

export const Item = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  title: z.string(),
  /** a column head in the grid, under 20 characters */
  label: z.string().max(20).optional(),
  why: z.string(),
  applies_to: z.array(AssetKind).min(1),
  category: Category,
  severity: Severity.default('should'),
  /** Items that must pass first, on this asset or one sharing its repo: a fix starts from what they provide (brand assets, a design system). */
  requires: z.array(ItemKey).default([]),
  /** Whether a PR's preview can show it: `false` for what only production has (the TLS certificate, DNS, field data, the CDN). */
  preview: z.boolean().default(true),
  /** Programs a worker needs to fix it (`ffmpeg`, `rsvg-convert`); a fix run checks they are installed before it starts. */
  tools: z.array(z.string().regex(/^[\w.-]+$/)).default([]),
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
  /** The run's items all passed on the PR's preview; false when some still failed after the last round; left out when nothing could be checked. */
  verified?: boolean
  /** Items still failing on the preview when the run ended. */
  unverified?: string[]
  /** How many times the worker was sent back because an item still failed on the preview. */
  rounds?: number
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
  /** Items only production can show (`preview: false`), left to the checks after the merge. */
  skipped?: string[]
}
