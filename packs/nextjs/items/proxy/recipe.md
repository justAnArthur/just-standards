## Done when
The check passes on the PR's branch, and every request the middleware handled (redirects, locale detection, auth, headers) is handled the same way: the file is `proxy.ts` (or `src/proxy.ts`), it exports `proxy`, it sets no `runtime`, and next.config uses the `Proxy` names of the flags.

## Make what is missing
- Run `npx @next/codemod@canary middleware-to-proxy .` from the app's folder: it renames the file and the function.
- Rename `skipMiddlewareUrlNormalize` to `skipProxyUrlNormalize`.
- Delete `runtime` from the file's `config`: proxy runs on Node.js. Keep `matcher`.
- Run the app and request the paths the matcher covers (a locale redirect, a protected page) to see they answer as before.

## Stacks
- **next-intl:** `export default createMiddleware(routing)` keeps working as the default export of `proxy.ts`; name it `proxy` if the file uses a named export.
- **Auth.js / Clerk:** their middleware helpers are default exports; move them to `proxy.ts` unchanged.

## Hand off only when
The middleware needs the edge runtime (an edge-only API the Node.js runtime lacks): keep `middleware.ts` with `runtime: 'edge'` in its config, which the check accepts, and say why in the PR.

## Don't
- Don't rename edge middleware blindly: it runs on Node.js afterwards.
- Don't keep both `middleware.ts` and `proxy.ts`.
