// The facts of the business: one source for the pages, the footer, JSON-LD, llms.txt and the share images.
// Príklad Rent is fictional. Every ID, address, phone number and e-mail address here is an example and belongs to no one.

import type { Locale } from '@/lib/i18n'

export type Localized<T = string> = Record<Locale, T>

export const company = {
  brand: 'Príklad Rent',
  /** what the brand means, for English readers */
  gloss: 'Example Rentals',
  legalName: 'Príklad Rent s.r.o.',
  street: 'Ukážková 12',
  postalCode: '811 01',
  city: 'Bratislava',
  country: 'SK',
  countryName: { sk: 'Slovensko', en: 'Slovakia' } as Localized,
  ico: '12 345 678',
  dic: '2012345678',
  icDph: 'SK2012345678',
  register: {
    sk: 'Obchodný register Mestského súdu Bratislava III, oddiel Sro, vložka č. 00000/B',
    en: 'Commercial Register of the Bratislava III Municipal Court, section Sro, entry no. 00000/B',
  } as Localized,
  phone: '+421 2 000 000 00',
  email: 'info@example.com',
  complaintsEmail: 'reklamacie@example.com',
  privacyEmail: 'gdpr@example.com',
  securityEmail: 'security@example.com',
  vatRate: 23,
  currency: 'EUR',
} as const

export const tel = (phone: string) => `tel:${phone.replace(/\s+/g, '')}`

export type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'

export interface Hours {
  days: Day[]
  opens: string
  closes: string
}

export interface Location {
  id: 'centre' | 'airport'
  page: 'location-centre' | 'location-airport'
  name: Localized
  short: Localized
  street: string
  postalCode: string
  city: string
  lat: number
  lon: number
  phone: string
  email: string
  hours: Hours[]
  /** how to get there */
  directions: Localized
  /** where exactly the desk is */
  desk: Localized
  /** after-hours return */
  afterHours: Localized
}

export const WEEKDAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
export const ALL_DAYS: Day[] = [...WEEKDAYS, 'Saturday', 'Sunday']

export const locations: Location[] = [
  {
    id: 'centre',
    page: 'location-centre',
    name: { sk: 'Bratislava – centrum', en: 'Bratislava city centre' },
    short: { sk: 'Centrum', en: 'City centre' },
    street: 'Ukážková 12',
    postalCode: '811 01',
    city: 'Bratislava',
    lat: 48.1447,
    lon: 17.1128,
    phone: '+421 2 000 000 00',
    email: 'centrum@example.com',
    hours: [
      { days: WEEKDAYS, opens: '08:00', closes: '18:00' },
      { days: ['Saturday'], opens: '09:00', closes: '13:00' },
    ],
    directions: {
      sk: 'Pobočka je v dvore budovy Ukážková 12, päť minút pešo od zastávky električky. Na vyzdvihnutie auta môžete na 15 minút zastaviť priamo pred bránou.',
      en: 'The branch is in the courtyard of Ukážková 12, five minutes on foot from the tram stop. You can stop in front of the gate for 15 minutes to pick up your car.',
    },
    desk: {
      sk: 'Recepcia na prízemí, vchod z dvora.',
      en: 'Reception on the ground floor, entrance from the courtyard.',
    },
    afterHours: {
      sk: 'Mimo otváracích hodín vrátite auto na vyhradené miesto v dvore a kľúč vhodíte do schránky pri recepcii.',
      en: 'Outside opening hours, park the car in the marked bay in the courtyard and drop the key in the box by the reception.',
    },
  },
  {
    id: 'airport',
    page: 'location-airport',
    name: { sk: 'Letisko Bratislava', en: 'Bratislava Airport' },
    short: { sk: 'Letisko', en: 'Airport' },
    street: 'Letisková 1',
    postalCode: '820 01',
    city: 'Bratislava',
    lat: 48.1702,
    lon: 17.2127,
    phone: '+421 2 000 000 01',
    email: 'letisko@example.com',
    hours: [{ days: ALL_DAYS, opens: '07:00', closes: '23:00' }],
    directions: {
      sk: 'Prepážka je v príletovej hale vedľa východu z colného priestoru. Autá stoja na parkovisku P1, tri minúty pešo od terminálu.',
      en: 'The desk is in the arrivals hall next to the exit from customs. The cars are in car park P1, three minutes on foot from the terminal.',
    },
    desk: {
      sk: 'Príletová hala, prepážka č. 3.',
      en: 'Arrivals hall, desk no. 3.',
    },
    afterHours: {
      sk: 'Ak váš let mešká, zavolajte nám: počkáme do 01:00 bez príplatku.',
      en: 'If your flight is late, call us: we wait until 01:00 at no extra charge.',
    },
  },
]

export type Transmission = 'manual' | 'automatic'

export interface CarClass {
  id: 'city' | 'compact' | 'estate' | 'suv' | 'minibus' | 'cargo'
  name: Localized
  /** what kind of car stands behind the class: no make or model is promised */
  example: Localized
  seats: number
  doors: number
  transmission: Transmission
  /** suitcases that fit, large + small */
  luggage: { large: number; small: number }
  /** cargo space in litres */
  cargoLitres: number
  fuel: 'petrol' | 'diesel'
  /** per day, VAT included */
  pricePerDay: number
  deposit: number
  excess: number
  /** km included per day */
  kmPerDay: number
  extraKm: number
  minAge: number
  /** for a van: the licence category */
  licence: 'B'
}

export const fleet: CarClass[] = [
  {
    id: 'city',
    name: { sk: 'Mestské auto', en: 'City car' },
    example: { sk: '5-dverový hatchback, napríklad malé mestské auto s nízkou spotrebou', en: 'a 5-door hatchback: a small, economical city car' },
    seats: 4,
    doors: 5,
    transmission: 'manual',
    luggage: { large: 1, small: 1 },
    cargoLitres: 270,
    fuel: 'petrol',
    pricePerDay: 29,
    deposit: 300,
    excess: 800,
    kmPerDay: 300,
    extraKm: 0.2,
    minAge: 21,
    licence: 'B',
  },
  {
    id: 'compact',
    name: { sk: 'Kompakt', en: 'Compact' },
    example: { sk: '5-dverový kompaktný hatchback s automatickou prevodovkou', en: 'a 5-door compact hatchback with an automatic gearbox' },
    seats: 5,
    doors: 5,
    transmission: 'automatic',
    luggage: { large: 2, small: 1 },
    cargoLitres: 380,
    fuel: 'petrol',
    pricePerDay: 35,
    deposit: 400,
    excess: 900,
    kmPerDay: 300,
    extraKm: 0.2,
    minAge: 21,
    licence: 'B',
  },
  {
    id: 'estate',
    name: { sk: 'Kombi', en: 'Estate' },
    example: { sk: 'priestranné kombi strednej triedy, vhodné na dovolenku', en: 'a roomy mid-size estate, made for a holiday' },
    seats: 5,
    doors: 5,
    transmission: 'automatic',
    luggage: { large: 3, small: 2 },
    cargoLitres: 600,
    fuel: 'diesel',
    pricePerDay: 42,
    deposit: 450,
    excess: 1000,
    kmPerDay: 300,
    extraKm: 0.2,
    minAge: 21,
    licence: 'B',
  },
  {
    id: 'suv',
    name: { sk: 'SUV', en: 'SUV' },
    example: { sk: 'SUV s pohonom všetkých kolies, vyšší posed', en: 'an all-wheel-drive SUV with a high seating position' },
    seats: 5,
    doors: 5,
    transmission: 'automatic',
    luggage: { large: 3, small: 2 },
    cargoLitres: 520,
    fuel: 'diesel',
    pricePerDay: 55,
    deposit: 600,
    excess: 1200,
    kmPerDay: 300,
    extraKm: 0.25,
    minAge: 23,
    licence: 'B',
  },
  {
    id: 'minibus',
    name: { sk: 'Minibus 9 miest', en: '9-seat minibus' },
    example: { sk: 'osobná dodávka s 9 sedadlami pre rodinu alebo tím', en: 'a 9-seat passenger van for a family or a team' },
    seats: 9,
    doors: 4,
    transmission: 'manual',
    luggage: { large: 6, small: 4 },
    cargoLitres: 1000,
    fuel: 'diesel',
    pricePerDay: 79,
    deposit: 700,
    excess: 1500,
    kmPerDay: 300,
    extraKm: 0.25,
    minAge: 23,
    licence: 'B',
  },
  {
    id: 'cargo',
    name: { sk: 'Dodávka 3,5 t', en: '3.5 t cargo van' },
    example: { sk: 'nákladná dodávka do 3,5 t, ložný priestor 11 m³, vodičské oprávnenie skupiny B', en: 'a cargo van up to 3.5 t with 11 m³ of load space, driven on a category B licence' },
    seats: 3,
    doors: 4,
    transmission: 'manual',
    luggage: { large: 0, small: 0 },
    cargoLitres: 11000,
    fuel: 'diesel',
    pricePerDay: 65,
    deposit: 600,
    excess: 1500,
    kmPerDay: 300,
    extraKm: 0.25,
    minAge: 23,
    licence: 'B',
  },
]

/** The rental terms the FAQ, the terms page and llms.txt all quote. */
export const terms = {
  minAge: 21,
  minAgeLarge: 23,
  licenceYears: 2,
  youngDriverFee: 8,
  youngDriverUntil: 25,
  extraDriverFee: 5,
  crossBorderFee: 25,
  childSeatFee: 4,
  superCoverPerDay: 12,
  weeklyDiscount: 10,
  weeklyFrom: 7,
  freeCancellationHours: 48,
  lateCancellationShare: 50,
  lateReturnGraceMinutes: 59,
  refuelFee: 20,
  fuelPricePerLitre: 2.2,
  oneWayFee: 0,
  /** where a car may go: EU and EEA countries */
  crossBorder: {
    sk: 'do krajín Európskej únie, Nórska, Islandu, Lichtenštajnska a Švajčiarska',
    en: 'to the countries of the European Union, Norway, Iceland, Liechtenstein and Switzerland',
  } as Localized,
  /** when the content of the rental terms last changed */
  updated: '2026-11-02',
}

export const priceFrom = Math.min(...fleet.map(car => car.pricePerDay))

/** When the copy of each page last changed, for the sitemap's lastmod. */
export const CONTENT_UPDATED = '2026-11-21'
