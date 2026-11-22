## Done when
The app's `payload.config.ts` is `buildConfig(withWWWConfig({ ... }))` with `const { withWWWConfig } = createWWWConfig()`,
its frontend routes render through payload-www's page factories, and the site shows the same pages, header, footer and
metadata as before.

## Make what is missing
- Read the integration skill first: `.mavis/skills/payload-www/SKILL.md` in github.com/justAnArthur/payload-www (clone it
  into the worktree's `tmp/` or read it with `gh api`). The canonical host is `camasys/frontend/apps/www/payload.config.ts`
  in utegsk/camasys.
- Keep the app's own collections, globals and blocks: pass them through `collections: (defaults) => [...defaults, ...]`,
  `globals`, `blocks`. Drop the ones payload-www already provides (pages, posts, header, footer, redirects) only after
  mapping their fields, with a migration that moves the data.
- Plugins the toolkit already sets up (SEO, imagehash, translator, MCP) are tuned with `defaultPluginsConfigs`, not added again.

## Stacks
- **Payload + Next:** `payload.config.ts`, `app/(frontend)/[locale]/layout.tsx` (`createRootLayoutExports`),
  `app/(frontend)/[locale]/[[...slug]]/page.tsx` (`createCollectionPageExports`, `slugShape: 'catch-all'`),
  `app/(frontend)/sitemap.ts` (`createSitemapFromCollections`).

## Hand off only when
The move needs a production database migration that someone must run against live data: write the migration, test it on a
local copy of the schema, and say in the summary that it must run before the deploy.

## Don't
- Don't import from subpaths missing from payload-www's `package.json#exports` (`/server`, `/globals`, `/hooks`…).
- Don't pass arguments to `createWWWConfig()`: locales come from Payload's `localization`.
- Don't delete content collections without a migration: an editor's pages are not code.
