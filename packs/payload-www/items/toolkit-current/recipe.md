## Done when
Every `@justanarthur/*` toolkit package is on its latest published minor, every `@payloadcms/*` package is on exactly the
version `payload` is on, the lockfile is updated, and typecheck, lint, tests and `next build` pass.

## Make what is missing
- Bump with the repo's package manager (`pnpm up`, `bun update`), all `@payloadcms/*` and `payload` together to one version.
- Read `packages/payload-www/CHANGELOG.md` and the plugin CHANGELOGs in github.com/justAnArthur/payload-www between the
  old and new versions and apply what they ask of hosts.
- After a Payload bump run `payload generate:importmap` and `payload generate:types`, and `payload migrate:create` if the
  schema changed; commit what they write.

## Hand off only when
A major bump of payload itself (3 → 4): say what the upgrade guide asks, and leave it for its own PR.

## Don't
- Don't loosen ranges to `*` or `latest` to pass.
- Don't bump one `@payloadcms/*` package alone.
