import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { isRepoRun, repoRun } from '../../repo-run.ts'

/** The repo's own lint script passes on a fresh worktree of its committed code. */
export default async function lintClean(ctx: Context): Promise<Outcome> {
  const ran = await repoRun(ctx)
  return isRepoRun(ran) ? ran.lint : ran
}
