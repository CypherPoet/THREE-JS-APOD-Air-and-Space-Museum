// =================================================================
// Procedural lo-fi radio — ten stations, pure WebAudio
// =================================================================
// Each station is a parameter set fed into a single signal graph:
//
//   chord-voices ─► station-filter ─► delay ─┐
//                                            ├─► master ─► destination
//                                  ─dry──────┘
//   pink-noise ─► band-pass ─► hiss-gain ────┘
//
// Switching stations fades the current chord voices out and re-tunes
// the filter / delay / hiss to the new station's parameters before
// fading new voices in.
// =================================================================

const SEMITONE = Math.pow(2, 1 / 12);
const NOTE = {};
{
  // Build a C0..C8 pitch table.
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  for (let oct = 0; oct <= 8; oct += 1) {
    for (let i = 0; i < names.length; i += 1) {
      const midi = (oct + 1) * 12 + i;
      NOTE[`${names[i]}${oct}`] = 440 * Math.pow(SEMITONE, midi - 69);
    }
  }
}

/**
 * The ten stations. Each is a tiny composition spec.
 *
 * scale:        roots cycled through as the chord progression
 * waveform:     sine / triangle / sawtooth / square
 * partials:     ratios for the three voices (unison + intervals)
 * detune:       cents detune spread between voices
 * filterHz:     base low-pass cutoff
 * filterLfoHz:  LFO speed (Hz)
 * filterLfoDep: LFO depth (Hz, +/- around base)
 * hissAmount:   noise gain (0..1)
 * hissBand:     band-pass center (Hz)
 * delayTime:    delay time (seconds)
 * delayFb:      delay feedback (0..1)
 * delayMix:    wet/dry mix (0..1)
 * chordSec:     seconds between chord changes
 * volume:       station overall gain (0..1)
 */
export const STATIONS = [
  {
    name: "Cassini Drift",
    era: "Saturn · 2008",
    scale: [NOTE["D2"], NOTE["F2"], NOTE["G2"], NOTE["A2"]],
    waveform: "sine",
    partials: [1, 1.4983, 0.5],
    detune: 7,
    filterHz: 700, filterLfoHz: 0.04, filterLfoDep: 320,
    hissAmount: 0.028, hissBand: 1800,
    delayTime: 0.52, delayFb: 0.42, delayMix: 0.55,
    chordSec: 14, volume: 0.62,
  },
  {
    name: "Hubble Glow",
    era: "Deep Field · 1995",
    scale: [NOTE["F2"], NOTE["A2"], NOTE["C3"], NOTE["G2"]],
    waveform: "triangle",
    partials: [1, 1.4983, 2],
    detune: 4,
    filterHz: 1200, filterLfoHz: 0.07, filterLfoDep: 400,
    hissAmount: 0.018, hissBand: 2400,
    delayTime: 0.38, delayFb: 0.38, delayMix: 0.48,
    chordSec: 10, volume: 0.55,
  },
  {
    name: "Voyager Echo",
    era: "Heliopause · 2012",
    scale: [NOTE["A1"], NOTE["C2"], NOTE["E2"], NOTE["F2"]],
    waveform: "sine",
    partials: [1, 0.5, 1.4983],
    detune: 12,
    filterHz: 560, filterLfoHz: 0.025, filterLfoDep: 240,
    hissAmount: 0.04, hissBand: 1200,
    delayTime: 0.78, delayFb: 0.55, delayMix: 0.62,
    chordSec: 22, volume: 0.6,
  },
  {
    name: "Magnetosphere",
    era: "Earth · IMAGE Mission",
    scale: [NOTE["E2"], NOTE["G2"], NOTE["B2"], NOTE["D3"]],
    waveform: "sawtooth",
    partials: [1, 0.5, 1.4983],
    detune: 9,
    filterHz: 480, filterLfoHz: 0.18, filterLfoDep: 360,
    hissAmount: 0.024, hissBand: 1500,
    delayTime: 0.31, delayFb: 0.5, delayMix: 0.45,
    chordSec: 12, volume: 0.58,
  },
  {
    name: "Apollo Static",
    era: "Lunar Surface · 1969",
    scale: [NOTE["C2"], NOTE["E2"], NOTE["G2"], NOTE["A2"]],
    waveform: "square",
    partials: [1, 1.4983, 2],
    detune: 16,
    filterHz: 420, filterLfoHz: 0.05, filterLfoDep: 160,
    hissAmount: 0.075, hissBand: 900,
    delayTime: 0.21, delayFb: 0.36, delayMix: 0.4,
    chordSec: 12, volume: 0.5,
  },
  {
    name: "Tycho Bell",
    era: "Pluto · 2015",
    scale: [NOTE["G2"], NOTE["B2"], NOTE["D3"], NOTE["E3"]],
    waveform: "triangle",
    partials: [1, 2, 3],
    detune: 3,
    filterHz: 1600, filterLfoHz: 0.09, filterLfoDep: 280,
    hissAmount: 0.012, hissBand: 3200,
    delayTime: 0.62, delayFb: 0.6, delayMix: 0.7,
    chordSec: 16, volume: 0.5,
  },
  {
    name: "Phobos Heartbeat",
    era: "Mars Moon · 1976",
    scale: [NOTE["B1"], NOTE["D2"], NOTE["E2"], NOTE["G2"]],
    waveform: "sine",
    partials: [1, 1.4983, 0.5],
    detune: 6,
    filterHz: 360, filterLfoHz: 0.6, filterLfoDep: 180,
    hissAmount: 0.05, hissBand: 1100,
    delayTime: 0.42, delayFb: 0.48, delayMix: 0.5,
    chordSec: 18, volume: 0.6,
  },
  {
    name: "Solar Wind",
    era: "Parker Probe · 2018",
    scale: [NOTE["G#2"], NOTE["B2"], NOTE["D#3"], NOTE["F3"]],
    waveform: "sine",
    partials: [1, 2, 3],
    detune: 5,
    filterHz: 2200, filterLfoHz: 0.11, filterLfoDep: 600,
    hissAmount: 0.06, hissBand: 4500,
    delayTime: 0.5, delayFb: 0.42, delayMix: 0.55,
    chordSec: 11, volume: 0.5,
  },
  {
    name: "Crescent Dust",
    era: "Asteroid Belt",
    scale: [NOTE["C#2"], NOTE["D2"], NOTE["F2"], NOTE["G#2"]],
    waveform: "sawtooth",
    partials: [1, 0.5, 1.4983],
    detune: 11,
    filterHz: 560, filterLfoHz: 0.06, filterLfoDep: 220,
    hissAmount: 0.035, hissBand: 1600,
    delayTime: 0.46, delayFb: 0.5, delayMix: 0.58,
    chordSec: 15, volume: 0.55,
  },
  {
    name: "Deep Field",
    era: "Hubble Ultra · 2004",
    scale: [NOTE["E1"], NOTE["G1"], NOTE["B1"], NOTE["D2"]],
    waveform: "sine",
    partials: [1, 2, 1.4983],
    detune: 4,
    filterHz: 320, filterLfoHz: 0.02, filterLfoDep: 140,
    hissAmount: 0.045, hissBand: 1400,
    delayTime: 0.9, delayFb: 0.62, delayMix: 0.7,
    chordSec: 26, volume: 0.62,
  },
];

export function createRadio() {
  let ctx = null;
  let master = null;
  let started = false;
  let muted = true;
  let stationIndex = 0;
  let chordIndex = 0;
  let chordTimer = 0;
  let voiceNodes = []; // active voice gain wrappers
  let listeners = new Set();

  // Per-station nodes (rebuilt on station change)
  let filter = null;
  let filterLfo = null;
  let filterLfoGain = null;
  let delayNode = null;
  let delayFeedback = null;
  let delayWet = null;
  let hissSource = null;
  let hissBp = null;
  let hissGain = null;

  function ensureContext() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }

  // ----------------------------------------------------------------
  // Chord-voice construction
  // ----------------------------------------------------------------
  function buildVoice(rootHz, station) {
    const group = ctx.createGain();
    group.gain.value = 0;

    const detunes = [-station.detune, 0, station.detune];
    for (let i = 0; i < station.partials.length; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = station.waveform;
      osc.frequency.value = rootHz * station.partials[i];
      osc.detune.value = detunes[i] ?? 0;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.55 : 0.34;
      osc.connect(g);
      g.connect(group);
      osc.start();
      group._oscs = (group._oscs || []).concat(osc);
    }
    return group;
  }

  function fadeOutVoice(node, ms = 3000) {
    if (!node) return;
    const now = ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(0.0001, now + ms / 1000);
    setTimeout(() => {
      (node._oscs || []).forEach((o) => { try { o.stop(); } catch {} });
      try { node.disconnect(); } catch {}
    }, ms + 500);
  }

  function playChord(station) {
    const rootHz = station.scale[chordIndex % station.scale.length];
    const voice = buildVoice(rootHz, station);
    voice.connect(filter);
    const now = ctx.currentTime;
    voice.gain.setValueAtTime(0, now);
    voice.gain.linearRampToValueAtTime(0.32, now + 4.0);
    voiceNodes.push(voice);

    // Fade out the previous one
    while (voiceNodes.length > 2) {
      fadeOutVoice(voiceNodes.shift());
    }
  }

  // ----------------------------------------------------------------
  // Per-station effect chain
  // ----------------------------------------------------------------
  function buildHissBuffer() {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3;
    }
    return buf;
  }

  function teardownStationChain() {
    [filter, filterLfo, filterLfoGain, delayNode, delayFeedback,
     delayWet, hissSource, hissBp, hissGain].forEach((node) => {
      if (!node) return;
      try { node.stop && node.stop(); } catch {}
      try { node.disconnect(); } catch {}
    });
    voiceNodes.forEach((v) => fadeOutVoice(v, 1500));
    voiceNodes = [];
  }

  function buildStationChain(station) {
    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = station.filterHz;
    filter.Q.value = 0.9;

    filterLfo = ctx.createOscillator();
    filterLfo.type = "sine";
    filterLfo.frequency.value = station.filterLfoHz;
    filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = station.filterLfoDep;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(filter.frequency);
    filterLfo.start();

    // Delay
    delayNode = ctx.createDelay(2.5);
    delayNode.delayTime.value = station.delayTime;
    delayFeedback = ctx.createGain();
    delayFeedback.gain.value = station.delayFb;
    delayWet = ctx.createGain();
    delayWet.gain.value = station.delayMix;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = "lowpass";
    delayTone.frequency.value = Math.min(2000, station.filterHz * 2);

    filter.connect(delayNode);
    delayNode.connect(delayTone);
    delayTone.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayTone.connect(delayWet);

    delayWet.connect(master);
    filter.connect(master);

    // Hiss
    hissSource = ctx.createBufferSource();
    hissSource.buffer = buildHissBuffer();
    hissSource.loop = true;
    hissBp = ctx.createBiquadFilter();
    hissBp.type = "bandpass";
    hissBp.frequency.value = station.hissBand;
    hissBp.Q.value = 0.7;
    hissGain = ctx.createGain();
    hissGain.gain.value = station.hissAmount;
    hissSource.connect(hissBp);
    hissBp.connect(hissGain);
    hissGain.connect(master);
    hissSource.start();
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------
  function start() {
    ensureContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") ctx.resume();

    if (!started) {
      buildStationChain(STATIONS[stationIndex]);
      chordIndex = 0;
      playChord(STATIONS[stationIndex]);
      chordTimer = setInterval(() => {
        if (muted) return;
        chordIndex += 1;
        playChord(STATIONS[stationIndex]);
      }, STATIONS[stationIndex].chordSec * 1000);
      started = true;
    }

    muted = false;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.linearRampToValueAtTime(STATIONS[stationIndex].volume, now + 2.0);
    notify();
    return true;
  }

  function mute() {
    if (!ctx) return false;
    muted = true;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.linearRampToValueAtTime(0.0, now + 0.8);
    notify();
    return false;
  }

  function toggle() {
    return muted ? start() : mute();
  }

  function setStation(index) {
    const next = ((index % STATIONS.length) + STATIONS.length) % STATIONS.length;
    if (next === stationIndex && started) return;
    stationIndex = next;

    if (!started) {
      // Just record the choice — playback hasn't begun yet.
      notify();
      return;
    }

    // Fade old chain out, build new one
    const old = { filter, filterLfo, filterLfoGain, delayNode, delayFeedback,
                  delayWet, hissSource, hissBp, hissGain, voices: voiceNodes };
    voiceNodes = [];
    chordIndex = 0;

    buildStationChain(STATIONS[stationIndex]);
    playChord(STATIONS[stationIndex]);

    // Fade old voices
    old.voices.forEach((v) => fadeOutVoice(v, 2000));
    // Stop old LFO/hiss after fade
    setTimeout(() => {
      [old.filterLfo, old.hissSource].forEach((n) => { if (n) { try { n.stop(); } catch {} } });
      Object.values(old).forEach((n) => {
        if (Array.isArray(n)) return;
        if (n && typeof n.disconnect === "function") { try { n.disconnect(); } catch {} }
      });
    }, 2500);

    // Reset chord interval
    clearInterval(chordTimer);
    chordTimer = setInterval(() => {
      if (muted) return;
      chordIndex += 1;
      playChord(STATIONS[stationIndex]);
    }, STATIONS[stationIndex].chordSec * 1000);

    // Ramp master to station's volume
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.linearRampToValueAtTime(STATIONS[stationIndex].volume, now + 1.6);

    notify();
  }

  function next() { setStation(stationIndex + 1); }
  function prev() { setStation(stationIndex - 1); }
  function getStationIndex() { return stationIndex; }
  function getStation() { return STATIONS[stationIndex]; }
  function isPlaying() { return started && !muted; }
  function isReady() { return Boolean(ctx); }
  function isSuspended() { return ctx ? ctx.state === "suspended" : true; }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function notify() {
    listeners.forEach((fn) => fn({
      stationIndex,
      station: STATIONS[stationIndex],
      isPlaying: isPlaying(),
    }));
  }

  return {
    start, mute, toggle, next, prev, setStation,
    getStationIndex, getStation, isPlaying, isReady, isSuspended, onChange,
  };
}
