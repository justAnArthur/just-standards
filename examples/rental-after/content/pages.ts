// Each page's title, description and heading in both languages. tests/content.test.ts holds them to the lengths
// search engines show: a title of 10–70 characters with the brand suffix, a description of 70–160, all unique.

import type { Locale, PageId } from '@/lib/i18n'

export interface PageCopy {
  /** without the " · Príklad Rent" suffix, which the layout adds */
  title: string
  description: string
  h1: string
  /** the breadcrumb name, when it differs from the h1 */
  crumb?: string
}

export const parents: Partial<Record<PageId, PageId>> = {
  'location-centre': 'locations',
  'location-airport': 'locations',
}

export const pageCopy: Record<PageId, Record<Locale, PageCopy>> = {
  home: {
    sk: {
      title: 'Požičovňa áut a dodávok v Bratislave',
      description:
        'Prenájom osobných áut a dodávok v Bratislave s vyzdvihnutím v centre alebo na letisku. Ceny od 29 € na deň vrátane DPH, bez skrytých poplatkov.',
      h1: 'Požičovňa áut a dodávok v Bratislave',
      crumb: 'Domov',
    },
    en: {
      title: 'Car and van rental in Bratislava',
      description:
        'Rent a car or a van in Bratislava, picked up in the city centre or at the airport. Prices from €29 a day including VAT, with no hidden fees.',
      h1: 'Car and van rental in Bratislava',
      crumb: 'Home',
    },
  },
  fleet: {
    sk: {
      title: 'Vozový park a ceny prenájmu',
      description:
        'Šesť tried áut a dodávok, od mestského auta po 9-miestny minibus a dodávku 3,5 t: počet miest, prevodovka, batožina a cena za deň s DPH.',
      h1: 'Vozový park a ceny',
    },
    en: {
      title: 'Fleet and rental prices',
      description:
        'Six classes of cars and vans, from a city car to a 9-seat minibus and a 3.5 t cargo van: seats, gearbox, luggage and the price per day with VAT.',
      h1: 'Fleet and prices',
    },
  },
  locations: {
    sk: {
      title: 'Pobočky v Bratislave: centrum a letisko',
      description:
        'Auto si vyzdvihnete v centre Bratislavy alebo na letisku. Adresy, otváracie hodiny, telefón a cesta na pobočku; vrátiť ho môžete na ktorejkoľvek.',
      h1: 'Pobočky',
    },
    en: {
      title: 'Pick-up points in Bratislava: centre and airport',
      description:
        'Pick up your car in Bratislava city centre or at the airport. Addresses, opening hours, phone numbers and directions; return it at either one.',
      h1: 'Pick-up points',
    },
  },
  'location-centre': {
    sk: {
      title: 'Pobočka Bratislava – centrum',
      description:
        'Pobočka Príklad Rent na Ukážkovej 12 v centre Bratislavy: otvorené po – pi 8:00 – 18:00, so 9:00 – 13:00. Mapa, cesta, parkovanie a vrátenie mimo hodín.',
      h1: 'Pobočka Bratislava – centrum',
      crumb: 'Bratislava – centrum',
    },
    en: {
      title: 'Bratislava city centre branch',
      description:
        'The Príklad Rent branch at Ukážková 12 in central Bratislava: open Mon – Fri 8:00 – 18:00, Sat 9:00 – 13:00. Map, directions, parking and after-hours return.',
      h1: 'Bratislava city centre branch',
      crumb: 'City centre',
    },
  },
  'location-airport': {
    sk: {
      title: 'Pobočka Letisko Bratislava',
      description:
        'Prepážka Príklad Rent v príletovej hale letiska v Bratislave, otvorená denne 7:00 – 23:00. Autá stoja na parkovisku P1, pri meškaní letu počkáme.',
      h1: 'Pobočka Letisko Bratislava',
      crumb: 'Letisko',
    },
    en: {
      title: 'Bratislava Airport desk',
      description:
        'The Príklad Rent desk in the arrivals hall of Bratislava Airport, open daily 7:00 – 23:00. Cars wait in car park P1, and we wait for late flights.',
      h1: 'Bratislava Airport desk',
      crumb: 'Airport',
    },
  },
  booking: {
    sk: {
      title: 'Rezervácia auta: voľné autá a ceny',
      description:
        'Vyberte pobočku a termín a pozrite si voľné triedy áut s celkovou cenou prenájmu vrátane DPH, zálohou a kilometrami v cene.',
      h1: 'Rezervácia auta',
    },
    en: {
      title: 'Book a car: available cars and prices',
      description:
        'Choose a pick-up point and dates to see the available car classes with the total rental price including VAT, the deposit and the kilometres included.',
      h1: 'Book a car',
    },
  },
  faq: {
    sk: {
      title: 'Časté otázky o prenájme auta',
      description:
        'Záloha, minimálny vek vodiča, poistenie a spoluúčasť, cesta do zahraničia, palivo, kilometre, platobné karty a storno: odpovede na jednom mieste.',
      h1: 'Časté otázky',
    },
    en: {
      title: 'Car rental questions and answers',
      description:
        'Deposit, minimum driver age, insurance and excess, travel abroad, fuel, mileage, payment cards and cancellation: the answers in one place.',
      h1: 'Frequently asked questions',
    },
  },
  'rental-terms': {
    sk: {
      title: 'Podmienky prenájmu vozidla',
      description:
        'Minimálny vek a vodičský preukaz, záloha, poistenie a spoluúčasť, palivo, kilometre, cesta do zahraničia a storno podmienky Príklad Rent.',
      h1: 'Podmienky prenájmu',
    },
    en: {
      title: 'Vehicle rental terms',
      description:
        'Minimum age and driving licence, deposit, insurance and excess, fuel, mileage, travel abroad and cancellation: the rental terms of Príklad Rent.',
      h1: 'Rental terms',
    },
  },
  terms: {
    sk: {
      title: 'Všeobecné obchodné podmienky (VOP)',
      description:
        'Všeobecné obchodné podmienky spoločnosti Príklad Rent s.r.o.: uzavretie zmluvy, platby, práva a povinnosti nájomcu a riešenie sporov.',
      h1: 'Všeobecné obchodné podmienky',
    },
    en: {
      title: 'General terms and conditions',
      description:
        'The general terms and conditions of Príklad Rent s.r.o.: how a contract is made, payment, the renter’s rights and duties, and resolving disputes.',
      h1: 'General terms and conditions',
    },
  },
  complaints: {
    sk: {
      title: 'Reklamačný poriadok',
      description:
        'Ako reklamovať službu Príklad Rent: kde a dokedy podať reklamáciu, ako ju vybavíme do 30 dní a kam sa obrátiť mimosúdne, ak nie ste spokojní.',
      h1: 'Reklamačný poriadok',
    },
    en: {
      title: 'Complaints procedure',
      description:
        'How to complain about a Príklad Rent service: where and by when, how we settle it within 30 days, and where to turn out of court if you are not satisfied.',
      h1: 'Complaints procedure',
    },
  },
  privacy: {
    sk: {
      title: 'Ochrana osobných údajov',
      description:
        'Aké osobné údaje Príklad Rent spracúva pri rezervácii a prenájme, na aký účel a ako dlho, komu ich poskytuje a aké máte práva podľa GDPR.',
      h1: 'Ochrana osobných údajov',
    },
    en: {
      title: 'Privacy policy',
      description:
        'Which personal data Príklad Rent processes when you book and rent a car, for what purpose and how long, who receives it and your rights under the GDPR.',
      h1: 'Privacy policy',
    },
  },
  cookies: {
    sk: {
      title: 'Zásady používania cookies',
      description:
        'Ktoré cookies a podobné technológie stránka Príklad Rent používa, na čo slúžia, ako dlho trvajú a ako svoj súhlas so štatistikou zmeníte.',
      h1: 'Zásady používania cookies',
    },
    en: {
      title: 'Cookie policy',
      description:
        'Which cookies and similar technologies the Príklad Rent site uses, what they are for, how long they last and how to change your consent to statistics.',
      h1: 'Cookie policy',
    },
  },
  accessibility: {
    sk: {
      title: 'Vyhlásenie o prístupnosti',
      description:
        'Ako stránka Príklad Rent spĺňa požiadavky na prístupnosť podľa WCAG 2.1 AA a európskeho aktu o prístupnosti, známe obmedzenia a kam nahlásiť problém.',
      h1: 'Vyhlásenie o prístupnosti',
    },
    en: {
      title: 'Accessibility statement',
      description:
        'How the Príklad Rent site meets WCAG 2.1 AA and the European Accessibility Act, the limits we know of, and how to report a problem to us.',
      h1: 'Accessibility statement',
    },
  },
  contact: {
    sk: {
      title: 'Kontakt a údaje o spoločnosti',
      description:
        'Telefón, e-mail a adresy pobočiek Príklad Rent v centre Bratislavy a na letisku, otváracie hodiny a údaje o spoločnosti Príklad Rent s.r.o.',
      h1: 'Kontakt',
    },
    en: {
      title: 'Contact and company details',
      description:
        'Phone, e-mail and the addresses of the Príklad Rent branches in Bratislava city centre and at the airport, opening hours and company details.',
      h1: 'Contact',
    },
  },
}
