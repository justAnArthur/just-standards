## Done when
Pages and posts get their meta from `@justanarthur/payload-plugin-seo` (through `defaultPluginsConfigs.seo`), media get
placeholders from the imagehash plugin, localized collections and globals are filled by the translator, and
`@payloadcms/plugin-seo` is gone.

## Make what is missing
- Remove `seoPlugin` from `@payloadcms/plugin-seo` and its package; write a Payload migration that copies its `meta.title`,
  `meta.description`, `meta.image` into the org plugin's fields so no page loses its meta.
- Tune, don't replace: `defaultPluginsConfigs: { seo: d => ({ ...d, collections: [...] }), imageHash: d => ({ ...d,
  algorithm: 'lqip-modern' }), translator: d => ({ ...d, collections: [...], globals: [...] }) }`.
- The translator and SEO auto-generation read `OPENAI_API_KEY`; name it in `.env.example`.

## Hand off only when
The site has a single locale and no one will translate it: then the translator may be off, said in the summary.

## Don't
- Don't keep both SEO plugins "for now".
- Don't commit an API key.
