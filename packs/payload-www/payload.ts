import type { Context } from '../../core/checks/context.ts'
import type { Outcome } from '../../core/schema.ts'
import { type Checkout, type Finding, type NextApp, perApp } from '../nextjs/next.ts'

export { grep, lines, listed, source, withoutComments } from '../nextjs/next.ts'
export type { Checkout, Finding }

/** A Next app that depends on payload: the host of a Payload site. */
export interface PayloadApp extends NextApp {
  /** dependencies and devDependencies of its package.json */
  deps: Record<string, string>
  /** its payload.config.*, when tracked */
  config?: { path: string; text: string }
  /** where its code lives: `src/` when it has one, else the app root */
  src: string
}

const at = (app: NextApp, path: string) => (app.root ? `${app.root}/${path}` : path)

/** The org's toolkit, published from github.com/justAnArthur/payload-www. */
export const TOOLKIT = '@justanarthur/payload-www'
export const ORG_PLUGINS = ['@justanarthur/payload-plugin-seo', '@justanarthur/payload-imagehash-plugin', '@justanarthur/payload-plugin-translator']

/** Runs `each` on every Payload host app of the checkout; Next apps without payload pass as not applying. */
export function perPayloadApp(ctx: Context, each: (app: PayloadApp, co: Checkout) => Promise<Finding>, options?: { remote?: boolean }): Promise<Outcome> {
  return perApp(
    ctx,
    async (app, co) => {
      let manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {}
      try {
        manifest = JSON.parse((await co.read(at(app, 'package.json'))) ?? '{}')
      } catch {}
      const deps = { ...manifest.devDependencies, ...manifest.dependencies }
      if (!deps.payload) return { pass: 'not a Payload app' }
      const configPath = app.files.find(path => /(^|\/)(src\/)?payload\.config\.(ts|mts|js|mjs)$/.test(path.slice(app.root ? app.root.length + 1 : 0)))
      const text = configPath ? await co.read(configPath) : undefined
      const src = app.files.some(path => path.startsWith(at(app, 'src/'))) ? at(app, 'src') : app.root
      return each({ ...app, deps, config: configPath && text !== undefined ? { path: configPath, text } : undefined, src }, co)
    },
    options,
  )
}

/** The app's own code: TypeScript and JavaScript sources outside generated and test files. */
export const codeOf = (app: PayloadApp) =>
  app.files.filter(
    path => /\.(tsx?|jsx?|mjs)$/.test(path) && !/(\.(test|spec|stories)\.|\.d\.ts$|(^|\/)(__tests__|tests?|e2e|public|migrations|node_modules)\/|payload-types\.ts$|importMap\.js$)/.test(path),
  )
