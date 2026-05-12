// =================================================================
// Entry point: APOD + Three.js + controls + UI + audio
// =================================================================

import { buildGallery, loadApodTexture } from "./scene.js";
import { attachControls } from "./controls.js";
import { createUI } from "./ui.js";
import { fetchApod } from "./apod.js";
import { createSoundtrack } from "./audio.js";

const ui = createUI();
const canvas = document.getElementById("stage");
const gallery = buildGallery(canvas);
const soundtrack = createSoundtrack();

ui.setBootProgress(0.12);

let currentApod = null;
let promptVisible = false;

function openReaderIfReady() {
  if (currentApod) {
    ui.openReader(currentApod);
  } else {
    ui.showToast("Exhibit data still loading — give it a moment.", 3000);
  }
}

const controls = attachControls({
  camera: gallery.camera,
  renderer: gallery.renderer,
  gallery: gallery.gallery,
  onInteract: () => {
    if (!ui.isReaderOpen() && controls.isNearExhibit()) {
      openReaderIfReady();
    }
  },
  onLockChange: (locked) => {
    if (!controls.isMobile) ui.showLockHint(!locked);
  },
});

if (!controls.isMobile) ui.showLockHint(true);

// Click handler on the on-screen prompt — backup to the E key.
ui.onPromptClick(() => openReaderIfReady());

// Audio toggle. start() requires a user gesture, which the button click is.
ui.onAudioToggle(() => soundtrack.toggle());

// Begin fetching APOD immediately (in parallel with boot).
fetchApod()
  .then(async (apod) => {
    currentApod = apod;
    ui.advanceFeed();
    ui.setBootProgress(0.55);

    ui.setHudDate(apod.date);
    ui.setHudTitle(apod.title);
    ui.setHudCredit(apod.copyright ? `Image · ${apod.copyright}` : "Image · NASA / APOD");

    if (apod.fallbackNote) {
      ui.showToast(apod.fallbackNote, 7000);
    }

    try {
      const texture = await loadApodTexture(apod.imageUrl);
      gallery.exhibit.setApod(texture);
      ui.advanceFeed();
      ui.setBootProgress(1);
      ui.bootReady();
      ui.setHudStatus("Link nominal");
    } catch (error) {
      console.warn("APOD texture failed to load", error);
      ui.setHudStatus("Image link degraded");
      ui.showToast("Couldn't load today's image — entering anyway.", 7000);
      ui.bootReady();
    }
  });

// Auto-enter after 14 seconds if user is idle.
const autoEnterTimer = setTimeout(() => {
  document.getElementById("boot-enter")?.click();
}, 14000);

ui.onEnter(() => {
  clearTimeout(autoEnterTimer);

  // Start the soundtrack on the same gesture (browsers require this).
  soundtrack.start();
  ui.setAudioActive(true);

  if (!controls.isMobile) {
    setTimeout(() => controls.tryLock(), 300);
  }
});

function tick() {
  controls.update();
  gallery.update();

  const near = controls.isNearExhibit() && !ui.isReaderOpen() && !ui.isSettingsOpen();
  if (near !== promptVisible) {
    promptVisible = near;
    ui.showInteractPrompt(near);
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener("blur", () => ui.setHudStatus("Telemetry idle"));
window.addEventListener("focus", () => ui.setHudStatus("Link nominal"));

// #settings in the URL pops the settings panel as soon as the HUD is up.
if (location.hash === "#settings") {
  setTimeout(() => ui.openSettings(), 100);
}
