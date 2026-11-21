## Done when
The check passes on the PR's preview: the home page and two sitemap pages load on a phone without a `console.error`, an uncaught exception or a failed resource (404s, refused connections) in the console.

## Make what is missing
Reproduce with the page open in Chrome DevTools (Console, "Preserve log"), on the preview and on `next start`/the production build, not only the dev server. For each message in the evidence:
- **Failed to load resource (with its URL):** a missing file (fix the path or remove the reference), a URL left pointing at `localhost` or a dev API (take it from the environment, with a production value), a font or image from a host that no longer serves it.
- **Uncaught TypeError / ReferenceError:** code that assumes data the page doesn't always have; guard it, and fix the type so it can't recur.
- **Hydration errors (React #418, #423, #425):** markup that differs between server and client: dates and random values rendered on the server, browser-only APIs in render, invalid nesting (`<div>` in `<p>`).
- **CSP violations:** add the host to the policy if it is wanted, or remove the script if not.
- **A third party's own errors:** update or configure it; remove it if it is dead.

## Stacks
- **Next.js:** error boundaries (`error.tsx`) don't hide console errors; `suppressHydrationWarning` only on the element whose text legitimately differs (a timestamp).
- **Payload + Next:** missing media (404 on `/api/media/file/…`) means a document references a deleted upload.
- **Astro / static:** check the built `dist/`, where paths differ from dev.

## Hand off only when
The error comes from a third party's script the repo includes as the vendor requires, and its configuration can't fix it: name the vendor and the message.

## Don't
- Don't override `console.error` or wrap everything in `try/catch` to silence it.
- Don't remove a feature to drop its error.
