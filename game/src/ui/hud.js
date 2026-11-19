import { clockText } from '../world/daylight.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.el = {
      health: $('health-fill'),
      money: $('money'),
      clock: $('clock'),
      stars: [...document.querySelectorAll('#wanted i')],
      street: $('street'),
      district: $('district'),
      objTitle: $('objective-title'),
      objText: $('objective-text'),
      speedo: $('speedo'),
      speed: $('speed'),
      needle: $('speed-needle'),
      vehicle: $('vehicle-name'),
      prompt: $('prompt'),
      toast: $('toast'),
      card: $('mission-card'),
      mute: $('mute-button'),
      flash: $('damage-flash'),
      help: $('help'),
    };
    this.shownMoney = null;
    this.cache = new Map();
    this.toastTimer = 0;
    this.cardTimer = 0;
    this.flash = 0;
    this.el.mute.addEventListener('click', () => this.onMute?.());
  }

  setMuted(muted) {
    this.el.mute.textContent = muted ? '🔇' : '🔊';
  }

  missionCard(html, seconds = 4) {
    this.el.card.innerHTML = html;
    this.el.card.hidden = false;
    this.el.card.classList.add('on');
    this.cardTimer = seconds;
  }

  show(visible) {
    this.root.hidden = !visible;
  }

  toggleHelp() {
    this.el.help.hidden = !this.el.help.hidden;
  }

  set(key, prop, value) {
    const id = `${key}.${prop}`;
    if (this.cache.get(id) === value) return;
    this.cache.set(id, value);
    const el = this.el[key];
    if (prop === 'html') el.innerHTML = value;
    else if (prop === 'text') el.textContent = value;
    else if (prop === 'hidden') el.hidden = value;
    else el.style.setProperty(prop, value);
  }

  toast(html, seconds = 2.6) {
    this.el.toast.innerHTML = html;
    this.el.toast.classList.add('on');
    this.toastTimer = seconds;
  }

  hurt() {
    this.flash = 1;
  }

  update(dt, s) {
    
    if (this.shownMoney === null) this.shownMoney = s.cash;
    const diff = s.cash - this.shownMoney;
    this.shownMoney += Math.abs(diff) < 1 ? diff : diff * Math.min(1, dt * 6) + Math.sign(diff);
    this.set('money', 'text', `$${Math.round(this.shownMoney).toLocaleString('en-US')}`);
    this.set('clock', 'text', clockText(s.hour));
    this.set('health', 'width', `${Math.max(0, (s.health / (s.maxHealth || 100)) * 100)}%`);
    this.el.stars.forEach((star, i) => star.classList.toggle('on', i < s.wanted));
    this.set('street', 'text', s.street);
    this.set('district', 'text', s.district);
    this.set('objTitle', 'text', s.objective.title);
    this.set('objText', 'html', s.objective.text);

    const car = s.vehicle;
    this.set('speedo', 'hidden', !car);
    if (car) {
      const kmh = Math.round(Math.abs(car.forwardSpeed) * 3.6);
      this.set('speed', 'text', String(kmh));
      this.set('needle', 'transform', `rotate(${-120 + Math.min(240, kmh * 1.1)}deg)`);
      this.set('vehicle', 'text', car.label);
    }
    this.set('prompt', 'hidden', !s.prompt);
    if (s.prompt) this.set('prompt', 'html', s.prompt);

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('on');
    }
    if (this.cardTimer > 0) {
      this.cardTimer -= dt;
      if (this.cardTimer <= 0) {
        this.el.card.classList.remove('on');
        this.el.card.hidden = true;
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.set('flash', 'opacity', this.flash.toFixed(2));
  }
}