/**
 * Vectura Modern Glass Color Picker
 * HSV Square, Hue Slider, Hex Input, Harmonies, and Color History (last 20).
 */
export class ColorPicker {
  constructor(containerEl, onChange) {
    this.container = containerEl;
    this.onChange = onChange;

    this.hue = 260; // 0 to 360
    this.sat = 0.7; // 0 to 1
    this.val = 0.9; // 0 to 1
    this.recentColors = ['#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ffffff', '#000000'];

    this.render();
  }

  getHex() {
    return this.hsvToHex(this.hue, this.sat, this.val);
  }

  setColorHex(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return;
    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    this.hue = hsv.h;
    this.sat = hsv.s;
    this.val = hsv.v;
    this.updateCanvas();
  }

  addRecentColor(hex) {
    if (!this.recentColors.includes(hex)) {
      this.recentColors.unshift(hex);
      if (this.recentColors.length > 20) this.recentColors.pop();
      this.renderRecentPalette();
    }
  }

  render() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="position: relative; width: 100%; aspect-ratio: 1.4; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--glass-border);">
          <canvas id="cp-hsv-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
          <div id="cp-hsv-cursor" style="position: absolute; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 4px #000; pointer-events: none; transform: translate(-50%, -50%);"></div>
        </div>

        <div style="position: relative; width: 100%; height: 24px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--glass-border);">
          <canvas id="cp-hue-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
          <div id="cp-hue-cursor" style="position: absolute; top: 0; bottom: 0; width: 8px; border: 2px solid #fff; border-radius: 4px; box-shadow: 0 0 4px #000; pointer-events: none; transform: translateX(-50%);"></div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div id="cp-preview-box" style="width: 40px; height: 40px; border-radius: var(--radius-sm); border: 1px solid var(--glass-border);"></div>
            <input type="text" id="cp-hex-input" class="glass-input" style="width: 90px; text-transform: uppercase;" value="#8B5CF6" />
          </div>
          <button id="cp-add-swatch-btn" class="glass-btn" style="padding: 6px 12px; font-size: 11px;">+ Save</button>
        </div>

        <div>
          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Harmonies</div>
          <div id="cp-harmonies-row" style="display: flex; gap: 6px;"></div>
        </div>

        <div>
          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Palette History (20)</div>
          <div id="cp-recent-palette" style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px;"></div>
        </div>
      </div>
    `;

    this.hsvCanvas = this.container.querySelector('#cp-hsv-canvas');
    this.hueCanvas = this.container.querySelector('#cp-hue-canvas');
    this.hsvCursor = this.container.querySelector('#cp-hsv-cursor');
    this.hueCursor = this.container.querySelector('#cp-hue-cursor');
    this.previewBox = this.container.querySelector('#cp-preview-box');
    this.hexInput = this.container.querySelector('#cp-hex-input');
    this.harmoniesRow = this.container.querySelector('#cp-harmonies-row');
    this.recentGrid = this.container.querySelector('#cp-recent-palette');

    this.setupEvents();
    this.updateCanvas();
    this.renderRecentPalette();
  }

  setupEvents() {
    let draggingHsv = false;
    let draggingHue = false;

    const handleHsv = (e) => {
      const rect = this.hsvCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      this.sat = x;
      this.val = 1 - y;
      this.updateCursor();
      this.notify();
    };

    this.hsvCanvas.addEventListener('pointerdown', (e) => {
      draggingHsv = true;
      this.hsvCanvas.setPointerCapture(e.pointerId);
      handleHsv(e);
    });
    this.hsvCanvas.addEventListener('pointermove', (e) => {
      if (draggingHsv) handleHsv(e);
    });
    this.hsvCanvas.addEventListener('pointerup', (e) => {
      draggingHsv = false;
      this.addRecentColor(this.getHex());
    });

    const handleHue = (e) => {
      const rect = this.hueCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.hue = x * 360;
      this.updateHueCanvas();
      this.updateHsvCanvas();
      this.updateCursor();
      this.notify();
    };

    this.hueCanvas.addEventListener('pointerdown', (e) => {
      draggingHue = true;
      this.hueCanvas.setPointerCapture(e.pointerId);
      handleHue(e);
    });
    this.hueCanvas.addEventListener('pointermove', (e) => {
      if (draggingHue) handleHue(e);
    });
    this.hueCanvas.addEventListener('pointerup', () => {
      draggingHue = false;
      this.addRecentColor(this.getHex());
    });

    this.hexInput.addEventListener('change', () => {
      this.setColorHex(this.hexInput.value);
      this.notify();
    });

    this.container.querySelector('#cp-add-swatch-btn').addEventListener('click', () => {
      this.addRecentColor(this.getHex());
    });
  }

  updateCanvas() {
    this.updateHueCanvas();
    this.updateHsvCanvas();
    this.updateCursor();
  }

  updateHueCanvas() {
    const ctx = this.hueCanvas.getContext('2d');
    const w = (this.hueCanvas.width = this.hueCanvas.clientWidth || 280);
    const h = (this.hueCanvas.height = 24);

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 360; i += 30) {
      grad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  updateHsvCanvas() {
    const ctx = this.hsvCanvas.getContext('2d');
    const w = (this.hsvCanvas.width = this.hsvCanvas.clientWidth || 280);
    const h = (this.hsvCanvas.height = this.hsvCanvas.clientHeight || 180);

    // Saturation horizontal gradient
    const gradSat = ctx.createLinearGradient(0, 0, w, 0);
    gradSat.addColorStop(0, '#ffffff');
    gradSat.addColorStop(1, `hsl(${this.hue}, 100%, 50%)`);
    ctx.fillStyle = gradSat;
    ctx.fillRect(0, 0, w, h);

    // Value vertical gradient
    const gradVal = ctx.createLinearGradient(0, 0, 0, h);
    gradVal.addColorStop(0, 'rgba(0,0,0,0)');
    gradVal.addColorStop(1, '#000000');
    ctx.fillStyle = gradVal;
    ctx.fillRect(0, 0, w, h);
  }

  updateCursor() {
    const rectHsv = this.hsvCanvas.getBoundingClientRect();
    if (rectHsv.width > 0) {
      this.hsvCursor.style.left = this.sat * rectHsv.width + 'px';
      this.hsvCursor.style.top = (1 - this.val) * rectHsv.height + 'px';
    }

    const rectHue = this.hueCanvas.getBoundingClientRect();
    if (rectHue.width > 0) {
      this.hueCursor.style.left = (this.hue / 360) * rectHue.width + 'px';
    }

    const hex = this.getHex();
    this.previewBox.style.backgroundColor = hex;
    this.hexInput.value = hex.toUpperCase();

    this.renderHarmonies();
  }

  notify() {
    const hex = this.getHex();
    this.onChange?.(hex);
  }

  renderHarmonies() {
    const compHue = (this.hue + 180) % 360;
    const compHex = this.hsvToHex(compHue, this.sat, this.val);

    const ana1Hue = (this.hue + 30) % 360;
    const ana1Hex = this.hsvToHex(ana1Hue, this.sat, this.val);

    const tri1Hue = (this.hue + 120) % 360;
    const tri1Hex = this.hsvToHex(tri1Hue, this.sat, this.val);

    const colors = [compHex, ana1Hex, tri1Hex];
    this.harmoniesRow.innerHTML = colors
      .map(
        c => `<div style="flex: 1; height: 26px; border-radius: var(--radius-sm); background: ${c}; cursor: pointer; border: 1px solid var(--glass-border);" data-color="${c}"></div>`
      )
      .join('');

    this.harmoniesRow.querySelectorAll('div').forEach(el => {
      el.addEventListener('click', () => {
        this.setColorHex(el.dataset.color);
        this.notify();
      });
    });
  }

  renderRecentPalette() {
    this.recentGrid.innerHTML = this.recentColors
      .map(
        c => `<div style="aspect-ratio: 1; border-radius: var(--radius-sm); background: ${c}; cursor: pointer; border: 1px solid var(--glass-border);" data-color="${c}"></div>`
      )
      .join('');

    this.recentGrid.querySelectorAll('div').forEach(el => {
      el.addEventListener('click', () => {
        this.setColorHex(el.dataset.color);
        this.notify();
      });
    });
  }

  hsvToHex(h, s, v) {
    const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    const r = Math.round(f(5) * 255);
    const g = Math.round(f(3) * 255);
    const b = Math.round(f(1) * 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  hexToRgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return isNaN(num) ? null : { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s, v };
  }
}
