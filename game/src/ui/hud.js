// The on-screen HUD: health bar, money counter, clock, wanted stars, location label,
// objective panel, speedometer, interaction prompt, toasts and the damage flash.
import { formatClock } from '../world/time-of-day.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.healthFill = $('health-fill');
    this.money = $('money');
    this.clock = $('clock');
    this.wantedStars = [...$('wanted').querySelectorAll('i')];
    this.street = $('street');
    this.district = $('district');
    this.objectiveTitle = $('objective-title');
    this.objectiveText = $('objective-text');
    this.speedo = $('speedo');
    this.speed = $('speed');
    this.speedNeedle = $('speed-needle');
    this.vehicleName = $('vehicle-name');
    this.prompt = $('prompt');
    this.toastBox = $('toast');
    this.flash = $('damage-flash');
    this.help = $('help');
    this.status = $('status');
    this.shownMoney = null;
    this.toastTimer = 0;
    this.last = {};
  }

  show(visible) {
    this.root.hidden = !visible;
  }

  /** Write `value` into `element` only when it changed (keeps the DOM quiet). */
  set(key, element, value) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    element.textContent = value;
  }

  /** `state` = { health, money, hour, wanted, street, district, objective, vehicle, prompt } */
  update(dt, state) {
    this.healthFill.style.width = `${Math.max(0, state.health)}%`;
    this.healthFill.classList.toggle('low', state.health < 30);
    // Money rolls up towards the real total like a counter.
    if (this.shownMoney === null) this.shownMoney = state.money;
    this.shownMoney += (state.money - this.shownMoney) * Math.min(1, dt * 6);
    if (Math.abs(state.money - this.shownMoney) < 1) this.shownMoney = state.money;
    this.set('money', this.money, `$${Math.round(this.shownMoney).toLocaleString('en-US')}`);
    this.set('clock', this.clock, formatClock(state.hour));
    if (this.last.wanted !== state.wanted) {
      this.last.wanted = state.wanted;
      this.wantedStars.forEach((star, index) => star.classList.toggle('on', index < state.wanted));
    }
    this.set('street', this.street, state.street);
    this.set('district', this.district, state.district);
    this.set('objectiveTitle', this.objectiveTitle, state.objective.title);
    this.set('objectiveText', this.objectiveText, state.objective.text);

    this.speedo.hidden = !state.vehicle;
    if (state.vehicle) {
      const kmh = Math.round(state.vehicle.speedKmh);
      this.set('speed', this.speed, String(kmh));
      this.set('vehicleName', this.vehicleName, state.vehicle.label);
      this.speedNeedle.style.transform = `rotate(${-120 + Math.min(240, kmh * 1.2)}deg)`;
    }
    this.prompt.hidden = !state.prompt;
    if (state.prompt) this.prompt.innerHTML = state.prompt;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastBox.classList.remove('visible');
    }
  }

  toast(html, seconds = 2.6) {
    this.toastBox.innerHTML = html;
    this.toastBox.classList.add('visible');
    this.toastTimer = seconds;
    this.status.textContent = this.toastBox.textContent;
  }

  damageFlash() {
    this.flash.classList.remove('hit');
    void this.flash.offsetWidth;
    this.flash.classList.add('hit');
  }

  toggleHelp() {
    this.help.classList.toggle('collapsed');
  }
}
