## Done when
The check passes on the PR's branch: `.env.example` (or `.env.sample`) at the root names every variable the code reads, each with a comment saying what it is for, whether it is required, and a placeholder, never a real value.

## Make what is missing
- The check's evidence names each missing variable and the file and line that reads it; read that code to say what the variable does and its default.
- Group by concern (database, CMS, email, analytics, storage), required first. `NAME=` for secrets, a safe default for the rest (`NEXT_PUBLIC_SERVER_URL=http://localhost:3000`).
- A variable that is optional, or used only by a script or a test setup, can be listed commented out: `# BASE_URL=http://localhost:3000`. The check counts commented lines.
- Variables the platform sets (`NODE_ENV`, `CI`, `VERCEL_*`, `NEXT_PUBLIC_VERCEL_*`) aren't counted; leave them out.
- Remove variables nothing reads any more.

## Stacks
- **Next.js:** `NEXT_PUBLIC_*` are inlined at build time: say so for the ones the browser reads.
- **Payload:** `PAYLOAD_SECRET`, `DATABASE_URL` (or `POSTGRES_URL`), and the storage adapter's keys for the adapter the config actually uses.
- **Monorepo:** one example per app that has its own env, next to it.

## Hand off only when
Never: names and purposes come from the code, and values are placeholders.

## Don't
- Don't copy values from a `.env`, `.env.local` or the hosting dashboard, not even "test" ones.
- Don't add `.env` itself (that's `repo/no-env`).
