/**
 * Vectura Settings Dialog
 * Clean, calm, professional settings panel matching design tokens and active theme.
 * Includes Theme Selector: Dark OLED, Grey, Blue Grey, White, Sepia.
 */
export class SettingsDialog {
  constructor(modalEl, config, onConfigChanged, onResetUILayout = null) {
    this.modalEl = modalEl;
    this.config = config;
    if (this.config.globalSpeedFactor === undefined) {
      this.config.globalSpeedFactor = 1.0;
    }
    if (this.config.reduceAnimations === undefined) {
      this.config.reduceAnimations = false;
    }
    if (this.config.fillAnimation === undefined) {
      this.config.fillAnimation = true;
    }
    if (this.config.fillSpeed === undefined) {
      this.config.fillSpeed = 380;
    }
    if (!this.config.theme) {
      this.config.theme = 'dark-oled';
    }
    this.onConfigChanged = onConfigChanged;
    this.onResetUILayout = onResetUILayout;

    this.render();
  }

  setResetLayoutHandler(fn) {
    this.onResetUILayout = fn;
  }

  render() {
    const speedFactor = (this.config.globalSpeedFactor || 1.0).toFixed(2);
    const rotThresh = this.config.rotationThreshold ?? 6;
    const currentTheme = this.config.theme || 'dark-oled';

    this.modalEl.innerHTML = `
      <div class="dialog-card" style="max-width: 440px; width: 94%; max-height: 85vh; display: flex; flex-direction: column; border-radius: 16px; overflow: hidden; background: var(--panel);">
        <div class="dialog-header" style="padding: 14px 20px; border-bottom: 1px solid var(--divider); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <span style="font-size: 17px; font-weight: 700; color: var(--text);">Preferences</span>
          <button id="sd-close-btn" class="btn-icon" title="Close" style="width: 32px; height: 32px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="dialog-body" style="padding: 16px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; flex: 1;">
          <!-- 1. GESTURES & CONTROLS -->
          <div>
            <div class="section-header" style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: var(--accent); font-weight: 700;">Gestures & Navigation</div>
            <div class="settings-dense-group" style="display: flex; flex-direction: column; gap: 10px; background: var(--card); padding: 12px; border-radius: 10px; border: 1px solid var(--divider);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Multi-finger Tap Shortcuts</div>
                  <div style="font-size: 11px; color: var(--text-2);">2-finger tap undo · 3-finger tap redo</div>
                </div>
                <input type="checkbox" id="sd-tap-gestures-toggle" ${this.config.multiTouchShortcuts !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>

              <div style="padding-top: 6px; border-top: 1px solid var(--divider);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 13px; font-weight: 500; color: var(--text);">Rotation activation threshold</span>
                  <span id="sd-rot-thresh-display" class="tabular" style="font-size: 11px; color: var(--text-2);">${rotThresh}°</span>
                </div>
                <input type="range" id="sd-rot-thresh-slider" class="dense-slider" min="2" max="20" step="1" value="${rotThresh}" style="width: 100%;" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid var(--divider);">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Stylus palm rejection</div>
                  <div style="font-size: 11px; color: var(--text-2);">Ignore finger touch while pen draws</div>
                </div>
                <input type="checkbox" id="sd-palm-toggle" ${this.config.palmRejection !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid var(--divider);">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Haptic vibration</div>
                  <div style="font-size: 11px; color: var(--text-2);">Tactile pulses on undo & transform snap</div>
                </div>
                <input type="checkbox" id="sd-haptic-toggle" ${this.config.hapticFeedback !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>
            </div>
          </div>

          <!-- 2. CANVAS & WORKSPACE -->
          <div>
            <div class="section-header" style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: var(--accent); font-weight: 700;">Canvas & Workspace</div>
            <div class="settings-dense-group" style="display: flex; flex-direction: column; gap: 10px; background: var(--card); padding: 12px; border-radius: 10px; border: 1px solid var(--divider);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Smooth Zero Attraction</div>
                  <div style="font-size: 11px; color: var(--text-2);">Softly pulls canvas upright near 0°</div>
                </div>
                <input type="checkbox" id="sd-magnetic-zero-toggle" ${this.config.magneticZero !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>

              <div style="padding-top: 6px; border-top: 1px solid var(--divider);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 13px; font-weight: 500; color: var(--text);">Checkerboard Background</div>
                    <div style="font-size: 11px; color: var(--text-2);">Indicates layer transparency</div>
                  </div>
                  <input type="checkbox" id="sd-checker-toggle" ${this.config.showCheckerboard !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
                </div>
              </div>
            </div>
          </div>

          <!-- 3. PERFORMANCE & BATTERY -->
          <div>
            <div class="section-header" style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: var(--accent); font-weight: 700;">Performance & Battery</div>
            <div class="settings-dense-group" style="display: flex; flex-direction: column; gap: 10px; background: var(--card); padding: 12px; border-radius: 10px; border: 1px solid var(--divider);">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 13px; font-weight: 500; color: var(--text);">Dynamics speed factor</span>
                  <span id="sd-speed-factor-display" class="tabular" style="font-size: 11px; color: var(--text-2);">${speedFactor}x</span>
                </div>
                <input type="range" id="sd-speed-factor-slider" class="dense-slider" min="0.1" max="3.0" step="0.05" value="${this.config.globalSpeedFactor || 1.0}" style="width: 100%;" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid var(--divider);">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Reduce animations & UI blur</div>
                  <div style="font-size: 11px; color: var(--text-2);">Conserves GPU memory and battery</div>
                </div>
                <input type="checkbox" id="sd-reduce-anim-toggle" ${this.config.reduceAnimations ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid var(--divider);">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">History RAM Saver</div>
                  <div style="font-size: 11px; color: var(--text-2);">Limits undo memory (recommended for phones)</div>
                </div>
                <input type="checkbox" id="sd-ram-saver-toggle" ${this.config.historyRamSaver !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>
            </div>
          </div>

          <!-- 4. INTERFACE & THEMES -->
          <div>
            <div class="section-header" style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: var(--accent); font-weight: 700;">Interface & Themes</div>
            <div class="settings-dense-group" style="display: flex; flex-direction: column; gap: 12px; background: var(--card); padding: 12px; border-radius: 10px; border: 1px solid var(--divider);">
              <div>
                <div style="font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 2px;">Studio Theme</div>
                <div style="font-size: 11px; color: var(--text-2); margin-bottom: 8px;">Select color scheme for all surfaces</div>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
                  ${[
                    { id: 'dark-oled', label: 'Dark OLED' },
                    { id: 'grey', label: 'Grey' },
                    { id: 'blue-grey', label: 'Blue Grey' },
                    { id: 'white', label: 'White' },
                    { id: 'sepia', label: 'Sepia' }
                  ].map(t => {
                    const isSel = currentTheme === t.id;
                    return `
                      <button class="btn-text sd-theme-btn ${isSel ? 'accent' : ''}" data-theme="${t.id}" style="padding: 6px 2px; font-size: 10px; min-height: 36px; border-radius: 6px; text-align: center; border: 1.5px solid ${isSel ? 'var(--accent)' : 'var(--border)'}; background: ${isSel ? 'var(--accent)' : 'var(--control)'}; color: ${isSel ? '#ffffff' : 'var(--text)'};">
                        ${t.label}
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--divider);">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Slider Position & Layout</div>
                  <div style="font-size: 11px; color: var(--text-2);">Reset edge sliders back to left default</div>
                </div>
                <button id="sd-reset-ui-btn" class="btn-text" style="font-size: 12px; padding: 4px 10px; height: 32px; border-radius: 6px;">
                  Reset Layout
                </button>
              </div>
            </div>
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

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    // Theme selector
    this.modalEl.querySelectorAll('.sd-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const themeId = btn.dataset.theme;
        this.config.theme = themeId;
        this.onConfigChanged?.('theme', themeId);
        this.render();
      });
    });

    // Reset UI Layout
    this.modalEl.querySelector('#sd-reset-ui-btn')?.addEventListener('click', () => {
      this.onResetUILayout?.();
      this.close();
    });

    // Speed Factor
    const speedSlider = this.modalEl.querySelector('#sd-speed-factor-slider');
    const speedDisplay = this.modalEl.querySelector('#sd-speed-factor-display');
    speedSlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.config.globalSpeedFactor = val;
      if (speedDisplay) speedDisplay.textContent = `${val.toFixed(2)}x`;
      this.onConfigChanged?.('globalSpeedFactor', val);
    });

    // Rotation Threshold
    const rotSlider = this.modalEl.querySelector('#sd-rot-thresh-slider');
    const rotDisplay = this.modalEl.querySelector('#sd-rot-thresh-display');
    rotSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.config.rotationThreshold = val;
      if (rotDisplay) rotDisplay.textContent = `${val}°`;
      this.onConfigChanged?.('rotationThreshold', val);
    });

    // Multi-touch gestures toggle
    this.modalEl.querySelector('#sd-tap-gestures-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.multiTouchShortcuts = val;
      this.onConfigChanged?.('multiTouchShortcuts', val);
    });

    // Magnetic Zero toggle
    this.modalEl.querySelector('#sd-magnetic-zero-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.magneticZero = val;
      this.onConfigChanged?.('magneticZero', val);
    });

    // Checkerboard toggle
    this.modalEl.querySelector('#sd-checker-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.showCheckerboard = val;
      this.onConfigChanged?.('showCheckerboard', val);
    });

    // Palm rejection
    this.modalEl.querySelector('#sd-palm-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.palmRejection = val;
      this.onConfigChanged?.('palmRejection', val);
    });

    // Haptic toggle
    this.modalEl.querySelector('#sd-haptic-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.hapticFeedback = val;
      this.onConfigChanged?.('haptics', val);
    });

    // Reduce animations toggle
    this.modalEl.querySelector('#sd-reduce-anim-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.reduceAnimations = val;
      this.onConfigChanged?.('reduceAnimations', val);
    });

    // RAM Saver toggle
    this.modalEl.querySelector('#sd-ram-saver-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.historyRamSaver = val;
      this.onConfigChanged?.('historyRamSaver', val);
    });
  }

  open() {
    this.render();
    this.modalEl.classList.add('open');
  }

  close() {
    this.modalEl.classList.remove('open');
  }
}
