import { join } from 'node:path'
import { type Cell, cellsOf, readResults } from './cells.ts'
import type { Setup } from './deps.ts'
import type { Workspace } from './load.ts'
import { Category, type Business, type Result, Severity } from './schema.ts'

export class PromptError extends Error {}

/** Notes on a stack the engine has learned across repos, beside the packs: `stacks/<stack>.md`. */
export const BUNDLED_STACKS = join(import.meta.dir, '../stacks')

const RULES = (branch: string) => `## How to work

- You are in a git worktree of this asset, on the branch \`${branch}\`. Change files only here.
- Do every standard below in this pull request. Size is not a reason to leave one out: a change that touches many files, needs a framework detail looked up, or seems to deserve a pull request of its own still belongs here.
- Make the smallest change that makes each check pass. Follow the repo's own conventions (AGENTS.md, CLAUDE.md, linters) over the recipe where they differ.
- Make what a standard needs from what the repo has: its design system, brand assets, content and docs. Don't leave a file for a person to add when you can make it.
- Run the repo's own checks (typecheck, lint, tests) before committing, when it has them.
- Commit with Conventional Commits (\`feat:\`, \`fix:\`, \`docs:\`, \`chore:\`). No \`Co-Authored-By\` trailer and no tool or AI credit in commits or the pull request.
- Push the branch and open a pull request with \`gh pr create\`. Its body says what changed and how to verify each standard, including any check to run after merging.
- When a standard needs something only a person can give (a secret, a paid account, a legal fact that is neither on the site nor in the business context), do the rest, open the pull request as a draft (\`gh pr create --draft\`), and say what is missing in its body.
- Then wait for the pull request's checks: \`gh pr checks <number> --watch\`, with a 10-minute timeout on the command. When it reports no checks, go on. When one fails, read why (\`gh run view <run-id> --log-failed\` for a GitHub Actions run), fix it, push, and wait again. After two rounds of fixes, or when a failing check has no log you can read (a deploy preview), stop and say in the summary what still fails.
- Never push to the default branch, never force-push, never merge.
- End your last message with the pull request URL alone on its last line.
- When you are done, call the \`finish\` tool (\`mcp__standards__finish\`) with the pull request URL, a short summary of what you changed, and \`missing\`: what a person must provide or fix before the pull request can merge (nothing else: checks to run after merging belong in the PR body). Then stop. Without a pull request, call it anyway, leave out the URL and say why in the summary.`

const readText = async (path: string) => {
  const file = Bun.file(path)
  return (await file.exists()) ? (await file.text()).trim() || undefined : undefined
}

/** `businesses/<id>.context.md`: what a worker should know about the business (brand, legal entity, locations, languages). */
export const contextFile = (ws: Workspace, businessId: string) => join(ws.dir, 'businesses', `${businessId}.context.md`)

/** The workspace's notes on a stack win over the bundled ones. */
async function stackNotes(ws: Workspace, stack: string | undefined) {
  if (!stack || !/^[\w.-]+$/.test(stack)) return undefined
  return (await readText(join(ws.dir, 'stacks', `${stack}.md`))) ?? (await readText(join(BUNDLED_STACKS, `${stack}.md`)))
}

const stateLine = (result: Result | undefined) =>
  result ? `Last check (${result.checked_at.slice(0, 10)}): **${result.state}**: ${result.evidence}` : 'Not checked yet.'

async function itemSection(ws: Workspace, cell: Cell, result: Result | undefined, heading = '##') {
  const { item } = cell
  const recipe = await readText(join(item.dir, 'recipe.md'))
  return [
    `${heading} ${item.title} (\`${item.key}\` v${item.version}, ${item.severity})`,
    `Why: ${item.why}`,
    item.requires.length ? `Builds on: ${item.requires.map(key => `\`${key}\``).join(', ')}.` : '',
    item.sources.length ? `Follows: ${item.sources.map(source => `[${source.title}](${source.url})`).join(', ')}. Where the source and the recipe differ, the source wins: read it.` : '',
    stateLine(result),
    `The check:\n\n\`\`\`json\n${JSON.stringify(item.check, null, 2)}\n\`\`\``,
    recipe ? `${heading}# Recipe\n\n${recipe}\n\nFiles the recipe names are in its pack: \`${ws.packs.get(item.pack)?.dir}\`.` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

interface Background {
  setup?: Setup
  /** Programs the items need, checked to be installed. */
  tools?: string[]
}

/** What every brief starts with: the asset, the sites it shares a repo with, the business context and the stack notes. */
async function intro(ws: Workspace, business: Business, cells: Cell[], { setup, tools = [] }: Background = {}) {
  const asset = cells[0]!.asset
  const siblings = business.assets.filter(other => other.id !== asset.id && other.repo && other.repo.toLowerCase() === asset.repo?.toLowerCase())
  const facts = [
    `- Business: ${business.name}`,
    `- Asset: ${asset.id} (${asset.kind}${asset.stack ? `, stack ${asset.stack}` : ''})`,
    asset.url && `- Live URL: ${asset.url}`,
    asset.repo && `- GitHub: ${asset.repo}`,
    siblings.length > 0 &&
      `- The same repo also serves: ${siblings.map(other => `${other.id}${other.url ? ` (${other.url})` : ''}`).join(', ')}. A change to shared code changes them too: keep them working.`,
    setup?.ok && `- Dependencies: installed with \`${setup.command}\``,
    setup && !setup.ok && `- Dependencies: \`${setup.command}\` failed, so install them yourself before running the repo's checks:\n\n\`\`\`text\n${setup.error}\n\`\`\``,
    tools.length > 0 && `- Installed for these standards: ${tools.map(tool => `\`${tool}\``).join(', ')}`,
  ].filter(Boolean)
  const context = await readText(contextFile(ws, business.id))
  const notes = await stackNotes(ws, asset.stack)
  return [facts.join('\n'), context && `## About ${business.name}\n\n${context}`, notes && `## Notes on the ${asset.stack} stack\n\n${notes}`].filter(Boolean)
}

function cellsOfAsset(ws: Workspace, business: Business, assetId: string) {
  const cells = cellsOf(business, ws).filter(cell => cell.asset.id === assetId)
  if (cells.length === 0) throw new PromptError(`${business.id} has no asset ${assetId}, or no items apply to it`)
  return cells
}

/** The instructions a worker gets to fix one or more failing items on one asset. */
export async function fixPrompt(ws: Workspace, business: Business, assetId: string, itemKeys: string[], branch: string, background: Background = {}) {
  const cells = cellsOfAsset(ws, business, assetId)
  const results = await readResults(ws, business.id)
  const sections = await Promise.all(
    itemKeys.map(key => {
      const cell = cells.find(c => c.item.key === key)
      if (!cell) throw new PromptError(`${key} does not apply to ${business.id}/${assetId}`)
      return itemSection(ws, cell, results[`${assetId}:${key}`])
    }),
  )
  return [
    `# Bring ${business.name} / ${cells[0]!.asset.id} up to standard`,
    ...(await intro(ws, business, cells, background)),
    `The standards below fail on this asset. Make them pass.`,
    ...sections,
    RULES(branch),
  ].join('\n\n')
}

const GLYPH: Record<Result['state'], string> = { pass: '✓', fail: '✕', error: '!' }
const CATEGORY_ORDER = Category.options
const SEVERITY_ORDER = Severity.options

export interface SpecFilter {
  severities?: string[]
  categories?: string[]
}

/**
 * Every standard the asset has adopted, grouped by category, as one Markdown brief: the definition of done for whoever
 * builds or rebuilds the asset, with where each stands today.
 */
export async function specOf(ws: Workspace, business: Business, assetId: string, filter: SpecFilter = {}) {
  const all = cellsOfAsset(ws, business, assetId)
  const cells = all
    .filter(cell => !filter.severities?.length || filter.severities.includes(cell.item.severity))
    .filter(cell => !filter.categories?.length || filter.categories.includes(cell.item.category))
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.item.category) - CATEGORY_ORDER.indexOf(b.item.category) ||
        SEVERITY_ORDER.indexOf(a.item.severity) - SEVERITY_ORDER.indexOf(b.item.severity),
    )
  if (cells.length === 0) throw new PromptError(`no standards of ${business.id}/${assetId} match the filter`)
  const results = await readResults(ws, business.id)
  const resultOf = (cell: Cell) => results[`${assetId}:${cell.item.key}`]

  const table = [
    '| category | standard | severity | now |',
    '|---|---|---|---|',
    ...cells.map(cell => {
      const result = resultOf(cell)
      return `| ${cell.item.category} | ${cell.item.title} (\`${cell.item.key}\`) | ${cell.item.severity} | ${result ? GLYPH[result.state] : '·'} |`
    }),
  ].join('\n')

  const groups: string[] = []
  for (const category of CATEGORY_ORDER) {
    const inCategory = cells.filter(cell => cell.item.category === category)
    if (inCategory.length === 0) continue
    groups.push(`## ${category}`, ...(await Promise.all(inCategory.map(cell => itemSection(ws, cell, resultOf(cell), '###')))))
  }

  return [
    `# Standards for ${business.name} / ${assetId}`,
    ...(await intro(ws, business, cells)),
    `Every standard below applies to this asset: it is done when each check passes. \`must\` is broken, illegal or losing money; \`should\` is expected; \`nice\` is polish. The "now" column is the last check of the live asset (✓ pass, ✕ fail, ! error, · not checked).`,
    table,
    ...groups,
  ].join('\n\n')
}
