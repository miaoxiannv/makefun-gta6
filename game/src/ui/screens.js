// The title screen, the pause screen and the busted screen: showing and hiding them, and
// wiring their buttons and the Enter key to the callbacks the entry point hands in.

const $ = (id) => document.getElementById(id);

export class Screens {
  constructor({ onStart, onResume, onBusted }) {
    this.title = $('title-screen');
    this.pause = $('pause-screen');
    this.busted = $('busted-screen');
    this.bustedFine = $('busted-fine');
    $('start-button').addEventListener('click', onStart);
    $('resume-button').addEventListener('click', onResume);
    $('busted-button').addEventListener('click', onBusted);
    $('controls-button').addEventListener('click', () => $('title-controls').classList.toggle('open'));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && !this.title.hidden) onStart();
      else if (e.code === 'Enter' && !this.busted.hidden) onBusted();
    });
  }

  showTitle(on) {
    this.title.hidden = !on;
  }

  showPause(on) {
    this.pause.hidden = !on;
  }

  showBusted(on, fine = 0) {
    this.busted.hidden = !on;
    if (on) this.bustedFine.textContent = `$${fine}`;
  }
}
