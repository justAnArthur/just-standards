## Done when
The check passes on the PR's branch: `AGENTS.md` (or the README) says, in a short section, where the content a visitor sees comes from and how to change it locally.

## Make what is missing
Write it from the code:
- **The source:** the CMS (from dependencies and config: `payload.config.ts`, a Strapi or Sanity client), content folders (`content/`, MDX), translation files, a database, an external API. Name the collections or folders that hold pages, posts, navigation and site settings.
- **Locally:** how to start it (`pnpm dev`, the admin at `/admin`), where the local data comes from (a seed script, a dump, the staging API through an env var), how to log in (pointing at the seed's user, never a real password), and which edits go through the CMS versus the code (fallback copy, defaults in `defaults.ts`).
- **What not to edit:** generated files (types, import maps), and copy that a CMS overrides.

## Stacks
- **Payload + Next:** collections and globals in `src/collections` / `src/globals`, seed endpoint or script, migrations for schema changes.
- **Strapi:** the API URL and token env vars, the content types the site reads.

## Hand off only when
Local content needs a database dump or API token only a person has: say so in the doc and in the PR, and name the env var.

## Don't
- Don't describe a workflow you couldn't trace in the code.
