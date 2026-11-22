// audio.js — a tiny WebAudio synth: gunshots, hits, pickups, a two-tone
// siren warble and a mission-complete sting. Starts on the first user gesture.
export function createAudio() {
  let ctx = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { ctx = null; }
    return ctx;
  }
  window.addEventListener("pointerdown", ensure, { once: false });
  window.addEventListener("keydown", ensure, { once: false });

  function blip(freq, dur, type = "square", vol = 0.12, slide = 0) {
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur);
  }

  function noise(dur, vol = 0.2) {
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(c.destination);
    src.start();
  }

  return {
    play(name) {
      if (!ctx) return;
      if (name === "shot") { noise(0.09, 0.25); blip(160, 0.08, "sawtooth", 0.1, -90); }
      else if (name === "hit") blip(90, 0.12, "square", 0.18, -40);
      else if (name === "pickup") { blip(660, 0.09, "sine", 0.14); setTimeout(() => blip(990, 0.12, "sine", 0.14), 70); }
      else if (name === "complete") {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, "triangle", 0.16), i * 110));
      } else if (name === "busted") { blip(220, 0.5, "sawtooth", 0.14, -140); }
      else if (name === "door") blip(240, 0.07, "square", 0.08, -60);
    },
    // Continuous two-tone siren while wanted and police are near.
    updateSiren(active) {
      const c = ctx;
      if (!c) return;
      if (active && !sirenOsc) {
        sirenOsc = c.createOscillator();
        sirenGain = c.createGain();
        sirenOsc.type = "triangle";
        sirenGain.gain.value = 0.035;
        sirenOsc.connect(sirenGain).connect(c.destination);
        sirenOsc.start();
      }
      if (!active && sirenOsc) {
        try { sirenOsc.stop(); } catch { /* already stopped */ }
        sirenOsc = null; sirenGain = null;
      }
      if (sirenOsc) {
        sirenTimer += 0.08;
        sirenOsc.frequency.value = Math.sin(sirenTimer) > 0 ? 720 : 540;
      }
    },
  };
}
