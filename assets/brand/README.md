# just-standards brand

The mark is a 2×2 grid of cells. The fourth cell is cut in two by a check: the moment a cell of the asset × standard grid passes. Every file here is plain SVG paths (no fonts, no masks), so it renders the same everywhere.

## Files

| file | use it for |
|---|---|
| `logo.svg` / `logo-white.svg` | the mark alone, one colour, on light / dark backgrounds; favicons, small UI |
| `logo-color.svg` / `logo-color-white.svg` | the mark with the green check cell, on light / dark backgrounds |
| `icon.svg`, `icon-1024.png` | the app icon master (macOS squircle with shadow, 1024 canvas); the Tauri set in `app/src-tauri/icons/` is generated from the PNG |
| `wordmark-black.svg` / `wordmark-white.svg` | the name alone, where the mark is already on screen |
| `lockup-black.svg` / `lockup-white.svg` | mark + name; the default for docs, slides and headers |
| `../social/og-1280x640.png` | GitHub social preview (Settings → Social preview) |
| `../social/og-1200x630.png` | Open Graph / Twitter card image for a site |
| `../social/avatar-1024.png` | square avatar; the mark stays inside a circle crop |
| `../social/x-header-1500x500.png`, `../social/linkedin-banner-1584x396.png` | profile headers; the lockup sits right of centre, clear of the profile photo |

Each social PNG has its SVG source next to it.

Regenerate the app icons after changing the master, then drop the mobile sets:

```bash
cd app && tauri icon ../assets/brand/icon-1024.png -o src-tauri/icons && rm -rf src-tauri/icons/android src-tauri/icons/ios
```

## Colour

| name | hex | where |
|---|---|---|
| Ink | `#0a0a0a` | the mark on light backgrounds and on the app icon |
| Green | `#22c55e` | the check cell on light backgrounds |
| Green on dark | `#4ade80` | the check cell on dark backgrounds; the banner accent; the icon's base |
| Night | `#09090b` | dark backgrounds (social images) |

The app icon's gradient lays four soft spots over Green on dark: lime `#d9f99d` top-left, violet `#c4b5fd` top-right, emerald `#10b981` bottom-left, lime `#a3e635` bottom-right.

Only the check cell is ever green. The other three cells are always the same colour as each other.

## Type

The name is set lowercase as `just-standards` in Inter SemiBold (600) with −3.5% tracking. Running text around the brand uses Inter Regular.

## Clear space and size

- **Clear space:** one cell (just under half the mark's width) on every side of the mark, and of the lockup.
- **Lockup:** the mark's cells are 1.25× the name's cap height, centred on it, and the gap between them is about a third of the mark's width.
- **Smallest size:** 16 px for the mark, 120 px wide for the lockup. Below 24 px use the one-colour `logo.svg`.

Don't rotate or redraw the mark, outline it, add effects to it, or set the name in another typeface.
