/**
 * Vectura Settings Dialog
 * Global speed factor slider, theme toggle, left-handed mode, gestures, palm rejection, haptics and performance mode.
 */
export class SettingsDialog {
  constructor(modalEl, config, onConfigChanged) {
    this.modalEl = modalEl;
    this.config = config;
    if (this.config.globalSpeedFactor === undefined) {
      this.config.globalSpeedFactor = 1.0;
    }
    this.onConfigChanged = onConfigChanged;

    this.render();
  }

  render() {
    const speedFactor = (this.config.globalSpeedFactor || 1.0).toFixed(2);

    this.modalEl.innerHTML = `
      <div class="glass-panel glass-modal" style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span style="font-size: 16px; font-weight: 700;">Studio Quick Settings</span>
          <button id="sd-close-btn" class="glass-btn glass-btn-icon" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; max-height: 65vh;">
          <!-- Global Speed Factor Slider (Scales all brushes) -->
          <div style="padding: 12px; background: rgba(139, 92, 246, 0.08); border-radius: var(--radius-md); border: 1px solid rgba(139, 92, 246, 0.25); display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 13px; font-weight: 700; color: var(--accent-primary);">Global Speed Factor</span>
                <span style="font-size: 11px; color: var(--text-muted);">Scales finger velocity dynamics for all brushes</span>
              </div>
              <span id="sd-speed-factor-display" style="font-size: 13px; font-weight: 700; color: var(--text-main); font-family: monospace;">${speedFactor}x</span>
            </div>
            <input type="range" id="sd-speed-factor-slider" class="glass-slider" min="0.1" max="3.0" step="0.05" value="${this.config.globalSpeedFactor || 1.0}" />
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-dim);">
              <span>0.1x (Slow)</span>
              <span>1.0x (Normal)</span>
              <span>3.0x (Fast)</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Theme</span>
              <span style="font-size: 11px; color: var(--text-muted);">Dark glass or light glass</span>
            </div>
            <button id="sd-theme-btn" class="glass-btn" style="padding: 6px 14px; font-size: 12px;">
              ${this.config.theme === 'light' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Left-Handed Mode</span>
              <span style="font-size: 11px; color: var(--text-muted);">Swaps toolbar to the right edge</span>
            </div>
            <input type="checkbox" id="sd-lefthand-toggle" ${this.config.leftHanded ? 'checked' : ''} />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Multi-Finger Gestures</span>
              <span style="font-size: 11px; color: var(--text-muted);">2-finger tap = Undo, 3-finger = Redo</span>
            </div>
            <input type="checkbox" id="sd-gestures-toggle" ${this.config.gesturesEnabled ? 'checked' : ''} />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Stylus Palm Rejection</span>
              <span style="font-size: 11px; color: var(--text-muted);">Ignore touch when stylus active</span>
            </div>
            <input type="checkbox" id="sd-palm-toggle" ${this.config.palmRejection ? 'checked' : ''} />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Haptic Feedback</span>
              <span style="font-size: 11px; color: var(--text-muted);">Vibrate on undo/redo/snapping</span>
            </div>
            <input type="checkbox" id="sd-haptics-toggle" ${this.config.haptics ? 'checked' : ''} />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Performance Mode</span>
              <span style="font-size: 11px; color: var(--text-muted);">Reduces backdrop blur for battery</span>
            </div>
            <input type="checkbox" id="sd-perf-toggle" ${this.config.perfMode ? 'checked' : ''} />
          </div>
        </div>
      </div>
    `;

    this.setupEvents();
  }

  setupEvents() {
    this.modalEl.querySelector('#sd-close-btn')?.addEventListener('click', () => {
      this.close();
    });

    const speedSlider = this.modalEl.querySelector('#sd-speed-factor-slider');
    const speedDisplay = this.modalEl.querySelector('#sd-speed-factor-display');
    speedSlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.config.globalSpeedFactor = val;
      if (speedDisplay) speedDisplay.textContent = val.toFixed(2) + 'x';
      this.onConfigChanged?.('globalSpeedFactor', val);
    });

    this.modalEl.querySelector('#sd-theme-btn')?.addEventListener('click', () => {
      this.config.theme = this.config.theme === 'light' ? 'dark' : 'light';
      this.render();
      this.onConfigChanged?.('theme', this.config.theme);
    });

    this.modalEl.querySelector('#sd-lefthand-toggle')?.addEventListener('change', (e) => {
      this.config.leftHanded = e.target.checked;
      this.onConfigChanged?.('leftHanded', this.config.leftHanded);
    });

    this.modalEl.querySelector('#sd-gestures-toggle')?.addEventListener('change', (e) => {
      this.config.gesturesEnabled = e.target.checked;
      this.onConfigChanged?.('gesturesEnabled', this.config.gesturesEnabled);
    });

    this.modalEl.querySelector('#sd-palm-toggle')?.addEventListener('change', (e) => {
      this.config.palmRejection = e.target.checked;
      this.onConfigChanged?.('palmRejection', this.config.palmRejection);
    });

    this.modalEl.querySelector('#sd-haptics-toggle')?.addEventListener('change', (e) => {
      this.config.haptics = e.target.checked;
      this.onConfigChanged?.('haptics', this.config.haptics);
    });

    this.modalEl.querySelector('#sd-perf-toggle')?.addEventListener('change', (e) => {
      this.config.perfMode = e.target.checked;
      this.onConfigChanged?.('perfMode', this.config.perfMode);
    });
  }

  open() {
    this.modalEl.classList.add('open');
  }

  close() {
    this.modalEl.classList.remove('open');
  }
}
