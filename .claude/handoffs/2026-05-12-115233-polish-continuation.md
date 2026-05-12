# 🤝 Handoff: Continuing misc polish after the cosmic-floor PR

## 🧾 Session Metadata
- Created: 2026-05-12T11:52:33Z
- Project: /Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01
- Branch: `worktree-refactored-wondering-falcon` (worktree at `.claude/worktrees/refactored-wondering-falcon/`)
- Live URL: https://cypherpoet.github.io/THREE-JS-APOD-Air-and-Space-Museum/
- Repo: https://github.com/CypherPoet/THREE-JS-APOD-Air-and-Space-Museum
- Merged PR: https://github.com/CypherPoet/THREE-JS-APOD-Air-and-Space-Museum/pull/1 (merged 2026-05-12 — all 7 commits now on `main`)

### Recent Commits (most recent first)
  - `d691fa4` Stabilize walkthrough opening + hover the enter button before click
  - `a57744c` Bump walkthrough to 60fps via motion-compensated interpolation
  - `33275ac` Recapture walkthrough at 1280x800 with smooth camera tweens
  - `8753f81` Tighten walkthrough video, crop side strip, switch to MP4
  - `6603789` Regenerate media against the polished gallery
  - `ae4185a` Seed historical APOD archive via APOD_DATE override
  - `9099fd0` Polish gallery: fluting, softer rim, cosmic floor, plinth dots

## 🔗 Handoff Chain

- **Continues from**: `/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/.claude/handoffs/2026-05-12-091307-general-polish-items.md` (in the main repo working dir — `.claude/handoffs/` is gitignored so the file isn't in the worktree)
- **Supersedes**: None

> The prior handoff enumerated eight polish items. Items 1 (pillar fluting + amber rim) and 6 (pre-seed archive) were tackled this session along with two new asks (cosmic floor shader, plinth base dots). Items 2-5 + 7-8 from that list are still open — see "Pending Work" below.

## 📍 Current State Summary

The Air & Space Museum is feature-complete and deployed. PR #1 has merged — all 7 commits are now on `main`: fluted pillars, softer amber rim, cosmic floor shader overlay, plinth base accent dots, a 1280×800 60fps walkthrough video with a stable opening + amber-hover-then-click on the Enter button, plus the `APOD_DATE` scraper extension and 10 historical archive entries spanning 1995-2022. The next session continues with the remaining polish items from the prior handoff and anything that surfaces from live use of the merged site.

## 🧠 Codebase Understanding

### Architecture Overview (unchanged from prior handoff — recap)

- **No build step.** Plain ES modules under `src/`, Three.js r169 via importmap in `index.html`.
- **No NASA API key.** Daily scrape commits to `data/archive/<date>.{json,jpg}` + rebuilds `data/manifest.json`. Frontend reads same-origin JSON.
- **Append-only data.** As of this session, 11 archive entries (10 historical + today). `scanArchive()` in `scripts/fetch-apod.mjs` is self-healing.
- **Interaction model.** PointerLockControls (desktop) / touch drag (mobile). Camera-raycast picks the mug. `window.__museum.{camera,mug}` debug handle is load-bearing — used by the capture flow.

### New patterns added this session

- **Additive overlay ShaderMaterial pattern** (`src/scene.js:357-456` in `makeCosmicFloorMaterial`). Two-octave fbm with domain warping → dust + bloom layers → hash-grid stars. Tweakable via uniform dials documented in the plan. `prefers-reduced-motion` honored via `uReducedMotion` clamping `uTime` to 0.
- **Vertex-displacement geometry** (`src/scene.js:531-548` in `makeFlutedShaft`). CylinderGeometry with `setXYZ` displacement + `computeVertexNormals()` — canonical for radial detailing without a normal map.
- **Plinth-base LED ring** (`src/scene.js:561-598` in `buildPlinthDots`). 24 small emissive spheres + 4 corner PointLights with tight distance/decay for soft pool spill.
- **HD walkthrough capture via Node Playwright** — `playwright-cli` records at fixed 800×450 with right-side gray padding; the Node API exposes `recordVideo.size`. Full recipe in `.claude/skills/capture-museum-media/SKILL.md` Pass 2.
- **Walkthrough trim-from-stable point** — the capture script logs `TRIM_MS=<n>` at the moment the boot screen is fully settled (button enabled + telemetry done); ffmpeg uses that as `-ss` so the MP4 opens on a stable frame, not mid-layout-shift.

### Critical Files (touched or load-bearing)

| File | Purpose | Relevance |
|------|---------|-----------|
| `src/scene.js` | Three.js composition; the only file modified for visual polish this session | Pillars at ~510-560, plinth dots at ~561-598, cosmic shader at ~357-456, animation tick at ~140 |
| `src/main.js` | Wires everything; exports `window.__museum` debug handle (camera, mug) | **Do not remove `window.__museum`** — the capture flow depends on it |
| `scripts/fetch-apod.mjs` | Daily APOD scraper, now supports `APOD_DATE` override | Cron path unchanged; `APOD_DATE=YYYY-MM-DD` targets `apYYMMDD.html` |
| `data/manifest.json` | Archive index (11 entries, `latest: 2026-05-12`) | Auto-rebuilt by `scanArchive()` |
| `.claude/skills/capture-museum-media/SKILL.md` | The two-pass capture recipe (screenshots via playwright-cli; video via Node API) | Inline Node script + ffmpeg trim+minterpolate pipeline |
| `.github/workflows/refresh-apod.yml` | Daily 06:30 UTC cron | First scheduled run fired successfully today (2026-05-12) — confirms cron path is healthy |
| `README.md` | Portfolio-style README | Walkthrough link points at `media/walkthrough.mp4` (updated this session) |

## 🏁 Work Completed (this session)

### Tasks Finished

- [x] Subtle vertical fluting on pillar shafts (vertex displacement, no normal map)
- [x] Soften amber rim (emissive 0.35 → 0.18; PointLight pulse 1.02-1.38 → 0.85-1.05)
- [x] Cosmic floor overlay shader (fbm nebula blooms + star pinpoints, additive, center-damp, `prefers-reduced-motion` aware)
- [x] Plinth base accent dots (24 emissive amber spheres + 4 corner PointLights)
- [x] `APOD_DATE` env-var override in `scripts/fetch-apod.mjs`; parser hardened for 1995-era "Picture Credit" and modern linked-`Copyright` blocks
- [x] 10 seeded historical archive entries (Pleiades 1995 → Webb's First Deep Field 2022)
- [x] All 7 PNGs regenerated against the polished scene
- [x] Walkthrough video: 1280×800 60fps MP4, stable opening, amber hover before click, smooth camera tweens (pan left → across → center → mug)
- [x] PR #1 opened; 7 commits pushed

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| Additive overlay disc vs. patching the floor's StandardMaterial | onBeforeCompile patch / additive overlay | Clean A/B (remove disc to disable), additive blending guarantees floor texture reads through, no PBR surgery |
| Warm palette for cosmic floor (vs. cool-only from my first recommendation) | Cool nebula / warm nebula | User's reference image showed warm amber+magenta blooms; cool-only would've been too muted and inconsistent with the existing amber accents |
| Emissive dots + PointLights for plinth base (vs. continuous strip) | Continuous baseboard strip / dotted markers | User explicitly asked for dotted LED-marker feel, not a continuous strip |
| Playwright Node API for HD video (vs. playwright-cli) | playwright-cli at 800×450 + crop / Node API at 1280×800 | playwright-cli's video size isn't configurable — Node API exposes `recordVideo.size`. Plus enables eased camera tweens |
| 60fps via ffmpeg `minterpolate mci` (vs. just frame duplication or accepting 25fps) | Accept 25 / `-r 60` duplicate / motion-compensated synthesis | True synthesized intermediates make the camera pans buttery; no visible artifacts at modal transitions |
| Trim from logged `TRIM_MS` (vs. fixed trim) | Fixed 3s / dynamic from script log | Page settle time varies; logged elapsed-since-record gives exact, deterministic trim point |

## 🚧 Pending Work

### Immediate Next Steps (when resuming)

1. **Verify the GH Pages deployment** with the cosmic shader live. The merge of PR #1 should have triggered a ~30s Pages rebuild — confirm the live site at https://cypherpoet.github.io/THREE-JS-APOD-Air-and-Space-Museum/ shows the cosmic floor, plinth dots, and fluted pillars. Spot-check on a real mobile device for shader performance.
2. **Clean up the worktree** if no longer needed: `git worktree remove .claude/worktrees/refactored-wondering-falcon` (run from main repo root). The branch can be deleted with `git branch -d worktree-refactored-wondering-falcon` once merged. (The `commit-commands:clean_gone` skill can do this in one step.)
3. **Pick up the remaining polish menu** from the prior handoff (see below).

### Open polish items (from the prior handoff, still unaddressed)

These were enumerated in `2026-05-12-091307-general-polish-items.md` and remain valid candidates:

1. **HUD type sizes at small viewports** — top-right APOD title can wrap awkwardly for long titles under ~1100px. Consider `clamp()` font-size + ellipsis at very small widths. Touches `styles.css`.
2. **Reader modal first-letter drop cap** — uses `::first-letter`. Doesn't fire when the explanation starts with whitespace. The scraper trims, but worth confirming on a few historical entries that just landed.
3. **Mobile audio toggle UX** — pointer-lock doesn't exist on mobile; the once-on-Enter gesture flow needs a real-device pass. Sequence to test: load mobile, tap Enter, confirm radio audio actually starts.
4. **README "Run locally" verification** — confirm the documented `python3 -m http.server 8767` works on a clean clone with no port collisions.
5. **Mug discoverability tune** — was at `emissiveIntensity: 0.18` baseline in the prior pass; revisit only if it now feels off against the warmer cosmic floor.

### New items surfaced this session

- **Browse-archive UI** — there are now 11 archive entries, only today's is displayed. The prior handoff deferred this; it's a feature, not polish, but the manifest infra is ready. Probably its own PR.
- **Reader modal contrast under the new floor** — the modal is bright vellum on dark void; against the warmer cosmic floor it might read slightly differently. Eyeball after merge.
- **Performance check on iPhone-class hardware** — the cosmic shader is 2-octave fbm + star hash per fragment over a ~17-unit disc + 16 lights now (1 hemi + 1 dir + amberRim + cyanFill + 8 pillar lamps + 4 plinth corners). Fine on desktop in the walkthrough; needs a real-device check.

### Deferred items

- **`capture-museum-media` skill optimization via `/skill-creator` eval loop** — the skill description was written by hand; could be sharpened with eval-driven tuning.

## 💡 Context for Resuming Agent

### Important Context

**Do not run the daily cron's `node scripts/fetch-apod.mjs` and overwrite today's entry casually.** Today's entry was already refreshed multiple times during this session due to parser-fix iteration; further refreshes are fine but expect the `date` field to match the URL. The `APOD_DATE` env var path produces deterministic output, but the cron path always writes to today's slot.

**The cosmic floor shader and the plinth dots interact visually.** The floor's warm dust is what makes the plinth base reads as a dark void, which is what motivated the dots. If you tune the cosmic shader significantly darker (e.g., reduce dust intensity), the plinth dots will start to dominate. Tune them together.

**`window.__museum` debug handle is load-bearing** — `src/main.js` exports `{ camera, mug }`. The walkthrough capture script (Pass 2 in the skill) and several future capture flows depend on it. Don't remove it as "dead code" — it has no in-app consumer, only the dev capture tooling.

**The mug click gating on `controls.isLocked`** is unchanged and still load-bearing. Subtle invariant — if you reshuffle click handlers, preserve it. See `src/main.js` and prior commit `26e1c04`.

**The walkthrough's TRIM_MS is non-deterministic** — depends on how fast the APOD JSON+image fetch resolves, which varies. The capture script logs the value; the operator (or skill instructions) reads it and uses it for ffmpeg `-ss`. If the prior handoff's recipe shifts (e.g., faster loading), the trim value drops naturally.

**Playwright video output is locked at 25fps** — no public API knob. We compensate with ffmpeg `minterpolate mci` to 60fps. If the camera tween durations change significantly, re-run the same pipeline; the trim + interpolate steps are idempotent.

### Assumptions Made

- The "soft and calming" aesthetic from the prior pass continues to be the north star — restraint over saturation.
- Cool-tone palette additions (e.g., the magenta `#a14a7f` bridge color in the cosmic shader) are acceptable when local to a single file and not exported to the global `COLORS` palette in `src/scene.js`.
- The amber rim, plinth top inlay, and plinth dots together form a coherent "amber hierarchy" — anything new that introduces amber should sit lower in the hierarchy than the central exhibit's frame border.
- The daily cron will continue producing one new entry per day. The historical seed entries are purely for an eventual browse-archive UI; they don't affect daily display.

### Potential Gotchas

- **Two `.claude/handoffs/` directories**: one in the main repo working copy, one in the worktree. `.claude/handoffs/` is gitignored so they never sync. When chaining, reference the absolute path.
- **`.claude/skills/` IS tracked** (per the gitignore opt-out flip) — be careful with `git add` on skill changes; you're shipping them with the repo. The `capture-museum-media` skill was rewritten this session and is part of PR #1.
- **`playwright-cli` (Homebrew, at `/opt/homebrew/bin/playwright-cli`) and `npx playwright` are DIFFERENT installs.** `playwright-cli` is for quick eval/click flows; the Node API in `~/.npm/_npx/<hash>/node_modules/playwright` is what the walkthrough capture uses. The skill explains how to locate the npx install dir dynamically.
- **The cosmic shader's `vec4(color, alpha)` output relies on additive blending** — if anyone toggles the overlay to `NormalBlending`, dark UV regions will write transparent-black and overwrite the floor texture. Keep `blending: THREE.AdditiveBlending`.
- **The historical archive entries' image URLs point to apod.nasa.gov** — the local JPGs are committed to the repo, but `image_url` in the JSON is the upstream link. Don't assume `image_url` is local.
- **APOD's older HTML format varies** — pre-2000 pages have "Picture Credit", "MM DD, YYYY" dates, no `<center>` block around the credit. The parser handles all variants now, but if you add a new date much earlier than 1995, expect breakage and budget time for regex tweaks.

## 🌐 Environment State

### Tools / Services Used

- **GitHub Pages** — serves `main` at root, auto-rebuild ~30s after push.
- **GitHub Actions** — `.github/workflows/refresh-apod.yml`, daily 06:30 UTC. First scheduled run succeeded today (commit on `main` outside this branch, visible in `data/archive/2026-05-12.*`).
- **Node.js 20** (CI) / Node 24 (local) — `scripts/fetch-apod.mjs` has no npm deps.
- **ImageMagick** (`magick`) — local + on `ubuntu-latest`.
- **`playwright-cli` v0.1.8** — Homebrew install at `/opt/homebrew/bin/playwright-cli` for quick interactions/screenshots.
- **`playwright` v1.60.0** — via `npx playwright`, installed in `~/.npm/_npx/<hash>/node_modules/playwright`. Used for HD video capture.
- **`ffmpeg`** — local Homebrew. Walkthrough pipeline: trim, `minterpolate`, H.264 encode.
- **macOS** primary dev platform.

### Active Processes

- No background `python3 -m http.server` left running. Worktree server on port 8769 was stopped at end of session. A separate Python http.server is parked on port **8768** (not started by me; serving an unrelated `-d .` cwd — left untouched).
- No other long-running processes.

### Environment Variables

- None used by the application itself.
- `APOD_DATE` (optional, `YYYY-MM-DD`) — drives `scripts/fetch-apod.mjs` to target a historical APOD page instead of today's.
- `GITHUB_TOKEN` — provided automatically by the daily Actions workflow.

## 📚 Related Resources

- Live site: https://cypherpoet.github.io/THREE-JS-APOD-Air-and-Space-Museum/
- Repo: https://github.com/CypherPoet/THREE-JS-APOD-Air-and-Space-Museum
- PR #1 (this session's work, merged): https://github.com/CypherPoet/THREE-JS-APOD-Air-and-Space-Museum/pull/1
- NASA APOD source: https://apod.nasa.gov/apod/astropix.html
- Three.js r169 docs: https://threejs.org/docs/
- Prior handoff: `/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/.claude/handoffs/2026-05-12-091307-general-polish-items.md`
- Capture skill: `.claude/skills/capture-museum-media/SKILL.md` (in this branch)
- `media/` — all committed PNGs + `walkthrough.mp4`

---

**Security Reminder**: No secrets in this handoff. API keys, tokens — none touched this session.
