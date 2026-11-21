## Done when
The check passes on the PR's preview, and responses carry no `X-Powered-By`, `X-Generator` or `X-AspNet-Version`, and `Server` (if sent) names no version (`Vercel`, `nginx`, not `nginx/1.18.0`).

## Stacks
- **Next.js:** `poweredByHeader: false` in `next.config.*`.
- **Payload + Next:** the same; Payload adds `Payload` to Next's `X-Powered-By`, and the config option removes both.
- **Express or a custom server:** `app.disable('x-powered-by')`.
- **nginx:** `server_tokens off;`. **Apache:** `ServerTokens Prod` and `ServerSignature Off`. **PHP:** `expose_php = Off`.

## Hand off only when
The header comes from a proxy or host whose config is not in this repo.

## Don't
- Don't replace the header with a fake value: remove it.
