## Done when
Every import of `@justanarthur/payload-www` names a subpath in its `package.json#exports`, `createWWWConfig()` is called
without arguments, plugins are tuned through `defaultPluginsConfigs`, and typecheck and `next build` pass.

## Make what is missing
Use the migration table in payload-www's `.mavis/skills/payload-www/SKILL.md` (§8): each removed name has its current
replacement (`createSitemapFile` → `createSitemapFromCollections`, `createRevalidateCollectionHook` →
`createRevalidateCollectionGlobalHook`, static pages → a `static-pages` collection from `createWWWCollectionGlobal`). Where
the toolkit has no replacement, keep the code in the app (`src/lib/`), not behind a fake import.

## Hand off only when
Never: every case has a replacement or stays in the app.

## Don't
- Don't deep-import `@justanarthur/payload-www/dist/...`: it is not public either.
- Don't add the missing export to the toolkit from this repo.
