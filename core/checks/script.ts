import { join } from 'node:path'
import type { Check, Outcome } from '../schema.ts'
import type { Context } from './context.ts'

type ScriptCheck = Extract<Check, { kind: 'script' }>

/** An item's own `check.ts`: `export default async (ctx: Context) => Outcome`. */
export async function script(check: ScriptCheck, ctx: Context): Promise<Outcome> {
  const module = await import(join(ctx.item.dir, check.file))
  return module.default(ctx)
}
