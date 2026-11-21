import { company, fleet, locations, terms } from '@/content/business'
import { pageCopy } from '@/content/pages'
import { eur, hoursLine } from '@/lib/format'
import { type Locale, type PageId, pathOf } from '@/lib/i18n'
import { absolute } from '@/lib/site'

const link = (page: PageId, lang: Locale) => `- [${pageCopy[page][lang].h1}](${absolute(pathOf(page, lang))}): ${pageCopy[page][lang].description}`

/** A curated map of the site for AI assistants (llmstxt.org), from the same facts the pages show. */
export function GET() {
  const body = `# ${company.brand}

> ${company.brand} (${company.legalName}) rents cars, minibuses and vans in Bratislava, Slovakia, picked up in the city centre or at the airport. Prices from ${eur(Math.min(...fleet.map(car => car.pricePerDay)), 'en')} a day including ${company.vatRate}% VAT. Príklad Rent is a fictional company: this site demonstrates the just-standards project, and nothing can be rented here.

The site is in Slovak (default, no prefix) and English (under /en). Every page links its other language.

## Pick-up points

${locations.map(location => `- ${location.name.en}: ${location.street}, ${location.postalCode} ${location.city}; ${location.hours.map(hours => hoursLine(hours, 'en')).join(', ')}; ${location.phone}; ${absolute(pathOf(location.page, 'en'))}`).join('\n')}

## Fleet (price per day, VAT included)

${fleet.map(car => `- ${car.name.en}: ${car.seats} seats, ${car.transmission}, from ${eur(car.pricePerDay, 'en')} a day, deposit ${eur(car.deposit, 'en')}, excess ${eur(car.excess, 'en')}`).join('\n')}

## Key terms

- Minimum driver age ${terms.minAge} (${terms.minAgeLarge} for the SUV, minibus and cargo van), licence held ${terms.licenceYears} years
- Deposit held on a credit card in the driver's name; Visa and Mastercard accepted for payment
- Fuel: full to full. ${fleet[0]?.kmPerDay} km a day included
- Travel abroad ${terms.crossBorder.en}, fee ${eur(terms.crossBorderFee, 'en')}
- Free cancellation up to ${terms.freeCancellationHours} hours before pick-up

## Pages (English)

${(['home', 'fleet', 'locations', 'booking', 'faq', 'rental-terms', 'terms', 'complaints', 'privacy', 'contact'] as PageId[]).map(page => link(page, 'en')).join('\n')}

## Stránky (slovensky)

${(['home', 'fleet', 'locations', 'booking', 'faq', 'rental-terms', 'terms', 'complaints', 'privacy', 'contact'] as PageId[]).map(page => link(page, 'sk')).join('\n')}

## Contact

- Phone: ${company.phone}
- E-mail: ${company.email}
- Operator: ${company.legalName}, ${company.street}, ${company.postalCode} ${company.city}, IČO ${company.ico} (example)
`
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
