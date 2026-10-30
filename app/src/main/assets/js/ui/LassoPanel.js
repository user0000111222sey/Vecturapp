/**
 * Vectura Lasso Studio & Settings Panel (LassoPanel.js)
 * Clean, professional inspector for the Vectura Lasso Engine:
 * - Library tab: 4 pre-made lasso brushes (Precise, Smooth, Angular, Loose)
 * - Settings tab: Polygon simplification, sharp-turn threshold, velocity point count,
 *   fill modes (Color / Pattern), pattern properties (Dots, Squares, Lines, Crosshatch),
 *   and interactive live preview canvas.
 */
import { createPatternTileCanvas } from '../tools/LassoFill.js';

export class LassoPanel {
  constructor(containerEl, lassoEngine, app) {
    this.container = containerEl;
    this.engine = lassoEngine;
    this.app = app;

    this.activeTab = 'library'; // 'library' | 'settings'
    this.init();
  }

  init() {
    this.syncHeaderTabs();
    this.render();
  }

  setTab(tab) {
    this.activeTab = tab === 'settings' ? 'settings' : 'library';
    this.syncHeaderTabs();
    this.render();
  }

  syncHeaderTabs() {
    const tabLib = document.getElementById('lp-tab-library');
    const tabSet = document.getElementById('lp-tab-settings');
    if (tabLib && tabSet) {
      tabLib.classList.toggle('active', this.activeTab === 'library');
      tabSet.classList.toggle('active', this.activeTab === 'settings');
    }
  }

  render() {
    if (!this.container) return;

    if (this.activeTab === 'library') {
      this.renderLibrary();
    } else {
      this.renderSettings();
    }
  }

  renderLibrary() {
    const presets = this.engine.presets;
    const activeId = this.engine.activePresetId;

    this.container.innerHTML = `
      <div class="lasso-library-wrap" style="padding: 14px; display: flex; flex-direction: column; gap: 10px;">
        <div style="font-size: 12px; color: var(--text-2); margin-bottom: 2px;">Select a lasso brush preset:</div>
        <div class="lasso-presets-list" style="display: flex; flex-direction: column; gap: 8px;">
          ${presets.map(p => {
            const isActive = p.id === activeId;
            return `
              <div class="lasso-card ${isActive ? 'active' : ''}" data-id="${p.id}" style="
                background: ${isActive ? 'var(--selected)' : 'var(--card)'};
                border: 1px solid ${isActive ? 'var(--accent)' : 'var(--border)'};
                border-radius: var(--radius-md);
                padding: 12px 14px;
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                user-select: none;
                transition: border-color 0.15s ease, background 0.15s ease;
              ">
                <div class="lasso-card-icon" style="
                  width: 44px;
                  height: 44px;
                  border-radius: var(--radius-sm);
                  background: var(--control);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex-shrink: 0;
                ">
                  <canvas id="lasso-thumb-${p.id}" width="40" height="40" style="width: 40px; height: 40px;"></canvas>
                </div>
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                    <span style="font-weight: 600; font-size: 14px; color: var(--text);">${p.name}</span>
                    <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--control); color: var(--text-2);">
                      ${p.polyCount > 80 ? 'Ultra-Dense' : (p.polyCount > 40 ? 'Smooth' : 'Low-Poly')}
                    </span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-2); margin-top: 3px; line-height: 1.35;">
                    ${p.description}
                  </div>
                </div>
                ${isActive ? `
                  <div style="color: var(--accent); display: flex; align-items: center;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Draw preview thumbnails for each preset card
    setTimeout(() => {
      presets.forEach(p => this.drawPresetThumb(p));
    }, 10);

    // Click on preset card
    this.container.querySelectorAll('.lasso-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.engine.applyPreset(id, true);
        this.render();
      });
    });
  }

  drawPresetThumb(preset) {
    const canvas = document.getElementById(`lasso-thumb-${preset.id}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 40, 40);
    const color = this.app?.vectorCanvas?.currentColor || '#6366f1';

    ctx.save();
    ctx.beginPath();
    if (preset.id === 'precise') {
      // High-density contour polygon
      const poly = [
        { x: 8, y: 20 }, { x: 12, y: 12 }, { x: 20, y: 8 }, { x: 28, y: 11 },
        { x: 34, y: 18 }, { x: 32, y: 28 }, { x: 22, y: 34 }, { x: 12, y: 31 }
      ];
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    } else if (preset.id === 'smooth') {
      const poly = [
        { x: 10, y: 14 }, { x: 20, y: 8 }, { x: 32, y: 16 }, { x: 30, y: 28 },
        { x: 20, y: 34 }, { x: 10, y: 26 }
      ];
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    } else if (preset.id === 'angular') {
      // Low-poly polygon
      ctx.moveTo(8, 10);
      ctx.lineTo(32, 8);
      ctx.lineTo(34, 28);
      ctx.lineTo(20, 34);
      ctx.lineTo(6, 26);
    } else {
      // Loose 3-4 vertex facet
      ctx.moveTo(6, 14);
      ctx.lineTo(34, 10);
      ctx.lineTo(26, 32);
    }
    ctx.closePath();

    ctx.fillStyle = color + '40';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  renderSettings() {
    const e = this.engine;
    const color = this.app?.vectorCanvas?.currentColor || '#6366f1';

    this.container.innerHTML = `
      <div class="lasso-settings-wrap" style="padding: 14px; display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Live Preview Canvas -->
        <div class="section-header">Live Polygon Preview</div>
        <div class="settings-dense-group" style="padding: 10px; display: flex; flex-direction: column; align-items: center; background: var(--control); border-radius: var(--radius-md);">
          <canvas id="lasso-live-preview-canvas" width="280" height="90" style="width: 100%; max-width: 280px; height: 90px; border-radius: 6px; background: var(--panel); border: 1px solid var(--border);"></canvas>
          <div style="font-size: 11px; color: var(--text-3); margin-top: 6px;">Adjust parameters below to see real-time geometry updates</div>
        </div>

        <!-- 1. Polygon Geometry & Simplification -->
        <div class="section-header">Polygon Geometry</div>
        <div class="settings-dense-group">
          <!-- Polygon Count -->
          <div class="settings-slider-row">
            <span class="settings-slider-label">Polygon Count</span>
            <input type="range" class="dense-slider" id="ls-poly-count" min="1" max="100" value="${e.polyCount}">
            <span class="settings-slider-val" id="ls-poly-count-val">${e.polyCount}%</span>
          </div>

          <!-- Sharp Turn Threshold Angle -->
          <div class="settings-slider-row">
            <span class="settings-slider-label">Corner Angle</span>
            <input type="range" class="dense-slider" id="ls-corner-angle" min="15" max="90" value="${e.sharpTurnAngle}">
            <span class="settings-slider-val" id="ls-corner-angle-val">${e.sharpTurnAngle}°</span>
          </div>
        </div>

        <!-- 2. Dynamic Velocity Point Density -->
        <div class="section-header">Velocity Point Count</div>
        <div class="settings-dense-group">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 500; color: var(--text);">Speed Adaptive Count</span>
              <span style="font-size: 11px; color: var(--text-2);">Fewer vertices on fast strokes, more on slow</span>
            </div>
            <input type="checkbox" id="ls-velocity-toggle" ${e.velocityEnabled ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--accent); cursor: pointer;" />
          </div>

          <div class="settings-slider-row ${e.velocityEnabled ? '' : 'disabled'}" id="ls-velocity-amount-row" style="opacity: ${e.velocityEnabled ? '1' : '0.4'};">
            <span class="settings-slider-label">Speed Influence</span>
            <input type="range" class="dense-slider" id="ls-velocity-amount" min="0" max="100" value="${e.velocityAmount}" ${e.velocityEnabled ? '' : 'disabled'}>
            <span class="settings-slider-val" id="ls-velocity-amount-val">${e.velocityAmount}%</span>
          </div>
        </div>

        <!-- 3. Fill Mode & Pattern Options -->
        <div class="section-header">Fill Mode</div>
        <div class="settings-dense-group">
          <!-- Segmented Control: Color vs Pattern -->
          <div style="display: flex; gap: 6px; margin-bottom: 8px;">
            <button id="ls-mode-color" class="btn-text ${e.fillMode === 'color' ? 'accent' : ''}" style="flex: 1; min-height: 34px; font-size: 13px;">Solid Color</button>
            <button id="ls-mode-pattern" class="btn-text ${e.fillMode === 'pattern' ? 'accent' : ''}" style="flex: 1; min-height: 34px; font-size: 13px;">Pattern Fill</button>
          </div>

          <!-- Pattern Sub-options -->
          <div id="ls-pattern-options" style="display: ${e.fillMode === 'pattern' ? 'flex' : 'none'}; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="settings-slider-label">Pattern Type</span>
              <select id="ls-pattern-type" class="dense-select" style="
                background: var(--control);
                color: var(--text);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 4px 8px;
                font-size: 12px;
              ">
                <option value="dots" ${e.pattern.type === 'dots' ? 'selected' : ''}>Dots</option>
                <option value="squares" ${e.pattern.type === 'squares' ? 'selected' : ''}>Squares</option>
                <option value="vertical-lines" ${e.pattern.type === 'vertical-lines' ? 'selected' : ''}>Vertical Lines</option>
                <option value="horizontal-lines" ${e.pattern.type === 'horizontal-lines' ? 'selected' : ''}>Horizontal Lines</option>
                <option value="crosshatch" ${e.pattern.type === 'crosshatch' ? 'selected' : ''}>Crosshatch</option>
              </select>
            </div>

            <div class="settings-slider-row">
              <span class="settings-slider-label">Pattern Size</span>
              <input type="range" class="dense-slider" id="ls-pat-size" min="2" max="64" value="${e.pattern.size || 8}">
              <span class="settings-slider-val" id="ls-pat-size-val">${e.pattern.size || 8}px</span>
            </div>

            <div class="settings-slider-row">
              <span class="settings-slider-label">Spacing</span>
              <input type="range" class="dense-slider" id="ls-pat-spacing" min="4" max="80" value="${e.pattern.spacing || 18}">
              <span class="settings-slider-val" id="ls-pat-spacing-val">${e.pattern.spacing || 18}px</span>
            </div>

            <div class="settings-slider-row">
              <span class="settings-slider-label">Line Width</span>
              <input type="range" class="dense-slider" id="ls-pat-width" min="1" max="24" value="${e.pattern.lineWidth || 2}">
              <span class="settings-slider-val" id="ls-pat-width-val">${e.pattern.lineWidth || 2}px</span>
            </div>

            <div class="settings-slider-row">
              <span class="settings-slider-label">Angle</span>
              <input type="range" class="dense-slider" id="ls-pat-angle" min="0" max="360" value="${e.pattern.angle || 0}">
              <span class="settings-slider-val" id="ls-pat-angle-val">${e.pattern.angle || 0}°</span>
            </div>
          </div>
        </div>

        <!-- Reset Button -->
        <div style="margin-top: 6px;">
          <button id="ls-reset-btn" class="btn-text" style="width: 100%; min-height: 36px; font-size: 12px; color: var(--text-2);">
            Reset Active Lasso to Defaults
          </button>
        </div>

      </div>
    `;

    this.setupSettingsEvents();
    this.drawLivePreview();
  }

  setupSettingsEvents() {
    const e = this.engine;

    // Polygon Count slider
    const polySlider = this.container.querySelector('#ls-poly-count');
    const polyVal = this.container.querySelector('#ls-poly-count-val');
    polySlider?.addEventListener('input', (ev) => {
      const v = parseInt(ev.target.value, 10);
      e.polyCount = v;
      if (polyVal) polyVal.textContent = `${v}%`;
      e.persistActivePresetSettings();
      this.drawLivePreview();
    });

    // Corner Angle slider
    const cornerSlider = this.container.querySelector('#ls-corner-angle');
    const cornerVal = this.container.querySelector('#ls-corner-angle-val');
    cornerSlider?.addEventListener('input', (ev) => {
      const v = parseInt(ev.target.value, 10);
      e.sharpTurnAngle = v;
      if (cornerVal) cornerVal.textContent = `${v}°`;
      e.persistActivePresetSettings();
      this.drawLivePreview();
    });

    // Velocity Toggle
    const velToggle = this.container.querySelector('#ls-velocity-toggle');
    const velAmountRow = this.container.querySelector('#ls-velocity-amount-row');
    const velAmountSlider = this.container.querySelector('#ls-velocity-amount');
    velToggle?.addEventListener('change', (ev) => {
      e.velocityEnabled = ev.target.checked;
      if (velAmountRow) velAmountRow.style.opacity = e.velocityEnabled ? '1' : '0.4';
      if (velAmountSlider) velAmountSlider.disabled = !e.velocityEnabled;
      e.persistActivePresetSettings();
      this.drawLivePreview();
    });

    // Velocity Amount
    const velAmountVal = this.container.querySelector('#ls-velocity-amount-val');
    velAmountSlider?.addEventListener('input', (ev) => {
      const v = parseInt(ev.target.value, 10);
      e.velocityAmount = v;
      if (velAmountVal) velAmountVal.textContent = `${v}%`;
      e.persistActivePresetSettings();
      this.drawLivePreview();
    });

    // Fill Mode buttons
    const modeColorBtn = this.container.querySelector('#ls-mode-color');
    const modePatBtn = this.container.querySelector('#ls-mode-pattern');
    const patWrap = this.container.querySelector('#ls-pattern-options');

    modeColorBtn?.addEventListener('click', () => {
      e.fillMode = 'color';
      modeColorBtn.classList.add('accent');
      modePatBtn?.classList.remove('accent');
      if (patWrap) patWrap.style.display = 'none';
      e.persistActivePresetSettings();
      this.drawLivePreview();
    });

    modePatBtn?.addEventListener('click', () => {
      e.fillMode = 'pattern';
      modePatBtn.classList.add('accent');
      modeColorBtn?.classList.remove('accent');
      if (patWrap) patWrap.style.display = 'flex';
      e.persistActivePresetSettings();
      this.drawLivePreview();
    });

    // Pattern Type dropdown
    this.container.querySelector('#ls-pattern-type')?.addEventListener('change', (ev) => {
      e.pattern.type = ev.target.value;
      e.persistActivePresetSettings();
      this.drawLivePreview();
    });

    // Pattern Size
    const patSizeSlider = this.container.querySelector('#ls-pat-size');
    const patSizeVal = this.container.querySelector('#ls-pat-size-val');
    patSizeSlider?.addEventListener('input', (ev) => {
      const v = parseInt(ev.target.value, 10);
      e.pattern.size = v;
      if (patSizeVal) patSizeVal.textContent = `${v}px`;
      e.persistActivePresetSettings();
      this.drawLivePreview();
    });

    // Pattern Spacing
    const patSpacSlider = this.container.querySelector('#ls-pat-spacing');
    const patSpacVal = this.container.querySelector('#ls-pat-spacing-val');
    patSpacSlider?.addEventListener('input', (ev) => {
      const v = parseInt(ev.target.value, 10);
      e.pattern.spacing = v;
      if (patSpacVal) patSpacVal.textContent = `${v}px`;
      e.persistActivePresetSettings();
      this.drawLivePreview();
    });

    // Pattern Line Width
    const patWidthSlider = this.container.querySelector('#ls-pat-width');
    const patWidthVal = this.container.querySelector('#ls-pat-width-val');
    patWidthSlider?.addEventListener('input', (ev) => {
      const v = parseInt(ev.target.value, 10);
      e.pattern.lineWidth = v;
      if (patWidthVal) patWidthVal.textContent = `${v}px`;
      e.persistActivePresetSettings();
      this.drawLivePreview();
    });

    // Pattern Angle
    const patAngleSlider = this.container.querySelector('#ls-pat-angle');
    const patAngleVal = this.container.querySelector('#ls-pat-angle-val');
    patAngleSlider?.addEventListener('input', (ev) => {
      const v = parseInt(ev.target.value, 10);
      e.pattern.angle = v;
      if (patAngleVal) patAngleVal.textContent = `${v}°`;
      e.persistActivePresetSettings();
      this.drawLivePreview();
    });

    // Reset button
    this.container.querySelector('#ls-reset-btn')?.addEventListener('click', () => {
      try {
        localStorage.removeItem(`vectura_lasso_preset_${e.activePresetId}`);
      } catch (_) {}
      e.applyPreset(e.activePresetId, true);
      this.render();
    });
  }

  drawLivePreview() {
    const canvas = document.getElementById('lasso-live-preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const color = this.app?.vectorCanvas?.currentColor || '#6366f1';
    const e = this.engine;

    // Build a stylized demo polygon path with sharp and gentle corners
    const pts = [
      { x: 30, y: 45, isCritical: true },
      { x: 75, y: 15, isCritical: false },
      { x: 140, y: 22, isCritical: false },
      { x: 210, y: 12, isCritical: true }, // Sharp corner
      { x: 255, y: 50, isCritical: false },
      { x: 220, y: 78, isCritical: false },
      { x: 130, y: 72, isCritical: true }, // Sharp corner
      { x: 55, y: 78, isCritical: false }
    ];

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();

    if (e.fillMode === 'pattern') {
      ctx.clip();
      const patCanvas = createPatternTileCanvas(e.pattern, color, 0.85);
      if (patCanvas) {
        const pat = ctx.createPattern(patCanvas, 'repeat');
        if (pat) {
          if (e.pattern.angle && typeof DOMMatrix !== 'undefined') {
            try {
              pat.setTransform(new DOMMatrix().rotate(e.pattern.angle));
            } catch (_) {}
          }
          ctx.fillStyle = pat;
          ctx.fillRect(0, 0, w, h);
        }
      }
    } else {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
    }
    ctx.restore();

    // Outline and vertex indicators
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();

    ctx.setLineDash([]);
    for (const p of pts) {
      ctx.beginPath();
      if (p.isCritical) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
