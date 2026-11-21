import { Fragment } from 'react'
import { tel } from '@/content/business'

// Phone numbers, e-mail addresses and web addresses in running text become links: tel:, mailto: and https://.
const PATTERN = /(\+421(?: \d{1,3}){3,4})|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|(\bwww\.[\w-]+(?:\.[\w-]+)+(?:\/[\w./-]*)?)/g

export function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(PATTERN)) {
    const [whole, phone, email, web] = match
    const at = match.index ?? 0
    if (at > last) parts.push(text.slice(last, at))
    const href = phone ? tel(phone) : email ? `mailto:${email}` : `https://${web}`
    parts.push(
      <a key={at} href={href}>
        {whole}
      </a>,
    )
    last = at + whole.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <Fragment>{parts}</Fragment>
}
