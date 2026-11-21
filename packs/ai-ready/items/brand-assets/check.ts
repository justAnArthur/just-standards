import { basename, dirname } from 'node:path'
import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { checkout, isOutcome } from '../../checkout.ts'

/** A folder named `brand` or `branding`, anywhere: `brand/`, `public/brand/`, `assets/brand/`, `.github/brand/`. */
const BRAND_DIR = /(^|\/)(brand|branding)$/
const INDEX = /^(README|INDEX|index|readme|BRAND|brand)\.md$/
const LOGO = /(logo|mark|lockup|wordmark|icon)[^/]*\.svg$/i
const COLOUR = /#[0-9a-f]{3,8}\b|\b(rgb|hsl|oklch|oklab)a?\(/i
const FONT = /\b(fonts?|typefaces?|typography)\b|^#+\s*type\b/im
const FONT_FILE = /\.(woff2?|ttf|otf)$/i
const TOKENS = /\.(css|scss|json|ts|js)$/

export default async function brandAssets(ctx: Context): Promise<Outcome> {
  const co = await checkout(ctx)
  if (isOutcome(co)) return co
  const dirs = [...new Set(co.files.flatMap(path => {
    const parts = dirname(path).split('/')
    const at = parts.findIndex((_, index) => BRAND_DIR.test(parts.slice(0, index + 1).join('/')))
    return at >= 0 ? [parts.slice(0, at + 1).join('/')] : []
  }))]
  if (dirs.length === 0) return { state: 'fail', evidence: `no brand folder (brand/, public/brand/, assets/brand/…) in ${co.where}` }

  // the folder that has the most of what is asked, so a stray `brand/` route doesn't hide the real one
  const reports = await Promise.all(
    dirs.map(async dir => {
      const files = co.files.filter(path => path.startsWith(`${dir}/`))
      const index = files.find(path => dirname(path) === dir && INDEX.test(basename(path)))
      const text = index ? ((await co.read(index)) ?? '') : ''
      const tokens = await Promise.all(files.filter(path => TOKENS.test(path)).map(path => co.read(path)))
      const others = files.filter(path => path !== index)
      // each file is said for, by its name or by the subfolder it sits in
      const unsaid = others.filter(path => {
        const relative = path.slice(dir.length + 1)
        return !text.includes(basename(path)) && !text.includes(relative.split('/')[0] as string)
      })
      const names = (paths: string[]) => `${paths.slice(0, 3).map(path => basename(path)).join(', ')}${paths.length > 3 ? ` and ${paths.length - 3} more` : ''}`
      const missing = [
        !files.some(path => LOGO.test(path)) && 'no logo SVG',
        !index && 'no README saying what each file is for',
        !(COLOUR.test(text) || tokens.some(token => token && COLOUR.test(token))) && 'no brand colours (hex, rgb(), oklch()…) in a README or tokens file',
        !(FONT.test(text) || files.some(path => FONT_FILE.test(path))) && 'no brand fonts, named in the README or as files',
        index && unsaid.length > 0 && `${basename(index)} doesn't say what ${names(unsaid)} ${unsaid.length === 1 ? 'is' : 'are'} for`,
      ].filter((entry): entry is string => Boolean(entry))
      return { dir, files, missing }
    }),
  )
  const best = reports.sort((a, b) => a.missing.length - b.missing.length)[0]!
  if (best.missing.length > 0) return { state: 'fail', evidence: `${best.dir}/: ${best.missing.join('; ')}` }
  return { state: 'pass', evidence: `${best.dir}/: ${best.files.length} files, with a logo SVG, colours, fonts and a README for each` }
}
