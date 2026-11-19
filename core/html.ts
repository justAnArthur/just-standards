export interface Element {
  attrs: Record<string, string>
  text: string
}

/** Every element matching `selector`, with its attributes and text, using Bun's HTMLRewriter. */
export async function select(html: string, selector: string): Promise<Element[]> {
  const found: Element[] = []
  const rewriter = new HTMLRewriter().on(selector, {
    element(element) {
      const entry: Element = { attrs: Object.fromEntries(element.attributes), text: '' }
      found.push(entry)
    },
    text(chunk) {
      const last = found.at(-1)
      if (last) last.text += chunk.text
    },
  })
  await rewriter.transform(new Response(html)).text()
  return found
}
