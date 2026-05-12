---
name: capture-museum-media
description: Regenerate every PNG + the walkthrough video under media/ for the Air & Space Museum project. Use when the scene changes, the HUD restyles, the radio gets new stations, or anything visual gets refreshed. Triggers on phrases like "refresh the screenshots", "regenerate media", "update the README images", or "capture new walkthrough".
allowed-tools: Bash(playwright-cli:*), Read, Bash(python3:*), Bash(lsof:*), Bash(kill:*), Bash(ls:*), Bash(rm:*), Bash(trash:*)
---

# capture-museum-media

Reusable automation for the screenshots and walkthrough recording committed to `media/`. Replaces the by-hand playwright dance from the project's early sessions.

## When to use

- The Three.js scene was edited (new geometry, lighting, materials)
- The HUD or boot screen was restyled
- The radio gained or renamed stations
- The reader modal layout shifted
- Before tagging a release / sharing the live URL

## Prerequisites

1. A local HTTP server is serving the project root at **http://localhost:8767**
   - If not running, start one in the background:
     ```bash
     python3 -m http.server 8767 -d /Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01 \
       > /tmp/apod-server.log 2>&1 &
     ```
2. `playwright-cli` is on PATH (verify with `playwright-cli --version`)
3. The Chrome browser is available to playwright-cli

## Outputs

All written under `media/` in the project root:

| File | What it shows |
|------|---------------|
| `01-boot.png` | Boot screen with "Press enter to begin" |
| `02-gallery.png` | Main 3D scene with full HUD chrome (mug visible on plinth) |
| `03-dial.png` | Radio dial open, current station highlighted |
| `04-dial-voyager.png` | Switched to Voyager Echo to demonstrate station change |
| `05-reader.png` | Curator's note (full APOD explanation) modal |
| `06-hud-voyager.png` | Back in gallery with the new station playing |
| `09-mug-easter-egg.png` | Close-up of the coffee-mug easter egg on the plinth |
| `walkthrough.webm` | ~30 second recording of the whole tour |

## Capture sequence

Run these in order, reading every screenshot back with the Read tool to confirm composition before moving on.

```bash
# Reset any prior session
playwright-cli close-all 2>/dev/null

# Start a fresh chrome session at 1920x1200
playwright-cli open --browser=chrome
playwright-cli resize 1920 1200

# Begin recording the full walkthrough
playwright-cli video-start /Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/walkthrough.webm

# ---- BOOT ----
playwright-cli goto "http://localhost:8767/?cb=$(date +%s)"
# Wait for the APOD to load + the "Ready" state to appear (~2s).
sleep 2
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/01-boot.png

# ---- GALLERY ----
# Snapshot to grab the Enter button ref (changes per session).
playwright-cli snapshot --raw 2>&1 | grep "Enter the Gallery" | head -1
# Click the Enter button — replace eXX below with the ref from the line above.
playwright-cli click eXX
sleep 3
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/02-gallery.png

# ---- RADIO DIAL ----
playwright-cli snapshot --raw 2>&1 | grep "Cassini Drift Saturn" | head -1
playwright-cli click eYY    # the station-name button in the radio widget
sleep 1
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/03-dial.png

# Switch to Voyager Echo (row 3) — grab its ref from a fresh snapshot
playwright-cli snapshot --raw 2>&1 | grep "03 Voyager" | head -1
playwright-cli click eZZ
sleep 1
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/04-dial-voyager.png

# ---- READER MODAL ----
playwright-cli press Escape
sleep 0.5
# The interact prompt only shows when near the exhibit. Open the reader
# directly via the click handler on the HUD prompt — calling it via DOM
# is reliable in headless even when pointer-lock isn't engaged.
playwright-cli eval "() => document.getElementById('hud-prompt').click()"
sleep 1
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/05-reader.png

# ---- HUD WITH NEW STATION ----
playwright-cli press Escape
sleep 1
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/06-hud-voyager.png

# ---- MUG EASTER EGG ----
# Reposition the camera onto the mug. The window.__museum debug handle
# exposes { camera, mug } — exported from src/main.js for this purpose.
playwright-cli eval "() => { const c = window.__museum.camera; c.position.set(1.6, 1.5, 1.9); c.lookAt(0.78, 1.18, 0.95); return 'ok'; }"
sleep 0.6
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/09-mug-easter-egg.png

# ---- STOP RECORDING + CLOSE ----
playwright-cli video-stop
playwright-cli close
```

## Notes on element refs

`playwright-cli` regenerates element refs (`e3`, `e27`, …) every snapshot. **Do not paste literal refs from this file** — always run a fresh `snapshot --raw | grep` immediately before each `click` to pick the current ref. The grep targets above are stable selectors that survive script reflows.

## Frame-by-frame verification

After every screenshot, call the Read tool on its path to confirm the image actually shows what's expected. Common failure modes:

- **Pointer-lock error in console** — expected in headless Chrome; safe to ignore (the rest of the page still renders)
- **Mug invisible / hint missing** — check that `window.__museum` is defined (`playwright-cli eval "typeof window.__museum"`) and that the camera position lookAt actually puts the mug in frame
- **Reader modal not showing** — the explanation only fills in after the APOD fetch resolves; bump the post-Enter `sleep` to 4-5s on slow connections

## Cleanup

Delete any `media/.tmp-*` files that may have been left behind from prior debug sessions:

```bash
trash /Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/.tmp-*.png 2>/dev/null
```

The `.playwright-cli/` directory at the project root holds session snapshots and console logs and is git-ignored — leave it alone.
