## Done when
The check passes on the PR's preview: the home page is served as UTF-8 and says so where a browser looks first: `Content-Type: text/html; charset=utf-8`, or `<meta charset="utf-8">` as the first element of `<head>` (within the first 1024 bytes), and its bytes are valid UTF-8.

## Make what is missing
- Move `<meta charset="utf-8">` to the very top of `<head>`, before any inline script or style.
- When the bytes aren't UTF-8, find the template or data file saved in another encoding (often a Windows-1250 export from an old CMS) and convert it with `iconv`.

## Stacks
- **Next.js:** Next writes `<meta charSet="utf-8">` first and sends the header; a custom `<head>` script placed before it in `app/layout.tsx` is the usual cause.
- **Astro / static:** the first tag in the layout's `<head>`; on nginx, `charset utf-8;`.

## Hand off only when
Never.

## Don't
- Don't declare UTF-8 on bytes that aren't: convert the file.
