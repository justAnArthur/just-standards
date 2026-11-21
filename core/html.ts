const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }

/** HTMLRewriter hands text and attributes over as written: `&amp;amp;` stays. Decoded, a title's length and uniqueness are right. */
export const decode = (text: string) =>
  text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const point = code[1] === 'x' || code[1] === 'X' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
    }
    return NAMED[code.toLowerCase()] ?? entity
  })

export interface Element {
  attrs: Record<string, string>
  text: string
}

/** Every element matching `selector`, with its attributes and text, using Bun's HTMLRewriter. */
export async function select(html: string, selector: string): Promise<Element[]> {
  const found: Element[] = []
  const rewriter = new HTMLRewriter().on(selector, {
    element(element) {
      const entry: Element = { attrs: Object.fromEntries([...element.attributes].map(([name, value]) => [name, decode(value)])), text: '' }
      found.push(entry)
    },
    text(chunk) {
      const last = found.at(-1)
      if (last) last.text += chunk.text
    },
  })
  await rewriter.transform(new Response(html)).text()
  for (const entry of found) entry.text = decode(entry.text)
  return found
}
