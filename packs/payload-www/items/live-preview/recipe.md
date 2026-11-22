## Done when
Editing a page or post in the admin shows the page next to the form, updating as they type.

## Make what is missing
`admin.livePreview: { url: ({ data, locale }) => ..., collections: ['pages', 'posts'], breakpoints }` in the config, and
`@payloadcms/live-preview-react`'s `RefreshRouteOnSave` in the frontend layout when draft mode is on.

## Hand off only when
Never.

## Don't
- Don't show drafts to visitors: preview only under draft mode.
