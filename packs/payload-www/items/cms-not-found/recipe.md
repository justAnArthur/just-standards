## Done when
The frontend `not-found.tsx` renders a document editors write in the admin (a `static-pages` entry of kind `not-found`, or a
page), in the visitor's locale, with links on; it still answers 404.

## Make what is missing
- A `static-pages` collection from `createWWWCollectionGlobal([{ name: 'kind', type: 'select', options: ['not-found',
  'server-error'] }, { name: 'blocks', type: 'blocks', blocks }], { slug: 'static-pages', isDraft: false })` (see §5 of
  payload-www's integration skill), and `not-found.tsx` querying it and rendering its blocks.
- Seed one entry per locale from the current hard-coded text plus links to the main sections, search and contact.

## Hand off only when
Never.

## Don't
- Don't redirect missing pages to the home page: that's a soft 404.
