# AGENTS.md — Standards

Standards is a desktop app on the just-apps platform (`@justanarthur/modo-ui` + Tauri). It lives in `app/` of the `just-standards` repo (beside the engine in `core/`, `cli/` and `packs/`, which work without it). just-apps mounts that repo at `apps/standards` and finds the app in its `app/` folder; the app builds only there: read `../../../AGENTS.md` first, it has the platform's layout, rules and checks.

- Here: the app's screens and logic (`src/`), its config (`app.json`), its own native commands (`src-tauri/src/main.rs`). Everything generic (window chrome, settings window, command palette, store, Tauri setup) comes from the platform; a capability other apps could use goes there, not here.
- Never edit `src-tauri/tauri.conf.json` or `src-tauri/capabilities/` by hand: `bun run app sync standards` (from the just-apps root) writes them from `app.json`.
- Run: `bun run app dev standards` (desktop) or `bun run dev` here (browser, web host).
- Releases: not wired yet. The just-apps release workflows assume the app at the repo root; they need `app/` paths before they go into this repo's `.github/workflows`. After committing here, commit the new submodule pointer in just-apps.
