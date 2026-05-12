// =================================================================
// UI surface: boot screen, HUD, reader modal, radio dial, toast
// =================================================================

import { formatDate } from "./apod.js";

const q = (sel) => document.querySelector(sel);

export function createUI() {
  // -------- boot --------
  const boot       = q("#boot");
  const bootEnter  = q("#boot-enter");
  const bootBar    = q("#boot-bar-fill");
  const feedLines  = [...document.querySelectorAll(".boot__feed-line")];

  // -------- HUD --------
  const hud       = q("#hud");
  const hudDate   = q("#hud-date");
  const hudTitle  = q("#hud-title");
  const hudCredit = q("#hud-credit");
  const hudPrompt = q("#hud-prompt");
  const hudLock   = q("#hud-lock");

  // Coarse-pointer devices don't have an [E] key; rewrite the prompt as a tap CTA.
  // Direct style override because .hud__prompt-key has an explicit `display: inline-flex`
  // in styles.css that beats the [hidden] attribute.
  if (matchMedia("(pointer: coarse)").matches) {
    hudPrompt.querySelector(".hud__prompt-key").style.display = "none";
    hudPrompt.querySelector(".hud__prompt-text").textContent =
      "Tap to read the curator's note";
  }

  // -------- radio widget --------
  const radioName    = q("#radio-name");
  const radioEra     = q("#radio-era");
  const radioChannel = q("#radio-channel");
  const radioPrev    = q("#radio-prev");
  const radioNext    = q("#radio-next");
  const radioToggle  = q("#radio-toggle");
  const radioOpen    = q("#radio-station-name");

  // -------- reader --------
  const reader       = q("#reader");
  const readerDate   = q("#reader-date");
  const readerTitle  = q("#reader-title");
  const readerBody   = q("#reader-body");
  const readerLink   = q("#reader-link");
  const readerCredit = q("#reader-credit");
  const readerScrim  = reader.querySelector(".reader__scrim");
  const readerClose  = q("#reader-close");

  // -------- dial (radio station list) --------
  const dial      = q("#dial");
  const dialScrim = dial.querySelector(".dial__scrim");
  const dialClose = q("#dial-close");
  const dialList  = q("#dial-list");

  // -------- toast --------
  const toast     = q("#toast");
  const toastText = q("#toast-text");

  let activeLine = 0;
  showFeedLine(0);

  function showFeedLine(index) {
    feedLines.forEach((line, i) => line.classList.toggle("is-active", i === index));
    activeLine = index;
  }

  function setBootProgress(value) {
    const v = Math.max(0, Math.min(1, value));
    bootBar.style.inset = `0 ${(1 - v) * 100}% 0 0`;
  }

  function advanceFeed() {
    if (activeLine < feedLines.length - 1) showFeedLine(activeLine + 1);
  }

  function bootReady() {
    showFeedLine(feedLines.length - 1);
    feedLines[feedLines.length - 1].textContent = "Ready · Press enter to begin";
    setBootProgress(1);
    bootEnter.disabled = false;
  }

  function dismissBoot() {
    boot.classList.add("is-gone");
    hud.classList.add("is-on");
    setTimeout(() => boot.remove(), 1400);
  }

  function setHudDate(iso)   { hudDate.textContent = formatDate(iso); }
  function setHudTitle(title){ hudTitle.textContent = title; }
  function setHudCredit(text){ hudCredit.textContent = text || ""; }
  function showInteractPrompt(show) { hudPrompt.hidden = !show; }
  function showLockHint(show) { hudLock.hidden = !show; }

  // ------ reader ------
  function openReader(apod) {
    if (!apod) return;
    readerDate.textContent = formatDate(apod.date);
    readerTitle.textContent = apod.title;
    readerCredit.textContent = apod.credit
      ? `Image · ${apod.credit}`
      : "Image · NASA / APOD";
    // Drop-cap (.reader__body::first-letter in styles.css) requires the
    // first character to be a letter; scripts/fetch-apod.mjs tidy() guarantees this.
    readerBody.textContent = apod.explanation;
    readerLink.href = apod.originalUrl;
    reader.hidden = false;
  }
  function closeReader() { reader.hidden = true; }
  readerClose.addEventListener("click", closeReader);
  readerScrim.addEventListener("click", closeReader);

  // ------ radio dial ------
  function buildDialList(stations, currentIndex, onPick) {
    dialList.innerHTML = "";
    stations.forEach((s, i) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dial__row" + (i === currentIndex ? " is-current" : "");
      button.innerHTML = `
        <span class="dial__num">${String(i + 1).padStart(2, "0")}</span>
        <span class="dial__meta">
          <span class="dial__sname"></span>
          <span class="dial__sera"></span>
        </span>
        <span class="dial__playing">Now playing</span>
      `;
      button.querySelector(".dial__sname").textContent = s.name;
      button.querySelector(".dial__sera").textContent = s.era;
      button.addEventListener("click", () => { onPick(i); });
      li.appendChild(button);
      dialList.appendChild(li);
    });
  }

  function highlightCurrentStation(index) {
    [...dialList.querySelectorAll(".dial__row")].forEach((el, i) => {
      el.classList.toggle("is-current", i === index);
    });
  }

  function openDial() { dial.hidden = false; }
  function closeDial() { dial.hidden = true; }
  dialClose.addEventListener("click", closeDial);
  dialScrim.addEventListener("click", closeDial);
  radioOpen.addEventListener("click", openDial);

  // ------ radio surface ------
  function setRadioStation({ stationIndex, station, isPlaying }) {
    radioName.textContent = station.name;
    radioEra.textContent = station.era;
    radioChannel.textContent = `CH ${String(stationIndex + 1).padStart(2, "0")} / 10`;
    radioToggle.setAttribute("aria-pressed", String(isPlaying));
    highlightCurrentStation(stationIndex);
  }
  function onRadioPrev(cb) { radioPrev.addEventListener("click", () => cb?.()); }
  function onRadioNext(cb) { radioNext.addEventListener("click", () => cb?.()); }
  function onRadioToggle(cb) { radioToggle.addEventListener("click", () => cb?.()); }

  // ------ keyboard shortcuts ------
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!reader.hidden) closeReader();
      else if (!dial.hidden) closeDial();
    }
  });

  // ------ toast ------
  let toastTimer = 0;
  function showToast(text, durationMs = 5000) {
    toastText.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, durationMs);
  }

  function onEnter(callback) {
    bootEnter.addEventListener("click", () => {
      if (bootEnter.disabled) return;
      dismissBoot();
      callback?.();
    });
  }

  function onPromptClick(callback) {
    hudPrompt.addEventListener("click", () => callback?.());
  }

  return {
    setBootProgress,
    advanceFeed,
    bootReady,
    onEnter,
    setHudDate,
    setHudTitle,
    setHudCredit,
    showInteractPrompt,
    showLockHint,
    openReader,
    closeReader,
    onPromptClick,
    buildDialList,
    openDial,
    closeDial,
    setRadioStation,
    onRadioPrev,
    onRadioNext,
    onRadioToggle,
    showToast,
    isReaderOpen: () => !reader.hidden,
    isDialOpen: () => !dial.hidden,
  };
}
