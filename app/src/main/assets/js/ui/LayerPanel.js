/**
 * Vectura Glass Layer Panel UI
 * Layer thumbnails, 18 blend modes, clipping mask indicator, alpha lock, and reordering.
 */
import { BLEND_MODES } from '../layers/BlendModes.js';

export class LayerPanel {
  constructor(containerEl, layerManager, onLayerChanged) {
    this.container = containerEl;
    this.layerManager = layerManager;
    this.onLayerChanged = onLayerChanged;

    this.render();
  }

  render() {
    const lm = this.layerManager;
    const active = lm.getActiveLayer();

    const blendOptions = BLEND_MODES.map(
      m => `<option value="${m.id}" ${active && active.blendMode === m.id ? 'selected' : ''}>${m.name}</option>`
    ).join('');

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
        <!-- Quick Layer Controls -->
        <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--glass-border);">
          <div style="display: flex; gap: 6px;">
            <button id="lp-add-btn" class="glass-btn glass-btn-icon" title="New Layer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button id="lp-dup-btn" class="glass-btn glass-btn-icon" title="Duplicate Layer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button id="lp-merge-btn" class="glass-btn glass-btn-icon" title="Merge Down">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"></path></svg>
            </button>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="lp-clear-btn" class="glass-btn glass-btn-icon" title="Clear Layer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <button id="lp-del-btn" class="glass-btn glass-btn-icon" title="Delete Layer" style="color: var(--danger);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <!-- Selected Layer Detail Bar -->
        ${
          active
            ? `
          <div style="display: flex; flex-direction: column; gap: 8px; padding: 10px; background: rgba(0,0,0,0.18); border-radius: var(--radius-md); border: 1px solid var(--glass-border);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 600;">Opacity</span>
              <span id="lp-opacity-val" style="font-size: 12px; color: var(--text-muted);">${Math.round(active.opacity * 100)}%</span>
            </div>
            <input type="range" id="lp-opacity-slider" class="glass-slider" min="0" max="100" value="${Math.round(active.opacity * 100)}" />
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
              <span style="font-size: 12px; font-weight: 600;">Blend Mode</span>
              <select id="lp-blend-select" class="glass-input" style="padding: 4px 8px; font-size: 12px;">
                ${blendOptions}
              </select>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 4px;">
              <button id="lp-clip-btn" class="glass-btn ${active.clippingMask ? 'active' : ''}" style="flex: 1; padding: 6px 8px; font-size: 11px;">
                ↳ Clip
              </button>
              <button id="lp-alpha-btn" class="glass-btn ${active.alphaLock ? 'active' : ''}" style="flex: 1; padding: 6px 8px; font-size: 11px;">
                🔒 Alpha
              </button>
              <button id="lp-ref-btn" class="glass-btn ${active.isReference ? 'active' : ''}" style="flex: 1; padding: 6px 8px; font-size: 11px;">
                ★ Ref
              </button>
            </div>
          </div>
        `
            : ''
        }

        <!-- Layers Stack (Top to Bottom visually: top layer first) -->
        <div id="lp-layers-list" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 48vh; padding-right: 4px;"></div>
      </div>
    `;

    this.renderLayerItems();
    this.setupEvents();
  }

  renderLayerItems() {
    const listEl = this.container.querySelector('#lp-layers-list');
    if (!listEl) return;
    const lm = this.layerManager;
    const activeId = lm.activeLayerId;

    // Display top layer at top of UI list (reverse stack order)
    const reversed = [...lm.layers].reverse();

    listEl.innerHTML = reversed
      .map(layer => {
        const isActive = layer.id === activeId;
        const indent = layer.clippingMask ? 'margin-left: 20px;' : '';
        return `
        <div class="glass-panel" data-id="${layer.id}" style="${indent} display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; cursor: pointer; border-color: ${isActive ? 'var(--accent-primary)' : 'var(--glass-border)'}; background: ${isActive ? 'var(--glass-bg-active)' : 'var(--glass-bg)'};">
          <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
            ${layer.clippingMask ? `<span style="color: var(--accent-secondary); font-size: 14px;">↳</span>` : ''}
            <div style="width: 44px; height: 44px; border-radius: var(--radius-sm); background: #1a202c; border: 1px solid var(--glass-border); overflow: hidden; display: flex; align-items: center; justify-content: center;">
              <canvas class="lp-thumb-canvas" width="64" height="64" style="width: 100%; height: 100%; object-fit: contain;"></canvas>
            </div>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600; color: ${isActive ? 'var(--text-main)' : 'var(--text-muted)'};">${layer.name}</span>
              <span style="font-size: 11px; color: var(--text-dim);">${layer.blendMode} • ${Math.round(layer.opacity * 100)}%</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="glass-btn glass-btn-icon lp-vis-btn" data-id="${layer.id}" style="width: 34px; height: 34px;">
              ${layer.visible ? '👁' : '🚫'}
            </button>
            <button class="glass-btn glass-btn-icon lp-lock-btn" data-id="${layer.id}" style="width: 34px; height: 34px;">
              ${layer.locked ? '🔒' : '🔓'}
            </button>
          </div>
        </div>
      `;
      })
      .join('');

    // Draw thumbnails
    listEl.querySelectorAll('.glass-panel').forEach(itemEl => {
      const id = itemEl.dataset.id;
      const layer = lm.layers.find(l => l.id === id);
      if (layer) {
        const thumbCanvas = itemEl.querySelector('.lp-thumb-canvas');
        if (thumbCanvas) {
          const tCtx = thumbCanvas.getContext('2d');
          tCtx.drawImage(layer.thumbCanvas, 0, 0);
        }
      }
    });
  }

  setupEvents() {
    const lm = this.layerManager;

    this.container.querySelector('#lp-add-btn')?.addEventListener('click', () => {
      lm.addLayer('Layer ' + (lm.layers.length + 1));
      this.render();
      this.onLayerChanged?.();
    });

    this.container.querySelector('#lp-dup-btn')?.addEventListener('click', () => {
      lm.duplicateLayer(lm.activeLayerId);
      this.render();
      this.onLayerChanged?.();
    });

    this.container.querySelector('#lp-merge-btn')?.addEventListener('click', () => {
      lm.mergeDown(lm.activeLayerId);
      this.render();
      this.onLayerChanged?.();
    });

    this.container.querySelector('#lp-clear-btn')?.addEventListener('click', () => {
      lm.clearLayer(lm.activeLayerId);
      this.render();
      this.onLayerChanged?.();
    });

    this.container.querySelector('#lp-del-btn')?.addEventListener('click', () => {
      lm.deleteLayer(lm.activeLayerId);
      this.render();
      this.onLayerChanged?.();
    });

    // Layer card click
    this.container.querySelectorAll('#lp-layers-list .glass-panel').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.lp-vis-btn') || e.target.closest('.lp-lock-btn')) return;
        const id = card.dataset.id;
        lm.setActiveLayer(id);
        this.render();
        this.onLayerChanged?.();
      });
    });

    // Visibility & Lock buttons
    this.container.querySelectorAll('.lp-vis-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const l = lm.layers.find(layer => layer.id === id);
        if (l) {
          l.visible = !l.visible;
          lm.invalidateCaches();
          this.render();
          this.onLayerChanged?.();
        }
      });
    });

    this.container.querySelectorAll('.lp-lock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const l = lm.layers.find(layer => layer.id === id);
        if (l) {
          l.locked = !l.locked;
          this.render();
        }
      });
    });

    // Opacity slider
    const opSlider = this.container.querySelector('#lp-opacity-slider');
    opSlider?.addEventListener('input', (e) => {
      const active = lm.getActiveLayer();
      if (active) {
        active.opacity = e.target.value / 100;
        const label = this.container.querySelector('#lp-opacity-val');
        if (label) label.textContent = `${e.target.value}%`;
        lm.invalidateCaches();
        this.onLayerChanged?.();
      }
    });

    // Blend mode selector
    const blendSelect = this.container.querySelector('#lp-blend-select');
    blendSelect?.addEventListener('change', (e) => {
      const active = lm.getActiveLayer();
      if (active) {
        active.blendMode = e.target.value;
        lm.invalidateCaches();
        this.render();
        this.onLayerChanged?.();
      }
    });

    // Clipping Mask toggle
    this.container.querySelector('#lp-clip-btn')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        active.clippingMask = !active.clippingMask;
        lm.invalidateCaches();
        this.render();
        this.onLayerChanged?.();
      }
    });

    // Alpha Lock toggle
    this.container.querySelector('#lp-alpha-btn')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        active.alphaLock = !active.alphaLock;
        this.render();
      }
    });

    // Reference Layer toggle
    this.container.querySelector('#lp-ref-btn')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        active.isReference = !active.isReference;
        this.render();
      }
    });
  }
}
