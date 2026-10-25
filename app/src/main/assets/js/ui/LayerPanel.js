/**
 * Vectura Layer Panel UI
 * Clean, modern, professional layers management.
 * Reworked with layer opacity slider, blend mode, alpha lock, clipping mask,
 * live thumbnails, rename, duplicate, merge down, clear, and delete.
 */
import { BLEND_MODES } from '../layers/BlendModes.js';
import { LayerCommand } from '../history/Command.js';

export class LayerPanel {
  constructor(containerEl, layerManager, onLayerChanged, history = null) {
    this.container = containerEl;
    this.layerManager = layerManager;
    this.onLayerChanged = onLayerChanged;
    this.history = history;

    this.render();
  }

  setHistory(history) {
    this.history = history;
  }

  executeLayerOp(name, action, includePixels = false) {
    const lm = this.layerManager;
    let beforeState = null;
    let afterState = null;
    try {
      beforeState = lm.createSnapshot(includePixels);
    } catch (e) {
      console.warn('createSnapshot beforeState failed:', e);
    }

    try {
      action();
    } catch (e) {
      console.error('action failed in executeLayerOp:', e);
    }

    try {
      afterState = lm.createSnapshot(includePixels);
    } catch (e) {
      console.warn('createSnapshot afterState failed:', e);
    }

    if (this.history && beforeState && afterState) {
      this.history.push(new LayerCommand(name, lm, beforeState, afterState, () => {
        this.render();
        this.onLayerChanged?.();
      }));
    }

    this.render();
    try {
      this.onLayerChanged?.();
    } catch (err) {
      console.warn('onLayerChanged error caught:', err);
    }
  }

  render() {
    const lm = this.layerManager;
    const active = lm.getActiveLayer();
    const activeIdx = lm.activeLayerIndex;

    const blendOptions = BLEND_MODES.map(
      m => `<option value="${m.id}" ${active && active.blendMode === m.id ? 'selected' : ''}>${m.name}</option>`
    ).join('');

    const activeOpacityPct = active ? Math.round(active.opacity * 100) : 100;

    // Reverse layers so top of stack is at the top of the list
    const layerRows = [...lm.layers].reverse().map((layer, reverseIdx) => {
      const realIdx = lm.layers.length - 1 - reverseIdx;
      const isSelected = realIdx === activeIdx;
      const opacityPct = Math.round(layer.opacity * 100);

      return `
        <div class="layers-row-item ${isSelected ? 'selected' : ''} ${layer.clippingMask ? 'clipped' : ''} ${!layer.visible ? 'hidden-layer' : ''}" data-idx="${realIdx}" style="padding-left: ${layer.clippingMask ? '22px' : '8px'}; opacity: ${layer.visible ? '1' : '0.45'}; transition: background-color 150ms ease, opacity 150ms ease;">
          ${layer.clippingMask ? `
            <span style="font-size: 14px; color: var(--accent, #6366f1); margin-right: -4px;" title="Clipped to layer below">↳</span>
          ` : ''}
          <!-- Visibility Eye -->
          <button class="btn-icon lp-vis-btn" data-idx="${realIdx}" title="${layer.visible ? 'Hide layer' : 'Show layer'}">
            ${layer.visible ? `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ` : `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            `}
          </button>

          <!-- Thumbnail -->
          <div class="layer-thumb-container">
            <canvas class="lp-thumb-canvas" data-idx="${realIdx}" width="40" height="40" style="width: 100%; height: 100%; display: block; border-radius: 4px;"></canvas>
          </div>

          <!-- Info & Name -->
          <div class="layer-info-col" data-idx="${realIdx}">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="layer-title-text" style="font-weight: ${isSelected ? '600' : '400'}; color: ${isSelected ? 'var(--accent, #6366f1)' : 'var(--text)'};">${layer.name}</span>
              ${isSelected ? `<span class="layer-active-badge">ACTIVE</span>` : ''}
              ${layer.clippingMask ? `<span style="font-size: 9px; font-weight: 600; background: rgba(99,102,241,0.2); color: var(--accent, #6366f1); padding: 1px 4px; border-radius: 3px;">CLIP</span>` : ''}
              ${layer.alphaLock ? `<span style="font-size: 9px; font-weight: 600; background: rgba(245,158,11,0.2); color: #f59e0b; padding: 1px 4px; border-radius: 3px;">ALPHA</span>` : ''}
              ${layer.locked ? `<span style="font-size: 9px; font-weight: 600; background: rgba(239,68,68,0.2); color: #ef4444; padding: 1px 4px; border-radius: 3px;">LOCKED</span>` : ''}
            </div>
            <span class="layer-sub-text tabular">${BLEND_MODES.find(m => m.id === layer.blendMode)?.name || 'Normal'} · ${opacityPct}%</span>
          </div>

          <!-- Actions: Rename, Move Up/Down, Lock -->
          <div style="display: flex; align-items: center; gap: 2px;">
            <button class="btn-icon lp-rename-btn" data-idx="${realIdx}" title="Rename layer" style="width: 28px; height: 28px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn-icon lp-move-up-btn" data-idx="${realIdx}" title="Move up" style="width: 28px; height: 28px;" ${realIdx === lm.layers.length - 1 ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button class="btn-icon lp-move-down-btn" data-idx="${realIdx}" title="Move down" style="width: 28px; height: 28px;" ${realIdx === 0 ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="btn-icon lp-lock-btn" data-idx="${realIdx}" title="${layer.locked ? 'Unlock' : 'Lock'}" style="width: 30px; height: 30px;">
              ${layer.locked ? `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              ` : `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
              `}
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <!-- Selected Layer Settings Block -->
      <div class="layers-top-block" style="padding: 10px 14px; background: var(--panel); border-bottom: 1px solid var(--divider); flex-shrink: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 13px; font-weight: 500; color: var(--text);">Opacity</span>
          <span id="lp-opacity-label" class="tabular" style="font-size: 12px; color: var(--text-2); font-weight: 500;">${activeOpacityPct}%</span>
        </div>
        <input type="range" class="dense-slider" id="lp-opacity-slider" min="0" max="100" value="${activeOpacityPct}" style="width: 100%; margin-bottom: 8px;">

        <div style="display: flex; gap: 8px; align-items: center;">
          <select id="lp-blend-select" style="flex: 1; height: 32px; background: var(--control); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 12px; color: var(--text); padding: 0 8px;">
            ${blendOptions}
          </select>
          <button id="lp-btn-alpha-lock" class="btn-text ${active?.alphaLock ? 'accent' : ''}" style="height: 32px; font-size: 11px; padding: 0 10px;">
            Alpha lock
          </button>
          <button id="lp-btn-clipping-mask" class="btn-text ${active?.clippingMask ? 'accent' : ''}" style="height: 32px; font-size: 11px; padding: 0 10px;">
            Clip
          </button>
        </div>
      </div>

      <!-- Layers List Stack -->
      <div id="lp-rows-list" style="flex: 1; overflow-y: auto; max-height: 280px; -webkit-overflow-scrolling: touch;">
        ${layerRows}
      </div>

      <!-- Action Footer -->
      <div class="layers-footer" style="display: flex; justify-content: space-around; align-items: center; padding: 6px 12px; border-top: 1px solid var(--divider); background: var(--panel); flex-shrink: 0;">
        <button id="lp-btn-add" class="btn-text" style="font-size: 12px; height: 32px; padding: 0 10px; gap: 4px;" title="New layer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add
        </button>
        <button id="lp-btn-dup" class="btn-text" style="font-size: 12px; height: 32px; padding: 0 10px; gap: 4px;" title="Duplicate layer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Duplicate
        </button>
        <button id="lp-btn-merge" class="btn-text" style="font-size: 12px; height: 32px; padding: 0 10px; gap: 4px;" ${activeIdx <= 0 ? 'disabled' : ''} title="Merge down">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14"/><polyline points="7 12 12 17 17 12"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
          Merge
        </button>
        <button id="lp-btn-clear" class="btn-text" style="font-size: 12px; height: 32px; padding: 0 10px;" title="Clear layer content">
          Clear
        </button>
        <button id="lp-btn-del" class="btn-text danger" style="font-size: 12px; height: 32px; padding: 0 10px; gap: 4px;" ${lm.layers.length <= 1 ? 'disabled' : ''} title="Delete layer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;

    this.drawThumbnails();
    this.setupEvents();
  }

  drawThumbnails() {
    const lm = this.layerManager;
    this.container.querySelectorAll('.lp-thumb-canvas').forEach(canvas => {
      const idx = parseInt(canvas.dataset.idx, 10);
      const layer = lm.layers[idx];
      if (!layer) return;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 40, 40);

      // Checkerboard background for transparency
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 40, 40);
      ctx.fillStyle = '#E8E8EA';
      ctx.fillRect(0, 0, 20, 20);
      ctx.fillRect(20, 20, 20, 20);

      // Draw layer thumbnail scaled
      if (layer.thumbCanvas) {
        ctx.drawImage(layer.thumbCanvas, 0, 0, 40, 40);
      } else {
        ctx.drawImage(layer.canvas, 0, 0, 40, 40);
      }
    });
  }

  setupEvents() {
    const lm = this.layerManager;

    // Layer Selection: Tap anywhere on the row (except buttons) to select
    this.container.querySelectorAll('.layers-row-item').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button, input, select')) return;
        const idx = parseInt(row.dataset.idx, 10);
        if (isNaN(idx)) return;
        if (idx !== lm.activeLayerIndex) {
          lm.setActiveLayer(lm.layers[idx].id);
          lm.invalidateCaches();
          this.render();
          this.onLayerChanged?.();
        }
      });
    });

    // Rename Layer (smooth inline input or rename button)
    this.container.querySelectorAll('.lp-rename-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        const layer = lm.layers[idx];
        if (!layer) return;
        const row = this.container.querySelector(`.layers-row-item[data-idx="${idx}"]`);
        const titleSpan = row ? row.querySelector('.layer-title-text') : null;
        if (!titleSpan) return;
        const currentName = layer.name;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'layer-inline-rename-input';
        input.style.cssText = 'height: 24px; font-size: 13px; font-weight: 500; padding: 0 6px; border-radius: 4px; border: 1px solid var(--accent); background: var(--control); color: var(--text); width: 120px;';
        titleSpan.replaceWith(input);
        input.focus();
        input.select();

        let committed = false;
        const commit = () => {
          if (committed) return;
          committed = true;
          const val = input.value.trim() || currentName;
          this.executeLayerOp('Rename Layer', () => {
            layer.name = val;
          });
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            input.blur();
          } else if (ev.key === 'Escape') {
            input.value = currentName;
            input.blur();
          }
        });
      });
    });

    // Visibility Toggle
    this.container.querySelectorAll('.lp-vis-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        const layer = lm.layers[idx];
        if (layer) {
          this.executeLayerOp('Toggle Visibility', () => {
            layer.visible = !layer.visible;
          });
        }
      });
    });

    // Lock Toggle
    this.container.querySelectorAll('.lp-lock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        const layer = lm.layers[idx];
        if (layer) {
          this.executeLayerOp('Toggle Lock', () => {
            layer.locked = !layer.locked;
          });
        }
      });
    });

    // Move Up
    this.container.querySelectorAll('.lp-move-up-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        if (idx < lm.layers.length - 1) {
          this.executeLayerOp('Move Layer Up', () => {
            lm.reorder(idx, idx + 1);
          });
        }
      });
    });

    // Move Down
    this.container.querySelectorAll('.lp-move-down-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        if (idx > 0) {
          this.executeLayerOp('Move Layer Down', () => {
            lm.reorder(idx, idx - 1);
          });
        }
      });
    });

    // Opacity Slider
    const opacitySlider = this.container.querySelector('#lp-opacity-slider');
    const opacityLabel = this.container.querySelector('#lp-opacity-label');
    opacitySlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (opacityLabel) opacityLabel.textContent = `${val}%`;
      const active = lm.getActiveLayer();
      if (active) {
        active.opacity = val / 100;
        lm.invalidateCaches();
        this.onLayerChanged?.();
      }
    });

    opacitySlider?.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Change Opacity', () => {
          active.opacity = val / 100;
        });
      }
    });

    // Blend Mode Select
    this.container.querySelector('#lp-blend-select')?.addEventListener('change', (e) => {
      const val = e.target.value;
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Change Blend Mode', () => {
          active.blendMode = val;
        });
      }
    });

    // Alpha Lock Button
    this.container.querySelector('#lp-btn-alpha-lock')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Toggle Alpha Lock', () => {
          active.alphaLock = !active.alphaLock;
        });
      }
    });

    // Clipping Mask Button
    this.container.querySelector('#lp-btn-clipping-mask')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Toggle Clipping Mask', () => {
          active.clippingMask = !active.clippingMask;
        });
      }
    });

    // Add Layer
    this.container.querySelector('#lp-btn-add')?.addEventListener('click', () => {
      this.executeLayerOp('Add Layer', () => {
        lm.addLayer(`Layer ${lm.layers.length + 1}`);
      });
      setTimeout(() => {
        const selected = this.container.querySelector('.layers-row-item.selected');
        selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 50);
    });

    // Duplicate Layer
    this.container.querySelector('#lp-btn-dup')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Duplicate Layer', () => {
          lm.duplicateLayer(active.id);
        }, true);
      }
    });

    // Merge Down
    this.container.querySelector('#lp-btn-merge')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Merge Layer Down', () => {
          lm.mergeDown(active.id);
        }, true);
      }
    });

    // Clear Layer Content
    this.container.querySelector('#lp-btn-clear')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Clear Layer', () => {
          active.ctx.clearRect(0, 0, active.width, active.height);
          active.updateThumbnail();
        }, true);
      }
    });

    // Delete Layer
    this.container.querySelector('#lp-btn-del')?.addEventListener('click', () => {
      if (lm.layers.length <= 1) return;
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Delete Layer', () => {
          lm.deleteLayer(active.id);
        }, true);
      }
    });
  }
}
