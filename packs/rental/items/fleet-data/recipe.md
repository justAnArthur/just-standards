## Done when
The check passes on the PR's preview: each vehicle page (or, when vehicles have no pages, the fleet page) shows in its HTML as served the seats, the transmission, the luggage or the category, and a "from" price with its currency ("od 46,00 €"), and carries `Car` (or `Product`) JSON-LD with an `Offer` holding `price` and `priceCurrency`.

## Make what is missing
- Render the facts from the fleet data the site already has (the CMS or the booking engine's vehicle list): seats, transmission, luggage, category, the lowest daily price.
- JSON-LD per vehicle page: `{"@type": ["Car", "Product"], "name", "vehicleSeatingCapacity", "vehicleTransmission", "category", "offers": {"@type": "Offer", "price", "priceCurrency": "EUR"}}`; on the fleet page, an `ItemList` of the same.
- The price is the "from" price the site shows; if it isn't in the data, take it from the booking engine's lowest rate in the repo's data source, never from memory.
- When the fleet list is built only in the browser, render it on the server (or render a static fallback list with the same data).

## Stacks
- **Next.js:** vehicle pages as server components from the fleet data; the JSON-LD next to the data, not in a client component.
- **Payload + Next:** a `vehicles` collection with the facts and the "from" price; the page and the JSON-LD read it.
- **Astro / static:** a vehicles data file and a page per vehicle.

## Hand off only when
A vehicle's price or facts are neither on the site nor in the repo's data nor in the booking engine's data the repo can read.

## Don't
- Don't invent prices, seat counts or luggage: a wrong price in JSON-LD is worse than none.
- Don't mark a price as `price` when it's "from": keep the same number the page shows ("od"), and say "from" in the text.
