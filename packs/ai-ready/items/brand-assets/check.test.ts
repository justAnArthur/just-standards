import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../fixture.ts'
import check from './check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const run = async (files: Record<string, string | Uint8Array>) => {
  const dir = await gitRepo(files)
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}
const README = '# Brand\n\n| file | for |\n|---|---|\n| `logo.svg` | light backgrounds |\n| `logo-white.svg` | dark |\n| `photos/` | hero photos |\n\nRed `#d4002a`. Fonts: Inter.\n'

test('a brand folder with logos, colours, fonts and a README for each file passes', async () => {
  const outcome = await run({
    'public/brand/README.md': README,
    'public/brand/logo.svg': '<svg/>',
    'public/brand/logo-white.svg': '<svg/>',
    'public/brand/photos/hero.jpg': 'x',
  })
  expect(outcome).toEqual({ state: 'pass', evidence: expect.stringContaining('public/brand/: 4 files') })
})

test('names what is missing', async () => {
  expect((await run({ 'src/index.ts': '' })).evidence).toStartWith('no brand folder')
  const bare = await run({ '.github/brand/logo.svg': '<svg/>', '.github/brand/og.png': 'x' })
  expect(bare.evidence).toBe('.github/brand/: no README saying what each file is for; no brand colours (hex, rgb(), oklch()…) in a README or tokens file; no brand fonts, named in the README or as files')
  const unsaid = await run({ 'brand/README.md': README, 'brand/logo.svg': '<svg/>', 'brand/logo-white.svg': '<svg/>', 'brand/mark.svg': '<svg/>' })
  expect(unsaid.evidence).toBe("brand/: README.md doesn't say what mark.svg is for")
})

test('colours may come from a tokens file and fonts from font files', async () => {
  const outcome = await run({
    'assets/brand/README.md': '- `logo.svg`: the logo\n- `colors.json`: the palette\n- `Inter.woff2`: the face\n',
    'assets/brand/logo.svg': '<svg/>',
    'assets/brand/colors.json': '{"red":"#d4002a"}',
    'assets/brand/Inter.woff2': 'x',
  })
  expect(outcome.state).toBe('pass')
})

/** A PNG header that says it is `width` × `height`. */
function png(width: number, height: number) {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return bytes
}

test("without an SVG, a raster logo of 512 px or more counts, in the folder or named by the README from elsewhere", async () => {
  const readme = "# Brand\n\nThe logo is `public/acme-logo.png`. Indigo `#2e2a6b`. Fonts: Geist.\n"
  const big = await run({ "brand/README.md": readme, "public/acme-logo.png": png(512, 512) })
  expect(big).toEqual({ state: "pass", evidence: "brand/: 1 files, with a logo (public/acme-logo.png), colours, fonts and a README for each" })
  const small = await run({ "brand/README.md": readme, "public/acme-logo.png": png(64, 64) })
  expect(small.evidence).toBe("brand/: no logo: an SVG, or a PNG, WebP or JPEG at least 512 px on its long side")
})
