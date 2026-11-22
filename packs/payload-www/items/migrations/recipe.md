## Done when
`push` is off, the schema of every collection, global and block is captured in committed migrations under
`src/migrations/`, and the deploy runs them before the build (`prodMigrations` in the db adapter, or `payload migrate` in the
build script).

## Make what is missing
- Turn `push` off and run `payload migrate:create <name>` against an empty local database; commit the `.ts` and `.json`.
- For an existing production database, the first migration must match what `push` already created: create it from the
  current schema and say in the summary that it must be marked as run (`payload migrate` sees it as applied only after that).
- Use the existing local Postgres; a database of its own is named `tmp_<task>_<yyyymmdd>` and dropped when done.

## Hand off only when
Marking the baseline migration as run on the production database: a person with access does it.

## Don't
- Don't edit a migration that already ran anywhere; add a new one.
- Don't copy a production database to test.
