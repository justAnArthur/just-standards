## Done when
Blocks and components take every colour from theme tokens (CSS variables or Tailwind theme utilities such as
`bg-primary`, `text-muted-foreground`), and the pages look the same as before.

## Make what is missing
- Map each literal to the nearest existing token. A colour with no token gets one in the theme file
  (`theme.css` / `tokens.ts`), named for its role (`--color-success`), not its hue.
- In a multi-client app (camasys-web) a token's value is data in the `site` global, not code.
- A literal that must stay (a QR code's black on white, a third-party brand mark) gets a `// standards-allow: why` comment.

## Hand off only when
Never.

## Don't
- Don't swap a hex for an equally hard-coded `rgb()`.
- Don't touch email templates: mail clients need inline colours.
