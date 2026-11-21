## Done when
The check passes on the PR's branch: every Next app in the repo is on the latest major of `next` or the one before it, `react` and `react-dom` match it, and the app builds and runs as before.

## Make what is missing
- Upgrade one major at a time, each a commit: `npx @next/codemod@latest upgrade <major>` runs the official codemods (async `params` and `cookies()` in 15, `middleware` → `proxy` in 16), then fix what the build still reports, following the upgrade guide for that major.
- Upgrade `eslint-config-next` and `@next/*` packages with it, and `react`/`react-dom` and their types to the version the major requires.
- Run the repo's build, typecheck, lint and tests after each major (see its AGENTS.md).

## Stacks
- **Next 13 → 14 → 15 → 16:** 15 makes request APIs async and stops caching `fetch` and GET handlers by default; 16 turns on Turbopack by default and renames `middleware.ts` to `proxy.ts`.
- **Payload + Next:** Payload pins the Next versions it supports: upgrade `payload` and `@payloadcms/*` together, to a release whose peer range covers the new Next.

## Hand off only when
A dependency has no release that supports the new major (a CMS, an auth library): name it and its tracking issue in the PR, and leave the PR a draft.

## Don't
- Don't jump several majors in one commit.
- Don't add `--legacy-peer-deps` or overrides to silence a peer range: that's the dependency saying it isn't ready.
- In a repo serving several sites, upgrade the shared app once; don't fork per site.
