/**
 * Vectura 3-Step Skippable Mini Tutorial
 */
export class Tutorial {
  constructor(modalEl, onFinished) {
    this.modalEl = modalEl;
    this.onFinished = onFinished;
    this.step = 1;
  }

  showIfNeeded() {
    if (localStorage.getItem('vectura_tutorial_seen')) {
      return;
    }
    this.step = 1;
    this.render();
    this.modalEl.classList.add('open');
  }

  render() {
    let title = '';
    let text = '';
    let icon = '';

    if (this.step === 1) {
      icon = '✒️';
      title = 'True Vector Stroke Engine';
      text = 'Every stroke you draw is mathematically stored as centripetal Catmull-Rom splines. Zoom in up to 6400% without any blur or pixelation!';
    } else if (this.step === 2) {
      icon = '🎨';
      title = 'Layers & 25+ Brushes';
      text = 'Enjoy infinite layers with 18 blend modes, clipping masks, alpha lock, and 25+ realistic brushes with coherent noise jitter.';
    } else {
      icon = '🖐️';
      title = 'Intuitive Touch Gestures';
      text = 'Two-finger tap to Undo. Three-finger tap to Redo. Pinch with 2 fingers to zoom and rotate. Hold at the end of a stroke to snap to shapes!';
    }

    this.modalEl.innerHTML = `
      <div class="glass-panel glass-modal" style="padding: 24px; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 12px;">${icon}</div>
        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">${title}</h3>
        <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 20px;">${text}</p>
        
        <div style="display: flex; justify-content: center; gap: 6px; margin-bottom: 20px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${this.step === 1 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)'};"></div>
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${this.step === 2 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)'};"></div>
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${this.step === 3 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)'};"></div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button id="tut-skip" class="glass-btn" style="flex: 1;">Skip</button>
          <button id="tut-next" class="glass-btn active" style="flex: 2;">${this.step === 3 ? 'Get Started' : 'Next'}</button>
        </div>
      </div>
    `;

    this.modalEl.querySelector('#tut-skip')?.addEventListener('click', () => this.finish());
    this.modalEl.querySelector('#tut-next')?.addEventListener('click', () => {
      if (this.step < 3) {
        this.step++;
        this.render();
      } else {
        this.finish();
      }
    });
  }

  finish() {
    localStorage.setItem('vectura_tutorial_seen', 'true');
    this.modalEl.classList.remove('open');
    this.onFinished?.();
  }
}
