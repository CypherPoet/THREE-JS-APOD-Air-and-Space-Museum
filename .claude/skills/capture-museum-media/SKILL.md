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

### Pass 2 — Walkthrough video (Playwright Node API, 1280×800)

`playwright-cli` records at a fixed 800×450 with a right-side gray strip — too small for showcase use. Drop down to the Playwright Node API to get a real 1280×800 recording with smooth camera tweens.

**One-time setup**: ensure Playwright is available via npx — running `npx playwright --version` installs it into `~/.npm/_npx/<hash>/node_modules/playwright`. Find the install dir:

```bash
find ~/.npm/_npx -name playwright -type d -maxdepth 4 | head -1
# → /Users/ethan/.npm/_npx/<hash>/node_modules/playwright
# Use the parent of that as PW_HOME below.
PW_HOME=$(dirname $(dirname $(find ~/.npm/_npx -name playwright -type d -maxdepth 4 | head -1)))
```

**Write the capture script** to `$PW_HOME/capture-walkthrough.mjs` so its `import 'playwright'` resolves naturally:

```js
import { chromium } from 'playwright';
import { mkdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUT = '/tmp/walkthrough-out';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1200 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

// Smooth camera tween helper — interpolates position + lookAt over `duration` ms.
async function tween({ fromPos, toPos, fromTarget, toTarget, duration }) {
  await page.evaluate(({ fromPos, toPos, fromTarget, toTarget, duration }) => {
    return new Promise((res) => {
      const c = window.__museum.camera;
      const start = performance.now();
      function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
        c.position.x = fromPos[0] + (toPos[0] - fromPos[0]) * e;
        c.position.y = fromPos[1] + (toPos[1] - fromPos[1]) * e;
        c.position.z = fromPos[2] + (toPos[2] - fromPos[2]) * e;
        c.lookAt(
          fromTarget[0] + (toTarget[0] - fromTarget[0]) * e,
          fromTarget[1] + (toTarget[1] - fromTarget[1]) * e,
          fromTarget[2] + (toTarget[2] - fromTarget[2]) * e,
        );
        if (t < 1) requestAnimationFrame(step);
        else res();
      }
      requestAnimationFrame(step);
    });
  }, { fromPos, toPos, fromTarget, toTarget, duration });
}

await page.goto('http://localhost:8769/?cb=walkthrough');
await page.waitForTimeout(2000);

await page.evaluate(() => document.getElementById('boot-enter').click());
await page.waitForTimeout(3500);

// Pan left
await tween({ fromPos: [0,1.7,9], toPos: [-3.5,1.7,8],
              fromTarget: [0,2.5,0], toTarget: [0,2.0,0], duration: 2800 });
await page.waitForTimeout(700);

// Pan across to right
await tween({ fromPos: [-3.5,1.7,8], toPos: [3.5,1.7,8],
              fromTarget: [0,2.0,0], toTarget: [0,2.0,0], duration: 3400 });
await page.waitForTimeout(700);

// Back to center
await tween({ fromPos: [3.5,1.7,8], toPos: [0,1.7,9],
              fromTarget: [0,2.0,0], toTarget: [0,2.5,0], duration: 2000 });
await page.waitForTimeout(600);

// Reader modal
await page.evaluate(() => document.getElementById('hud-prompt').click());
await page.waitForTimeout(2600);
await page.keyboard.press('Escape');
await page.waitForTimeout(1300);

// Tween to mug
await tween({ fromPos: [0,1.7,9], toPos: [1.6,1.5,1.9],
              fromTarget: [0,2.5,0], toTarget: [0.78,1.18,0.95], duration: 2400 });
await page.waitForTimeout(2200);

const videoPath = await page.video().path();
await context.close();
await browser.close();
await rename(videoPath, resolve(OUT, 'walkthrough.webm'));
console.log(resolve(OUT, 'walkthrough.webm'));
```

**Run + convert**:

```bash
(cd "$PW_HOME" && node capture-walkthrough.mjs)

# Convert to H.264 MP4 for portfolio embedding
ffmpeg -i /tmp/walkthrough-out/walkthrough.webm \
  -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart -an \
  -y /Users/ethan/Projects/Misc-Experiments/NASA-APOD-Showcase-01/media/walkthrough.mp4

trash /tmp/walkthrough-out
```

Why this path: `playwright-cli`'s `video-start` records at a fixed 800×450 and pads the right with a gray strip — no flag to change it. The Node API exposes `recordVideo.size`, which is the only way to get a usable resolution. The script also lets us add smooth camera tweens (impossible in the chained-eval approach without timing precision).

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
