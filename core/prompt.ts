import { join } from 'node:path'
import { cellsOf, readResults } from './cells.ts'
import type { Workspace } from './load.ts'
import type { Business } from './schema.ts'

export class PromptError extends Error {}

const RULES = (branch: string) => `## How to work

- You are in a git worktree of this asset, on the branch \`${branch}\`. Change files only here.
- Make the smallest change that makes each check pass. Follow the repo's own conventions (AGENTS.md, CLAUDE.md, linters) over the recipe where they differ.
- Run the repo's own checks (typecheck, lint, tests) before committing, when it has them.
- Commit with Conventional Commits (\`feat:\`, \`fix:\`, \`docs:\`, \`chore:\`). No \`Co-Authored-By\` trailer and no tool or AI credit in commits or the pull request.
- Push the branch and open a pull request with \`gh pr create\`. Its body says what changed and how to verify each standard.
- Never push to the default branch, never force-push, never merge.
- When a standard needs something only a person can give (an asset, a decision, a secret), do the rest, say what is missing in the PR body, and stop.
- End your last message with the pull request URL alone on its last line.
- When you are done, call the \`finish\` tool (\`mcp__standards__finish\`) with the pull request URL, a short summary of what you changed, and anything a person must still do, then stop. Without a pull request, call it anyway, leave out the URL and say why in the summary.`

/** The instructions a worker gets to fix one or more failing items on one asset. */
export async function fixPrompt(ws: Workspace, business: Business, assetId: string, itemKeys: string[], branch: string) {
  const cells = cellsOf(business, ws).filter(cell => cell.asset.id === assetId)
  if (cells.length === 0) throw new PromptError(`${business.id} has no asset ${assetId}, or no items apply to it`)
  const asset = cells[0]!.asset
  const results = await readResults(ws, business.id)

  const sections = await Promise.all(
    itemKeys.map(async key => {
      const cell = cells.find(c => c.item.key === key)
      if (!cell) throw new PromptError(`${key} does not apply to ${business.id}/${assetId}`)
      const result = results[`${assetId}:${key}`]
      const recipe = Bun.file(join(cell.item.dir, 'recipe.md'))
      return [
        `## ${cell.item.title} (\`${key}\` v${cell.item.version})`,
        `Why: ${cell.item.why}`,
        result ? `Last check (${result.checked_at.slice(0, 10)}): **${result.state}**: ${result.evidence}` : 'Not checked yet.',
        `The check:\n\n\`\`\`json\n${JSON.stringify(cell.item.check, null, 2)}\n\`\`\``,
        (await recipe.exists()) ? `### Recipe\n\n${(await recipe.text()).trim()}\n\nFiles the recipe names are in its pack: \`${ws.packs.get(cell.item.pack)?.dir}\`.` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    }),
  )

  const facts = [
    `- Business: ${business.name}`,
    `- Asset: ${asset.id} (${asset.kind}${asset.stack ? `, stack ${asset.stack}` : ''})`,
    asset.url && `- Live URL: ${asset.url}`,
    asset.repo && `- GitHub: ${asset.repo}`,
  ].filter(Boolean)

  return [
    `# Bring ${business.name} / ${asset.id} up to standard`,
    facts.join('\n'),
    `The standards below fail on this asset. Make them pass.`,
    ...sections,
    RULES(branch),
  ].join('\n\n')
}
