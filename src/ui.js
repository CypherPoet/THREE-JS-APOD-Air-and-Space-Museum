// =================================================================
// UI surface: boot screen, HUD, reading modal, settings, toast
// =================================================================

import { formatDate, getApiKey, setApiKey, isUsingDefaultKey } from "./apod.js";

const q = (sel) => document.querySelector(sel);

export function createUI() {
  // -------- boot --------
  const boot       = q("#boot");
  const bootEnter  = q("#boot-enter");
  const bootBar    = q("#boot-bar-fill");
  const feedLines  = [...document.querySelectorAll(".boot__feed-line")];

  // -------- HUD --------
  const hud         = q("#hud");
  const hudDate     = q("#hud-date");
  const hudTitle    = q("#hud-title");
  const hudCredit   = q("#hud-credit");
  const hudStatus   = q("#hud-status");
  const hudPrompt   = q("#hud-prompt");
  const hudLock     = q("#hud-lock");
  const hudAudioBtn = q("#hud-audio");
  const hudSettingsBtn = q("#hud-settings");

  // -------- reader --------
  const reader      = q("#reader");
  const readerDate  = q("#reader-date");
  const readerTitle = q("#reader-title");
  const readerBody  = q("#reader-body");
  const readerLink  = q("#reader-link");
  const readerCredit = q("#reader-credit");
  const readerScrim  = reader.querySelector(".reader__scrim");
  const readerClose = q("#reader-close");

  // -------- settings --------
  const settings       = q("#settings");
  const settingsScrim  = settings.querySelector(".settings__scrim");
  const settingsClose  = q("#settings-close");
  const settingsKey    = q("#settings-key");
  const settingsStatus = q("#settings-status");
  const settingsSave   = q("#settings-save");
  const settingsClear  = q("#settings-clear");

  // -------- toast --------
  const toast      = q("#toast");
  const toastText  = q("#toast-text");

  let activeLine = 0;
  showFeedLine(0);

  function showFeedLine(index) {
    feedLines.forEach((line, i) => {
      line.classList.toggle("is-active", i === index);
    });
    activeLine = index;
  }

  function setBootProgress(value) {
    const v = Math.max(0, Math.min(1, value));
    bootBar.style.inset = `0 ${(1 - v) * 100}% 0 0`;
  }

  function advanceFeed() {
    if (activeLine < feedLines.length - 1) {
      showFeedLine(activeLine + 1);
    }
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

  function setHudDate(iso) {
    hudDate.textContent = formatDate(iso);
  }
  function setHudTitle(title) {
    hudTitle.textContent = title;
  }
  function setHudCredit(text) {
    hudCredit.textContent = text || "";
  }
  function setHudStatus(text) {
    hudStatus.textContent = text;
  }
  function showInteractPrompt(show) {
    hudPrompt.hidden = !show;
  }
  function showLockHint(show) {
    hudLock.hidden = !show;
  }

  // ------ reader ------
  function openReader(apod) {
    if (!apod) return;
    readerDate.textContent = formatDate(apod.date);
    readerTitle.textContent = apod.title;
    readerCredit.textContent = apod.copyright
      ? `Image · ${apod.copyright}`
      : "Image · NASA / APOD";
    readerBody.textContent = apod.explanation;
    readerLink.href = apod.originalUrl;
    reader.hidden = false;
  }
  function closeReader() {
    reader.hidden = true;
  }
  readerClose.addEventListener("click", closeReader);
  readerScrim.addEventListener("click", closeReader);

  // ------ settings ------
  function refreshSettingsStatus() {
    settingsStatus.textContent = isUsingDefaultKey()
      ? "Currently using shared DEMO_KEY"
      : "Using your personal key";
  }

  function openSettings() {
    const current = getApiKey();
    settingsKey.value = current === "DEMO_KEY" ? "" : current;
    refreshSettingsStatus();
    settings.hidden = false;
    setTimeout(() => settingsKey.focus(), 80);
  }
  function closeSettings() {
    settings.hidden = true;
  }
  settingsClose.addEventListener("click", closeSettings);
  settingsScrim.addEventListener("click", closeSettings);
  settingsSave.addEventListener("click", () => {
    setApiKey(settingsKey.value);
    refreshSettingsStatus();
    closeSettings();
    location.reload();
  });
  settingsClear.addEventListener("click", () => {
    setApiKey("");
    settingsKey.value = "";
    refreshSettingsStatus();
  });
  settingsKey.addEventListener("keydown", (e) => {
    if (e.key === "Enter") settingsSave.click();
  });

  hudSettingsBtn.addEventListener("click", openSettings);

  // ------ audio toggle button ------
  function setAudioActive(active) {
    hudAudioBtn.classList.toggle("is-active", active);
    hudAudioBtn.setAttribute("aria-pressed", String(active));
  }
  function onAudioToggle(callback) {
    hudAudioBtn.addEventListener("click", () => {
      const active = callback?.();
      if (typeof active === "boolean") setAudioActive(active);
    });
  }

  // ------ interact prompt (click + key both work) ------
  function onPromptClick(callback) {
    hudPrompt.addEventListener("click", () => callback?.());
  }

  // ------ keyboard shortcuts for modals ------
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!reader.hidden) closeReader();
      else if (!settings.hidden) closeSettings();
    }
  });

  // ------ toast ------
  let toastTimer = 0;
  function showToast(text, durationMs = 5000) {
    toastText.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, durationMs);
  }

  function onEnter(callback) {
    bootEnter.addEventListener("click", () => {
      if (bootEnter.disabled) return;
      dismissBoot();
      callback?.();
    });
  }

  return {
    setBootProgress,
    advanceFeed,
    bootReady,
    onEnter,
    setHudDate,
    setHudTitle,
    setHudCredit,
    setHudStatus,
    showInteractPrompt,
    showLockHint,
    openReader,
    closeReader,
    openSettings,
    closeSettings,
    onPromptClick,
    onAudioToggle,
    setAudioActive,
    showToast,
    isReaderOpen: () => !reader.hidden,
    isSettingsOpen: () => !settings.hidden,
  };
}
