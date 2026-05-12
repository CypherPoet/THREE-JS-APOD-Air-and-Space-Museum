// =================================================================
// Procedural lo-fi ambient soundtrack — pure WebAudio
// =================================================================
// Three slow-detuned sine oscillators form a sustained chord, fed
// through a wandering low-pass filter. A pink-noise bed (slow band-
// passed) adds tape-hiss texture. A long delay/feedback adds space.
//
// All values were tuned for "soft, drifting, never-intrusive" —
// designed to sit underneath the experience, not on top of it.
// =================================================================

export function createSoundtrack() {
  let ctx = null;
  let masterGain = null;
  let started = false;
  let muted = true;

  // Slow chord progression: D minor 7 → F maj 7 → G sus → A minor.
  // All transposed down two octaves and root-only (we get the colour
  // from oscillator detune rather than chord voicings).
  const ROOTS_HZ = [
    73.42,  // D2
    87.31,  // F2
    98.00,  // G2
    110.00, // A2
  ];

  let chordIndex = 0;
  let oscillators = [];
  let chordChangeInterval = 0;

  function ensureContext() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.0;
    masterGain.connect(ctx.destination);
  }

  function buildVoice(rootHz) {
    // Three sines: root, root, root * 1.5 (perfect fifth) — slightly detuned.
    const detunes = [-7, 0, 7]; // cents
    const ratios  = [1, 1.4983, 0.5];
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.0;

    const oscs = [];
    for (let i = 0; i < ratios.length; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = rootHz * ratios[i];
      osc.detune.value = detunes[i];
      const g = ctx.createGain();
      g.gain.value = (i === 0 ? 0.5 : 0.32);
      osc.connect(g);
      g.connect(voiceGain);
      osc.start();
      oscs.push(osc);
    }
    return { node: voiceGain, oscs };
  }

  function buildHiss() {
    // Pink-ish noise via filtered white noise — "tape hiss" texture.
    const bufferLength = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastValue = 0;
    for (let i = 0; i < bufferLength; i += 1) {
      const white = Math.random() * 2 - 1;
      lastValue = (lastValue + 0.02 * white) / 1.02;
      data[i] = lastValue * 3;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0.028;

    noise.connect(bp);
    bp.connect(gain);
    noise.start();
    return gain;
  }

  function buildDelay() {
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = 0.52;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;

    // Lo-fi tone shaping on the delay path
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 1400;

    delay.connect(tone);
    tone.connect(feedback);
    feedback.connect(delay);
    tone.connect(wet);

    return { input: delay, output: wet };
  }

  function playChord(rootHz, duration = 12) {
    // Fade out the previous voice
    oscillators.forEach((v) => {
      v.node.gain.cancelScheduledValues(ctx.currentTime);
      v.node.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 3.0);
      // Stop and disconnect once faded
      setTimeout(() => {
        v.oscs.forEach((o) => { try { o.stop(); } catch {} });
        v.node.disconnect();
      }, 3500);
    });

    // Build a new voice
    const voice = buildVoice(rootHz);
    voice.node.connect(filter);
    voice.node.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 4.0);

    oscillators = [voice];
  }

  // The shared, slowly-wandering low-pass that everything goes through.
  let filter = null;
  let filterLFO = null;
  let filterLFOGain = null;

  function start() {
    if (started) {
      // Just unmute if already running
      muted = false;
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.62, ctx.currentTime + 1.6);
      return;
    }

    ensureContext();
    if (!ctx) return;

    // Wandering low-pass for "underwater" lo-fi feel
    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 0.9;

    filterLFO = ctx.createOscillator();
    filterLFO.type = "sine";
    filterLFO.frequency.value = 0.04; // 25-second cycle
    filterLFOGain = ctx.createGain();
    filterLFOGain.gain.value = 320;
    filterLFO.connect(filterLFOGain);
    filterLFOGain.connect(filter.frequency);
    filterLFO.start();

    // Delay/echo chain
    const delay = buildDelay();
    filter.connect(delay.input);
    delay.output.connect(masterGain);
    filter.connect(masterGain); // dry path

    // Hiss layer (bypass the filter so it stays airy)
    const hiss = buildHiss();
    hiss.connect(masterGain);

    // Start the first chord
    playChord(ROOTS_HZ[chordIndex]);

    // Rotate chords every 14 seconds
    chordChangeInterval = setInterval(() => {
      if (muted) return;
      chordIndex = (chordIndex + 1) % ROOTS_HZ.length;
      playChord(ROOTS_HZ[chordIndex]);
    }, 14000);

    // Resume context if the browser auto-suspended it
    if (ctx.state === "suspended") ctx.resume();

    started = true;
    muted = false;
    masterGain.gain.linearRampToValueAtTime(0.62, ctx.currentTime + 2.5);
  }

  function mute() {
    if (!ctx) return;
    muted = true;
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.8);
  }

  function toggle() {
    if (muted) start();
    else mute();
    return !muted;
  }

  function isPlaying() {
    return started && !muted;
  }

  return { start, mute, toggle, isPlaying };
}
