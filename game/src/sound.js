export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem('port-solano-muted') === '1';
    this.eng = null;
    this.engGain = null;
    this.engFilter = null;
    this.siren = null;
    this.sirenGain = null;
    this.sirenT = 0;
    this.noiseBuf = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const o1 = this.ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.value = 55;
      const o2 = this.ctx.createOscillator();
      o2.type = 'square';
      o2.frequency.value = 28;
      this.engFilter = this.ctx.createBiquadFilter();
      this.engFilter.type = 'lowpass';
      this.engFilter.frequency.value = 420;
      this.engGain = this.ctx.createGain();
      this.engGain.gain.value = 0;
      o1.connect(this.engFilter);
      o2.connect(this.engFilter);
      this.engFilter.connect(this.engGain);
      this.engGain.connect(this.master);
      o1.start();
      o2.start();
      this.eng = [o1, o2];
      this.siren = this.ctx.createOscillator();
      this.siren.type = 'sine';
      this.siren.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.siren.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.siren.start();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('port-solano-muted', m ? '1' : '0'); } catch (e) { /* private mode */ }
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  toggle() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone(f, dur, type, vol, when = 0, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, freq, vol, when = 0) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  click() { this.tone(1200, 0.04, 'square', 0.06); }
  punch() { this.noise(0.09, 900, 0.35); this.tone(140, 0.12, 'sine', 0.4, 0, -70); }
  thud(s = 1) { this.noise(0.18, 260, Math.min(0.6, 0.3 * s)); this.tone(70, 0.2, 'sine', 0.35 * Math.min(1, s), 0, -30); }
  coin() { this.tone(988, 0.09, 'sine', 0.18); this.tone(1319, 0.16, 'sine', 0.18, 0.08); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.2, i * 0.09)); }
  fail() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.18, i * 0.12)); }
  bust() { this.tone(110, 0.5, 'square', 0.2, 0, -40); this.noise(0.3, 500, 0.15, 0.05); }

  update(dt, speed, inCar, wanted) {
    if (!this.ctx) return;
    if (this.engGain) {
      const target = inCar ? Math.min(0.09, 0.02 + Math.abs(speed) * 0.0022) : 0;
      this.engGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      const f = 50 + Math.abs(speed) * 4.5;
      this.eng[0].frequency.setTargetAtTime(f, this.ctx.currentTime, 0.1);
      this.eng[1].frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.1);
      this.engFilter.frequency.setTargetAtTime(300 + Math.abs(speed) * 22, this.ctx.currentTime, 0.1);
    }
    if (this.sirenGain) {
      this.sirenT += dt;
      const on = wanted > 0;
      this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.2);
      if (on) this.siren.frequency.setTargetAtTime(Math.floor(this.sirenT / 0.45) % 2 === 0 ? 700 : 950, this.ctx.currentTime, 0.05);
    }
  }
}
