#!/usr/bin/env node
// Render a README banner (1200×600 SVG, light + dark) from a JSON spec.
// Text is converted to outlines with the bundled Inter / Geist Mono fonts, so it renders
// the same in every browser and on GitHub without web fonts.
//
// usage: node banner.mjs <spec.json> <out.svg>
// spec (only `title` is required):
// {
//   "title": "8-puzzle solver",
//   "subtitle": "Up to two lines of muted text under the title.",
//   "eyebrow": "FIIT STU · Artificial Intelligence · 2023",
//   "name": "8-puzzle-by-A-star-algorithm",        // top-left label next to the icon; defaults to title
//   "cta": "Live demo",                            // dark button top-right
//   "accent": "#fcd34d",
//   "icon": "<rect x='8' y='8' width='16' height='16' class='accent'/>",  // inner SVG on a 32×32 grid
//   "stats": [{ "value": "5", "label": "test states" }],                   // 0–4 cards, or:
//   "code": "bunx @justanarthur/modo init my-ds",                          // one wide command card
//   "codePrompt": ">",                            // prompt before `code`; default "$", "" for none
//   "visual": "<g>…</g>",                         // subject drawing on a 360×220 grid, right side
//   "footerLeft": "github.com/justAnArthur/…",
//   "footerRight": "Python · standard library"
// }
// Classes available inside icon/visual: fg, muted, faint, card, line, accent, accent-stroke, bg.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'

const here = dirname(fileURLToPath(import.meta.url))
const font = f => opentype.parse(readFileSync(join(here, '../assets/fonts', f)).buffer)
const F = { 400: font('Inter-400.ttf'), 500: font('Inter-500.ttf'), 600: font('Inter-600.ttf'), mono: font('GeistMono-400.ttf') }

const args = process.argv.slice(2)
const theme = args.includes('--dark') ? 'dark' : null   // --dark: bake the dark palette in (previews only)
const [specPath, outPath] = args.filter(a => !a.startsWith('--'))
if (!specPath || !outPath) { console.error('usage: node banner.mjs <spec.json> <out.svg>'); process.exit(1) }
const s = JSON.parse(readFileSync(specPath, 'utf8'))
if (!s.title) throw new Error('spec.title is required')

const W = 1200, H = 600, L = 56, R = 1144
const accent = s.accent || '#fcd34d'
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const width = (t, size, f = F[400]) => f.getAdvanceWidth(t, size)
const defs = new Map()   // one outline per glyph, reused with <use>
const fontKey = f => Object.keys(F).find(k => F[k] === f)
const text = (t, x, y, size, cls, f = F[400], anchor = 'start', maxW = Infinity) => {
  const w = width(t, size, f)
  if (w > maxW + 0.5) throw new Error(`text "${t}" is ${Math.round(w)}px wide, more than the ${maxW}px it has; shorten it`)
  const dx = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
  const uses = []
  f.forEachGlyph(t, dx, y, size, undefined, (g, gx, gy, gs) => {
    const id = `g${fontKey(f)}-${g.index}`
    if (!defs.has(id)) {
      const d = g.getPath(0, 0, f.unitsPerEm).toPathData(0)
      if (!d) return
      defs.set(id, d)
    }
    uses.push(`<use href="#${id}" transform="translate(${+gx.toFixed(2)} ${+gy.toFixed(2)}) scale(${+(gs / f.unitsPerEm).toFixed(5)})"/>`)
  })
  return `<g class="${cls}">${uses.join('')}</g>`
}
const wrap = (t, size, maxW, f = F[400]) => {
  const lines = []; let cur = ''
  for (const w of t.split(/\s+/)) {
    const next = cur ? cur + ' ' + w : w
    if (width(next, size, f) <= maxW || !cur) cur = next; else { lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines
}

const out = []
const hasBottom = (s.stats && s.stats.length) || s.code
const textMaxW = s.visual ? 640 : 760

// right-side subject drawing; <text> inside it is outlined too
// (attributes: x, y, size, class, anchor = start|middle|end, weight = 400|500|600|mono)
const outline = frag => frag.replace(/<text([^>]*)>([^<]*)<\/text>/g, (_, attrs, t) => {
  const a = Object.fromEntries([...attrs.matchAll(/([\w-]+)=["']([^"']*)["']/g)].map(m => [m[1], m[2]]))
  const x = +a.x || 0, anchor = a.anchor || 'start'
  const room = anchor === 'end' ? x : anchor === 'middle' ? 2 * Math.min(x, 360 - x) : 360 - x
  return text(t.replace(/&amp;/g, '&').replace(/&lt;/g, '<'), x, +a.y || 0, +a.size || 16, a.class || 'fg', F[a.weight || 400], anchor, room)
})
// header: icon + name, optional CTA
const iconInner = () => s.icon ? outline(s.icon) : text((s.name || s.title).replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase(), 16, 22, 15, 'accent', F[600], 'middle')
out.push(`<g transform="translate(${L} 44) scale(1.25)"><rect class="icon" width="32" height="32" rx="8"/>${iconInner()}</g>`)
out.push(text(s.name || s.title, 110, 72, 20, 'fg', F[500], 'start', s.cta ? 620 : 1000))
if (s.cta) {
  const bw = Math.ceil(width(s.cta, 16, F[500])) + 56
  out.push(`<rect class="btn" x="${R - bw}" y="42" width="${bw}" height="44" rx="10"/>`)
  out.push(text(s.cta, R - bw / 2, 69.5, 16, 'btn-text', F[500], 'middle'))
}

// text block; vertically centred when there are no bottom cards
let y = hasBottom ? 170 : 205
if (s.eyebrow) { out.push(text(s.eyebrow, L, y, 16, 'muted')); y += 60 } else y += 44
let ts = 54
while (width(s.title, ts, F[500]) > textMaxW && ts > 38) ts -= 2
if (width(s.title, ts, F[500]) > textMaxW) throw new Error(`title too long for one line: "${s.title}"`)
out.push(text(s.title, L - 2, y, ts, 'fg', F[500]))
if (s.subtitle) {
  let size = 21, lines = wrap(s.subtitle, size, textMaxW)
  if (lines.length > 2) { size = 19; lines = wrap(s.subtitle, size, textMaxW) }
  if (lines.length > 2) throw new Error(`subtitle needs more than two lines; shorten it: "${s.subtitle}"`)
  lines.forEach((ln, i) => out.push(text(ln, L, y + 48 + i * size * 1.45, size, 'muted')))
}

if (s.visual) out.push(`<g transform="translate(${R - 360} ${hasBottom ? 120 : 150})">${outline(s.visual)}</g>`)

// bottom: stat cards or a command card
if (s.stats && s.stats.length) {
  const n = Math.min(s.stats.length, 4), gap = 16, cw = (R - L - gap * (n - 1)) / n
  s.stats.slice(0, 4).forEach((st, i) => {
    const x = L + i * (cw + gap)
    out.push(`<rect class="card" x="${x + .5}" y="372.5" width="${cw - 1}" height="119" rx="16"/>`)
    out.push(text(String(st.value), x + 24, 432, 40, 'fg', F[500]))
    out.push(text(String(st.label), x + 24, 466, 16, 'muted', F[400], 'start', cw - 48))
  })
} else if (s.code) {
  out.push(`<rect class="card" x="${L + .5}" y="396.5" width="${R - L - 1}" height="87" rx="16"/>`)
  const prompt = s.codePrompt ?? '$'
  if (prompt) out.push(text(prompt, L + 28, 448, 22, 'faint', F.mono))
  out.push(text(s.code, L + (prompt ? 56 : 28), 448, 22, 'fg', F.mono, 'start', R - L - (prompt ? 84 : 56)))
}

// footer
if (s.footerLeft) out.push(text(s.footerLeft, L, 548, 15, 'muted'))
if (s.footerRight) out.push(text(s.footerRight, R, 548, 15, 'muted', F[400], 'end'))

const label = s.subtitle ? `${s.title}: ${s.subtitle}` : s.title
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
  <title>${esc(label)}</title>
  <style>
    .bg { fill: #fafafa; stroke: rgba(0, 0, 0, 0.08); }
    .card { fill: #ffffff; stroke: rgba(0, 0, 0, 0.08); }
    .fg { fill: #171717; } .muted { fill: #737373; } .faint { fill: #a3a3a3; }
    .line { stroke: rgba(0, 0, 0, 0.12); fill: none; }
    .btn { fill: #171717; } .btn-text { fill: #fafafa; }
    .icon { fill: #171717; stroke: none; }
    @media (prefers-color-scheme: dark) {
      .bg { fill: #171717; stroke: rgba(255, 255, 255, 0.1); }
      .card { fill: #252525; stroke: rgba(255, 255, 255, 0.08); }
      .fg { fill: #f5f5f5; } .muted { fill: #a3a3a3; } .faint { fill: #737373; }
      .line { stroke: rgba(255, 255, 255, 0.14); fill: none; }
      .btn { fill: #f5f5f5; } .btn-text { fill: #171717; }
      .icon { fill: #252525; stroke: rgba(255, 255, 255, 0.16); }
    }
    .accent { fill: ${accent}; } .accent-stroke { stroke: ${accent}; fill: none; }
  </style>
  <defs>${[...defs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('')}</defs>
  <rect class="bg" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="24"/>
  ${out.join('\n  ')}
</svg>
`
writeFileSync(outPath, theme ? svg.replace(/\n    \.bg \{[\s\S]*?@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n    \}\n/, '$1\n') : svg)
console.log(`wrote ${outPath} (${(svg.length / 1024).toFixed(1)} KB)`)
