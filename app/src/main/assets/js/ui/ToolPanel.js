/**
 * Vectura Tool Options Strip Manager (44px contextual strip)
 * Displays active tool options directly above bottom toolbar.
 */
export class ToolPanel {
  constructor(stripContentEl, toolManager, onAction, app = null) {
    this.container = stripContentEl;
    this.stripEl = document.getElementById('tool-options-strip');
    this.toolManager = toolManager;
    this.onAction = onAction;
    this.app = app;

    this.activeTool = 'brush';
  }

  setApp(app) {
    this.app = app;
  }

  update(activeTool) {
    this.activeTool = activeTool;
    this.render();
  }

  render() {
    if (!this.container) return;
    const tm = this.toolManager;
    const tool = this.activeTool;

    if (this.stripEl) {
      this.stripEl.classList.remove('hidden');
    }

    if (tool === 'brush' || tool === 'eraser') {
      const b = this.app?.vectorCanvas?.currentBrush;
      const brushName = b?.name || (tool === 'eraser' ? 'Eraser' : 'Pencil');
      const brushSize = b?.size || 8;
      const brushOpac = Math.round((b?.opacity ?? 1.0) * 100);

      this.container.innerHTML = `
        <div id="strip-brush-click" class="strip-item" style="cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%;">
          <canvas id="strip-brush-thumb" class="strip-brush-thumb" width="64" height="28"></canvas>
          <span style="font-weight: 500; font-size: var(--text-body); color: var(--text);">${brushName}</span>
          <span class="tabular" style="font-size: var(--text-secondary); color: var(--text-2);">${brushSize}px · ${brushOpac}%</span>
        </div>
      `;

      this.container.querySelector('#strip-brush-click')?.addEventListener('click', () => {
        this.app?.ui?.toggleSheet('brushes');
      });

      this.drawBrushThumb();
    } else if (tool === 'bucket') {
      const fb = tm.fillBucket;
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; align-items: center; gap: 10px; width: 100%;">
          <span style="font-size: var(--text-secondary); color: var(--text-2);">Tolerance</span>
          <input type="range" class="dense-slider" id="strip-fill-tolerance" min="0" max="100" value="${fb?.tolerance ?? 30}" style="width: 100px;">
          <span id="strip-fill-tol-val" class="tabular" style="font-size: var(--text-secondary);">${fb?.tolerance ?? 30}%</span>
          <button id="strip-fill-gap-btn" class="btn-text ${fb?.gapClose ? 'accent' : ''}" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">
            Gap close
          </button>
        </div>
      `;

      const tolInput = this.container.querySelector('#strip-fill-tolerance');
      const tolVal = this.container.querySelector('#strip-fill-tol-val');
      tolInput?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (fb) fb.tolerance = val;
        if (tolVal) tolVal.textContent = `${val}%`;
      });

      const gapBtn = this.container.querySelector('#strip-fill-gap-btn');
      gapBtn?.addEventListener('click', () => {
        if (fb) {
          fb.gapClose = !fb.gapClose;
          gapBtn.classList.toggle('accent', fb.gapClose);
        }
      });
    } else if (tool === 'select' || tool === 'selection' || tool === 'lasso-fill') {
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; align-items: center; gap: 6px; width: 100%;">
          <button id="strip-sel-add" class="btn-text accent" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Add</button>
          <button id="strip-sel-sub" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Subtract</button>
          <button id="strip-sel-inv" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Invert</button>
          <button id="strip-sel-feather" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Feather</button>
        </div>
      `;
      this.container.querySelector('#strip-sel-inv')?.addEventListener('click', () => {
        tm.selectionTool?.invert();
      });
    } else if (tool === 'smudge') {
      const sm = tm.smudgeTool;
      const strengthVal = Math.round((sm?.strength ?? 0.6) * 100);
      const sizeVal = Math.round(sm?.size ?? 30);
      const isFinger = sm?.fingerPainting ?? false;

      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; align-items: center; gap: 8px; width: 100%; overflow-x: auto;">
          <span style="font-weight: 600; font-size: var(--text-body); color: var(--text);">Smudge</span>
          <span style="font-size: 11px; color: var(--text-2);">Strength</span>
          <input type="range" class="dense-slider" id="strip-smudge-strength" min="1" max="100" value="${strengthVal}" style="width: 80px;">
          <span id="strip-smudge-str-val" class="tabular" style="font-size: 11px; min-width: 30px;">${strengthVal}%</span>
          <span style="font-size: 11px; color: var(--text-2);">Size</span>
          <input type="range" class="dense-slider" id="strip-smudge-size" min="2" max="150" value="${sizeVal}" style="width: 80px;">
          <span id="strip-smudge-sz-val" class="tabular" style="font-size: 11px; min-width: 32px;">${sizeVal}px</span>
          <button id="strip-smudge-finger" class="btn-text ${isFinger ? 'accent' : ''}" style="min-height: 28px; padding: 2px 8px; font-size: 11px; white-space: nowrap;">
            Finger Paint
          </button>
        </div>
      `;

      const strInput = this.container.querySelector('#strip-smudge-strength');
      const strVal = this.container.querySelector('#strip-smudge-str-val');
      strInput?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (sm) sm.strength = val / 100;
        if (strVal) strVal.textContent = `${val}%`;
      });

      const szInput = this.container.querySelector('#strip-smudge-size');
      const szVal = this.container.querySelector('#strip-smudge-sz-val');
      szInput?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (sm) sm.size = val;
        if (szVal) szVal.textContent = `${val}px`;
      });

      const fingerBtn = this.container.querySelector('#strip-smudge-finger');
      fingerBtn?.addEventListener('click', () => {
        if (sm) {
          sm.fingerPainting = !sm.fingerPainting;
          fingerBtn.classList.toggle('accent', sm.fingerPainting);
        }
      });
    } else if (tool === 'transform') {
      const tt = tm.transformTool;
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 600; font-size: 13px;">Transform</span>
            <span style="color: var(--text-2); font-size: 11px;">Drag handles to scale/rotate</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="strip-tf-fliph" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Flip H</button>
            <button id="strip-tf-flipv" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Flip V</button>
            <button id="strip-tf-rot90" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">90°</button>
            <button id="strip-tf-apply" class="btn-text accent" style="min-height: 28px; padding: 2px 10px; font-size: 12px; font-weight: 600;">Done</button>
          </div>
        </div>
      `;

      this.container.querySelector('#strip-tf-fliph')?.addEventListener('click', () => {
        tt?.flipH?.();
        this.app?.vectorCanvas?.render();
      });
      this.container.querySelector('#strip-tf-flipv')?.addEventListener('click', () => {
        tt?.flipV?.();
        this.app?.vectorCanvas?.render();
      });
      this.container.querySelector('#strip-tf-rot90')?.addEventListener('click', () => {
        if (tt) {
          tt.rotation = (tt.rotation || 0) + Math.PI / 2;
        }
        this.app?.vectorCanvas?.render();
      });
      this.container.querySelector('#strip-tf-apply')?.addEventListener('click', () => {
        if (this.app?.vectorCanvas) {
          this.app.vectorCanvas.commitTransform();
        }
      });
    } else if (tool === 'pan') {
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 500; font-size: 13px;">Navigate</span>
            <span style="color: var(--text-2); font-size: 11px;">Drag to pan · Pinch to zoom</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="strip-nav-fit" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Fit</button>
            <button id="strip-nav-100" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">100%</button>
            <button id="strip-nav-reset" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Reset</button>
          </div>
        </div>
      `;

      this.container.querySelector('#strip-nav-fit')?.addEventListener('click', () => {
        if (this.app?.vectorCanvas) {
          this.app.vectorCanvas.viewport.fitToScreen();
          this.app.vectorCanvas.viewport.onNavigate?.(this.app.vectorCanvas.viewport.zoom, this.app.vectorCanvas.viewport.rotation);
        }
      });
      this.container.querySelector('#strip-nav-100')?.addEventListener('click', () => {
        if (this.app?.vectorCanvas) {
          this.app.vectorCanvas.viewport.set100Percent();
          this.app.vectorCanvas.viewport.onNavigate?.(1.0, this.app.vectorCanvas.viewport.rotation);
        }
      });
      this.container.querySelector('#strip-nav-reset')?.addEventListener('click', () => {
        if (this.app?.vectorCanvas) {
          this.app.vectorCanvas.viewport.resetView();
          this.app.vectorCanvas.viewport.onNavigate?.(this.app.vectorCanvas.viewport.zoom, 0);
        }
      });
    } else if (tool === 'shape') {
      const sh = tm.shapeTool;
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; gap: 6px; overflow-x: auto; width: 100%;">
          <button class="btn-text strip-sh-btn ${sh?.type === 'line' ? 'accent' : ''}" data-type="line" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Line</button>
          <button class="btn-text strip-sh-btn ${sh?.type === 'arrow' ? 'accent' : ''}" data-type="arrow" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Arrow</button>
          <button class="btn-text strip-sh-btn ${sh?.type === 'rect' ? 'accent' : ''}" data-type="rect" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Rect</button>
          <button class="btn-text strip-sh-btn ${sh?.type === 'ellipse' ? 'accent' : ''}" data-type="ellipse" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Ellipse</button>
          <button class="btn-text strip-sh-btn ${sh?.type === 'polygon' ? 'accent' : ''}" data-type="polygon" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Polygon</button>
        </div>
      `;

      this.container.querySelectorAll('.strip-sh-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (sh) sh.type = btn.dataset.type;
          this.container.querySelectorAll('.strip-sh-btn').forEach(b => b.classList.remove('accent'));
          btn.classList.add('accent');
        });
      });
    } else if (tool === 'symmetry') {
      const sym = tm.symmetry;
      const isLocked = sym?.locked || false;
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; gap: 6px; align-items: center; overflow-x: auto; width: 100%;">
          <button class="btn-text strip-sym-btn ${sym?.mode === 'vertical' ? 'accent' : ''}" data-mode="vertical" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Vertical</button>
          <button class="btn-text strip-sym-btn ${sym?.mode === 'horizontal' ? 'accent' : ''}" data-mode="horizontal" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Horizontal</button>
          <button class="btn-text strip-sym-btn ${sym?.mode === 'radial' ? 'accent' : ''}" data-mode="radial" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Radial</button>
          <button id="strip-sym-lock" class="btn-text ${isLocked ? 'accent' : ''}" style="min-height: 28px; padding: 2px 8px; font-size: 12px; display: flex; align-items: center; gap: 4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="${isLocked ? 'M7 11V7a5 5 0 0 1 10 0v4' : 'M7 11V7a5 5 0 0 1 9.9-1'}"/></svg>
            ${isLocked ? 'Locked' : 'Unlocked'}
          </button>
          <button id="strip-sym-reset" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">
            Reset Axis
          </button>
        </div>
      `;
      this.container.querySelectorAll('.strip-sym-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (sym) {
            sym.mode = btn.dataset.mode;
            this.container.querySelectorAll('.strip-sym-btn').forEach(b => b.classList.remove('accent'));
            btn.classList.add('accent');
            this.app?.vectorCanvas?.render();
          }
        });
      });
      this.container.querySelector('#strip-sym-lock')?.addEventListener('click', () => {
        if (sym) {
          sym.toggleLock();
          this.render();
          this.app?.vectorCanvas?.render();
        }
      });
      this.container.querySelector('#strip-sym-reset')?.addEventListener('click', () => {
        if (sym && this.app?.vectorCanvas) {
          sym.reset(this.app.vectorCanvas.docWidth, this.app.vectorCanvas.docHeight);
          this.app.vectorCanvas.render();
        }
      });
    } else {
      if (this.stripEl) {
        this.stripEl.classList.add('hidden');
      }
    }
  }

  drawBrushThumb() {
    const canvas = this.container.querySelector('#strip-brush-thumb');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const color = this.app?.vectorCanvas?.currentColor || '#3B6EDC';
    const b = this.app?.vectorCanvas?.currentBrush;

    ctx.fillStyle = color;
    ctx.beginPath();
    for (let x = 6; x < w - 6; x += 2) {
      const y = h / 2 + Math.sin((x / w) * Math.PI * 2) * 4;
      const rad = Math.max(0.8, ((b?.size || 8) / 16) * 2);
      ctx.arc(x, y, rad, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}
