/**
 * Vectura Brush Panel & Comprehensive Brush Editor
 * 25+ brush library with category tabs, live previews, and coherent noise graph.
 */
import { BRUSH_CATEGORIES, DEFAULT_BRUSH_PRESETS } from '../brushes/BrushPresets.js';
import { Brush } from '../brushes/Brush.js';
import { CoherentNoise } from '../engine/CoherentNoise.js';

export class BrushPanel {
  constructor(containerEl, currentBrush, onBrushChanged) {
    this.container = containerEl;
    this.currentBrush = currentBrush;
    this.onBrushChanged = onBrushChanged;

    this.activeTab = 'library'; // 'library' | 'editor'
    this.activeCategory = 'ink';
    this.brushes = DEFAULT_BRUSH_PRESETS.map(p => new Brush(p));

    this.render();
  }

  setBrush(brush) {
    this.currentBrush = brush;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
        <!-- Mode Tabs -->
        <div style="display: flex; border-bottom: 1px solid var(--glass-border); padding-bottom: 8px; gap: 8px;">
          <button id="bp-tab-lib" class="glass-btn ${this.activeTab === 'library' ? 'active' : ''}" style="flex: 1;">
            Library (${this.brushes.length})
          </button>
          <button id="bp-tab-edit" class="glass-btn ${this.activeTab === 'editor' ? 'active' : ''}" style="flex: 1;">
            Editor & Noise
          </button>
        </div>

        ${this.activeTab === 'library' ? this.renderLibraryHTML() : this.renderEditorHTML()}
      </div>
    `;

    this.setupEvents();
    if (this.activeTab === 'library') {
      this.drawLibraryPreviews();
    } else {
      this.drawEditorPreviews();
    }
  }

  renderLibraryHTML() {
    const categoryTabs = BRUSH_CATEGORIES.map(
      cat => `
      <button class="glass-btn bp-cat-btn ${this.activeCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}" style="padding: 4px 10px; font-size: 11px; min-height: 32px;">
        ${cat.name}
      </button>
    `
    ).join('');

    const filtered = this.brushes.filter(b => b.category === this.activeCategory);

    const cards = filtered.map(b => {
      const isSelected = this.currentBrush && this.currentBrush.id === b.id;
      return `
        <div class="glass-panel bp-brush-card" data-id="${b.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; cursor: pointer; border-color: ${isSelected ? 'var(--accent-primary)' : 'var(--glass-border)'}; background: ${isSelected ? 'var(--glass-bg-active)' : 'var(--glass-bg)'};">
          <div style="display: flex; flex-direction: column; flex: 1;">
            <span style="font-size: 13px; font-weight: 600; color: ${isSelected ? 'var(--text-main)' : 'var(--text-muted)'};">${b.name}</span>
            <span style="font-size: 11px; color: var(--text-dim);">${b.size}px • Stab ${b.stabilizer}%</span>
          </div>
          <div style="width: 100px; height: 32px; border-radius: var(--radius-sm); background: rgba(0,0,0,0.25); overflow: hidden;">
            <canvas class="bp-preview-canvas" data-id="${b.id}" width="100" height="32" style="width: 100%; height: 100%;"></canvas>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!-- Category Tabs -->
      <div style="display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px;">
        ${categoryTabs}
      </div>

      <!-- Brush Cards Grid -->
      <div id="bp-cards-list" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 52vh; padding-right: 4px;">
        ${cards}
      </div>
    `;
  }

  renderEditorHTML() {
    const b = this.currentBrush;
    if (!b) return `<div>No brush selected</div>`;

    return `
      <div style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; max-height: 60vh; padding-right: 6px;">
        <!-- Live Stroke Test Canvas -->
        <div style="width: 100%; height: 50px; border-radius: var(--radius-md); background: #1a202c; border: 1px solid var(--glass-border); overflow: hidden;">
          <canvas id="bp-editor-stroke-preview" width="300" height="50" style="width: 100%; height: 100%;"></canvas>
        </div>

        <!-- Slider Controls -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Base Size</span>
              <span>${b.size} px</span>
            </div>
            <input type="range" class="glass-slider bp-param-input" data-param="size" min="1" max="150" value="${b.size}" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Opacity</span>
              <span>${Math.round(b.opacity * 100)}%</span>
            </div>
            <input type="range" class="glass-slider bp-param-input" data-param="opacity" min="5" max="100" value="${Math.round(b.opacity * 100)}" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Hardness</span>
              <span>${Math.round(b.hardness * 100)}%</span>
            </div>
            <input type="range" class="glass-slider bp-param-input" data-param="hardness" min="0" max="100" value="${Math.round(b.hardness * 100)}" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Stabilizer Strength</span>
              <span>${b.stabilizer}%</span>
            </div>
            <input type="range" class="glass-slider bp-param-input" data-param="stabilizer" min="0" max="100" value="${b.stabilizer}" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Taper Length</span>
              <span>${b.taperEnd || 0}</span>
            </div>
            <input type="range" class="glass-slider bp-param-input" data-param="taperEnd" min="0" max="60" value="${b.taperEnd || 0}" />
          </div>
        </div>

        <!-- Coherent Noise Jitter Section -->
        <div style="padding: 10px; background: rgba(0,0,0,0.22); border-radius: var(--radius-md); border: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 600;">Coherent 1D Noise Jitter</span>
            <input type="checkbox" id="bp-jitter-toggle" ${b.jitter && b.jitter.enabled ? 'checked' : ''} />
          </div>
          <div style="width: 100%; height: 36px; background: #0c0f17; border-radius: var(--radius-sm); overflow: hidden;">
            <canvas id="bp-noise-graph" width="280" height="36" style="width: 100%; height: 100%;"></canvas>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted);">
            <span>Smooth undulating wave (non-random)</span>
          </div>
        </div>
      </div>
    `;
  }

  setupEvents() {
    this.container.querySelector('#bp-tab-lib')?.addEventListener('click', () => {
      this.activeTab = 'library';
      this.render();
    });

    this.container.querySelector('#bp-tab-edit')?.addEventListener('click', () => {
      this.activeTab = 'editor';
      this.render();
    });

    // Category buttons
    this.container.querySelectorAll('.bp-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeCategory = btn.dataset.cat;
        this.render();
      });
    });

    // Brush card selection
    this.container.querySelectorAll('.bp-brush-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const found = this.brushes.find(b => b.id === id);
        if (found) {
          this.currentBrush = found;
          this.onBrushChanged?.(found);
          this.render();
        }
      });
    });

    // Parameter sliders in Editor
    this.container.querySelectorAll('.bp-param-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const param = e.target.dataset.param;
        let val = parseFloat(e.target.value);
        if (param === 'opacity' || param === 'hardness') val /= 100;
        this.currentBrush[param] = val;
        this.drawEditorPreviews();
        this.onBrushChanged?.(this.currentBrush);
      });
    });

    // Jitter toggle
    this.container.querySelector('#bp-jitter-toggle')?.addEventListener('change', (e) => {
      if (!this.currentBrush.jitter) this.currentBrush.jitter = { enabled: false };
      this.currentBrush.jitter.enabled = e.target.checked;
      this.drawEditorPreviews();
      this.onBrushChanged?.(this.currentBrush);
    });
  }

  drawLibraryPreviews() {
    this.container.querySelectorAll('.bp-preview-canvas').forEach(cvs => {
      const id = cvs.dataset.id;
      const brush = this.brushes.find(b => b.id === id);
      if (!brush) return;

      const ctx = cvs.getContext('2d');
      ctx.clearRect(0, 0, 100, 32);

      // Draw horizontal S-curve preview stroke
      ctx.strokeStyle = brush.isEraser ? '#64748b' : '#8b5cf6';
      ctx.lineWidth = Math.min(18, brush.size);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(10, 16);
      ctx.bezierCurveTo(35, 6, 65, 26, 90, 16);
      ctx.stroke();
    });
  }

  drawEditorPreviews() {
    const strokeCvs = this.container.querySelector('#bp-editor-stroke-preview');
    if (strokeCvs) {
      const ctx = strokeCvs.getContext('2d');
      ctx.clearRect(0, 0, 300, 50);

      const b = this.currentBrush;
      ctx.strokeStyle = b.isEraser ? '#64748b' : '#8b5cf6';
      ctx.lineWidth = Math.min(26, b.size);
      ctx.lineCap = 'round';
      ctx.globalAlpha = b.opacity;

      ctx.beginPath();
      ctx.moveTo(20, 25);
      ctx.bezierCurveTo(90, 8, 180, 42, 280, 25);
      ctx.stroke();
    }

    const noiseCvs = this.container.querySelector('#bp-noise-graph');
    if (noiseCvs) {
      const ctx = noiseCvs.getContext('2d');
      ctx.clearRect(0, 0, 280, 36);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let x = 0; x < 280; x += 2) {
        const val = CoherentNoise.layeredSines(x * 0.05, 42, 3);
        const y = 18 + val * 12;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}
