## Done when
The check passes on the PR's preview and on production, and none of the probed paths (`/.git/HEAD`, `/.git/config`, `/.env*`, `/.DS_Store`, `/wp-config.php.bak`, `/server-status`, `/phpinfo.php`, `/.vscode/settings.json`, `/.npmrc`, `/.htpasswd`, `/docker-compose.yml`, SQL dumps) is served as the real file: each answers 404 or 403, or the site's own 404 page.

## Make what is missing
- **Find why the file is public.** Usually the whole repo (or the project root) is the web root: a static host pointed at `.` instead of the build output, a Docker image that copies the repo into the server's document root, or `public/` holding a copied `.env`.
- **Remove the file from what is published,** not only from the response: publish only the build output (`out/`, `dist/`, `.next` through the framework's server), and add the paths to `.dockerignore` and the host's ignore list.
- **Then block the paths as a second line,** in the proxy or the app: dotfiles (`/\.(?!well-known)`) and backup suffixes (`.bak`, `~`, `.sql`) answer 404.
- **Any secret that was served is burnt.** List each one (by variable name, never by value) in the PR so it gets rotated.

## Stacks
- **Next.js:** only `public/` is served as files; check nothing secret sits in `public/`. A block in `middleware.ts` (`matcher` on `/((?!_next|\.well-known).*)`, 404 for paths starting with `/.`) covers a misconfigured proxy too.
- **Payload + Next:** the same; uploads directories must not be the repo root.
- **Astro / static:** publish `dist/` only. On nginx: `location ~ /\.(?!well-known) { deny all; }` and turn off `server-status` (`mod_status`) or restrict it to localhost.
- **Docker / Dokploy:** `.dockerignore` lists `.git`, `.env*`, `*.sql`, `.vscode`; the runtime image copies only the build output.

## Hand off only when
- A served secret has to be rotated in a provider account the worker can't reach: name the variable and the provider.
- The web server or proxy config lives outside the repo, on a host the worker has no access to: give the exact rule.

## Don't
- Don't answer 200 with an empty body or a "forbidden" page for these paths: answer 404 or 403.
- Don't delete the file from the repo's history as the fix; stop publishing it, then rotate what it held.
