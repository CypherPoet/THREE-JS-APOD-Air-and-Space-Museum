// =================================================================
// Entry point: APOD JSON + Three.js + controls + UI + radio
// =================================================================

import { buildGallery, loadApodTexture } from "./scene.js";
import { attachControls } from "./controls.js";
import { createUI } from "./ui.js";
import { fetchApod } from "./apod.js";
import { createRadio, STATIONS } from "./audio.js";

const ui = createUI();
const canvas = document.getElementById("stage");
const gallery = buildGallery(canvas);
const radio = createRadio();

ui.buildDialList(STATIONS, radio.getStationIndex(), (i) => {
  radio.setStation(i);
  if (!radio.isPlaying()) radio.start();
});
ui.setRadioStation({
  stationIndex: radio.getStationIndex(),
  station: radio.getStation(),
  isPlaying: false,
});

radio.onChange((info) => ui.setRadioStation(info));

ui.setBootProgress(0.12);

let currentApod = null;
let promptVisible = false;

function openReaderIfReady() {
  if (currentApod) ui.openReader(currentApod);
  else ui.showToast("Exhibit data still loading — give it a moment.", 3000);
}

const controls = attachControls({
  camera: gallery.camera,
  renderer: gallery.renderer,
  gallery: gallery.gallery,
  onInteract: () => {
    if (!ui.isReaderOpen() && controls.isNearExhibit()) openReaderIfReady();
  },
  onLockChange: (locked) => {
    if (!controls.isMobile) ui.showLockHint(!locked);
  },
});

if (!controls.isMobile) ui.showLockHint(true);

ui.onPromptClick(openReaderIfReady);

ui.onRadioPrev(() => radio.prev());
ui.onRadioNext(() => radio.next());
ui.onRadioToggle(() => radio.toggle());

// ---------- load APOD data (local JSON) ----------
fetchApod()
  .then(async (apod) => {
    currentApod = apod;
    ui.advanceFeed();
    ui.setBootProgress(0.55);

    ui.setHudDate(apod.date);
    ui.setHudTitle(apod.title);
    ui.setHudCredit(apod.credit ? `Image · ${apod.credit}` : "Image · NASA / APOD");

    if (apod.fallbackNote) ui.showToast(apod.fallbackNote, 7000);

    try {
      const texture = await loadApodTexture(apod.imageUrl);
      gallery.exhibit.setApod(texture);
      ui.advanceFeed();
      ui.setBootProgress(1);
      ui.bootReady();
    } catch (error) {
      console.warn("APOD texture failed to load", error);
      ui.showToast("Couldn't load today's image — entering anyway.", 7000);
      ui.bootReady();
    }
  });

// Auto-enter after 14s of idle.
const autoEnterTimer = setTimeout(() => {
  document.getElementById("boot-enter")?.click();
}, 14000);

ui.onEnter(() => {
  clearTimeout(autoEnterTimer);

  // Browsers require a user gesture to start audio. The enter click works.
  radio.start();

  if (!controls.isMobile) setTimeout(() => controls.tryLock(), 300);
});

function tick() {
  controls.update();
  gallery.update();

  const near = controls.isNearExhibit() && !ui.isReaderOpen() && !ui.isDialOpen();
  if (near !== promptVisible) {
    promptVisible = near;
    ui.showInteractPrompt(near);
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
