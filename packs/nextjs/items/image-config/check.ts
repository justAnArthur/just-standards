import type { Context } from '../../../../core/checks/context.ts'
import { closing, configFiles, lineAt, listed, perApp, withoutComments } from '../../next.ts'

/** Each `images: {…}` object in a config file, with where it starts. */
function imageBlocks(text: string) {
  const code = withoutComments(text)
  return [...code.matchAll(/(^|[\s,{])images\s*:\s*\{/g)].map(match => {
    const open = match.index + match[0].length - 1
    return { code, open, block: code.slice(open, closing(code, open) + 1) }
  })
}

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const hits: string[] = []
    for (const file of await configFiles(app, co)) {
      for (const { code, open, block } of imageBlocks(file.text)) {
        const at = (index: number) => `${file.path}:${lineAt(code, open + index)}`
        const domains = block.match(/[{,\s]domains\s*:/)
        if (domains?.index !== undefined) hits.push(`${at(domains.index)} (images.domains is deprecated: remotePatterns)`)
        for (const match of block.matchAll(/hostname\s*:\s*['"`]\*\*?['"`]|new URL\(\s*['"`]https?:\/\/\*\*?[/'"`]/g)) {
          hits.push(`${at(match.index)} (a pattern that allows any host)`)
        }
        const svg = block.match(/dangerouslyAllowSVG\s*:\s*true/)
        if (svg?.index !== undefined && !/contentSecurityPolicy\s*:/.test(block)) hits.push(`${at(svg.index)} (SVGs allowed without images.contentSecurityPolicy)`)
      }
    }
    if (hits.length > 0) return { fail: `the image optimizer accepts more than it should: ${listed(hits)}` }
    return { pass: 'images take remotePatterns for named hosts' }
  })
