/**
 * Vectura Brush Panel & Studio
 * Clean, dense, professional brush library and settings.
 * Two sub-views: Library and Settings.
 */
import { BRUSH_CATEGORIES, DEFAULT_BRUSH_PRESETS } from '../brushes/BrushPresets.js';
import { Brush } from '../brushes/Brush.js';

export class BrushPanel {
  constructor(containerEl, currentBrush, onBrushChanged, currentColor = '#3B6EDC') {
    this.container = containerEl;
    this.onBrushChanged = onBrushChanged;
    this.currentColor = currentColor;

    this.viewMode = 'library'; // 'library' | 'settings'
    this.activePack = 'ink';
    this.activeFactorTab = 'velocity'; // 'pressure' | 'velocity' | 'jitter' | 'noise'

    // Available packs
    this.packs = [
      { id: 'ink', name: 'Inking' },
      { id: 'paint', name: 'Painting' },
      { id: 'texture', name: 'Texture' },
      { id: 'eraser', name: 'Eraser' },
      { id: 'pixel', name: 'Pixel' }
    ];

    this.brushes = DEFAULT_BRUSH_PRESETS.map(p => new Brush(p));

    // Restore per-brush settings (size, opacity, minSize, maxSize) from localStorage
    for (const b of this.brushes) {
      try {
        const saved = localStorage.getItem(`vectura_brush_settings_${b.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.minSize !== undefined) b.minSize = parsed.minSize;
          if (parsed.maxSize !== undefined) b.maxSize = parsed.maxSize;
          if (parsed.size !== undefined) b.size = Math.max(b.minSize || 1, Math.min(b.maxSize || 500, parsed.size));
          if (parsed.opacity !== undefined) b.opacity = parsed.opacity;
        }
      } catch (_) {}
    }

    // Restore last used brush
    let initialBrush = currentBrush;
    if (!initialBrush) {
      const lastBrushId = localStorage.getItem('vectura_last_brush_id');
      if (lastBrushId) {
        const match = this.brushes.find(b => b.id === lastBrushId);
        if (match) initialBrush = match;
      }
    }
    this.currentBrush = initialBrush || this.brushes[0];

    this.render();
  }

  persistBrushSettings(b) {
    if (!b) return;
    try {
      localStorage.setItem(`vectura_brush_settings_${b.id}`, JSON.stringify({
        size: b.size,
        opacity: b.opacity,
        minSize: b.minSize,
        maxSize: b.maxSize
      }));
      localStorage.setItem('vectura_last_brush_id', b.id);
    } catch (_) {}
  }

  get activeTab() {
    return this.viewMode === 'settings' ? 'settings' : 'library';
  }

  set activeTab(tab) {
    this.viewMode = (tab === 'settings' || tab === 'editor') ? 'settings' : 'library';
    this.syncTabs();
    this.render();
  }

  syncTabs() {
    const tabLib = document.getElementById('bp-tab-library');
    const tabSet = document.getElementById('bp-tab-settings');
    if (tabLib && tabSet) {
      tabLib.classList.toggle('active', this.viewMode === 'library');
      tabSet.classList.toggle('active', this.viewMode === 'settings');
    }
  }

  setColor(color) {
    this.currentColor = color;
    if (this.viewMode === 'library') {
      this.drawLibraryPreviews();
    } else {
      this.drawSettingsStrokePreview();
    }
  }

  setBrush(brush) {
    this.currentBrush = brush;
    this.render();
  }

  render() {
    this.syncTabs();

    if (this.viewMode === 'library') {
      this.renderLibrary();
    } else {
      this.renderSettings();
    }
  }

  renderLibrary() {
    const packRail = this.packs.map(p => `
      <button class="brush-pack-btn ${this.activePack === p.id ? 'selected' : ''}" data-pack="${p.id}">
        ${p.name}
      </button>
    `).join('');

    const filtered = this.brushes.filter(b => b.category === this.activePack);
    const brushRows = filtered.map(b => {
      const isSelected = this.currentBrush && this.currentBrush.id === b.id;
      return `
        <div class="brush-row-item ${isSelected ? 'selected' : ''}" data-id="${b.id}">
          <canvas class="brush-stroke-thumb" data-id="${b.id}" width="40" height="28"></canvas>
          <span class="brush-name-label">${b.name}</span>
          <span class="brush-size-range tabular">${b.size}px</span>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="brush-library-container">
        <div class="brush-pack-rail">
          ${packRail}
        </div>
        <div class="brush-list-col">
          ${brushRows}
        </div>
      </div>
    `;

    // Events
    this.container.querySelectorAll('.brush-pack-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activePack = btn.dataset.pack;
        this.render();
      });
    });

    this.container.querySelectorAll('.brush-row-item').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        const found = this.brushes.find(b => b.id === id);
        if (found) {
          this.currentBrush = found;
          this.onBrushChanged?.(this.currentBrush);
          this.render();
        }
      });
    });

    this.drawLibraryPreviews();
  }

  renderSettings() {
    const b = this.currentBrush;
    if (!b) {
      this.container.innerHTML = `<div style="padding: 16px; color: var(--text-2);">No brush selected</div>`;
      return;
    }

    if (!b.dynamics) {
      b.dynamics = {
        pressure: { size: 100, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
        velocity: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
        jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
        noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
      };
    }

    const curFactor = this.activeFactorTab || 'velocity';
    const factorObj = b.dynamics[curFactor] || { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 };

    const spacingVal = Math.round((b.spacing || 0.1) * 100);
    const stabilizerVal = Math.round(b.stabilizerStrength || 35);
    const grainVal = Math.round((b.grain || 0.3) * 100);
    const hardnessVal = Math.round((b.hardness ?? 0.8) * 100);
    const roundnessVal = Math.round((b.roundness ?? 1.0) * 100);
    const opacityVal = Math.round((b.opacity ?? 1.0) * 100);

    const minSize = Math.max(1, Math.round(b.minSize || 1));
    const maxSize = Math.max(minSize + 1, Math.round(b.maxSize || 200));
    b.size = Math.max(minSize, Math.min(maxSize, b.size || 12));

    this.container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column;">
        <!-- 1. LIVE STROKE PREVIEW (STICKY HEADER) -->
        <div class="brush-settings-preview-wrap" style="position: sticky; top: 0; z-index: 10; background: var(--panel); padding: 10px 16px; border-bottom: 1px solid var(--divider); flex-shrink: 0;">
          <canvas id="brush-live-stroke-preview" width="320" height="64" style="width: 100%; height: 64px; border-radius: 8px; display: block;"></canvas>
          <div class="brush-preview-meta" style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: var(--text-2);">
            <span class="brush-preview-title" style="font-weight: 600; color: var(--text);">${b.name}</span>
            <span class="brush-preview-size tabular" id="bs-preview-size-label">${b.size || 12}px (min ${minSize}px – max ${maxSize}px)</span>
          </div>
        </div>

        <div style="flex: 1; overflow-y: auto; padding: 12px 16px;">
          <!-- 2. SHAPE & TIP PRESETS -->
          <div class="section-header">Brush Tip & Shape</div>
          <div class="settings-dense-group">
            <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
              ${['round', 'square', 'chisel', 'star', 'bristle', 'soft'].map(ts => `
                <button class="dense-btn tip-shape-btn ${b.tipShape === ts ? 'active' : ''}" data-tip="${ts}" style="flex: 1; min-width: 44px; padding: 6px 4px; font-size: 11px; text-transform: capitalize; border-radius: 6px; border: 1px solid var(--border); background: ${b.tipShape === ts ? 'var(--accent)' : 'var(--control)'}; color: ${b.tipShape === ts ? '#ffffff' : 'var(--text)'};">${ts}</button>
              `).join('')}
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Aspect Ratio</span>
              <input type="range" class="dense-slider" id="bs-aspect-ratio" min="10" max="300" value="${Math.round((b.aspectRatio ?? 1.0) * 100)}">
              <span class="settings-slider-val" id="bs-aspect-ratio-val">${(b.aspectRatio ?? 1.0).toFixed(2)}x</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Hardness</span>
              <input type="range" class="dense-slider" id="bs-hardness" min="0" max="100" value="${hardnessVal}">
              <span class="settings-slider-val" id="bs-hardness-val">${hardnessVal}%</span>
            </div>
          </div>

          <!-- 3. SIZE & LIMITS SECTION -->
          <div class="section-header">Size & Range</div>
          <div class="settings-dense-group">
            <div class="settings-slider-row">
              <span class="settings-slider-label">Current Size</span>
              <input type="range" class="dense-slider" id="bs-size" min="${minSize}" max="${maxSize}" value="${b.size}">
              <span class="settings-slider-val" id="bs-size-val">${b.size}px</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Min Size</span>
              <input type="range" class="dense-slider" id="bs-min-size" min="1" max="100" value="${minSize}">
              <span class="settings-slider-val" id="bs-min-size-val">${minSize}px</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Max Size</span>
              <input type="range" class="dense-slider" id="bs-max-size" min="10" max="500" value="${maxSize}">
              <span class="settings-slider-val" id="bs-max-size-val">${maxSize}px</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Opacity</span>
              <input type="range" class="dense-slider" id="bs-opacity" min="1" max="100" value="${opacityVal}">
              <span class="settings-slider-val" id="bs-opacity-val">${opacityVal}%</span>
            </div>
          </div>

          <!-- 4. DYNAMICS LIVE TEST PREVIEW -->
          <div class="section-header">Dynamics Live Test</div>
          <div class="settings-dense-group" style="padding: 10px;">
            <canvas id="brush-dynamics-preview" width="300" height="84" style="width: 100%; height: 84px; border-radius: 6px; background: var(--control); display: block;"></canvas>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-3); margin-top: 5px;">
              <span>Slow (Low Velocity)</span>
              <span>Medium Speed</span>
              <span>Fast Flick (High Velocity)</span>
            </div>
          </div>

          <!-- 5. UNIFIED DYNAMICS (SOURCES & TARGET LINKS) -->
          <div class="section-header">Dynamics Source & Targets</div>
          <div class="factor-tabs-nav" style="display: flex; gap: 4px; margin-bottom: 8px;">
            <button class="factor-tab-btn ${curFactor === 'pressure' ? 'active' : ''}" data-factor="pressure" style="flex: 1; padding: 6px; font-size: 11px; border-radius: 6px; border: 1px solid var(--border); background: ${curFactor === 'pressure' ? 'var(--accent)' : 'var(--control)'}; color: ${curFactor === 'pressure' ? '#ffffff' : 'var(--text)'};">Pressure</button>
            <button class="factor-tab-btn ${curFactor === 'velocity' ? 'active' : ''}" data-factor="velocity" style="flex: 1; padding: 6px; font-size: 11px; border-radius: 6px; border: 1px solid var(--border); background: ${curFactor === 'velocity' ? 'var(--accent)' : 'var(--control)'}; color: ${curFactor === 'velocity' ? '#ffffff' : 'var(--text)'};">Velocity</button>
            <button class="factor-tab-btn ${curFactor === 'jitter' ? 'active' : ''}" data-factor="jitter" style="flex: 1; padding: 6px; font-size: 11px; border-radius: 6px; border: 1px solid var(--border); background: ${curFactor === 'jitter' ? 'var(--accent)' : 'var(--control)'}; color: ${curFactor === 'jitter' ? '#ffffff' : 'var(--text)'};">Jitter</button>
            <button class="factor-tab-btn ${curFactor === 'noise' ? 'active' : ''}" data-factor="noise" style="flex: 1; padding: 6px; font-size: 11px; border-radius: 6px; border: 1px solid var(--border); background: ${curFactor === 'noise' ? 'var(--accent)' : 'var(--control)'}; color: ${curFactor === 'noise' ? '#ffffff' : 'var(--text)'};">2D Noise</button>
          </div>
          <div class="settings-dense-group" id="factor-child-controls">
            <div class="settings-slider-row">
              <span class="settings-slider-label">→ Size</span>
              <input type="range" class="dense-slider" id="bs-fc-size" min="-100" max="100" value="${factorObj.size ?? 0}">
              <span class="settings-slider-val" id="bs-fc-size-val">${factorObj.size ?? 0}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">→ Opacity</span>
              <input type="range" class="dense-slider" id="bs-fc-opacity" min="-100" max="100" value="${factorObj.opacity ?? 0}">
              <span class="settings-slider-val" id="bs-fc-opacity-val">${factorObj.opacity ?? 0}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">→ Rotation</span>
              <input type="range" class="dense-slider" id="bs-fc-rotation" min="-100" max="100" value="${factorObj.rotation ?? 0}">
              <span class="settings-slider-val" id="bs-fc-rotation-val">${factorObj.rotation ?? 0}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">→ Spacing</span>
              <input type="range" class="dense-slider" id="bs-fc-spacing" min="-100" max="100" value="${factorObj.spacing ?? 0}">
              <span class="settings-slider-val" id="bs-fc-spacing-val">${factorObj.spacing ?? 0}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">→ Scatter</span>
              <input type="range" class="dense-slider" id="bs-fc-scatter" min="-100" max="100" value="${factorObj.scatter ?? 0}">
              <span class="settings-slider-val" id="bs-fc-scatter-val">${factorObj.scatter ?? 0}%</span>
            </div>
          </div>

          ${curFactor === 'noise' ? `
            <div class="section-header">2D Noise Settings</div>
            <div class="settings-dense-group">
              <div class="settings-slider-row">
                <span class="settings-slider-label">Noise Scale</span>
                <input type="range" class="dense-slider" id="bs-noise-scale" min="1" max="100" value="${Math.round((b.noiseScale || 0.02) * 1000)}">
                <span class="settings-slider-val" id="bs-noise-scale-val">${Math.round((b.noiseScale || 0.02) * 1000)}</span>
              </div>
              <div class="settings-slider-row">
                <span class="settings-slider-label">Octaves</span>
                <input type="range" class="dense-slider" id="bs-noise-octaves" min="1" max="5" value="${b.noiseOctaves || 2}">
                <span class="settings-slider-val" id="bs-noise-octaves-val">${b.noiseOctaves || 2}</span>
              </div>
            </div>
          ` : ''}

          <!-- 6. CORE STROKE & TEXTURE -->
          <div class="section-header">Stroke & Spacing</div>
          <div class="settings-dense-group">
            <div class="settings-slider-row">
              <span class="settings-slider-label">Spacing</span>
              <input type="range" class="dense-slider" id="bs-spacing" min="1" max="100" value="${spacingVal}">
              <span class="settings-slider-val" id="bs-spacing-val">${spacingVal}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Stream / Smoothing</span>
              <input type="range" class="dense-slider" id="bs-stabilizer" min="0" max="100" value="${stabilizerVal}">
              <span class="settings-slider-val" id="bs-stabilizer-val">${stabilizerVal}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Roundness</span>
              <input type="range" class="dense-slider" id="bs-roundness" min="10" max="100" value="${roundnessVal}">
              <span class="settings-slider-val" id="bs-roundness-val">${roundnessVal}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Grain</span>
              <input type="range" class="dense-slider" id="bs-grain" min="0" max="100" value="${grainVal}">
              <span class="settings-slider-val" id="bs-grain-val">${grainVal}%</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupSettingsEvents();
    this.drawSettingsStrokePreview();
    this.drawDynamicsPreview();
  }

  setupSettingsEvents() {
    const b = this.currentBrush;
    if (!b) return;

    const bindSlider = (id, onChange) => {
      const el = this.container.querySelector(`#${id}`);
      const valEl = this.container.querySelector(`#${id}-val`);
      if (!el || !valEl) return;
      el.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        onChange(val, valEl);
        this.updateMetaLabels();
        this.drawSettingsStrokePreview();
        this.drawDynamicsPreview();
        this.persistBrushSettings(b);
        this.onBrushChanged?.(this.currentBrush);
      });
    };

    // Tip shape buttons
    this.container.querySelectorAll('.tip-shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        b.tipShape = btn.dataset.tip;
        this.container.querySelectorAll('.tip-shape-btn').forEach(bb => {
          bb.classList.toggle('active', bb.dataset.tip === b.tipShape);
          bb.style.background = bb.dataset.tip === b.tipShape ? 'var(--accent)' : 'var(--control)';
          bb.style.color = bb.dataset.tip === b.tipShape ? '#ffffff' : 'var(--text)';
        });
        this.drawSettingsStrokePreview();
        this.drawDynamicsPreview();
        this.persistBrushSettings(b);
        this.onBrushChanged?.(this.currentBrush);
      });
    });

    // Aspect ratio & Hardness
    bindSlider('bs-aspect-ratio', (v, valEl) => {
      b.aspectRatio = v / 100;
      valEl.textContent = `${(v / 100).toFixed(2)}x`;
    });

    // Factor Tabs
    this.container.querySelectorAll('.factor-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeFactorTab = btn.dataset.factor;
        this.renderSettings();
      });
    });

    // Size & Limits - strictly synced
    bindSlider('bs-size', (v, valEl) => {
      b.size = v;
      valEl.textContent = `${Math.round(v)}px`;
    });

    bindSlider('bs-min-size', (v, valEl) => {
      b.minSize = Math.max(1, Math.round(v));
      if (b.minSize >= b.maxSize) b.maxSize = b.minSize + 1;
      b.size = Math.max(b.minSize, Math.min(b.maxSize, b.size));
      const sizeSlider = this.container.querySelector('#bs-size');
      if (sizeSlider) {
        sizeSlider.min = b.minSize;
        sizeSlider.max = b.maxSize;
        sizeSlider.value = b.size;
        const sizeVal = this.container.querySelector('#bs-size-val');
        if (sizeVal) sizeVal.textContent = `${Math.round(b.size)}px`;
      }
      const maxSlider = this.container.querySelector('#bs-max-size');
      if (maxSlider) maxSlider.value = b.maxSize;
      valEl.textContent = `${Math.round(b.minSize)}px`;
    });

    bindSlider('bs-max-size', (v, valEl) => {
      b.maxSize = Math.max(2, Math.round(v));
      if (b.maxSize <= b.minSize) b.minSize = Math.max(1, b.maxSize - 1);
      b.size = Math.max(b.minSize, Math.min(b.maxSize, b.size));
      const sizeSlider = this.container.querySelector('#bs-size');
      if (sizeSlider) {
        sizeSlider.min = b.minSize;
        sizeSlider.max = b.maxSize;
        sizeSlider.value = b.size;
        const sizeVal = this.container.querySelector('#bs-size-val');
        if (sizeVal) sizeVal.textContent = `${Math.round(b.size)}px`;
      }
      const minSlider = this.container.querySelector('#bs-min-size');
      if (minSlider) minSlider.value = b.minSize;
      valEl.textContent = `${Math.round(b.maxSize)}px`;
    });

    bindSlider('bs-opacity', (v, valEl) => {
      b.opacity = v / 100;
      valEl.textContent = `${Math.round(v)}%`;
    });

    // Unified Dynamics Sliders
    const curFactor = this.activeFactorTab || 'velocity';
    if (!b.dynamics) {
      b.dynamics = {
        pressure: { size: 100, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
        velocity: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
        jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
        noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
      };
    }
    if (!b.dynamics[curFactor]) {
      b.dynamics[curFactor] = { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 };
    }

    bindSlider('bs-fc-size', (v, valEl) => {
      b.dynamics[curFactor].size = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-fc-opacity', (v, valEl) => {
      b.dynamics[curFactor].opacity = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-fc-rotation', (v, valEl) => {
      b.dynamics[curFactor].rotation = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-fc-spacing', (v, valEl) => {
      b.dynamics[curFactor].spacing = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-fc-scatter', (v, valEl) => {
      b.dynamics[curFactor].scatter = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    if (curFactor === 'noise') {
      bindSlider('bs-noise-scale', (v, valEl) => {
        b.noiseScale = v / 1000;
        valEl.textContent = `${Math.round(v)}`;
      });
      bindSlider('bs-noise-octaves', (v, valEl) => {
        b.noiseOctaves = Math.round(v);
        valEl.textContent = `${Math.round(v)}`;
      });
    }

    // Core stroke & texture sliders
    bindSlider('bs-spacing', (v, valEl) => {
      b.spacing = v / 100;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-stabilizer', (v, valEl) => {
      b.stabilizerStrength = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-roundness', (v, valEl) => {
      b.roundness = v / 100;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-grain', (v, valEl) => {
      b.grain = v / 100;
      valEl.textContent = `${Math.round(v)}%`;
    });
  }

  drawDynamicsPreview() {
    const canvas = this.container.querySelector('#brush-dynamics-preview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const b = this.currentBrush;
    if (!b) return;

    const color = this.currentColor || '#3B6EDC';
    const dyn = b.dynamics || {};
    const dP = dyn.pressure || {};
    const dV = dyn.velocity || {};

    const strokes = [
      { y: 20, v: 0.2, pStart: 0.2, pEnd: 0.8 },
      { y: 44, v: 1.0, pStart: 0.5, pEnd: 0.5 },
      { y: 68, v: 3.5, pStart: 0.8, pEnd: 0.1 }
    ];

    ctx.save();
    for (const st of strokes) {
      const vFactor = Math.min(1.5, Math.max(-1.0, (st.v - 0.6) / 0.8));
      const step = Math.max(1.8, (b.size || 8) * (b.spacing || 0.1));

      for (let x = 12; x < w - 12; x += step) {
        const t = (x - 12) / (w - 24);
        const pNorm = st.pStart + t * (st.pEnd - st.pStart);
        const pFactor = (pNorm - 0.5) * 2;

        let sizeMod = 1.0;
        if (dP.size) sizeMod += (dP.size / 100) * pFactor;
        if (dV.size) sizeMod += (dV.size / 100) * vFactor;

        let r = Math.max(0.5, ((b.size || 8) / 2) * Math.max(0.05, sizeMod));
        r = Math.max((b.minSize || 1) / 2, Math.min((b.maxSize || 200) / 2, r));

        let alphaMod = 0;
        if (dP.opacity) alphaMod += (dP.opacity / 100) * pFactor;
        if (dV.opacity) alphaMod += (dV.opacity / 100) * vFactor;
        const alpha = Math.max(0.05, Math.min(1.0, (b.opacity ?? 1.0) * Math.max(0, 1.0 + alphaMod)));

        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, st.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  updateMetaLabels() {
    const b = this.currentBrush;
    if (!b) return;
    const label = this.container.querySelector('#bs-preview-size-label');
    if (label) {
      label.textContent = `${Math.round(b.size || 12)}px (min ${Math.round(b.minSize || 1)}px – max ${Math.round(b.maxSize || 200)}px)`;
    }
  }

  drawSettingsStrokePreview() {
    const canvas = this.container.querySelector('#brush-live-stroke-preview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle sleek dark background
    ctx.fillStyle = '#141722';
    ctx.fillRect(0, 0, w, h);

    const b = this.currentBrush;
    if (!b) return;

    // Generate simulated smooth S-curve
    const pts = [];
    const steps = 70;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = 20 + u * (w - 40);
      const y = h / 2 + Math.sin(u * Math.PI * 2) * (h * 0.28);
      const speedNorm = Math.sin(u * Math.PI);
      pts.push({ x, y, u, speed: speedNorm * 1.5, pressure: 0.35 + speedNorm * 0.55 });
    }

    const color = this.currentColor || '#8b5cf6';
    const baseSize = Math.max(1, b.size || 12);
    const minR = Math.max(0.25, (b.minSize || 1) / 2);
    const maxR = Math.max(minR + 0.5, (b.maxSize || 200) / 2);

    const dyn = b.dynamics || {};
    const dP = dyn.pressure || {};
    const dV = dyn.velocity || {};
    const dJ = dyn.jitter || {};
    const dN = dyn.noise || {};

    ctx.save();
    ctx.fillStyle = b.isEraser ? '#ffffff' : color;
    ctx.strokeStyle = b.isEraser ? '#ffffff' : color;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const pFactor = (p.pressure - 0.5) * 2.0;
      const vFactor = Math.min(1.5, Math.max(-1.0, (p.speed - 0.6) / 0.8));
      const jVal = ((Math.sin(i * 1337.7) * 43758.5453) % 1.0);
      const nVal = Math.sin(i * 0.18) * 0.7;

      let sizeMod = 1.0;
      if (dP.size) sizeMod += (dP.size / 100) * pFactor;
      if (dV.size) sizeMod += (dV.size / 100) * vFactor;
      if (dJ.size) sizeMod += (dJ.size / 100) * jVal;
      if (dN.size) sizeMod += (dN.size / 100) * nVal;

      let r = ((baseSize * p.pressure) / 2) * Math.max(0.05, sizeMod);
      r = Math.max(minR, Math.min(maxR, r));

      let alphaMod = 0;
      if (dP.opacity) alphaMod += (dP.opacity / 100) * pFactor;
      if (dV.opacity) alphaMod += (dV.opacity / 100) * vFactor;
      if (dJ.opacity) alphaMod += (dJ.opacity / 100) * jVal;
      if (dN.opacity) alphaMod += (dN.opacity / 100) * nVal;
      let alpha = Math.max(0.05, Math.min(1.0, (b.opacity ?? 1.0) * Math.max(0, 1.0 + alphaMod)));

      let rot = (b.rotation || 0) * (Math.PI / 180);
      if (dP.rotation) rot += (dP.rotation / 100) * pFactor * Math.PI;
      if (dV.rotation) rot += (dV.rotation / 100) * vFactor * Math.PI;
      if (dJ.rotation) rot += (dJ.rotation / 100) * jVal * Math.PI;
      if (dN.rotation) rot += (dN.rotation / 100) * nVal * Math.PI;

      const totalAngle = rot;
      const aspect = Math.max(0.1, b.aspectRatio ?? 1.0);
      const rx = Math.max(0.5, r * Math.sqrt(aspect));
      const ry = Math.max(0.5, r / Math.sqrt(aspect));

      ctx.globalAlpha = alpha;

      const shape = b.tipShape || 'round';
      if (shape === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(totalAngle);
        ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
        ctx.restore();
      } else if (shape === 'chisel') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(totalAngle + 0.785);
        ctx.fillRect(-rx * 1.8, -ry * 0.45, rx * 3.6, ry * 0.9);
        ctx.restore();
      } else if (shape === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(totalAngle);
        ctx.beginPath();
        for (let s = 0; s < 5; s++) {
          const aOuter = (s * Math.PI * 2) / 5 - Math.PI / 2;
          const aInner = aOuter + Math.PI / 5;
          const xo = Math.cos(aOuter) * rx;
          const yo = Math.sin(aOuter) * ry;
          const xi = Math.cos(aInner) * (rx * 0.45);
          const yi = Math.sin(aInner) * (ry * 0.45);
          if (s === 0) ctx.moveTo(xo, yo);
          else ctx.lineTo(xo, yo);
          ctx.lineTo(xi, yi);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (shape === 'bristle') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(totalAngle);
        const dotCount = 5;
        for (let d = -dotCount / 2; d <= dotCount / 2; d++) {
          ctx.beginPath();
          ctx.arc(d * (rx / 2.5), 0, Math.max(0.4, ry * 0.35), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (shape === 'soft' || (b.hardness ?? 1.0) < 0.5) {
        const rad = Math.max(1, r);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(totalAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawLivePreview() {
    this.drawLibraryPreviews();
    this.drawSettingsStrokePreview();
  }

  drawLibraryPreviews() {
    this.container.querySelectorAll('.brush-stroke-thumb').forEach(canvas => {
      const id = canvas.dataset.id;
      const b = this.brushes.find(brush => brush.id === id);
      if (!b) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = this.currentColor || '#3B6EDC';
      ctx.beginPath();
      for (let x = 6; x < w - 6; x += 2.5) {
        const y = h / 2 + Math.sin((x / w) * Math.PI * 2) * 4;
        const rad = Math.max(0.8, (b.size / 16) * 2);
        ctx.arc(x, y, rad, 0, Math.PI * 2);
      }
      ctx.fill();
    });
  }
}
