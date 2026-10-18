/**
 * Vectura Tool Options Panel
 * Context-sensitive controls for Fill Bucket, Selection, Shapes, Transform, Guides and Symmetry.
 */
export class ToolPanel {
  constructor(containerEl, toolManager, onOptionChanged) {
    this.container = containerEl;
    this.toolManager = toolManager;
    this.onOptionChanged = onOptionChanged;

    this.render();
  }

  update(activeTool) {
    this.render();
  }

  render() {
    const tm = this.toolManager;
    const tool = tm.activeTool;

    let content = '';

    if (tool === 'bucket') {
      const fb = tm.fillBucket;
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Color Tolerance</span>
              <span>${fb.tolerance}%</span>
            </div>
            <input type="range" class="glass-slider tp-input" data-tool="bucket" data-prop="tolerance" min="0" max="100" value="${fb.tolerance}" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Expand / Contract</span>
              <span>${fb.expand > 0 ? '+' : ''}${fb.expand} px</span>
            </div>
            <input type="range" class="glass-slider tp-input" data-tool="bucket" data-prop="expand" min="-5" max="10" value="${fb.expand}" />
          </div>

          <div>
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px;">Sampling Source</div>
            <div style="display: flex; gap: 6px;">
              <button class="glass-btn tp-sample-src ${fb.sampleSource === 'all' ? 'active' : ''}" data-src="all" style="flex: 1; padding: 6px; font-size: 11px;">All Layers</button>
              <button class="glass-btn tp-sample-src ${fb.sampleSource === 'current' ? 'active' : ''}" data-src="current" style="flex: 1; padding: 6px; font-size: 11px;">Current</button>
              <button class="glass-btn tp-sample-src ${fb.sampleSource === 'reference' ? 'active' : ''}" data-src="reference" style="flex: 1; padding: 6px; font-size: 11px;">Reference</button>
            </div>
          </div>
        </div>
      `;
    } else if (tool === 'selection') {
      const st = tm.selectionTool;
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px;">Selection Shape</div>
            <div style="display: flex; gap: 6px;">
              <button class="glass-btn tp-sel-shape ${st.type === 'rect' ? 'active' : ''}" data-shape="rect" style="flex: 1; padding: 6px; font-size: 11px;">Rect</button>
              <button class="glass-btn tp-sel-shape ${st.type === 'ellipse' ? 'active' : ''}" data-shape="ellipse" style="flex: 1; padding: 6px; font-size: 11px;">Ellipse</button>
              <button class="glass-btn tp-sel-shape ${st.type === 'lasso' ? 'active' : ''}" data-shape="lasso" style="flex: 1; padding: 6px; font-size: 11px;">Lasso</button>
            </div>
          </div>

          <div style="display: flex; gap: 6px;">
            <button id="tp-sel-invert" class="glass-btn" style="flex: 1; font-size: 11px;">Invert</button>
            <button id="tp-sel-clear" class="glass-btn" style="flex: 1; font-size: 11px; color: var(--danger);">Deselect</button>
          </div>
        </div>
      `;
    } else if (tool === 'transform') {
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; gap: 6px;">
            <button id="tp-tr-fliph" class="glass-btn" style="flex: 1; font-size: 12px;">Flip H</button>
            <button id="tp-tr-flipv" class="glass-btn" style="flex: 1; font-size: 12px;">Flip V</button>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="tp-tr-apply" class="glass-btn active" style="flex: 1; font-size: 13px;">✓ Apply</button>
            <button id="tp-tr-cancel" class="glass-btn" style="flex: 1; font-size: 13px; color: var(--danger);">✕ Cancel</button>
          </div>
        </div>
      `;
    } else if (tool === 'shape') {
      const sh = tm.shapeTool;
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="glass-btn tp-shape-type ${sh.type === 'line' ? 'active' : ''}" data-type="line" style="flex: 1; min-width: 60px; font-size: 11px;">Line</button>
            <button class="glass-btn tp-shape-type ${sh.type === 'rect' ? 'active' : ''}" data-type="rect" style="flex: 1; min-width: 60px; font-size: 11px;">Rect</button>
            <button class="glass-btn tp-shape-type ${sh.type === 'ellipse' ? 'active' : ''}" data-type="ellipse" style="flex: 1; min-width: 60px; font-size: 11px;">Ellipse</button>
            <button class="glass-btn tp-shape-type ${sh.type === 'polygon' ? 'active' : ''}" data-type="polygon" style="flex: 1; min-width: 60px; font-size: 11px;">Polygon</button>
            <button class="glass-btn tp-shape-type ${sh.type === 'star' ? 'active' : ''}" data-type="star" style="flex: 1; min-width: 60px; font-size: 11px;">Star</button>
          </div>
        </div>
      `;
    } else if (tool === 'symmetry') {
      const sym = tm.symmetry;
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; gap: 6px;">
            <button class="glass-btn tp-sym-btn ${sym.mode === 'off' ? 'active' : ''}" data-mode="off" style="flex: 1; font-size: 11px;">Off</button>
            <button class="glass-btn tp-sym-btn ${sym.mode === 'vertical' ? 'active' : ''}" data-mode="vertical" style="flex: 1; font-size: 11px;">Vertical</button>
            <button class="glass-btn tp-sym-btn ${sym.mode === 'horizontal' ? 'active' : ''}" data-mode="horizontal" style="flex: 1; font-size: 11px;">Horizontal</button>
            <button class="glass-btn tp-sym-btn ${sym.mode === 'radial' ? 'active' : ''}" data-mode="radial" style="flex: 1; font-size: 11px;">Radial</button>
          </div>

          ${
            sym.mode === 'radial'
              ? `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span>Radial Axes</span>
                <span>${sym.radialAxes}</span>
              </div>
              <input type="range" id="tp-radial-axes" class="glass-slider" min="2" max="12" value="${sym.radialAxes}" />
            </div>
          `
              : ''
          }
        </div>
      `;
    } else if (tool === 'point-editor') {
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <span style="font-size: 12px; color: var(--text-muted);">Tap a vector stroke to edit its Catmull-Rom nodes.</span>
          <div style="display: flex; gap: 6px;">
            <button id="tp-pe-simplify" class="glass-btn" style="flex: 1; font-size: 12px;">Simplify Path</button>
            <button id="tp-pe-delete" class="glass-btn" style="flex: 1; font-size: 12px; color: var(--danger);">Delete Node</button>
          </div>
        </div>
      `;
    } else {
      content = `<div style="font-size: 12px; color: var(--text-muted);">Options for ${tool}</div>`;
    }

    this.container.innerHTML = content;
    this.setupEvents();
  }

  setupEvents() {
    const tm = this.toolManager;

    // Fill Bucket inputs
    this.container.querySelectorAll('.tp-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const prop = e.target.dataset.prop;
        tm.fillBucket[prop] = parseInt(e.target.value);
        this.render();
      });
    });

    this.container.querySelectorAll('.tp-sample-src').forEach(btn => {
      btn.addEventListener('click', () => {
        tm.fillBucket.sampleSource = btn.dataset.src;
        this.render();
      });
    });

    // Selection buttons
    this.container.querySelectorAll('.tp-sel-shape').forEach(btn => {
      btn.addEventListener('click', () => {
        tm.selectionTool.type = btn.dataset.shape;
        this.render();
      });
    });
    this.container.querySelector('#tp-sel-invert')?.addEventListener('click', () => {
      tm.selectionTool.invert();
    });
    this.container.querySelector('#tp-sel-clear')?.addEventListener('click', () => {
      tm.selectionTool.clear();
    });

    // Transform buttons
    this.container.querySelector('#tp-tr-fliph')?.addEventListener('click', () => tm.transformTool.flipHorizontal());
    this.container.querySelector('#tp-tr-flipv')?.addEventListener('click', () => tm.transformTool.flipVertical());
    this.container.querySelector('#tp-tr-apply')?.addEventListener('click', () => {
      tm.transformTool.applyTransform(() => this.onOptionChanged?.('transform-apply'));
      this.render();
    });
    this.container.querySelector('#tp-tr-cancel')?.addEventListener('click', () => {
      tm.transformTool.cancel();
      this.render();
    });

    // Shape buttons
    this.container.querySelectorAll('.tp-shape-type').forEach(btn => {
      btn.addEventListener('click', () => {
        tm.shapeTool.type = btn.dataset.type;
        this.render();
      });
    });

    // Symmetry buttons
    this.container.querySelectorAll('.tp-sym-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tm.symmetry.mode = btn.dataset.mode;
        this.render();
      });
    });
    this.container.querySelector('#tp-radial-axes')?.addEventListener('input', (e) => {
      tm.symmetry.radialAxes = parseInt(e.target.value);
      this.render();
    });

    // Point editor
    this.container.querySelector('#tp-pe-simplify')?.addEventListener('click', () => {
      this.onOptionChanged?.('point-editor-simplify');
    });
    this.container.querySelector('#tp-pe-delete')?.addEventListener('click', () => {
      this.onOptionChanged?.('point-editor-delete');
    });
  }
}
