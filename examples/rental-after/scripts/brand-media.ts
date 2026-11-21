// Renders every brand file the site serves from the sources in brand/: the logo and mark (text outlined from Inter, so
// they look the same without the font), the icons and favicon, the fleet illustrations, the 1200×630 share images and
// the og:video loop. Run `bun run brand` after changing brand/tokens.json, a headline below or a car drawing.
// Needs ffmpeg on PATH for the video; everything else is sharp and opentype.js.
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import opentype from 'opentype.js'
import sharp from 'sharp'
import subsetFont from 'subset-font'
import { company, fleet, locations, priceFrom } from '../content/business'
import tokens from '../brand/tokens.json'

const ROOT = join(import.meta.dir, '..')
const out = (path: string) => join(ROOT, path)
const C = tokens.color

const fonts = {
  400: opentype.parse(await Bun.file(out('brand/fonts/Inter-400.ttf')).arrayBuffer()),
  500: opentype.parse(await Bun.file(out('brand/fonts/Inter-500.ttf')).arrayBuffer()),
  600: opentype.parse(await Bun.file(out('brand/fonts/Inter-600.ttf')).arrayBuffer()),
}
type Weight = keyof typeof fonts

/** Text as an outlined path, with its advance width. `anchor: 'end'` right-aligns it at x. */
function text(value: string, x: number, y: number, size: number, weight: Weight, fill: string, anchor: 'start' | 'middle' | 'end' = 'start') {
  const font = fonts[weight]
  const width = font.getAdvanceWidth(value, size)
  const left = anchor === 'start' ? x : anchor === 'middle' ? x - width / 2 : x - width
  const d = font.getPath(value, left, y, size).toPathData(2)
  return { svg: `<path d="${d}" fill="${fill}"/>`, width }
}

/** Lines of text broken to fit `max` pixels. A one-letter word (Slovak "a", "v", "s") stays with the next one. */
function wrap(value: string, size: number, weight: Weight, max: number) {
  const lines: string[] = []
  let line = ''
  const words = value.split(' ').reduce<string[]>((all, word) => {
    const last = all.at(-1)
    if (last !== undefined && /^\p{L}$/u.test(last.split(' ').at(-1) ?? '')) all[all.length - 1] = `${last} ${word}`
    else all.push(word)
    return all
  }, [])
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && fonts[weight].getAdvanceWidth(next, size) > max) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

// ── the mark and the logo ───────────────────────────────────────────────────────────────────────────────────────────

/** The mark on a 64×64 grid: a rounded square with a P and a road line under it. */
function markGroup(background: string, letter: string, road: string) {
  const p = text('P', 32, 45, 40, 600, letter, 'middle')
  return `<rect width="64" height="64" rx="14" fill="${background}"/>${p.svg}<rect x="14" y="51" width="36" height="4" rx="2" fill="${road}"/>`
}

function logo(dark: boolean) {
  const ink = dark ? '#FFFFFF' : C.ink
  const accent = dark ? C.accent : C.brand
  const first = text('Príklad', 80, 44, 38, 600, ink)
  const second = text('Rent', 80 + first.width + 10, 44, 38, 600, accent)
  const width = Math.ceil(80 + first.width + 10 + second.width + 2)
  const mark = dark ? markGroup('#FFFFFF', C.brand, C.accent) : markGroup(C.brand, '#FFFFFF', C.accent)
  return {
    width,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 64" width="${width}" height="64" role="img" aria-label="${company.brand}"><title>${company.brand}</title>${mark}${first.svg}${second.svg}</svg>\n`,
    inner: `${mark}${first.svg}${second.svg}`,
  }
}

const markSvg = (size = 64) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${markGroup(C.brand, '#FFFFFF', C.accent)}</svg>\n`

/** A maskable icon: the mark's P on a full-bleed square, inside the 80% safe zone. */
const maskableSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="512" height="512"><rect width="80" height="80" fill="${C.brand}"/><g transform="translate(8 8)">${markGroup(C.brand, '#FFFFFF', C.accent)}</g></svg>`

// ── the cars ────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Drawing {
  body: string
  windows: string[]
  wheels: [number, number]
  wheelY: number
  r: number
  color: string
  trim?: string
  stripe?: string
  front: [number, number]
  rear: [number, number]
}

/** Side views on a 480×240 grid, facing right. Shapes only: no make, no model, no badge. */
const DRAWINGS: Record<(typeof fleet)[number]['id'], Drawing> = {
  city: {
    body: 'M64,190 L62,150 Q62,118 84,100 L114,84 Q122,80 134,80 L262,80 Q276,80 288,90 L330,126 L398,134 Q418,137 420,160 L420,190 Z',
    windows: ['M100,98 L124,87 L182,87 L182,124 L94,124 Z', 'M190,87 L258,87 L298,124 L190,124 Z'],
    wheels: [130, 352],
    wheelY: 190,
    r: 30,
    color: C.brand,
    front: [404, 142],
    rear: [62, 132],
  },
  compact: {
    body: 'M56,190 L54,146 Q55,116 76,100 L112,82 Q122,78 136,78 L274,78 Q288,78 300,88 L344,124 L410,132 Q430,135 432,160 L432,190 Z',
    windows: ['M94,98 L122,85 L190,85 L190,122 L88,122 Z', 'M198,85 L272,85 L314,122 L198,122 Z'],
    wheels: [126, 364],
    wheelY: 190,
    r: 31,
    color: '#2C7DA0',
    front: [416, 140],
    rear: [54, 130],
  },
  estate: {
    body: 'M48,190 L48,108 Q50,84 72,82 L276,80 Q290,80 302,90 L346,126 L414,134 Q434,137 436,160 L436,190 Z',
    windows: ['M64,92 L138,90 L138,124 L62,124 Z', 'M146,90 L212,89 L212,124 L146,124 Z', 'M220,89 L280,89 L318,124 L220,124 Z'],
    wheels: [122, 370],
    wheelY: 190,
    r: 31,
    color: C.muted,
    front: [420, 142],
    rear: [48, 128],
  },
  suv: {
    body: 'M52,184 L52,104 Q54,72 80,68 L284,66 Q300,66 312,78 L348,114 L412,122 Q432,126 434,150 L434,184 Z',
    windows: ['M70,80 L150,78 L150,112 L68,112 Z', 'M158,78 L228,77 L228,112 L158,112 Z', 'M236,77 L288,77 L322,112 L236,112 Z'],
    wheels: [128, 364],
    wheelY: 188,
    r: 35,
    color: C.brandDeep,
    front: [418, 130],
    rear: [52, 118],
  },
  minibus: {
    body: 'M44,186 L44,62 Q44,48 60,48 L332,48 Q350,48 362,64 L404,118 Q428,124 432,148 L432,186 Z',
    windows: [
      'M62,62 L124,62 L124,108 L62,108 Z',
      'M132,62 L194,62 L194,108 L132,108 Z',
      'M202,62 L264,62 L264,108 L202,108 Z',
      'M272,62 L326,62 L326,108 L272,108 Z',
      'M334,62 L350,62 L386,108 L334,108 Z',
    ],
    wheels: [120, 366],
    wheelY: 188,
    r: 32,
    color: '#E4EBF1',
    trim: C.line,
    front: [418, 134],
    rear: [44, 120],
  },
  cargo: {
    body: 'M44,186 L44,52 Q44,40 58,40 L332,40 Q350,40 362,58 L406,118 Q430,124 434,148 L434,186 Z',
    windows: ['M334,58 L352,58 L390,108 L334,108 Z'],
    wheels: [120, 368],
    wheelY: 188,
    r: 32,
    color: '#F7F9FB',
    trim: C.line,
    stripe: C.accent,
    front: [420, 134],
    rear: [44, 118],
  },
}

function carGroup(id: keyof typeof DRAWINGS) {
  const d = DRAWINGS[id]
  const wheel = (x: number) =>
    `<circle cx="${x}" cy="${d.wheelY}" r="${d.r + 5}" fill="#0B1620" fill-opacity="0.18"/><circle cx="${x}" cy="${d.wheelY}" r="${d.r}" fill="#1F2933"/><circle cx="${x}" cy="${d.wheelY}" r="${d.r * 0.45}" fill="#C9D3DC"/>`
  const stroke = d.trim ? ` stroke="${d.trim}" stroke-width="2"` : ''
  return [
    `<ellipse cx="240" cy="${d.wheelY + d.r + 4}" rx="200" ry="7" fill="#0B1620" fill-opacity="0.12"/>`,
    `<path d="${d.body}" fill="${d.color}"${stroke}/>`,
    d.stripe ? `<rect x="46" y="134" width="300" height="10" fill="${d.stripe}"/>` : '',
    ...d.windows.map(w => `<path d="${w}" fill="#BFD7EA"/>`),
    `<rect x="${d.front[0]}" y="${d.front[1]}" width="14" height="8" rx="3" fill="#FFE8A3"/>`,
    `<rect x="${d.rear[0]}" y="${d.rear[1]}" width="7" height="16" rx="2" fill="#D64545"/>`,
    wheel(d.wheels[0]),
    wheel(d.wheels[1]),
  ].join('')
}

const carSvg = (id: keyof typeof DRAWINGS) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240" width="480" height="240">${carGroup(id)}</svg>\n`

/** A fleet picture: the car on the brand's light surface, 2:1. */
const fleetCard = (id: keyof typeof DRAWINGS) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 480" width="960" height="480"><rect width="960" height="480" fill="${C.surface}"/><rect y="400" width="960" height="80" fill="${C.line}" fill-opacity="0.5"/><g transform="translate(120 70) scale(1.5)">${carGroup(id)}</g></svg>`

// ── share images and the video ──────────────────────────────────────────────────────────────────────────────────────

const SHARE = {
  home: {
    sk: { headline: 'Požičovňa áut a dodávok v Bratislave', sub: `Centrum aj letisko · od ${priceFrom} € na deň s DPH`, car: 'compact' },
    en: { headline: 'Car and van rental in Bratislava', sub: `City centre and airport · from €${priceFrom} a day incl. VAT`, car: 'compact' },
  },
  fleet: {
    sk: { headline: 'Šesť tried áut a dodávok', sub: 'Od mestského auta po dodávku 3,5 t · ceny s DPH', car: 'suv' },
    en: { headline: 'Six classes of cars and vans', sub: 'From a city car to a 3.5 t van · prices incl. VAT', car: 'suv' },
  },
  locations: {
    sk: { headline: 'Vyzdvihnite si auto v centre alebo na letisku', sub: locations.map(l => l.name.sk).join(' · '), car: 'estate' },
    en: { headline: 'Pick up in the city centre or at the airport', sub: locations.map(l => l.name.en).join(' · '), car: 'estate' },
  },
} as const

function shareImage(headline: string, sub: string, car: keyof typeof DRAWINGS, width = 1200, height = 630) {
  const pad = Math.round(width * 0.06)
  const brand = logo(true)
  const scale = 0.9
  const lines = wrap(headline, 60, 600, width * 0.5)
  const top = Math.round(height * 0.36)
  const headlineSvg = lines.map((line, i) => text(line, pad, top + i * 72, 60, 600, '#FFFFFF').svg).join('')
  const subY = top + lines.length * 72 + 20
  const subSvg = wrap(sub, 28, 400, width * 0.52).map((line, i) => text(line, pad, subY + i * 38, 28, 400, '#CFE3F1').svg).join('')
  const carScale = (width * 0.48) / 480
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<rect width="${width}" height="${height}" fill="${C.brandDeep}"/>
<circle cx="${width * 0.8}" cy="${height * 0.62}" r="${height * 0.5}" fill="${C.brand}"/>
<rect x="0" y="${height - 14}" width="${width}" height="14" fill="${C.accent}"/>
<g transform="translate(${pad} ${pad * 0.8}) scale(${scale})">${brand.inner}</g>
${headlineSvg}${subSvg}
<g transform="translate(${width * 0.5} ${height * 0.42}) scale(${carScale})">${carGroup(car)}</g>
</svg>`
}

/** The second frame of the video: three classes side by side and the lowest price. */
function lineup(lang: 'sk' | 'en', width = 1280, height = 720) {
  const title = lang === 'sk' ? `Od ${priceFrom} € na deň vrátane DPH` : `From €${priceFrom} a day including VAT`
  const sub = lang === 'sk' ? 'Mestské autá, SUV aj dodávky · centrum a letisko' : 'City cars, SUVs and vans · city centre and airport'
  const cars = (['city', 'suv', 'cargo'] as const).map((id, i) => `<g transform="translate(${70 + i * 390} 360) scale(0.78)">${carGroup(id)}</g>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<rect width="${width}" height="${height}" fill="${C.surface}"/>
<rect y="${height - 150}" width="${width}" height="150" fill="${C.line}" fill-opacity="0.6"/>
<rect x="0" y="${height - 14}" width="${width}" height="14" fill="${C.accent}"/>
${text(title, width / 2, 170, 64, 600, C.ink, 'middle').svg}
${text(sub, width / 2, 230, 30, 400, C.muted, 'middle').svg}
${cars}
</svg>`
}

// ── output ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const png = (svg: string, path: string, size?: number) => {
  const image = sharp(Buffer.from(svg), { density: 300 })
  return (size ? image.resize(size, size) : image).png({ compressionLevel: 9 }).toFile(out(path))
}

/** An .ico with PNG images inside, which every browser since 2007 reads. */
async function ico(path: string, sizes: number[]) {
  const images = await Promise.all(sizes.map(size => sharp(Buffer.from(markSvg(size)), { density: 300 }).resize(size, size).png().toBuffer()))
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach((image, i) => {
    const at = 6 + i * 16
    header.writeUInt8(sizes[i]! >= 256 ? 0 : sizes[i]!, at)
    header.writeUInt8(sizes[i]! >= 256 ? 0 : sizes[i]!, at + 1)
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(image.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += image.length
  })
  await Bun.write(out(path), Buffer.concat([header, ...images]))
}

async function video() {
  const tmp = out('.brand-tmp')
  await mkdir(tmp, { recursive: true })
  const first = join(tmp, 'a.png')
  const second = join(tmp, 'b.png')
  await sharp(Buffer.from(shareImage(SHARE.home.sk.headline, SHARE.home.sk.sub, 'compact', 1280, 720))).png().toFile(first)
  await sharp(Buffer.from(lineup('sk'))).png().toFile(second)
  // A, B, A again: a 6.4 s loop that starts and ends on the same frame. No audio, H.264, faststart.
  const filter =
    '[0:v]fps=25,format=yuv420p[a];[1:v]fps=25,format=yuv420p[b];[2:v]fps=25,format=yuv420p[c];' +
    '[a][b]xfade=transition=fade:duration=0.6:offset=2.0[ab];[ab][c]xfade=transition=fade:duration=0.6:offset=4.4[v]'
  const args = ['ffmpeg', '-y', '-loglevel', 'error']
  for (const [image, seconds] of [[first, 2.6], [second, 3.0], [first, 2.0]] as const) args.push('-loop', '1', '-t', String(seconds), '-i', image)
  args.push('-filter_complex', filter, '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out('public/og/loop.mp4'))
  const proc = Bun.spawnSync(args, { stderr: 'pipe' })
  await rm(tmp, { recursive: true, force: true })
  if (proc.exitCode !== 0) throw new Error(`ffmpeg failed: ${proc.stderr.toString()}`)
}

/** The web fonts: Inter subset to Latin and Latin Extended-A (every Slovak letter), as WOFF2 for next/font/local. */
async function webFonts() {
  const latin = Array.from({ length: 0x17f - 0x20 + 1 }, (_, i) => String.fromCodePoint(0x20 + i)).join('')
  const chars = `${latin}–—‘’“”„…€·•→›✓×`
  for (const weight of [400, 600] as const) {
    const source = Buffer.from(await Bun.file(out(`brand/fonts/Inter-${weight}.ttf`)).arrayBuffer())
    await Bun.write(out(`app/fonts/inter-${weight}.woff2`), await subsetFont(source, chars, { targetFormat: 'woff2' }))
  }
}

await Promise.all(['brand', 'brand/illustrations', 'public/og', 'public/fleet', 'public/icons', 'app/fonts'].map(dir => mkdir(out(dir), { recursive: true })))

await webFonts()

const light = logo(false)
const dark = logo(true)
await Bun.write(out('brand/logo.svg'), light.svg)
await Bun.write(out('brand/logo-dark.svg'), dark.svg)
await Bun.write(out('brand/mark.svg'), markSvg())
await Bun.write(out('public/icons/icon.svg'), markSvg())
// the header draws the logo inline from these paths
await Bun.write(
  out('components/logo-art.ts'),
  `// Generated by scripts/brand-media.ts from brand/fonts and brand/tokens.json; don't edit by hand.\nexport const LOGO = { width: ${light.width}, height: 64, inner: ${JSON.stringify(light.inner)} }\n`,
)

await png(markSvg(), 'public/icons/icon-32.png', 32)
await png(markSvg(), 'public/icons/apple-touch-icon.png', 180)
await png(markSvg(), 'public/icons/icon-192.png', 192)
await png(markSvg(), 'public/icons/icon-512.png', 512)
await png(maskableSvg(), 'public/icons/maskable-512.png', 512)
await ico('public/favicon.ico', [16, 32, 48])

for (const car of fleet) {
  await Bun.write(out(`brand/illustrations/${car.id}.svg`), carSvg(car.id))
  await sharp(Buffer.from(fleetCard(car.id))).png({ compressionLevel: 9 }).toFile(out(`public/fleet/${car.id}.png`))
}

for (const [group, byLang] of Object.entries(SHARE)) {
  for (const [lang, copy] of Object.entries(byLang)) {
    await sharp(Buffer.from(shareImage(copy.headline, copy.sub, copy.car))).png({ compressionLevel: 9 }).toFile(out(`public/og/${group}-${lang}.png`))
  }
}

await video()
console.log('brand media written: brand/, app/fonts, components/logo-art.ts, public/icons, public/fleet, public/og, public/favicon.ico')
