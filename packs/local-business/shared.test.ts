import { expect, test } from 'bun:test'
import { fold, hasAddress, hasHours, parseLocations, phonesIn, runsOf, samePhone, streetOf, textOf } from './shared.ts'

test('one number, however it is written', () => {
  expect(samePhone('+421 2 2086 2620', '02/2086 2620')).toBe(true)
  expect(samePhone('+421 900 200 200', '0900 200 200')).toBe(true)
  expect(samePhone('00421900200200', '+421-900-200-200')).toBe(true)
  expect(samePhone('+298 358800', '358800')).toBe(true)
  expect(samePhone('+421 900 200 200', '+421 915 080 400')).toBe(false)
})

test('finds international numbers anywhere and national ones after a label, not fax, prices or IDs', () => {
  const text = 'Volajte +421 900 200 200 (0,60 €/min). Tel.: 02/2086 2620, Fax: +421 2 1111 2222. IČO 36 123 456, cena 1 250 €'
  expect(phonesIn(text)).toEqual(['+421 900 200 200', '02/2086 2620'])
})

test('folds diacritics, Faroese letters and punctuation', () => {
  expect(fold('Ivanská cesta 5285/91, 821 04')).toBe('ivanska cesta 5285 91 821 04')
  expect(fold('Sørvágur, Flogvøllurin')).toBe('sorvagur flogvollurin')
})

test('the street of a one-line address is its first part with a number', () => {
  expect(streetOf('OC Cassovia, Pri prachárni 4, 040 11 Košice')).toBe('Pri prachárni 4')
  expect(streetOf('Ivanská cesta 5285/91, 821 04 Bratislava, Slovensko')).toBe('Ivanská cesta 5285/91')
  expect(streetOf('2 Flogvøllurin, Sørvágur 380, Faroe Islands')).toBe('2 Flogvøllurin')
})

test('an address in the text, spelled with or without diacritics, or with the postcode', () => {
  const place = { name: 'Letisko', street: 'Ivanská cesta 5285/91', postcode: '821 04', source: 'x' }
  expect(hasAddress('Adresa: Ivanska cesta 5285/91, Bratislava', place)).toBe(true)
  expect(hasAddress('Ivanská cesta 91, 82104 Bratislava', place)).toBe(true)
  expect(hasAddress('Ivanská cesta 12', { ...place, postcode: undefined })).toBe(false)
})

test('hours need a time range and a day or hours word', () => {
  expect(hasHours('Otváracie hodiny: Po – Pi 08:00 – 18:00')).toBe(true)
  expect(hasHours('Monday\n08:00\n21:00')).toBe(true)
  expect(hasHours('Otvorené nonstop')).toBe(true)
  expect(hasHours('Akcia platí 1.12 2026')).toBe(false)
  expect(hasHours('Dodávka 3.5 t, 12:00 15:00')).toBe(false)
})

test('the business context lists locations under a heading, with an address and an optional page', () => {
  const markdown = `# Acme\nSome text.\n\n## Pick-up points\n- **Bratislava Letisko**: Ivanská cesta 5285/91, 821 04 Bratislava\n- [Košice](https://acme.sk/pobocky/kosice) — K letisku 6, 040 17 Košice\n- Call centre\n\n## Legacy URLs\n- /old.html`
  expect(parseLocations(markdown)).toEqual([
    { name: 'Bratislava Letisko', source: 'business context', address: 'Ivanská cesta 5285/91, 821 04 Bratislava', street: 'Ivanská cesta 5285/91', postcode: '821 04' },
    { name: 'Košice', source: 'business context', address: 'K letisku 6, 040 17 Košice', street: 'K letisku 6', postcode: '040 17', url: 'https://acme.sk/pobocky/kosice' },
    { name: 'Call centre', source: 'business context' },
  ])
})

test('visible text leaves out scripts, the head and hidden elements, keeps blocks apart, and knows its links', async () => {
  const html = `<html><head><title>T</title></head><body><input type="hidden" hidden name="x"><div hidden>secret</div>
    <script>var a = "+421 111 111 111"</script><p>Call <a href="tel:+421900200200">+421 900 200 200</a></p><p>Mon&nbsp;8:00</p></body></html>`
  expect(await textOf(html)).toBe('Call\n+421 900 200 200\nMon 8:00')
  expect((await runsOf(html)).find(run => run.href)).toEqual({ text: '\n+421 900 200 200', href: 'tel:+421900200200' })
})
