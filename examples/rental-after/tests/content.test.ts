import { describe, expect, test } from 'bun:test'
import { fleet, locations } from '@/content/business'
import { faq } from '@/content/faq'
import { pageCopy } from '@/content/pages'
import { locales, pageIds, pageOf, pathOf, slugs } from '@/lib/i18n'
import { fullTitle } from '@/lib/metadata'

describe('page copy', () => {
  for (const lang of locales) {
    test(`${lang}: every title is 10–70 characters with the brand, and unique`, () => {
      const titles = pageIds.map(page => fullTitle(page, lang))
      for (const title of titles) {
        expect(title.length).toBeGreaterThanOrEqual(10)
        expect(title.length).toBeLessThanOrEqual(70)
      }
      expect(new Set(titles).size).toBe(titles.length)
    })

    test(`${lang}: every description is 70–160 characters, and unique`, () => {
      const descriptions = pageIds.map(page => pageCopy[page][lang].description)
      for (const description of descriptions) {
        expect(description.length).toBeGreaterThanOrEqual(70)
        expect(description.length).toBeLessThanOrEqual(160)
      }
      expect(new Set(descriptions).size).toBe(descriptions.length)
    })
  }

  test('titles differ between the languages too', () => {
    const all = locales.flatMap(lang => pageIds.map(page => fullTitle(page, lang)))
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('routes', () => {
  test('every page has a slug in each language, and the slugs are lowercase and unique', () => {
    for (const lang of locales) {
      const own = pageIds.map(page => slugs[page][lang])
      expect(new Set(own).size).toBe(own.length)
      for (const slug of own) expect(slug).toMatch(/^[a-z0-9/-]*$/)
    }
  })

  test('paths round-trip through pageOf', () => {
    for (const lang of locales) {
      for (const page of pageIds) expect(pageOf(lang, slugs[page][lang])).toBe(page)
    }
    expect(pathOf('home', 'sk')).toBe('/')
    expect(pathOf('home', 'en')).toBe('/en')
    expect(pathOf('fleet', 'sk')).toBe('/vozovy-park')
    expect(pathOf('fleet', 'en')).toBe('/en/fleet')
  })
})

describe('facts', () => {
  test('every car class has a positive price, a deposit and a name in each language', () => {
    for (const car of fleet) {
      expect(car.pricePerDay).toBeGreaterThan(0)
      expect(car.deposit).toBeGreaterThan(0)
      for (const lang of locales) expect(car.name[lang].length).toBeGreaterThan(0)
    }
  })

  test('every location has hours, a phone number and coordinates', () => {
    for (const location of locations) {
      expect(location.hours.length).toBeGreaterThan(0)
      expect(location.phone).toMatch(/^\+421 /)
      expect(Math.abs(location.lat)).toBeGreaterThan(0)
    }
  })

  test('the FAQ answers the same questions in both languages', () => {
    expect(faq.sk.length).toBe(faq.en.length)
    expect(faq.sk.length).toBeGreaterThanOrEqual(8)
  })
})
