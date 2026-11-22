## Done when
`payload generate:importmap` (and `generate:async-importmap` where the app has it) has run, its output is committed, and every
block's `custom['@justanarthur/payload-www'].path` is in it.

## Make what is missing
Run the app's generate scripts (`pnpm generate:importmap`, `generate:types`); make the build script run them too, so a new
block can't ship without them.

## Hand off only when
Never.

## Don't
- Don't hand-edit `importMap.js`.
