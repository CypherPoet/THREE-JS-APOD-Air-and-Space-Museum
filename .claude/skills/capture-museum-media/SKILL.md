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
| `walkthrough.mp4` | ~15 second H.264 recording of the whole tour |

## Capture sequence

Two passes: screenshots first (analysis-friendly, can pause between shots), then the walkthrough video as a single tight chain (no pauses — the recording captures every second the playwright session is alive).

### Pass 1 — Screenshots

```bash
# Reset any prior session
playwright-cli close-all 2>/dev/null
playwright-cli open --browser=chrome
playwright-cli resize 1920 1200

# ---- BOOT ----
playwright-cli goto "http://localhost:8767/?cb=$(date +%s)"
sleep 2
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/01-boot.png

# ---- GALLERY ----
playwright-cli eval "() => document.getElementById('boot-enter').click()"
sleep 3
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/02-gallery.png

# ---- RADIO DIAL ----
playwright-cli snapshot --raw 2>&1 | grep "Cassini Drift Saturn" | head -1
playwright-cli click eYY    # station-name button — replace with current ref
sleep 1
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/03-dial.png

playwright-cli snapshot --raw 2>&1 | grep "03 Voyager" | head -1
playwright-cli click eZZ    # replace with current ref
sleep 1
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/04-dial-voyager.png

# ---- READER MODAL ----
playwright-cli press Escape
sleep 0.5
# DOM-click the hud prompt — reliable in headless without pointer-lock.
playwright-cli eval "() => document.getElementById('hud-prompt').click()"
sleep 1
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/05-reader.png

# ---- HUD WITH NEW STATION ----
playwright-cli press Escape
sleep 1
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/06-hud-voyager.png

# ---- MUG EASTER EGG ----
# window.__museum.{camera,mug} is exported from src/main.js for this.
playwright-cli eval "() => { const c = window.__museum.camera; c.position.set(1.6, 1.5, 1.9); c.lookAt(0.78, 1.18, 0.95); return 'ok'; }"
sleep 0.6
playwright-cli screenshot --filename=/Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/09-mug-easter-egg.png

playwright-cli close
```

### Pass 2 — Walkthrough video (chained, no pauses)

Critical: the video is the full session lifetime. Issue every command in one chained Bash line so no analysis time sneaks into the recording.

```bash
playwright-cli close-all 2>/dev/null
playwright-cli open --browser=chrome
playwright-cli resize 1920 1200

playwright-cli goto "http://localhost:8767/?cb=walkthrough" && sleep 1.5 && \
playwright-cli video-start /tmp/walkthrough-raw.webm && sleep 1 && \
playwright-cli eval "() => document.getElementById('boot-enter').click()" && sleep 3.2 && \
playwright-cli eval "() => document.getElementById('hud-prompt').click()" && sleep 2.5 && \
playwright-cli press Escape && sleep 1.4 && \
playwright-cli eval "() => { const c = window.__museum.camera; c.position.set(1.6, 1.5, 1.9); c.lookAt(0.78, 1.18, 0.95); return 'ok'; }" && sleep 2.2 && \
playwright-cli video-stop && playwright-cli close

# Post-process: crop the right-side gray strip (playwright-cli's default
# video is 800x450, ~80px gray padding on the right), re-encode as H.264 MP4.
ffmpeg -i /tmp/walkthrough-raw.webm \
  -vf "crop=720:450:0:0" \
  -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -movflags +faststart -an \
  -y /Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/walkthrough.mp4

trash /tmp/walkthrough-raw.webm
```

Why the post-process: playwright-cli records a fixed 800x450 webm regardless of the viewport size set by `resize`, and pads the right ~80px with a gray strip. ffmpeg crops to 720x450 (16:10, matching the viewport aspect) and re-encodes as H.264 in MP4 for broader compatibility (GitHub previews, iOS Safari, embed-friendly).

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
