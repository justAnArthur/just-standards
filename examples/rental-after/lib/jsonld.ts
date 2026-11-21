// schema.org JSON-LD, built from content/business.ts so it says what the visible text says.
import { type CarClass, company, fleet, type Location, locations } from '@/content/business'
import { faq } from '@/content/faq'
import { pageCopy, parents } from '@/content/pages'
import { type Locale, type PageId, pathOf } from '@/lib/i18n'
import { absolute } from '@/lib/site'

type Node = Record<string, unknown>

export const orgId = () => absolute('/#organization')
const locationId = (location: Location) => absolute(`/#location-${location.id}`)
const carId = (car: CarClass, lang: Locale) => `${absolute(pathOf('fleet', lang))}#${car.id}`

export const mapUrl = (location: Location) =>
  `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lon}#map=17/${location.lat}/${location.lon}`

const address = (street: string, postalCode: string, city: string) => ({
  '@type': 'PostalAddress',
  streetAddress: street,
  postalCode,
  addressLocality: city,
  addressCountry: company.country,
})

export function organization(lang: Locale): Node {
  return {
    '@type': 'Organization',
    '@id': orgId(),
    name: company.brand,
    legalName: company.legalName,
    url: absolute(pathOf('home', lang)),
    logo: absolute('/icons/icon-512.png'),
    email: company.email,
    telephone: company.phone,
    address: address(company.street, company.postalCode, company.city),
    taxID: company.dic,
    vatID: company.icDph,
    identifier: { '@type': 'PropertyValue', propertyID: 'IČO', value: company.ico },
    description:
      lang === 'sk'
        ? 'Vymyslená požičovňa áut a dodávok v Bratislave, ukážka štandardov projektu just-standards.'
        : 'A fictional car and van rental in Bratislava, demonstrating the just-standards project.',
    subOrganization: locations.map(location => ({ '@id': locationId(location) })),
  }
}

export function website(lang: Locale): Node {
  return { '@type': 'WebSite', '@id': absolute('/#website'), name: company.brand, url: absolute(pathOf('home', lang)), inLanguage: lang, publisher: { '@id': orgId() } }
}

export function autoRental(location: Location, lang: Locale): Node {
  return {
    '@type': 'AutoRental',
    '@id': locationId(location),
    name: `${company.brand} – ${location.name[lang]}`,
    url: absolute(pathOf(location.page, lang)),
    telephone: location.phone,
    email: location.email,
    image: absolute(`/og/locations-${lang}.png`),
    priceRange: '€€',
    currenciesAccepted: 'EUR',
    paymentAccepted: 'Visa, Mastercard, bank transfer',
    address: address(location.street, location.postalCode, location.city),
    geo: { '@type': 'GeoCoordinates', latitude: location.lat, longitude: location.lon },
    hasMap: mapUrl(location),
    openingHoursSpecification: location.hours.map(hours => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: hours.days.map(day => `https://schema.org/${day}`),
      opens: hours.opens,
      closes: hours.closes,
    })),
    parentOrganization: { '@id': orgId() },
  }
}

export function car(car: CarClass, lang: Locale): Node {
  return {
    '@type': 'Car',
    '@id': carId(car, lang),
    name: car.name[lang],
    description: car.example[lang],
    image: absolute(`/fleet/${car.id}.png`),
    vehicleSeatingCapacity: car.seats,
    numberOfDoors: car.doors,
    vehicleTransmission: car.transmission === 'manual' ? 'https://schema.org/ManualTransmission' : 'https://schema.org/AutomaticTransmission',
    fuelType: car.fuel === 'petrol' ? 'Petrol' : 'Diesel',
    cargoVolume: { '@type': 'QuantitativeValue', value: car.cargoLitres, unitCode: 'LTR' },
    offers: {
      '@type': 'Offer',
      url: absolute(pathOf('booking', lang)),
      price: car.pricePerDay.toFixed(2),
      priceCurrency: company.currency,
      availability: 'https://schema.org/InStock',
      businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: car.pricePerDay.toFixed(2),
        priceCurrency: company.currency,
        unitCode: 'DAY',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'DAY' },
        valueAddedTaxIncluded: true,
      },
      seller: { '@id': orgId() },
    },
  }
}

export function faqPage(lang: Locale): Node {
  return {
    '@type': 'FAQPage',
    url: absolute(pathOf('faq', lang)),
    inLanguage: lang,
    mainEntity: faq[lang].map(entry => ({ '@type': 'Question', name: entry.q, acceptedAnswer: { '@type': 'Answer', text: entry.a } })),
  }
}

/** The trail from the home page to `page`: Domov › Pobočky › Letisko. */
export function trail(page: PageId): PageId[] {
  const chain: PageId[] = []
  for (let at: PageId | undefined = page; at && at !== 'home'; at = parents[at]) chain.unshift(at)
  return ['home', ...chain]
}

export function breadcrumbs(page: PageId, lang: Locale): Node {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail(page).map((id, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: pageCopy[id][lang].crumb ?? pageCopy[id][lang].h1,
      item: absolute(pathOf(id, lang)),
    })),
  }
}

/** The JSON-LD of a page: who runs the site on every page, and what the page itself is about. */
export function graphFor(page: PageId, lang: Locale): Node {
  const nodes: Node[] = [organization(lang), website(lang)]
  if (page === 'home' || page === 'locations' || page === 'contact') nodes.push(...locations.map(location => autoRental(location, lang)))
  if (page === 'location-centre' || page === 'location-airport') nodes.push(autoRental(locations.find(l => l.page === page) as Location, lang))
  if (page === 'home' || page === 'fleet') nodes.push(...fleet.map(entry => car(entry, lang)))
  if (page === 'faq') nodes.push(faqPage(lang))
  if (page !== 'home') nodes.push(breadcrumbs(page, lang))
  return { '@context': 'https://schema.org', '@graph': nodes }
}
