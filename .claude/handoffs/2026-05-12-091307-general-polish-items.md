# 🤝 Handoff: General polish items for the Air & Space Museum

## 🧾 Session Metadata
- Created: 2026-05-12T09:13:07Z
- Project: /Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01
- Branch: main
- Live URL: https://cypherpoet.github.io/THREE-JS-APOD-Air-and-Space-Museum/
- Repo: https://github.com/CypherPoet/THREE-JS-APOD-Air-and-Space-Museum

### Recent Commits (for context)
  - 72e2036 Tighten README hero, trim filler, link acknowledgements
  - 2c19ba2 Add MIT LICENSE and Linktree badge entry
  - b6720fe Reshape data/ as an append-only archive with a manifest
  - 142a019 Track all .claude/skills/ — they're part of the dev environment
  - dd89421 Regenerate media against current scene + add portfolio README

## 🔗 Handoff Chain

- **Continues from**: None (fresh start)
- **Supersedes**: None

> This is the first handoff for this task. Major feature work is done; the next session is for general polish.

## 📍 Current State Summary

The Air & Space Museum is feature-complete and deployed on GitHub Pages. It scrapes the daily NASA APOD via a GitHub Action (06:30 UTC cron), commits each day's parsed metadata + compressed image into `data/archive/`, and the frontend reads `data/manifest.json` to find the latest exhibit. Three.js renders a small open-air gallery with first-person controls, a ten-station procedural lo-fi radio, a curator's-note reader, and a discoverable coffee-mug easter egg. The repo has a portfolio-style README with hero image, badge row, screenshot grid, and ASCII architecture diagram. There's an in-project `capture-museum-media` skill that re-runs the playwright-cli flow to regenerate every asset under `media/`. **The next session is for polish, not new features** — anything that makes the showcase tighter without changing what the site does.

## 🧠 Codebase Understanding

### Architecture Overview

- **No build step.** `index.html` declares an importmap that pulls Three.js r169 from unpkg. Plain ES modules under `src/`.
- **No NASA API key.** Data is scraped daily on the GH runner and committed to the repo; the browser reads same-origin JSON.
- **Append-only data.** `data/manifest.json` lists every dated archive entry; `data/archive/<YYYY-MM-DD>.{json,jpg}` pairs accumulate. Scraper rebuilds the manifest by scanning the directory (self-healing).
- **Interaction model.** PointerLockControls on desktop; drag-to-look on mobile. A single `THREE.Raycaster` from the camera centre picks the coffee mug. Stuck keys are cleared on window blur.

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `index.html` | Shell + HUD markup, importmap, all DOM ids the JS references | Add/remove HUD elements here |
| `styles.css` | All visual design — typography, palette, HUD, dial, reader, world-hint | Polish/restyle starts here |
| `src/main.js` | Wires everything; runs raycaster + auto-enter timer; exposes `window.__museum` debug handle | The orchestration layer |
| `src/scene.js` | Three.js scene composition: sky, floor, pillars, plinth, APOD frame, mug, dust | New geometry / lighting |
| `src/controls.js` | PointerLockControls + WASD + mobile touch; collision with plinth & pillars | Movement tweaks |
| `src/audio.js` | Ten procedural lo-fi stations + cross-fade switching | New stations / sound tweaks |
| `src/ui.js` | Boot, HUD, reader, dial, toast handlers | New UI surfaces |
| `src/apod.js` | Fetches `manifest.json` → archive entry | Loader shape |
| `scripts/fetch-apod.mjs` | APOD HTML scraper, ImageMagick compress, manifest rebuild | Server-side data |
| `.github/workflows/refresh-apod.yml` | Daily 06:30 UTC cron, commits new dated pair + manifest | Schedule changes |
| `.claude/skills/capture-museum-media/SKILL.md` | Playwright-cli capture flow for `media/` | Use this after any visual change |
| `README.md` | Portfolio-style, hero + badges + diagrams | Polish |

### Key Patterns Discovered

- **`window.__museum` debug handle** in `src/main.js` exposes `{ camera, mug }` so playwright-cli can position the camera for the easter-egg screenshot. Don't remove it — the capture skill depends on it.
- **Mug click gating**: only fires when `controls.isLocked` (or mobile) so the click that re-engages pointer lock after returning from BMC doesn't re-trigger the BMC open. See commit `26e1c04`.
- **CSS-id selectors over playwright refs**: playwright-cli `eXX` refs invalidate across DOM reflows (boot → gallery transition is a common culprit). The capture skill uses `#radio-station-name` etc.
- **Manifest is rebuilt by scanning the archive directory** each run — orphan files heal in/out automatically. See `scanArchive()` in `scripts/fetch-apod.mjs`.

## 🏁 Work Completed

### Tasks Finished

- [x] Built full Three.js museum scene with starfield, pillars, plinth, suspended APOD frame
- [x] First-person PointerLockControls + WASD + mobile drag-to-look
- [x] Ten-station procedural lo-fi radio with cross-fade
- [x] Curator's-note reader modal
- [x] Editorial boot screen with telemetry feed
- [x] Coffee-mug easter egg on plinth with raycast pick + world-hint
- [x] Fix for the mug-click-on-return-from-BMC loop
- [x] HTML scrape replaces NASA API dependency
- [x] Daily GitHub Action commits new APOD entry
- [x] Append-only `data/archive/` + `data/manifest.json`
- [x] `capture-museum-media` project-local skill
- [x] All seven screenshots + walkthrough video committed under `media/`
- [x] Portfolio README with hero, badges, diagram, project layout
- [x] MIT LICENSE file
- [x] `.gitignore` set to ship all `.claude/skills/` with the repo

### Files Modified (recently)

| File | Changes | Rationale |
|------|---------|-----------|
| `README.md` | Tightened hero, trimmed filler, linked acknowledgements | User edits to the portfolio README |
| `LICENSE` | Added MIT license | Match the badge in the README |

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| Self-host the APOD via HTML scrape vs use api.nasa.gov | NASA API (needs key, rate-limited) / HTML scrape (no key, daily cron) | No key in client; smaller, more reliable |
| Coffee mug as 3D easter egg vs HTML floating button | HTML floating button / 3D in-scene object | User explicitly preferred in-world discovery |
| `data/archive/<date>.{json,jpg}` + manifest | Single `apod.{json,jpg}` overwriting / Date-named files only / Manifest + archive | Archive grows over time, manifest gives O(1) latest lookup, enables future browsing |
| Ship all `.claude/skills/` not just `capture-museum-media` | Only ship project skill / Ship all | Skills are part of the dev environment; visitors get same tooling |
| Procedural WebAudio radio vs bundled audio files | Bundled MP3s / Pure WebAudio | Zero binary assets, deterministic, no licensing |

## 🚧 Pending Work

### Immediate Next Steps (polish menu, pick & choose)

1. **Visual polish on the gallery scene** — pillar materials currently use flat MeshStandardMaterial; could add subtle vertical fluting via geometry or a normal map. The floor's amber rim is bright — consider a softer falloff.
2. **Type sizes on smaller viewports** — the top-right HUD title can wrap awkwardly for long APOD titles. Consider shrinking under ~1100px or letting it overflow with an ellipsis.
3. **Mug discoverability vs subtlety** — the amber emissive (0.18 baseline, 0.73 hovered) might be a touch too obvious from the entry point. Compare gallery view in `media/02-gallery.png` against the close-up `media/09-mug-easter-egg.png`. Could try 0.12 baseline.
4. **Reader modal first-letter drop cap** — uses `::first-letter`, which doesn't fire when the explanation starts with whitespace. The scraper already trims, but worth confirming.
5. **Mobile audio toggle UX** — pointer-lock doesn't exist on mobile, so the auto-start-on-Enter gesture flow needs a once-over with a real device.
6. **Pre-seed archive with notable APODs from history** — drop entries into `data/archive/` by hand; manifest will pick them up. Could enable a "browse exhibits" feature later.
7. **`README.md` "Run locally" step** — verify on a clean clone, since the user may have just done `python3 -m http.server` without specifying a port and gotten 8000 vs 8767.
8. **`.github/workflows/refresh-apod.yml` first cron run** — the workflow has never actually fired yet; first 06:30 UTC run will be the live smoke test. Watch the Actions tab for failures.

### Blockers/Open Questions

- [ ] Are there other "polish" items the user has in mind beyond visual? (perf, accessibility, deeper mobile testing)
- [ ] The first scheduled GH Action run (next 06:30 UTC) hasn't been verified yet — if it errors, the failure mode is silent (just no new commit). Worth proactively checking.

### Deferred Items

- **Browse the archive UI** — manifest already supports listing past entries; UI work deferred until there are >1 entry to browse.
- **Skill description optimisation** — `capture-museum-media` SKILL.md was written manually rather than via `skill-creator`'s eval loop. Could run the optimiser later.

## 💡 Context for Resuming Agent

### Important Context

**The user is the author/owner — CypherPoet on GitHub.** Tone is collaborative and direct; they push back when they disagree. They prefer in-world, discoverable touches over heavy HUD chrome — the easter-egg mug was a representative course-correction (they explicitly rejected an HTML floating button).

**The local dev loop is `python3 -m http.server 8767 -d <project-root>`** — not 8000, since 8000 is sometimes already taken on this machine. There is no build step; edits to JS/CSS/HTML are immediately visible on browser refresh.

**The `window.__museum` debug handle is load-bearing** — `capture-museum-media` uses it to position the camera onto the mug. If you ever feel the urge to remove it as "dead code", don't.

**The mug-click fix uses `controls.isLocked`** — the mug click handler in `src/main.js` gates on pointer-lock state so the click-to-re-engage-lock after returning from BMC doesn't re-fire the BMC tab. This is a subtle invariant worth preserving across any reshuffle of the click handlers.

**Daily refresh runs at 06:30 UTC.** The first run hasn't fired yet at handoff time. If polish work happens to land mid-refresh, expect a merge with the bot's commit on `main`.

### Assumptions Made

- The user is comfortable with all-CSS solutions vs JS animation for polish
- "Polish" excludes new features — don't add a browse-archive UI or new stations without checking
- The visual aesthetic ("retro-futurist cosmic editorial", Michroma + B612 + B612 Mono, cosmic navy + vellum + Voyager amber palette) is settled; polish should respect it, not redirect it
- GitHub Pages serves directly from `main` at root — there's no `gh-pages` branch or build artefact

### Potential Gotchas

- **Plugin-installed skills under `.claude/skills/*` are tracked.** Don't add commits like `git add .claude/` blindly; a future plugin install could sweep in unwanted files. Stage specific paths.
- **`playwright-cli` refs (`e27`, etc.) invalidate across DOM reflows.** Always use CSS selectors (`#hud-prompt`, `#radio-station-name`) or role locators with disambiguating text.
- **Headless Chrome can't engage pointer lock.** Expect a console error in capture screenshots; it's safe and documented in the skill.
- **`media/walkthrough.webm` is ~4.6 MB.** Committing a fresh one on every visual change inflates history. Use git LFS or accept the bloat — current choice is accept.
- **APOD HTML uses HTML 3.2 (no `</p>` closing tags) for the live page**, but browser-saved versions add them. The scraper's `pickExplanation` handles both — don't simplify the regex without testing on both forms.

## 🌐 Environment State

### Tools/Services Used

- **GitHub Pages** — serves `main` branch at root; auto-rebuilds on push (~30s)
- **GitHub Actions** — `refresh-apod.yml` daily cron, manual `workflow_dispatch` available
- **Node.js 20** (CI runner) — `scripts/fetch-apod.mjs` runs with no npm deps
- **ImageMagick** (`magick`) — installed locally (Homebrew) and preinstalled on `ubuntu-latest`
- **playwright-cli** — Homebrew install at `/opt/homebrew/bin/playwright-cli`
- **Python 3** — used only for `http.server` during local dev
- **macOS** — primary dev platform

### Active Processes

- A local `python3 -m http.server 8767 -d <project-root>` may still be running in the background (task `bhmdzkkw9` from earlier session); start a fresh one if needed
- No other long-running processes

### Environment Variables

- None used by the application itself (no NASA API key, no secrets)
- `GITHUB_TOKEN` (auto-provided by Actions) — used by the daily refresh workflow

## 📚 Related Resources

- Live site: https://cypherpoet.github.io/THREE-JS-APOD-Air-and-Space-Museum/
- Repo: https://github.com/CypherPoet/THREE-JS-APOD-Air-and-Space-Museum
- NASA APOD source: https://apod.nasa.gov/apod/astropix.html
- Three.js docs (r169): https://threejs.org/docs/
- B612 typeface: https://github.com/polarsys/b612
- Michroma typeface: https://fonts.google.com/specimen/Michroma
- ImageMagick: https://imagemagick.org/
- `media/` — every committed screenshot + walkthrough video
- `.claude/skills/capture-museum-media/SKILL.md` — how to re-run the media capture

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
