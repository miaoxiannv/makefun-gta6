// The heads-up display: health bar, money counter that rolls up when you get paid, clock,
// wanted stars, the street and district you are in, the objective card, the speedometer while
// driving, the context prompt ("E  Get in"), toasts and the red flash when you get hurt.
// Elements are only written when their text actually changes.
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
      flash: $('damage-flash'),
      help: $('help'),
    };
    this.shownMoney = null;
    this.cache = new Map();
    this.toastTimer = 0;
    this.flash = 0;
  }

  show(visible) {
    this.root.hidden = !visible;
  }

  toggleHelp() {
    this.el.help.hidden = !this.el.help.hidden;
  }

  /** Write `value` into element `key` (as `prop`) only if it changed. */
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
    // the money counter rolls toward the real balance
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
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.set('flash', 'opacity', this.flash.toFixed(2));
  }
}
