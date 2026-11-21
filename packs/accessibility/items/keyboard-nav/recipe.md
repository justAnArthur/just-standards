## Done when
The check passes on the PR's preview: at 1366×900, pressing Tab from the top of the home page (after closing the cookie banner) reaches every visible header link and button and every form control of the first two screens, each stop shows a visible focus indicator, and focus never gets stuck. A keyboard-only visitor can open the menu and fill the booking search.

## Make what is missing
Reproduce: open the page, click the address bar, press Tab repeatedly. The evidence names what Tab never reached, which stops showed no focus, or where it got stuck.
- **No visible focus:** one global rule in the base stylesheet, from the design system's focus token (or its primary colour): `:focus-visible { outline: 2px solid var(--focus, currentColor); outline-offset: 2px }`. Remove `outline: none` / `outline: 0` resets that have no replacement (search the CSS and Tailwind classes: `outline-none`, `focus:outline-none` without `focus-visible:ring-*`). On dark backgrounds use a token with 3:1 contrast against them.
- **Focus lands on something off screen:** a closed menu, dropdown or off-canvas drawer keeps its links focusable. Make the closed state `hidden`, `inert` or `display: none`, not only `opacity: 0` or a transform.
- **Never reached:** a `div` or `span` with an `onClick` instead of a `<button>` or `<a href>`; custom selects and date pickers without `tabindex="0"` and key handlers. Use the native element, or the design system's accessible component (Radix, React Aria, Headless UI).
- **Stuck:** a widget that calls `focus()` on blur or catches Tab without letting go; a modal open on load without Esc. Release focus on Tab at the ends, and close on Esc.

## Stacks
- **Next.js / React:** fix the shared `Button`, `Link`, `Menu` and form components once; `next/link` renders an `<a>` already.
- **Tailwind:** `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--focus]` on the base components, or the rule above in `globals.css`.
- **Payload + Next:** the admin isn't checked; only the public site.
- **Astro / static:** the base layout's stylesheet and the header component.

## Hand off only when
The unreachable controls are inside a third party's widget (the booking engine's iframe, a chat): name the vendor in the PR and fix everything else.

## Don't
- Don't add `tabindex` greater than 0: it reorders the whole page.
- Don't show focus only on `:hover`, or remove it after a mouse click with script.
- Don't make the check pass by removing elements from the header.
