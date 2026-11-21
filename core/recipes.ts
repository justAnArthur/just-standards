import { join } from 'node:path'
import type { Workspace } from './load.ts'

/** The headings `packs/RECIPE.md` makes required. */
export const REQUIRED_SECTIONS = ['## Done when', '## Hand off only when']

/** Every item whose `recipe.md` is missing or lacks a required section, as `pack/item: what`. */
export async function recipeProblems(ws: Workspace) {
  const problems: string[] = []
  for (const pack of ws.packs.values()) {
    for (const item of pack.entries) {
      const file = Bun.file(join(item.dir, 'recipe.md'))
      if (!(await file.exists())) {
        problems.push(`${item.key}: no recipe.md`)
        continue
      }
      const lines = (await file.text()).split('\n').map(line => line.trim())
      const missing = REQUIRED_SECTIONS.filter(heading => !lines.includes(heading))
      if (missing.length) problems.push(`${item.key}: recipe.md has no ${missing.map(h => `"${h}"`).join(' or ')}`)
    }
  }
  return problems
}
