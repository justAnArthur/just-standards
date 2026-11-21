import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { isRepoRun, repoRun } from '../../repo-run.ts'

/** The repo's typecheck (its script, else tsc --noEmit) passes on a fresh worktree of its committed code. */
export default async function typecheckClean(ctx: Context): Promise<Outcome> {
  const ran = await repoRun(ctx)
  return isRepoRun(ran) ? ran.typecheck : ran
}
