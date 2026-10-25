/**
 * Vectura Color Picker
 * Clean, dense, professional color studio.
 * Tabs: Disc, Classic, Sliders, Palettes.
 */
export class ColorPicker {
  constructor(containerEl, onChange, onEyedropper = null) {
    this.container = containerEl;
    this.onChange = onChange;
    this.onEyedropper = onEyedropper;

    this.activeTab = 'disc'; // 'disc' | 'classic' | 'sliders' | 'palettes'
    this.sliderMode = 'rgb'; // 'rgb' | 'hsl' | 'cmyk'

    this.hue = 220; // 0 to 360
    this.sat = 0.73; // 0 to 1
    this.val = 0.86; // 0 to 1

    this.previousColor = '#FFFFFF';
    this.currentColor = '#3B6EDC';
    this.recentColors = ['#3B6EDC', '#1B1B1D', '#FFFFFF', '#C2362F', '#10B981', '#F59E0B', '#8B5CF6', '#5C5C61'];

    this.render();
  }

  getHex() {
    return this.currentColor;
  }

  setColorHex(hex, isPrevious = false) {
    if (!hex || typeof hex !== 'string') return;
    const clean = hex.startsWith('#') ? hex : '#' + hex;
    const rgb = this.hexToRgb(clean);
    if (!rgb) return;

    if (isPrevious) {
      this.previousColor = clean;
    }
    this.currentColor = clean;

    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    this.hue = hsv.h;
    this.sat = hsv.s;
    this.val = hsv.v;

    this.updateUI();
  }

  addRecentColor(hex) {
    if (!hex) return;
    const clean = hex.startsWith('#') ? hex.toUpperCase() : '#' + hex.toUpperCase();
    const idx = this.recentColors.indexOf(clean);
    if (idx >= 0) this.recentColors.splice(idx, 1);
    this.recentColors.unshift(clean);
    if (this.recentColors.length > 8) this.recentColors.pop();
    this.renderRecentPalette();
  }

  setTab(tab) {
    this.activeTab = tab;
    // Sync tab buttons in header
    ['disc', 'classic', 'sliders', 'palettes'].forEach(t => {
      const el = document.getElementById(`cp-tab-${t}`);
      if (el) el.classList.toggle('active', t === tab);
    });
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; height: 100%;">
        <!-- Swatch Bar: Current (32x32) next to Previous (32x32), HEX input -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--divider);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="color-current-previous">
              <div id="cp-swatch-curr" class="swatch-32" style="background: ${this.currentColor};" title="Current colour"></div>
              <div id="cp-swatch-prev" class="swatch-32" style="background: ${this.previousColor}; cursor: pointer;" title="Previous colour (tap to restore)"></div>
            </div>
            <input type="text" id="cp-hex-input" class="tabular" style="width: 86px; height: 32px; font-size: var(--text-secondary); text-transform: uppercase;" value="${this.currentColor.toUpperCase()}" />
          </div>

          ${this.onEyedropper ? `
            <button id="cp-btn-eyedropper" class="btn-icon" title="Eyedropper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2l4 4L7 17H3v-4L14 2z"/><line x1="16" y1="4" x2="20" y2="8"/></svg>
            </button>
          ` : ''}
        </div>

        <!-- Tab Body -->
        <div id="cp-tab-body" style="flex: 1; display: flex; flex-direction: column;">
          ${this.renderActiveTabContent()}
        </div>

        <!-- Palette Strip at bottom of every tab: 8 recent swatches (24x24, 4px radius, 1px border) -->
        <div>
          <div class="section-header" style="margin-top: 4px; margin-bottom: 6px;">Recent swatches</div>
          <div id="cp-palette-strip" class="palette-strip">
            ${this.recentColors.slice(0, 8).map(c => `
              <div class="palette-swatch-item" data-color="${c}" style="background: ${c};" title="${c}"></div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.setupEvents();
    this.setupTabEvents();
  }

  renderActiveTabContent() {
    if (this.activeTab === 'disc') {
      return `
        <div class="color-picker-wheel-wrap">
          <div style="position: relative; width: 200px; height: 200px;">
            <canvas id="cp-disc-canvas" width="200" height="200" style="display: block; width: 100%; height: 100%; border-radius: 50%; cursor: crosshair;"></canvas>
            <div id="cp-disc-cursor" style="position: absolute; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #FFFFFF; box-shadow: 0 0 2px #000000; pointer-events: none; transform: translate(-50%, -50%);"></div>
          </div>
        </div>
      `;
    } else if (this.activeTab === 'classic') {
      return `
        <div style="display: flex; flex-direction: column; gap: 10px; padding: 6px 0;">
          <div style="position: relative; width: 100%; height: 140px; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; cursor: crosshair;">
            <canvas id="cp-classic-canvas" width="280" height="140" style="width: 100%; height: 100%; display: block;"></canvas>
            <div id="cp-classic-cursor" style="position: absolute; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #FFFFFF; box-shadow: 0 0 2px #000000; pointer-events: none; transform: translate(-50%, -50%);"></div>
          </div>

          <div style="position: relative; width: 100%; height: 24px; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; cursor: pointer;">
            <canvas id="cp-hue-bar" width="280" height="24" style="width: 100%; height: 100%; display: block;"></canvas>
            <div id="cp-hue-cursor" style="position: absolute; top: 0; bottom: 0; width: 6px; border: 1.5px solid #FFFFFF; border-radius: 2px; box-shadow: 0 0 2px #000000; pointer-events: none; transform: translateX(-50%);"></div>
          </div>
        </div>
      `;
    } else if (this.activeTab === 'sliders') {
      return `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Slider Mode Switcher -->
          <div style="display: flex; gap: 4px; margin-bottom: 4px;">
            <button class="btn-text cp-smode-btn ${this.sliderMode === 'rgb' ? 'accent' : ''}" data-mode="rgb" style="flex: 1; min-height: 28px; font-size: var(--text-secondary); padding: 2px 6px;">RGB</button>
            <button class="btn-text cp-smode-btn ${this.sliderMode === 'hsl' ? 'accent' : ''}" data-mode="hsl" style="flex: 1; min-height: 28px; font-size: var(--text-secondary); padding: 2px 6px;">HSL</button>
            <button class="btn-text cp-smode-btn ${this.sliderMode === 'cmyk' ? 'accent' : ''}" data-mode="cmyk" style="flex: 1; min-height: 28px; font-size: var(--text-secondary); padding: 2px 6px;">CMYK</button>
          </div>
          <div class="color-sliders-list">
            ${this.renderSlidersList()}
          </div>
        </div>
      `;
    } else {
      // Palettes Tab
      return `
        <div style="display: flex; flex-direction: column; gap: 10px; padding: 6px 0;">
          <span style="font-size: var(--text-secondary); color: var(--text-2);">Studio Harmonies</span>
          <div id="cp-harmonies-row" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px;">
            ${this.getHarmonies(this.currentColor).map(h => `
              <div class="palette-swatch-item" data-color="${h}" style="background: ${h}; width: 100%; height: 36px;" title="${h}"></div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  renderSlidersList() {
    const rgb = this.hexToRgb(this.currentColor) || { r: 59, g: 110, b: 220 };
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const cmyk = this.rgbToCmyk(rgb.r, rgb.g, rgb.b);

    if (this.sliderMode === 'rgb') {
      return `
        ${this.sliderRow('R', 'rgb-r', rgb.r, 0, 255, `linear-gradient(to right, rgb(0, ${rgb.g}, ${rgb.b}), rgb(255, ${rgb.g}, ${rgb.b}))`)}
        ${this.sliderRow('G', 'rgb-g', rgb.g, 0, 255, `linear-gradient(to right, rgb(${rgb.r}, 0, ${rgb.b}), rgb(${rgb.r}, 255, ${rgb.b}))`)}
        ${this.sliderRow('B', 'rgb-b', rgb.b, 0, 255, `linear-gradient(to right, rgb(${rgb.r}, ${rgb.g}, 0), rgb(${rgb.r}, ${rgb.g}, 255))`)}
      `;
    } else if (this.sliderMode === 'hsl') {
      return `
        ${this.sliderRow('H', 'hsl-h', Math.round(hsl.h), 0, 360, `linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)`)}
        ${this.sliderRow('S', 'hsl-s', Math.round(hsl.s * 100), 0, 100, `linear-gradient(to right, #808080, hsl(${hsl.h}, 100%, ${hsl.l * 100}%))`)}
        ${this.sliderRow('L', 'hsl-l', Math.round(hsl.l * 100), 0, 100, `linear-gradient(to right, #000, hsl(${hsl.h}, ${hsl.s * 100}%, 50%), #fff)`)}
      `;
    } else {
      // CMYK
      return `
        ${this.sliderRow('C', 'cmyk-c', Math.round(cmyk.c * 100), 0, 100, `linear-gradient(to right, #fff, #0ff)`)}
        ${this.sliderRow('M', 'cmyk-m', Math.round(cmyk.m * 100), 0, 100, `linear-gradient(to right, #fff, #f0f)`)}
        ${this.sliderRow('Y', 'cmyk-y', Math.round(cmyk.y * 100), 0, 100, `linear-gradient(to right, #fff, #ff0)`)}
        ${this.sliderRow('K', 'cmyk-k', Math.round(cmyk.k * 100), 0, 100, `linear-gradient(to right, #fff, #000)`)}
      `;
    }
  }

  sliderRow(label, channelId, value, min, max, trackGradient) {
    return `
      <div class="color-slider-row">
        <span style="font-size: var(--text-secondary); font-weight: 500; color: var(--text-2);">${label}</span>
        <div class="color-slider-track" style="background: ${trackGradient}; border-radius: var(--radius-xs); border: 1px solid var(--border); padding: 0 4px;">
          <input type="range" class="dense-slider cp-channel-slider" data-ch="${channelId}" min="${min}" max="${max}" value="${value}">
        </div>
        <input type="number" class="tabular cp-channel-num" data-ch="${channelId}" min="${min}" max="${max}" value="${value}" style="width: 40px; height: 28px; font-size: var(--text-secondary); text-align: right; padding: 2px 4px;">
      </div>
    `;
  }

  setupEvents() {
    // Previous color tap to restore
    this.container.querySelector('#cp-swatch-prev')?.addEventListener('click', () => {
      this.setColorHex(this.previousColor);
      this.onChange?.(this.currentColor);
    });

    // HEX input
    const hexInput = this.container.querySelector('#cp-hex-input');
    if (hexInput) {
      hexInput.addEventListener('change', (e) => {
        let v = e.target.value.trim();
        if (!v.startsWith('#')) v = '#' + v;
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
          this.setColorHex(v);
          this.onChange?.(this.currentColor);
        }
      });
    }

    // Eyedropper button
    this.container.querySelector('#cp-btn-eyedropper')?.addEventListener('click', () => {
      this.onEyedropper?.();
    });

    // Recent swatches click
    this.container.querySelectorAll('.palette-swatch-item').forEach(el => {
      el.addEventListener('click', () => {
        const col = el.dataset.color;
        if (col) {
          this.setColorHex(col);
          this.onChange?.(this.currentColor);
        }
      });
    });

    // Slider mode switcher
    this.container.querySelectorAll('.cp-smode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sliderMode = btn.dataset.mode;
        this.render();
      });
    });
  }

  setupTabEvents() {
    if (this.activeTab === 'disc') {
      this.initDiscCanvas();
    } else if (this.activeTab === 'classic') {
      this.initClassicCanvas();
    } else if (this.activeTab === 'sliders') {
      this.initSlidersEvents();
    }
  }

  initDiscCanvas() {
    const canvas = this.container.querySelector('#cp-disc-canvas');
    const cursor = this.container.querySelector('#cp-disc-cursor');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = size / 2 - 2;

    if (!ColorPicker._cachedDiscCanvas || ColorPicker._cachedDiscCanvas.width !== size) {
      const off = document.createElement('canvas');
      off.width = size;
      off.height = size;
      const offCtx = off.getContext('2d');
      const imgData = offCtx.createImageData(size, size);
      const data = imgData.data;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - center;
          const dy = y - center;
          const dist = Math.hypot(dx, dy);
          const idx = (y * size + x) * 4;
          if (dist <= radius) {
            const angle = Math.atan2(dy, dx);
            const hue = ((angle * 180 / Math.PI) + 360) % 360;
            const sat = Math.min(1, dist / radius);
            const rgb = this.hsvToRgb(hue, sat, 1.0);
            data[idx] = rgb.r;
            data[idx + 1] = rgb.g;
            data[idx + 2] = rgb.b;
            data[idx + 3] = 255;
          } else {
            data[idx + 3] = 0;
          }
        }
      }
      offCtx.putImageData(imgData, 0, 0);

      // Border ring
      offCtx.strokeStyle = '#B8B8BC';
      offCtx.lineWidth = 1;
      offCtx.beginPath();
      offCtx.arc(center, center, radius, 0, Math.PI * 2);
      offCtx.stroke();

      ColorPicker._cachedDiscCanvas = off;
    }

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(ColorPicker._cachedDiscCanvas, 0, 0);

    let rafId = null;
    const updateFromPointer = (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const dx = px - (rect.width / 2);
        const dy = py - (rect.height / 2);
        const dist = Math.hypot(dx, dy);
        const maxR = rect.width / 2;

        const angle = Math.atan2(dy, dx);
        this.hue = ((angle * 180 / Math.PI) + 360) % 360;
        this.sat = Math.min(1, dist / maxR);
        this.val = 1.0;

        const rgb = this.hsvToRgb(this.hue, this.sat, this.val);
        this.currentColor = this.rgbToHex(rgb.r, rgb.g, rgb.b);

        if (cursor) {
          cursor.style.left = `${px}px`;
          cursor.style.top = `${py}px`;
        }
        this.updateAffordances();
        this.onChange?.(this.currentColor);
      });
    };

    let isDown = false;
    canvas.addEventListener('pointerdown', (e) => {
      isDown = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      updateFromPointer(e);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (isDown) updateFromPointer(e);
    });
    canvas.addEventListener('pointerup', () => { isDown = false; });
  }

  initClassicCanvas() {
    const svCanvas = this.container.querySelector('#cp-classic-canvas');
    const hueCanvas = this.container.querySelector('#cp-hue-bar');
    if (!svCanvas || !hueCanvas) return;

    this.drawClassicSV(svCanvas);
    this.drawHueBar(hueCanvas);

    const updateSV = (e) => {
      const rect = svCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      this.sat = x / rect.width;
      this.val = 1.0 - (y / rect.height);

      const rgb = this.hsvToRgb(this.hue, this.sat, this.val);
      this.currentColor = this.rgbToHex(rgb.r, rgb.g, rgb.b);

      const cursor = this.container.querySelector('#cp-classic-cursor');
      if (cursor) {
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
      }
      this.updateAffordances();
      this.onChange?.(this.currentColor);
    };

    let isDownSV = false;
    svCanvas.addEventListener('pointerdown', (e) => {
      isDownSV = true;
      try { svCanvas.setPointerCapture(e.pointerId); } catch (_) {}
      updateSV(e);
    });
    svCanvas.addEventListener('pointermove', (e) => {
      if (isDownSV) updateSV(e);
    });
    svCanvas.addEventListener('pointerup', () => { isDownSV = false; });

    const updateHue = (e) => {
      const rect = hueCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      this.hue = (x / rect.width) * 360;

      this.drawClassicSV(svCanvas);
      const rgb = this.hsvToRgb(this.hue, this.sat, this.val);
      this.currentColor = this.rgbToHex(rgb.r, rgb.g, rgb.b);

      const cursor = this.container.querySelector('#cp-hue-cursor');
      if (cursor) {
        cursor.style.left = `${x}px`;
      }
      this.updateAffordances();
      this.onChange?.(this.currentColor);
    };

    let isDownHue = false;
    hueCanvas.addEventListener('pointerdown', (e) => {
      isDownHue = true;
      try { hueCanvas.setPointerCapture(e.pointerId); } catch (_) {}
      updateHue(e);
    });
    hueCanvas.addEventListener('pointermove', (e) => {
      if (isDownHue) updateHue(e);
    });
    hueCanvas.addEventListener('pointerup', () => { isDownHue = false; });
  }

  drawClassicSV(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const baseRgb = this.hsvToRgb(this.hue, 1, 1);
    ctx.fillStyle = `rgb(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b})`;
    ctx.fillRect(0, 0, w, h);

    // White horizontal gradient
    const gradWhite = ctx.createLinearGradient(0, 0, w, 0);
    gradWhite.addColorStop(0, '#FFFFFF');
    gradWhite.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradWhite;
    ctx.fillRect(0, 0, w, h);

    // Black vertical gradient
    const gradBlack = ctx.createLinearGradient(0, 0, 0, h);
    gradBlack.addColorStop(0, 'rgba(0,0,0,0)');
    gradBlack.addColorStop(1, '#000000');
    ctx.fillStyle = gradBlack;
    ctx.fillRect(0, 0, w, h);
  }

  drawHueBar(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#f00');
    grad.addColorStop(0.17, '#ff0');
    grad.addColorStop(0.33, '#0f0');
    grad.addColorStop(0.5, '#0ff');
    grad.addColorStop(0.67, '#00f');
    grad.addColorStop(0.83, '#f0f');
    grad.addColorStop(1, '#f00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  initSlidersEvents() {
    this.container.querySelectorAll('.cp-channel-slider, .cp-channel-num').forEach(el => {
      el.addEventListener('input', (e) => {
        const ch = el.dataset.ch;
        const val = parseFloat(e.target.value);
        this.handleSliderChannelChange(ch, val);
      });
    });
  }

  handleSliderChannelChange(ch, val) {
    const rgb = this.hexToRgb(this.currentColor) || { r: 59, g: 110, b: 220 };
    if (ch === 'rgb-r') rgb.r = Math.round(val);
    if (ch === 'rgb-g') rgb.g = Math.round(val);
    if (ch === 'rgb-b') rgb.b = Math.round(val);

    this.currentColor = this.rgbToHex(rgb.r, rgb.g, rgb.b);
    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    this.hue = hsv.h;
    this.sat = hsv.s;
    this.val = hsv.v;

    this.updateAffordances();
    this.onChange?.(this.currentColor);
  }

  updateAffordances() {
    const swatch = this.container.querySelector('#cp-swatch-curr');
    if (swatch) swatch.style.background = this.currentColor;
    const hexInput = this.container.querySelector('#cp-hex-input');
    if (hexInput) hexInput.value = this.currentColor.toUpperCase();

    // Toolbar swatch
    const barPrimary = document.getElementById('swatch-primary');
    if (barPrimary) barPrimary.style.background = this.currentColor;
  }

  updateUI() {
    this.updateAffordances();
    if (this.activeTab === 'sliders') {
      const list = this.container.querySelector('.color-sliders-list');
      if (list) list.innerHTML = this.renderSlidersList();
      this.initSlidersEvents();
    }
  }

  getHarmonies(hex) {
    const rgb = this.hexToRgb(hex) || { r: 59, g: 110, b: 220 };
    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    return [
      hex,
      this.hsvToHex((hsv.h + 30) % 360, hsv.s, hsv.v),
      this.hsvToHex((hsv.h + 60) % 360, hsv.s, hsv.v),
      this.hsvToHex((hsv.h + 180) % 360, hsv.s, hsv.v),
      this.hsvToHex((hsv.h + 210) % 360, hsv.s, hsv.v),
      this.hsvToHex((hsv.h + 240) % 360, hsv.s, hsv.v)
    ];
  }

  /* Math & Conversion Helpers */
  hexToRgb(hex) {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return res ? {
      r: parseInt(res[1], 16),
      g: parseInt(res[2], 16),
      b: parseInt(res[3], 16)
    } : null;
  }

  rgbToHex(r, g, b) {
    const toHex = c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    if (max !== min) {
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, v };
  }

  hsvToHex(h, s, v) {
    const rgb = this.hsvToRgb(h, s, v);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  rgbToCmyk(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const k = 1 - Math.max(r, g, b);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 1 };
    const c = (1 - r - k) / (1 - k);
    const m = (1 - g - k) / (1 - k);
    const y = (1 - b - k) / (1 - k);
    return { c, m, y, k };
  }
}
