// The title screen (start the game, read the controls) and the pause menu.

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor({ onStart, onResume }) {
    this.title = $('title-screen');
    this.pause = $('pause-screen');
    this.controls = $('title-controls');
    $('start-button').addEventListener('click', () => onStart());
    $('controls-button').addEventListener('click', () => this.controls.classList.toggle('open'));
    $('resume-button').addEventListener('click', () => onResume());
    window.addEventListener('keydown', (event) => {
      if (!this.title.hidden && (event.code === 'Enter' || event.code === 'Space')) {
        event.preventDefault();
        onStart();
      }
    });
  }

  showTitle(visible) {
    this.title.hidden = !visible;
  }

  showPause(visible) {
    this.pause.hidden = !visible;
  }
}
