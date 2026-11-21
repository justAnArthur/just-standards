// Local sites for the local-business and rental tests: a well-kept rental with two branches, and a neglected one.
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '../../core/checks/context.ts'
import { html, site } from '../seo/fixture.ts'

export { html, site }

export const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`

/** The context with a workspace whose `businesses/acme.context.md` is `markdown`. */
export async function withContext(ctx: Context, markdown: string): Promise<Context> {
  const dir = await mkdtemp(join(tmpdir(), 'standards-lb-'))
  await mkdir(join(dir, 'businesses'))
  await Bun.write(join(dir, 'businesses', 'acme.context.md'), markdown)
  return { ...ctx, wsDir: dir }
}

export const CONTEXT = `# Acme rental\n\n## Locations\n- Acme Letisko: Ivanská cesta 5285/91, 821 04 Bratislava\n- Acme Mesto: Seberíniho 9, 821 03 Bratislava\n`

const branch = (o: string, slug: string, name: string, street: string, postcode: string, phone: string) => ({
  '@type': 'AutoRental',
  '@id': `${o}/pobocky/${slug}#branch`,
  name,
  url: `${o}/pobocky/${slug}`,
  telephone: phone,
  address: { '@type': 'PostalAddress', streetAddress: street, postalCode: postcode, addressLocality: 'Bratislava', addressCountry: 'SK' },
  geo: { '@type': 'GeoCoordinates', latitude: 48.17, longitude: 17.21 },
  openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday'], opens: '08:00', closes: '18:00' }],
})
const letisko = (o: string) => branch(o, 'letisko', 'Acme Letisko', 'Ivanská cesta 5285/91', '821 04', '+421 900 200 200')
const mesto = (o: string) => branch(o, 'mesto', 'Acme Mesto', 'Seberíniho 9', '821 03', '+421 2 2086 2620')

const footer = `<footer><p>Acme s.r.o.</p><a href="tel:+421900200200">+421 900 200 200</a> <a href="mailto:info@acme.sk">info@acme.sk</a>
  <a href="/kontakt">Kontakt</a><a href="/faq">FAQ</a><a href="/vozovy-park">Vozový park</a></footer>`
const branchPage = (name: string, street: string, phone: string, tel: string) =>
  html(
    `<title>${name}</title>`,
    `<h1>${name}</h1><p>${street}, Bratislava</p><p>Tel.: <a href="tel:${tel}">${phone}</a></p>
    <table><tr><td>Pondelok – Piatok</td><td>08:00 – 18:00</td></tr></table>
    <a href="https://www.google.com/maps/search/?api=1&query=48.17,17.21">Navigovať</a>${footer}`,
    'sk',
  )

/** A rental with two branches, each with its own page, AutoRental JSON-LD, hours, a map link and tel: links. */
export const kept = () =>
  site({
    '/': o => html(ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', name: 'Acme', telephone: '+421 900 200 200' }, letisko(o)] }), `<h1>Acme</h1>${footer}`, 'sk'),
    '/kontakt': o =>
      html(
        ld([{ '@type': 'Organization', name: 'Acme', department: [letisko(o), mesto(o)] }]),
        `<h1>Kontakt</h1><a href="/pobocky/letisko">Letisko</a><a href="/pobocky/mesto">Mesto</a><p>Ivanská cesta 5285/91</p><p>Seberíniho 9</p>
        <p>Mesto: <a href="tel:+421220862620">+421 2 2086 2620</a></p>${footer}`,
        'sk',
      ),
    '/pobocky/letisko': o => html(ld(letisko(o)), branchPage('Acme Letisko', 'Ivanská cesta 5285/91', '+421 900 200 200', '+421900200200'), 'sk'),
    '/pobocky/mesto': o => html(ld(mesto(o)), branchPage('Acme Mesto', 'Seberíniho 9', '+421 2 2086 2620', '+421220862620'), 'sk'),
  })

/**
 * A rental whose branches live only in a contactPoint Place with a text address and an ID URL that 404s, whose home
 * AutoRental has a name only, and whose numbers aren't links.
 */
export const neglected = () =>
  site({
    '/': o =>
      html(
        ld({ '@type': 'AutoRental', name: 'Acme', url: `${o}/` }),
        `<p>Volajte 0900 200 200 alebo <a href="tel:+421 900 200 200 (0,60 €/min)">+421 900 200 200</a>, info@acme.sk</p><a href="/kontakt">Kontakt</a>`,
        'sk',
      ),
    '/kontakt': o =>
      html(
        ld({
          '@type': 'ContactPage',
          mainEntity: {
            '@type': 'Organization',
            name: 'Acme',
            contactPoint: [
              { '@type': 'Place', name: 'Acme Letisko', address: 'Ivanská cesta 5285/91, 821 04 Bratislava', telephone: '+421 915 080 400', url: `${o}/d8e38a3c` },
              { '@type': 'Place', name: 'Acme Call Centrum', address: '   ', telephone: '+421 900 200 200' },
            ],
          },
        }),
        '<h1>Kontakt</h1><p>Telefón: +421 900 200 200</p>',
        'sk',
      ),
  })
