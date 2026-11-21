// The legal pages: rental terms, general terms (VOP), complaints procedure, privacy and cookie policies and the
// accessibility statement. Numbers come from content/business.ts, so the FAQ, the fleet and these pages agree.
// They are example texts for a fictional company, written to show what such pages cover; they are not legal advice.
import { company, fleet, locations, terms } from '@/content/business'
import { eur } from '@/lib/format'
import type { Locale, PageId } from '@/lib/i18n'

export type Block = string | { list: string[] }
export interface Section {
  h: string
  blocks: Block[]
}
export interface LegalDoc {
  updated: string
  intro: string
  sections: Section[]
}

export type LegalPage = Extract<PageId, 'rental-terms' | 'terms' | 'complaints' | 'privacy' | 'cookies' | 'accessibility'>

const byClass = (lang: Locale, value: (car: (typeof fleet)[number]) => string) => fleet.map(car => `${car.name[lang]}: ${value(car)}`)

const operator = {
  sk: `${company.legalName}, so sídlom ${company.street}, ${company.postalCode} ${company.city}, IČO ${company.ico}, DIČ ${company.dic}, IČ DPH ${company.icDph}, zapísaná v registri: ${company.register.sk}`,
  en: `${company.legalName}, registered office ${company.street}, ${company.postalCode} ${company.city}, Slovakia, company ID (IČO) ${company.ico}, tax ID (DIČ) ${company.dic}, VAT ID ${company.icDph}, entered in the ${company.register.en}`,
}

const SOI = {
  sk: 'Slovenská obchodná inšpekcia, Ústredný inšpektorát, odbor medzinárodných vzťahov a alternatívneho riešenia spotrebiteľských sporov, Bajkalská 21/A, 827 99 Bratislava, e-mail ars@soi.sk, www.soi.sk',
  en: 'Slovak Trade Inspection (Slovenská obchodná inšpekcia), Central Inspectorate, Department of International Relations and Alternative Dispute Resolution, Bajkalská 21/A, 827 99 Bratislava, e-mail ars@soi.sk, www.soi.sk',
}

const fictional = {
  sk: 'Toto je ukážkový text vymyslenej spoločnosti Príklad Rent. Ukazuje, čo takáto stránka obsahuje; nie je to skutočná zmluva ani právna rada.',
  en: 'This is an example text of the fictional company Príklad Rent. It shows what such a page covers; it is neither a real contract nor legal advice.',
}

export const legal: Record<LegalPage, Record<Locale, LegalDoc>> = {
  'rental-terms': {
    sk: {
      updated: terms.updated,
      intro: `Podmienky prenájmu vozidiel ${company.brand} v skratke. Podrobné zmluvné podmienky sú vo všeobecných obchodných podmienkach. ${fictional.sk}`,
      sections: [
        {
          h: 'Vodič a doklady',
          blocks: [
            `Vodič musí mať aspoň ${terms.minAge} rokov, pre SUV, minibus a dodávku aspoň ${terms.minAgeLarge} rokov, a vodičský preukaz skupiny B aspoň ${terms.licenceYears} roky.`,
            `Vodiči mladší ako ${terms.youngDriverUntil} rokov platia príplatok mladého vodiča ${eur(terms.youngDriverFee, 'sk')} na deň. Každý ďalší vodič stojí ${eur(terms.extraDriverFee, 'sk')} na deň a musí byť zapísaný v zmluve.`,
            'Pri vyzdvihnutí predložíte občiansky preukaz alebo pas, vodičský preukaz a kreditnú kartu na meno vodiča. Vodičský preukaz vydaný mimo EÚ musí byť doplnený medzinárodným vodičským preukazom.',
          ],
        },
        {
          h: 'Ceny a platba',
          blocks: [
            `Všetky ceny sú konečné a zahŕňajú ${company.vatRate} % DPH, povinné zmluvné poistenie, havarijné poistenie, poistenie proti krádeži a kilometre podľa tejto stránky.`,
            `Pri prenájme na ${terms.weeklyFrom} a viac dní je cena za deň nižšia o ${terms.weeklyDiscount} %.`,
            'Prenájom zaplatíte pri vyzdvihnutí kartou Visa alebo Mastercard, kreditnou aj debetnou, alebo bankovým prevodom vopred.',
          ],
        },
        {
          h: 'Záloha',
          blocks: [
            'Zálohu blokujeme pri vyzdvihnutí na kreditnej karte na meno vodiča; debetnú kartu ani hotovosť na zálohu neprijímame. Výška zálohy podľa triedy:',
            { list: byClass('sk', car => eur(car.deposit, 'sk')) },
            'Po vrátení auta bez poškodenia, s plnou nádržou a v dohodnutom čase zálohu uvoľníme v ten istý deň. Banka ju vráti na kartu zvyčajne do 7 pracovných dní.',
          ],
        },
        {
          h: 'Poistenie a spoluúčasť',
          blocks: [
            'V cene je povinné zmluvné poistenie, havarijné poistenie (CDW) a poistenie proti krádeži (TP). Pri poškodení alebo krádeži platíte spoluúčasť podľa triedy:',
            { list: byClass('sk', car => eur(car.excess, 'sk')) },
            `S doplnkovým poistením Super Cover za ${eur(terms.superCoverPerDay, 'sk')} na deň je spoluúčasť 0 €. Poistenie nekryje škody spôsobené pod vplyvom alkoholu alebo iných návykových látok, úmyselne ani pri jazde v krajine, kam auto nesmie.`,
          ],
        },
        {
          h: 'Palivo',
          blocks: [
            `Platí pravidlo plná – plná: auto dostanete s plnou nádržou a s plnou ho vrátite. Chýbajúce palivo doúčtujeme po ${eur(terms.fuelPricePerLitre, 'sk')} za liter a k tomu poplatok za tankovanie ${eur(terms.refuelFee, 'sk')}.`,
          ],
        },
        {
          h: 'Kilometre',
          blocks: [
            `V cene je ${fleet[0]?.kmPerDay} km na každý deň prenájmu, spolu za celý prenájom. Každý ďalší kilometer stojí 0,20 €, pri SUV, minibuse a dodávke 0,25 €.`,
          ],
        },
        {
          h: 'Cesta do zahraničia',
          blocks: [
            `S autom môžete cestovať ${terms.crossBorder.sk}. Cestu do zahraničia oznámte pri rezervácii; poplatok je ${eur(terms.crossBorderFee, 'sk')} za prenájom a dostanete k nemu potrebné doklady. Do iných krajín s autom cestovať nemožno.`,
          ],
        },
        {
          h: 'Vyzdvihnutie a vrátenie',
          blocks: [
            `Auto vyzdvihnete a vrátite na ktorejkoľvek pobočke: ${locations.map(location => location.name.sk).join(' alebo ')}. Za vrátenie na inej pobočke neúčtujeme nič.`,
            `Prenájom sa počíta po 24-hodinových dňoch. Pri vrátení do ${terms.lateReturnGraceMinutes} minút po dohodnutom čase neplatíte nič navyše, neskôr začína ďalší deň.`,
            'Mimo otváracích hodín vrátite auto podľa pokynov pobočky; za stav auta do jeho prevzatia zodpovedá nájomca.',
          ],
        },
        {
          h: 'Zrušenie rezervácie',
          blocks: [
            `Rezerváciu zrušíte bezplatne najneskôr ${terms.freeCancellationHours} hodín pred vyzdvihnutím telefonicky alebo e-mailom. Pri neskoršom zrušení alebo ak auto nevyzdvihnete, účtujeme ${terms.lateCancellationShare} % ceny prenájmu, najviac však cenu za tri dni.`,
          ],
        },
        {
          h: 'Doplnky',
          blocks: [
            `Detskú sedačku alebo podsedák požičiame za ${eur(terms.childSeatFee, 'sk')} na deň. Snehové reťaze a zimné pneumatiky v zimnom období sú v cene.`,
          ],
        },
        {
          h: 'Nehoda alebo porucha',
          blocks: [
            `Pri nehode alebo poruche zabezpečte miesto, zavolajte políciu, ak to zákon vyžaduje, a hneď nás kontaktujte na čísle ${company.phone}. Auto bez nášho súhlasu nedávajte opravovať.`,
          ],
        },
      ],
    },
    en: {
      updated: terms.updated,
      intro: `The terms for renting a ${company.brand} vehicle, in short. The full contract terms are in the general terms and conditions. ${fictional.en}`,
      sections: [
        {
          h: 'Driver and documents',
          blocks: [
            `The driver must be at least ${terms.minAge}, or ${terms.minAgeLarge} for the SUV, the minibus and the cargo van, and have held a category B licence for at least ${terms.licenceYears} years.`,
            `Drivers under ${terms.youngDriverUntil} pay a young-driver fee of ${eur(terms.youngDriverFee, 'en')} a day. Each additional driver costs ${eur(terms.extraDriverFee, 'en')} a day and must be named in the contract.`,
            'At pick-up, show an identity card or passport, your driving licence and a credit card in the driver’s name. A licence issued outside the EU needs an International Driving Permit with it.',
          ],
        },
        {
          h: 'Prices and payment',
          blocks: [
            `Every price is final and includes ${company.vatRate}% VAT, third-party liability, collision damage cover, theft protection and the kilometres stated on this page.`,
            `For ${terms.weeklyFrom} days or more, the price per day is ${terms.weeklyDiscount}% lower.`,
            'You pay for the rental at pick-up with Visa or Mastercard, credit or debit, or by bank transfer in advance.',
          ],
        },
        {
          h: 'Deposit',
          blocks: [
            'We hold the deposit at pick-up on a credit card in the driver’s name; we accept neither a debit card nor cash for the deposit. The deposit by class:',
            { list: byClass('en', car => eur(car.deposit, 'en')) },
            'When the car comes back undamaged, with a full tank and on time, we release the deposit the same day. The bank returns it to the card, usually within 7 working days.',
          ],
        },
        {
          h: 'Insurance and excess',
          blocks: [
            'The price includes third-party liability, collision damage cover (CDW) and theft protection (TP). For damage or theft you pay an excess, by class:',
            { list: byClass('en', car => eur(car.excess, 'en')) },
            `With Super Cover for ${eur(terms.superCoverPerDay, 'en')} a day, the excess is €0. The cover does not apply to damage caused under the influence of alcohol or drugs, on purpose, or in a country the car may not enter.`,
          ],
        },
        {
          h: 'Fuel',
          blocks: [
            `Full to full: you get the car with a full tank and bring it back full. We charge missing fuel at ${eur(terms.fuelPricePerLitre, 'en')} a litre plus a refuelling fee of ${eur(terms.refuelFee, 'en')}.`,
          ],
        },
        {
          h: 'Mileage',
          blocks: [
            `${fleet[0]?.kmPerDay} km for each day of the rental are included, counted over the whole rental. Every further kilometre costs €0.20, or €0.25 for the SUV, the minibus and the cargo van.`,
          ],
        },
        {
          h: 'Travel abroad',
          blocks: [
            `You may drive the car ${terms.crossBorder.en}. Tell us when you book; the fee is ${eur(terms.crossBorderFee, 'en')} per rental and includes the documents you need. The car may not go to any other country.`,
          ],
        },
        {
          h: 'Pick-up and return',
          blocks: [
            `Pick up and return the car at either branch: ${locations.map(location => location.name.en).join(' or ')}. Returning it at the other branch costs nothing.`,
            `Rental days are counted in 24-hour periods. Returning up to ${terms.lateReturnGraceMinutes} minutes after the agreed time costs nothing extra; after that a new day starts.`,
            'Outside opening hours, return the car as the branch instructs; the renter is responsible for it until we take it over.',
          ],
        },
        {
          h: 'Cancellation',
          blocks: [
            `Cancel free of charge by phone or e-mail up to ${terms.freeCancellationHours} hours before pick-up. If you cancel later or don’t pick up the car, we charge ${terms.lateCancellationShare}% of the rental price, and never more than three days’ rental.`,
          ],
        },
        {
          h: 'Extras',
          blocks: [
            `We rent a child seat or booster for ${eur(terms.childSeatFee, 'en')} a day. Snow chains and winter tyres in the winter season are included.`,
          ],
        },
        {
          h: 'Accident or breakdown',
          blocks: [
            `After an accident or a breakdown, make the place safe, call the police where the law requires it, and call us at once on ${company.phone}. Don’t have the car repaired without our consent.`,
          ],
        },
      ],
    },
  },

  terms: {
    sk: {
      updated: terms.updated,
      intro: `Tieto všeobecné obchodné podmienky (VOP) upravujú nájom vozidiel od spoločnosti ${company.legalName}. ${fictional.sk}`,
      sections: [
        {
          h: '1. Prenajímateľ',
          blocks: [`Prenajímateľom je ${operator.sk}. Kontakt: ${company.phone}, ${company.email}.`],
        },
        {
          h: '2. Uzavretie zmluvy',
          blocks: [
            'Rezervácia cez stránku, telefonicky alebo e-mailom je nezáväzná. Zmluva o nájme vozidla vzniká podpisom nájomnej zmluvy pri vyzdvihnutí vozidla, ktorej súčasťou sú tieto VOP a podmienky prenájmu.',
            'Pred podpisom zmluvy dostane nájomca všetky informácie o cene, zálohe, poistení a spoluúčasti, ktoré sú uvedené aj na tejto stránke.',
          ],
        },
        {
          h: '3. Ceny a platby',
          blocks: [
            `Ceny sú uvedené v eurách vrátane ${company.vatRate} % DPH. Cena za prenájom je splatná pri vyzdvihnutí vozidla, pokiaľ sa strany nedohodnú na platbe vopred. Záloha sa blokuje na kreditnej karte vodiča a uvoľní sa po vrátení vozidla.`,
          ],
        },
        {
          h: '4. Práva a povinnosti nájomcu',
          blocks: [
            {
              list: [
                'používať vozidlo s náležitou starostlivosťou, len na pozemných komunikáciách a v krajinách podľa podmienok prenájmu;',
                'nedovoliť riadiť vozidlo osobe, ktorá nie je zapísaná v zmluve;',
                'neviesť vozidlo pod vplyvom alkoholu alebo iných návykových látok;',
                'bez odkladu oznámiť prenajímateľovi každú nehodu, poruchu, poškodenie alebo krádež;',
                'vrátiť vozidlo v dohodnutom čase, na dohodnutom mieste a v stave, v akom ho prevzal, s prihliadnutím na bežné opotrebenie.',
              ],
            },
          ],
        },
        {
          h: '5. Zodpovednosť za škodu',
          blocks: [
            'Za škodu na vozidle zodpovedá nájomca do výšky spoluúčasti podľa podmienok prenájmu. Za škodu spôsobenú úmyselne, pod vplyvom alkoholu alebo iných návykových látok alebo porušením týchto VOP zodpovedá v plnej výške.',
          ],
        },
        {
          h: '6. Odstúpenie od zmluvy a zrušenie rezervácie',
          blocks: [
            'Podľa zákona č. 108/2024 Z. z. o ochrane spotrebiteľa spotrebiteľ nemôže odstúpiť od zmluvy o nájme vozidla, ak sa má služba poskytnúť v dohodnutom termíne. Rezerváciu však môže zrušiť podľa storno podmienok v podmienkach prenájmu.',
          ],
        },
        {
          h: '7. Reklamácie',
          blocks: ['Postup pri reklamácii služieb upravuje reklamačný poriadok.'],
        },
        {
          h: '8. Alternatívne riešenie sporov',
          blocks: [
            `Ak spotrebiteľ nie je spokojný so spôsobom, ktorým prenajímateľ vybavil jeho reklamáciu, alebo ak sa domnieva, že prenajímateľ porušil jeho práva, môže sa naň obrátiť so žiadosťou o nápravu na ${company.complaintsEmail}. Ak prenajímateľ na žiadosť odpovie zamietavo alebo na ňu neodpovie do 30 dní od jej odoslania, spotrebiteľ má právo podať návrh na začatie alternatívneho riešenia sporu podľa zákona č. 391/2015 Z. z. o alternatívnom riešení spotrebiteľských sporov.`,
            `Príslušným subjektom alternatívneho riešenia sporov je ${SOI.sk}. Spotrebiteľ sa môže obrátiť aj na inú oprávnenú právnickú osobu zo zoznamu subjektov alternatívneho riešenia sporov, ktorý vedie Ministerstvo hospodárstva Slovenskej republiky. Spotrebiteľ si môže vybrať, na ktorý z týchto subjektov sa obráti.`,
          ],
        },
        {
          h: '9. Dozor',
          blocks: ['Dozor nad dodržiavaním povinností prenajímateľa vykonáva Slovenská obchodná inšpekcia, Inšpektorát SOI pre Bratislavský kraj, Bajkalská 21/A, 827 99 Bratislava.'],
        },
        {
          h: '10. Záverečné ustanovenia',
          blocks: ['Tieto VOP sú platné a účinné od dátumu uvedeného nižšie. Vzťahy nimi neupravené sa riadia právnym poriadkom Slovenskej republiky, najmä Občianskym zákonníkom a zákonom o ochrane spotrebiteľa.'],
        },
      ],
    },
    en: {
      updated: terms.updated,
      intro: `These general terms and conditions govern vehicle rental from ${company.legalName}. ${fictional.en}`,
      sections: [
        {
          h: '1. The lessor',
          blocks: [`The lessor is ${operator.en}. Contact: ${company.phone}, ${company.email}.`],
        },
        {
          h: '2. How the contract is made',
          blocks: [
            'A booking on the site, by phone or by e-mail is free of obligation. The rental contract comes into being when the rental agreement is signed at pick-up; these terms and the rental terms are part of it.',
            'Before signing, the renter receives all information on the price, the deposit, the insurance and the excess, which is also on this site.',
          ],
        },
        {
          h: '3. Prices and payment',
          blocks: [
            `Prices are in euros and include ${company.vatRate}% VAT. The rental price is due at pick-up unless payment in advance is agreed. The deposit is held on the driver’s credit card and released when the vehicle is returned.`,
          ],
        },
        {
          h: '4. The renter’s rights and duties',
          blocks: [
            {
              list: [
                'to use the vehicle with due care, only on public roads and in the countries the rental terms allow;',
                'not to let anyone drive who is not named in the contract;',
                'not to drive under the influence of alcohol or drugs;',
                'to report any accident, breakdown, damage or theft to the lessor without delay;',
                'to return the vehicle at the agreed time and place, in the condition it was taken over, allowing for normal wear.',
              ],
            },
          ],
        },
        {
          h: '5. Liability for damage',
          blocks: [
            'The renter is liable for damage to the vehicle up to the excess set in the rental terms. For damage caused on purpose, under the influence of alcohol or drugs, or by breaking these terms, the renter is liable in full.',
          ],
        },
        {
          h: '6. Withdrawal and cancellation',
          blocks: [
            'Under Slovak Act No. 108/2024 Coll. on Consumer Protection, a consumer cannot withdraw from a vehicle rental contract when the service is to be provided on an agreed date. A booking can, however, be cancelled under the cancellation terms in the rental terms.',
          ],
        },
        {
          h: '7. Complaints',
          blocks: ['The complaints procedure sets out how to complain about our services.'],
        },
        {
          h: '8. Alternative dispute resolution',
          blocks: [
            `A consumer who is not satisfied with how the lessor handled a complaint, or who believes the lessor has breached their rights, may ask the lessor for redress at ${company.complaintsEmail}. If the lessor rejects the request or does not reply within 30 days of it being sent, the consumer may file a proposal for alternative dispute resolution under Slovak Act No. 391/2015 Coll. on Alternative Resolution of Consumer Disputes.`,
            `The competent alternative dispute resolution body is the ${SOI.en}. The consumer may also turn to another authorised body on the list of ADR bodies kept by the Ministry of Economy of the Slovak Republic, and may choose which of these bodies to use.`,
          ],
        },
        {
          h: '9. Supervision',
          blocks: ['The lessor’s duties are supervised by the Slovak Trade Inspection, Inspectorate for the Bratislava Region, Bajkalská 21/A, 827 99 Bratislava.'],
        },
        {
          h: '10. Final provisions',
          blocks: ['These terms apply from the date below. Matters they do not cover are governed by Slovak law, in particular the Civil Code and the Consumer Protection Act.'],
        },
      ],
    },
  },

  complaints: {
    sk: {
      updated: terms.updated,
      intro: `Tento reklamačný poriadok hovorí, ako reklamovať službu spoločnosti ${company.legalName} a ako reklamáciu vybavíme. ${fictional.sk}`,
      sections: [
        {
          h: 'Kde a ako reklamovať',
          blocks: [
            `Reklamáciu podáte e-mailom na ${company.complaintsEmail}, telefonicky na ${company.phone} alebo osobne na ktorejkoľvek pobočke. Reklamáciu podajte bez zbytočného odkladu po tom, čo ste zistili nedostatok služby.`,
            'Uveďte číslo zmluvy alebo rezervácie, čo reklamujete a ako by ste chceli reklamáciu vybaviť. Ak máte fotografie alebo doklady, priložte ich.',
          ],
        },
        {
          h: 'Potvrdenie a vybavenie',
          blocks: [
            'Prijatie reklamácie vám potvrdíme e-mailom alebo písomne. Reklamáciu vybavíme bez zbytočného odkladu, najneskôr do 30 dní od jej podania, a o výsledku vás informujeme.',
            'Oprávnenú reklamáciu vybavíme vrátením časti alebo celej ceny, zľavou z ceny alebo poskytnutím náhradného vozidla. Ak reklamáciu zamietneme, uvedieme dôvod.',
          ],
        },
        {
          h: 'Mimosúdne riešenie sporov',
          blocks: [
            `Ak s vybavením reklamácie nie ste spokojní alebo sme vám do 30 dní neodpovedali, môžete podať návrh na alternatívne riešenie sporu: ${SOI.sk}. Môžete sa obrátiť aj na inú oprávnenú právnickú osobu zo zoznamu Ministerstva hospodárstva SR.`,
          ],
        },
      ],
    },
    en: {
      updated: terms.updated,
      intro: `This complaints procedure explains how to complain about a service of ${company.legalName} and how we settle a complaint. ${fictional.en}`,
      sections: [
        {
          h: 'Where and how to complain',
          blocks: [
            `Send your complaint by e-mail to ${company.complaintsEmail}, call ${company.phone}, or make it in person at either branch. Please complain without undue delay once you notice the problem with the service.`,
            'Give the number of your contract or booking, what you are complaining about and how you would like it settled. Attach any photos or documents you have.',
          ],
        },
        {
          h: 'Confirmation and settlement',
          blocks: [
            'We confirm receipt of your complaint by e-mail or in writing. We settle it without undue delay and within 30 days at most, and tell you the outcome.',
            'We settle a justified complaint by refunding part or all of the price, a discount, or a replacement vehicle. If we reject a complaint, we give the reason.',
          ],
        },
        {
          h: 'Settling a dispute out of court',
          blocks: [
            `If you are not satisfied with how we settled your complaint, or we did not reply within 30 days, you can file a proposal for alternative dispute resolution with the ${SOI.en}. You can also turn to another authorised body on the Ministry of Economy’s list.`,
          ],
        },
      ],
    },
  },

  privacy: {
    sk: {
      updated: '2026-11-21',
      intro: `Ako ${company.legalName} spracúva osobné údaje zákazníkov a návštevníkov stránky podľa nariadenia (EÚ) 2016/679 (GDPR). ${fictional.sk}`,
      sections: [
        {
          h: 'Prevádzkovateľ',
          blocks: [`Prevádzkovateľom je ${operator.sk}. S otázkami o osobných údajoch nám píšte na ${company.privacyEmail}.`],
        },
        {
          h: 'Aké údaje spracúvame a prečo',
          blocks: [
            {
              list: [
                'Rezervácia a nájomná zmluva: meno, kontakt, údaje z dokladu totožnosti a vodičského preukazu, termín a miesto prenájmu. Právny základ: plnenie zmluvy (čl. 6 ods. 1 písm. b) GDPR).',
                'Účtovníctvo a dane: faktúry a údaje o platbách. Právny základ: zákonná povinnosť (čl. 6 ods. 1 písm. c) GDPR).',
                'Riešenie škôd, pokút a sporov: údaje o vozidle, nehode a priestupku. Právny základ: oprávnený záujem (čl. 6 ods. 1 písm. f) GDPR).',
                'Štatistika návštevnosti stránky: navštívená stránka, odkiaľ ste prišli, jazyk a rozlíšenie obrazovky, bez cookies a bez identifikátora. Právny základ: súhlas (čl. 6 ods. 1 písm. a) GDPR), ktorý môžete kedykoľvek odvolať.',
              ],
            },
            'Číslo platobnej karty nespracúvame my, ale banka, ktorá platbu a blokovanie zálohy vykonáva.',
          ],
        },
        {
          h: 'Ako dlho údaje uchovávame',
          blocks: [
            'Údaje zo zmluvy a účtovné doklady 10 rokov po skončení roka, v ktorom zmluva skončila, ako vyžaduje zákon o účtovníctve. Nezrealizované rezervácie 1 rok. Štatistiku návštevnosti len v súhrnnej podobe, najviac 25 mesiacov.',
          ],
        },
        {
          h: 'Komu údaje poskytujeme',
          blocks: [
            'Poisťovni pri poistnej udalosti, polícii a správnym orgánom, ak to vyžaduje zákon, účtovníkovi a poskytovateľom IT služieb, ktorí pre nás údaje spracúvajú na základe zmluvy. Údaje neprenášame mimo Európskej únie a nepoužívame automatizované rozhodovanie ani profilovanie.',
          ],
        },
        {
          h: 'Vaše práva',
          blocks: [
            'Máte právo na prístup k údajom, ich opravu a vymazanie, obmedzenie spracúvania, prenosnosť údajov a právo namietať proti spracúvaniu na základe oprávneného záujmu. Súhlas so štatistikou môžete odvolať v nastaveniach cookies v pätičke stránky.',
            'Ak sa domnievate, že údaje spracúvame v rozpore so zákonom, môžete podať návrh na Úrad na ochranu osobných údajov Slovenskej republiky, Hraničná 12, 820 07 Bratislava, www.dataprotection.gov.sk.',
          ],
        },
      ],
    },
    en: {
      updated: '2026-11-21',
      intro: `How ${company.legalName} processes the personal data of customers and visitors under Regulation (EU) 2016/679 (GDPR). ${fictional.en}`,
      sections: [
        {
          h: 'The controller',
          blocks: [`The controller is ${operator.en}. Write to ${company.privacyEmail} with any question about your personal data.`],
        },
        {
          h: 'Which data we process and why',
          blocks: [
            {
              list: [
                'Booking and rental contract: name, contact details, details from your identity document and driving licence, rental dates and place. Legal basis: performance of a contract (Art. 6(1)(b) GDPR).',
                'Accounting and taxes: invoices and payment records. Legal basis: legal obligation (Art. 6(1)(c) GDPR).',
                'Handling damage, fines and disputes: data on the vehicle, the accident or the offence. Legal basis: legitimate interest (Art. 6(1)(f) GDPR).',
                'Visitor statistics: the page visited, where you came from, language and screen size, with no cookies and no identifier. Legal basis: consent (Art. 6(1)(a) GDPR), which you can withdraw at any time.',
              ],
            },
            'We do not process your card number: the bank that takes the payment and holds the deposit does.',
          ],
        },
        {
          h: 'How long we keep data',
          blocks: [
            'Contract data and accounting records for 10 years after the end of the year the contract ended, as the Accounting Act requires. Bookings that did not go ahead for 1 year. Visitor statistics in aggregate only, for 25 months at most.',
          ],
        },
        {
          h: 'Who receives data',
          blocks: [
            'The insurer after an insured event, the police and authorities where the law requires it, our accountant, and IT providers who process data for us under contract. We transfer no data outside the European Union and use no automated decision-making or profiling.',
          ],
        },
        {
          h: 'Your rights',
          blocks: [
            'You have the right to access your data, to have it corrected or erased, to restrict processing, to data portability, and to object to processing based on legitimate interest. You can withdraw consent to statistics in the cookie settings in the footer.',
            'If you believe we process data unlawfully, you can complain to the Office for Personal Data Protection of the Slovak Republic, Hraničná 12, 820 07 Bratislava, www.dataprotection.gov.sk.',
          ],
        },
      ],
    },
  },

  cookies: {
    sk: {
      updated: '2026-11-21',
      intro: `Ktoré cookies a podobné technológie používa stránka ${company.brand}. ${fictional.sk}`,
      sections: [
        {
          h: 'Nevyhnutné cookies',
          blocks: [
            'Jediná cookie stránky, consent, si pamätá, či ste štatistiku povolili alebo odmietli, aby sme sa nepýtali pri každej návšteve. Je naša vlastná, platí 6 mesiacov a nastaví sa až po vašej voľbe.',
          ],
        },
        {
          h: 'Štatistika návštevnosti',
          blocks: [
            'So súhlasom spustíme vlastný štatistický skript, ktorý pri zobrazení stránky odošle na náš server navštívenú adresu, predchádzajúcu stránku, jazyk a rozlíšenie obrazovky. Nepoužíva cookies, neukladá identifikátor a údaje neposiela tretím stranám.',
            'Bez súhlasu sa skript nespustí a stránka nepošle žiadnu požiadavku nástroju na meranie.',
          ],
        },
        {
          h: 'Reklama a sociálne siete',
          blocks: ['Stránka nepoužíva reklamné cookies ani pixely sociálnych sietí a nevkladá obsah tretích strán.'],
        },
        {
          h: 'Ako súhlas zmeníte',
          blocks: ['Kliknite na Nastavenia cookies v pätičke stránky a zvoľte znova. Cookie consent môžete kedykoľvek vymazať aj v prehliadači.'],
        },
      ],
    },
    en: {
      updated: '2026-11-21',
      intro: `Which cookies and similar technologies the ${company.brand} site uses. ${fictional.en}`,
      sections: [
        {
          h: 'Necessary cookies',
          blocks: [
            'The site’s only cookie, consent, remembers whether you allowed or declined statistics, so we don’t ask on every visit. It is our own, lasts 6 months, and is set only once you choose.',
          ],
        },
        {
          h: 'Visitor statistics',
          blocks: [
            'With your consent we run our own statistics script, which sends the page address, the previous page, the language and the screen size to our server when a page is shown. It uses no cookies, stores no identifier and sends nothing to third parties.',
            'Without consent the script does not run and the site sends no request to any measuring tool.',
          ],
        },
        {
          h: 'Advertising and social media',
          blocks: ['The site uses no advertising cookies or social media pixels and embeds no third-party content.'],
        },
        {
          h: 'Changing your consent',
          blocks: ['Click Cookie settings in the footer and choose again. You can also delete the consent cookie in your browser at any time.'],
        },
      ],
    },
  },

  accessibility: {
    sk: {
      updated: '2026-11-21',
      intro: `${company.legalName} sa usiluje, aby stránka bola prístupná všetkým, aj ľuďom so zdravotným postihnutím, v súlade so smernicou (EÚ) 2019/882 o požiadavkách na prístupnosť výrobkov a služieb (európsky akt o prístupnosti). ${fictional.sk}`,
      sections: [
        {
          h: 'Stav súladu',
          blocks: ['Stránka je čiastočne v súlade s normou EN 301 549 a s pravidlami WCAG 2.1 na úrovni AA. Nesúlad uvádzame nižšie.'],
        },
        {
          h: 'Čo robíme pre prístupnosť',
          blocks: [
            {
              list: [
                'celá stránka vrátane rezervačného formulára sa dá ovládať klávesnicou, s viditeľným zameraním;',
                'odkaz na preskočenie navigácie, orientačné body a jeden hlavný nadpis na stránke;',
                'všetky polia formulára majú popis, chyby sa oznamujú textom;',
                'obrázky majú alternatívny text a farby spĺňajú požiadavky na kontrast;',
                'pohyb a plynulé posúvanie sa vypnú, ak to v systéme požadujete;',
                'obsah je dostupný aj bez JavaScriptu.',
              ],
            },
          ],
        },
        {
          h: 'Známe obmedzenia',
          blocks: [
            {
              list: [
                'Výber dátumu používa ovládací prvok prehliadača; jeho prístupnosť závisí od prehliadača. Dátum môžete vždy zadať aj priamo.',
                'Odkaz na mapu vedie na stránku OpenStreetMap, ktorej prístupnosť neovplyvňujeme. Adresu, súradnice a opis cesty uvádzame priamo na stránke pobočky.',
              ],
            },
          ],
        },
        {
          h: 'Ako vyhlásenie vzniklo',
          blocks: ['Vyhlásenie sme pripravili vlastným posúdením: automatickou kontrolou (axe-core) a skúškou ovládania len klávesnicou.'],
        },
        {
          h: 'Spätná väzba a kontakt',
          blocks: [
            `Ak narazíte na prekážku, napíšte nám na ${company.email} alebo zavolajte na ${company.phone}. Odpovieme do 5 pracovných dní a informácie vám poskytneme aj inou formou.`,
            'Ak nie ste spokojní s našou odpoveďou, môžete sa obrátiť na Slovenskú obchodnú inšpekciu, ktorá dohliada na prístupnosť služieb, www.soi.sk.',
          ],
        },
      ],
    },
    en: {
      updated: '2026-11-21',
      intro: `${company.legalName} aims to make this site accessible to everyone, including people with disabilities, in line with Directive (EU) 2019/882 on the accessibility requirements for products and services (the European Accessibility Act). ${fictional.en}`,
      sections: [
        {
          h: 'Compliance status',
          blocks: ['The site partially conforms to EN 301 549 and to WCAG 2.1 level AA. The non-conformities are listed below.'],
        },
        {
          h: 'What we do for accessibility',
          blocks: [
            {
              list: [
                'the whole site, the booking form included, works with the keyboard, with a visible focus;',
                'a link to skip the navigation, landmarks and one main heading per page;',
                'every form field has a label, and errors are announced in text;',
                'images have alternative text, and colours meet the contrast requirements;',
                'motion and smooth scrolling stop when your system asks for reduced motion;',
                'the content is available without JavaScript.',
              ],
            },
          ],
        },
        {
          h: 'Known limitations',
          blocks: [
            {
              list: [
                'The date fields use the browser’s own date picker, whose accessibility depends on the browser. You can always type the date instead.',
                'The map link leads to OpenStreetMap, whose accessibility we don’t control. The address, the coordinates and the directions are on each branch’s page.',
              ],
            },
          ],
        },
        {
          h: 'How this statement was prepared',
          blocks: ['We prepared this statement by self-assessment: automated checks (axe-core) and a keyboard-only test.'],
        },
        {
          h: 'Feedback and contact',
          blocks: [
            `If something stands in your way, write to ${company.email} or call ${company.phone}. We reply within 5 working days and can give you the information in another format.`,
            'If you are not satisfied with our reply, you can turn to the Slovak Trade Inspection, which supervises the accessibility of services, www.soi.sk.',
          ],
        },
      ],
    },
  },
}
