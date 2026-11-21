## Done when
The check passes on the PR's preview: every page carries `<meta name="viewport" content="width=device-width, initial-scale=1">`, without `user-scalable=no` and without a `maximum-scale` below 2, so the layout fits a phone and visitors can pinch to zoom.

## Make what is missing
When zoom was turned off to stop iOS zooming into form fields, fix the cause instead: inputs with a font size of at least 16 px don't trigger it.

## Stacks
- **Next.js:** Next adds `width=device-width, initial-scale=1` itself; remove any `viewport` export (or `<meta name="viewport">` in a layout) that sets `maximumScale: 1` or `userScalable: false`.
- **Astro / static:** the tag in the layout's `<head>`.

## Hand off only when
Never.

## Don't
- Don't keep `maximum-scale=1` for a form: set the inputs' font size to 16 px.
