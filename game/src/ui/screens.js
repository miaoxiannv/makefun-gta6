// The title screen and the pause screen: showing and hiding them, and wiring their buttons and
// the Enter key to the callbacks the entry point hands in.

const $ = (id) => document.getElementById(id);

export class Screens {
  constructor({ onStart, onResume }) {
    this.title = $('title-screen');
    this.pause = $('pause-screen');
    $('start-button').addEventListener('click', onStart);
    $('resume-button').addEventListener('click', onResume);
    $('controls-button').addEventListener('click', () => $('title-controls').classList.toggle('open'));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && !this.title.hidden) onStart();
    });
  }

  showTitle(on) {
    this.title.hidden = !on;
  }

  showPause(on) {
    this.pause.hidden = !on;
  }
}
