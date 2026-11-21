## Done when
The check passes on the PR's branch: the repo has one place an agent reads for the design system, a `DESIGN.md` (root, `docs/design.md`, or the UI package's), Storybook or Ladle stories, and it names the tokens (colours, type scale, spacing, radii, shadows, motion) and the components with when to use each.

## Make what is missing
The check accepts any of: `DESIGN.md` / `design.md` / `design-system.md` anywhere, Markdown under `docs/design/` or `docs/design-system/`, `*.stories.*` files, `.storybook/main.*`, `.ladle/components.*`. The cheapest true one is a `DESIGN.md`, written from the code:
- **Tokens:** read them where they are defined (Tailwind `@theme` or `tailwind.config`, CSS custom properties in `globals.css`, a tokens file, a theme object) and list each with its value and use: `--color-primary #d4002a: buttons, links`.
- **Type:** families (from `next/font` or `@font-face`), the scale and which element uses which step.
- **Components:** the folder (`components/ui`, `src/components`), one line per component with when to use it and its main variants, read from its props.
- **Layout:** container widths, breakpoints, section spacing.
- If the design system comes from a package (shadcn, modo-ui, an internal library), say which and link its docs, then list what this repo adds or overrides.

## Hand off only when
Never: the tokens and components are in the code; a missing brand is `ai-ready/brand-assets`, not this.

## Don't
- Don't invent tokens the code doesn't have, or describe a design the site doesn't use.
- Don't copy the whole Tailwind palette: only what the site uses.
