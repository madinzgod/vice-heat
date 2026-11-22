// audio.js — tiny WebAudio synth: engine hum, gunshot, coin, siren blips.
// No audio files; everything is oscillators, started on first user gesture.
export class GameAudio {
  constructor() { this.ctx = null; this.engineOsc = null; this.engineGain = null; this.muted = false; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.engineOsc = this.ctx.createOscillator(); this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    } catch { this.ctx = null; }
  }
  engine(speedRatio, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(50 + speedRatio * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.028 + speedRatio * 0.03 : 0, t, 0.1);
  }
  blip(freq, dur = 0.09, type = 'square', vol = 0.05, slide = 0) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), this.ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + dur);
  }
  shot() { this.blip(160, 0.12, 'sawtooth', 0.09, -120); }
  coin() { this.blip(880, 0.08, 'square', 0.05); setTimeout(() => this.blip(1320, 0.14, 'square', 0.05), 70); }
  siren() { this.blip(660, 0.16, 'triangle', 0.03, 220); }
  crash() { this.blip(90, 0.2, 'sawtooth', 0.08, -50); }
}
