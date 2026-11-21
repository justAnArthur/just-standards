// The questions renters ask before they book. The FAQ page shows them and carries them as FAQPage JSON-LD.
import { company, fleet, type Localized, terms } from '@/content/business'
import { eur } from '@/lib/format'

export interface Question {
  q: string
  a: string
}

const deposits = (lang: 'sk' | 'en') => {
  const low = Math.min(...fleet.map(car => car.deposit))
  const high = Math.max(...fleet.map(car => car.deposit))
  return `${eur(low, lang)} – ${eur(high, lang)}`
}
const excesses = (lang: 'sk' | 'en') => {
  const low = Math.min(...fleet.map(car => car.excess))
  const high = Math.max(...fleet.map(car => car.excess))
  return `${eur(low, lang)} – ${eur(high, lang)}`
}

export const faq: Localized<Question[]> = {
  sk: [
    {
      q: 'Aká vysoká je záloha a ako ju zablokujete?',
      a: `Záloha je podľa triedy auta ${deposits('sk')}. Pri vyzdvihnutí ju zablokujeme na kreditnej karte vodiča; nestrhneme ju, iba rezervujeme. Po vrátení auta bez poškodenia ju uvoľníme v ten istý deň, banka ju vráti na kartu zvyčajne do 7 pracovných dní.`,
    },
    {
      q: 'Aký je minimálny vek vodiča a aký vodičský preukaz potrebujem?',
      a: `Vodič musí mať aspoň ${terms.minAge} rokov (pre SUV, minibus a dodávku ${terms.minAgeLarge} rokov) a vodičský preukaz skupiny B aspoň ${terms.licenceYears} roky. Vodiči do ${terms.youngDriverUntil} rokov platia príplatok mladého vodiča ${eur(terms.youngDriverFee, 'sk')} na deň. Preukaz vydaný mimo EÚ musí byť doplnený medzinárodným vodičským preukazom.`,
    },
    {
      q: 'Aké poistenie je v cene a aká je spoluúčasť?',
      a: `V cene je povinné zmluvné poistenie, havarijné poistenie (CDW) a poistenie proti krádeži (TP). Spoluúčasť pri poškodení alebo krádeži je podľa triedy ${excesses('sk')}. S doplnkovým poistením Super Cover za ${eur(terms.superCoverPerDay, 'sk')} na deň klesne spoluúčasť na 0 €.`,
    },
    {
      q: 'Môžem s autom vycestovať do zahraničia?',
      a: `Áno, ${terms.crossBorder.sk}. Cestu do zahraničia nám oznámte pri rezervácii; poplatok je ${eur(terms.crossBorderFee, 'sk')} za prenájom. Do iných krajín, napríklad na Ukrajinu, s autom cestovať nemožno.`,
    },
    {
      q: 'Ako je to s palivom?',
      a: `Platí pravidlo plná – plná: auto dostanete s plnou nádržou a s plnou ho vrátite. Ak ho vrátite s menším množstvom paliva, doúčtujeme chýbajúce litre po ${eur(terms.fuelPricePerLitre, 'sk')} a poplatok za tankovanie ${eur(terms.refuelFee, 'sk')}.`,
    },
    {
      q: 'Koľko kilometrov mám v cene?',
      a: `V cene je ${fleet[0]?.kmPerDay} km na každý deň prenájmu, spolu za celý prenájom. Každý ďalší kilometer stojí 0,20 € (pri SUV, minibuse a dodávke 0,25 €).`,
    },
    {
      q: 'Ktoré platobné karty prijímate?',
      a: 'Prenájom môžete zaplatiť kartou Visa alebo Mastercard, kreditnou aj debetnou, alebo bankovým prevodom vopred. Zálohu blokujeme iba na kreditnej karte znejúcej na meno vodiča; debetnú kartu ani hotovosť na zálohu neprijímame.',
    },
    {
      q: 'Môžem rezerváciu zrušiť?',
      a: `Rezerváciu zrušíte bezplatne najneskôr ${terms.freeCancellationHours} hodín pred vyzdvihnutím. Pri neskoršom zrušení alebo ak auto nevyzdvihnete, účtujeme ${terms.lateCancellationShare} % ceny prenájmu, najviac však cenu za tri dni.`,
    },
    {
      q: 'Môžem auto vyzdvihnúť na letisku a vrátiť v centre?',
      a: 'Áno. Auto môžete vyzdvihnúť aj vrátiť na ktorejkoľvek z našich dvoch pobočiek, v centre Bratislavy alebo na letisku, bez príplatku za jednosmerný prenájom.',
    },
    {
      q: 'Čo ak môj let mešká?',
      a: 'Číslo letu nám uveďte pri rezervácii. Na letisku sme denne od 7:00 do 23:00 a pri meškaní letu počkáme bez príplatku až do 01:00; stačí nám zavolať.',
    },
    {
      q: 'Požičiavate detské sedačky?',
      a: `Áno, detskú sedačku alebo podsedák vám pripravíme za ${eur(terms.childSeatFee, 'sk')} na deň. Uveďte vek a hmotnosť dieťaťa v rezervácii.`,
    },
    {
      q: 'Aké doklady si mám priniesť?',
      a: `Občiansky preukaz alebo pas, vodičský preukaz a kreditnú kartu na meno vodiča na zálohu. Firmy nám pri prvom prenájme pošlú aj IČO a fakturačné údaje na ${company.email}.`,
    },
  ],
  en: [
    {
      q: 'How much is the deposit, and how do you hold it?',
      a: `The deposit is ${deposits('en')}, depending on the car class. We block it on the driver's credit card at pick-up; it is held, not charged. Once the car is back undamaged we release it the same day, and the bank returns it to the card, usually within 7 working days.`,
    },
    {
      q: 'What is the minimum driver age, and which licence do I need?',
      a: `The driver must be at least ${terms.minAge} (${terms.minAgeLarge} for the SUV, the minibus and the cargo van) and have held a category B licence for at least ${terms.licenceYears} years. Drivers under ${terms.youngDriverUntil} pay a young-driver fee of ${eur(terms.youngDriverFee, 'en')} a day. A licence issued outside the EU needs an International Driving Permit with it.`,
    },
    {
      q: 'Which insurance is included, and what is the excess?',
      a: `The price includes third-party liability, collision damage cover (CDW) and theft protection (TP). The excess for damage or theft is ${excesses('en')}, depending on the class. With Super Cover for ${eur(terms.superCoverPerDay, 'en')} a day, the excess drops to €0.`,
    },
    {
      q: 'Can I take the car abroad?',
      a: `Yes, ${terms.crossBorder.en}. Tell us when you book; the fee is ${eur(terms.crossBorderFee, 'en')} per rental. The car may not go to other countries, such as Ukraine.`,
    },
    {
      q: 'What is the fuel policy?',
      a: `Full to full: you get the car with a full tank and bring it back full. If it comes back with less, we charge the missing litres at ${eur(terms.fuelPricePerLitre, 'en')} each and a refuelling fee of ${eur(terms.refuelFee, 'en')}.`,
    },
    {
      q: 'How many kilometres are included?',
      a: `${fleet[0]?.kmPerDay} km for each day of the rental are included, counted over the whole rental. Every further kilometre costs €0.20 (€0.25 for the SUV, the minibus and the cargo van).`,
    },
    {
      q: 'Which payment cards do you accept?',
      a: 'You can pay for the rental with Visa or Mastercard, credit or debit, or by bank transfer in advance. The deposit is held on a credit card in the driver’s name only; we accept neither a debit card nor cash for the deposit.',
    },
    {
      q: 'Can I cancel my booking?',
      a: `Cancellation is free up to ${terms.freeCancellationHours} hours before pick-up. If you cancel later or don't pick up the car, we charge ${terms.lateCancellationShare}% of the rental price, and never more than three days' rental.`,
    },
    {
      q: 'Can I pick up at the airport and return in the city centre?',
      a: 'Yes. You can pick up and return the car at either of our two branches, in Bratislava city centre or at the airport, with no one-way fee.',
    },
    {
      q: 'What if my flight is late?',
      a: 'Give us your flight number when you book. We are at the airport daily from 7:00 to 23:00, and for a late flight we wait until 01:00 at no extra charge; just call us.',
    },
    {
      q: 'Do you rent child seats?',
      a: `Yes, we have a child seat or booster ready for ${eur(terms.childSeatFee, 'en')} a day. Tell us the child's age and weight in your booking.`,
    },
    {
      q: 'Which documents do I need to bring?',
      a: `An identity card or passport, your driving licence, and a credit card in the driver's name for the deposit. Companies renting for the first time also send their company ID and billing details to ${company.email}.`,
    },
  ],
}
