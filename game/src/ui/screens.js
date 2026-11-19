const $ = (id) => document.getElementById(id);

export class Screens {
  constructor({ onStart, onContinue, onNewGame, onMission, onResume, onBusted, onReset }) {
    this.title = $('title-screen');
    this.pause = $('pause-screen');
    this.busted = $('busted-screen');
    this.bustedFine = $('busted-fine');
    this.startButton = $('start-button');
    this.newGameButton = $('new-game-button');
    this.missionList = $('mission-list');
    this.titleProgress = $('title-progress');
    this.pauseStats = $('pause-stats');
    this.resetButton = $('reset-button');
    this.resetArmed = false;
    this.onStart = onStart;
    this.onContinue = onContinue;
    this.onNewGame = onNewGame;
    this.onMission = onMission;
    this.startButton.addEventListener('click', () => (this.save ? this.onContinue() : this.onStart()));
    this.newGameButton.addEventListener('click', () => this.onNewGame());
    $('resume-button').addEventListener('click', onResume);
    $('busted-button').addEventListener('click', onBusted);
    $('controls-button').addEventListener('click', () => $('title-controls').classList.toggle('open'));
    this.resetButton.addEventListener('click', () => {
      if (!this.resetArmed) {
        this.resetArmed = true;
        this.resetButton.textContent = 'Sure? Click again';
        setTimeout(() => {
          this.resetArmed = false;
          this.resetButton.textContent = 'Reset progress';
        }, 3000);
        return;
      }
      onReset();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && !this.title.hidden) (this.save ? this.onContinue() : this.onStart());
      else if (e.code === 'Enter' && !this.busted.hidden) onBusted();
    });
  }

  renderTitle(save, missions) {
    this.save = save;
    this.startButton.textContent = save ? 'Continue' : 'Start game';
    this.newGameButton.hidden = !save;
    this.titleProgress.textContent = save
      ? `Jobs ${missions.completed} of ${missions.total} · $${missions.earned.toLocaleString('en-US')} earned · ${missions.knockouts} knockouts`
      : '';
    this.missionList.innerHTML = '';
    for (const m of missions.list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'job';
      b.classList.toggle('done', m.state === 'done');
      b.disabled = m.state === 'locked';
      b.innerHTML = `<b>${m.state === 'done' ? '✓ ' : ''}${m.name}</b><span>$${m.reward} · ${m.state === 'done' ? 'Done' : m.state === 'locked' ? 'Locked' : 'Open'}</span>`;
      if (m.state !== 'locked') b.addEventListener('click', () => this.onMission(m.id));
      this.missionList.appendChild(b);
    }
  }

  renderStats(stats) {
    const unlocks = stats.unlocks.length ? stats.unlocks.join(' · ') : 'None yet';
    this.pauseStats.innerHTML = `<p>Jobs ${stats.missionsDone} of ${stats.total} done · <b class="cash">$${stats.earned.toLocaleString('en-US')}</b> earned · ${stats.knockouts} knockouts</p><p>Unlocks: ${unlocks}</p>`;
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