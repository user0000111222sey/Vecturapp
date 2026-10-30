/**
 * Vectura UI Manager
 * Master UI coordinator connecting top bar, edge sliders, tool strip, bottom toolbar, and sheets.
 * Follows exact specifications:
 * - 48px top bar with projects, undo, redo, project name rename, export, more menu.
 * - Zoom & rotation chips in workspace.
 * - Draggable vertical edge sliders cluster (Size & Opacity) snapping to left/right edge.
 * - 44px contextual tool options strip.
 * - 56px bottom toolbar with 8 equal items.
 * - Non-modal bottom sheets (Brush, Colour, Layers) with 4x32 drag handles.
 */
import { ColorPicker } from './ColorPicker.js';
import { LayerPanel } from './LayerPanel.js';
import { BrushPanel } from './BrushPanel.js';
import { ToolPanel } from './ToolPanel.js';
import { SettingsDialog } from './SettingsDialog.js';
import { LassoPanel } from './LassoPanel.js';

const LAYOUT_STORAGE_KEY = 'vectura_ui_layout_v2';

export class UIManager {
  constructor(app) {
    this.app = app;
    this.vc = app.vectorCanvas;

    this.activeSheet = null; // 'layers' | 'brushes' | 'color'
    this.activeTool = 'brush';
    this.zoomChipTimer = null;

    this.savedLayout = this.loadLayout();

    this.initElements();
    this.initPanels();
    this.setupEventListeners();
    this.setupEdgeSlidersDragAndTrack();
    this.setupSheetGestures();
    this.setupViewportFeedback();
    this.applySavedLayout();
  }

  loadLayout() {
    try {
      const data = localStorage.getItem(LAYOUT_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (_) {
      return {};
    }
  }

  saveLayout() {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(this.savedLayout));
    } catch (_) {}
  }

  resetLayout() {
    this.savedLayout = {};
    try {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch (_) {}

    if (this.edgeSlidersCluster) {
      this.edgeSlidersCluster.classList.remove('on-right');
      this.edgeSlidersCluster.style.left = '8px';
      this.edgeSlidersCluster.style.right = 'auto';
      this.edgeSlidersCluster.style.top = '50%';
      this.edgeSlidersCluster.style.transform = 'translateY(-50%)';
    }
  }

  applySavedLayout() {
    if (this.savedLayout.edgeSliders && this.edgeSlidersCluster) {
      const es = this.savedLayout.edgeSliders;
      if (es.side === 'right') {
        this.edgeSlidersCluster.classList.add('on-right');
        this.edgeSlidersCluster.style.left = 'auto';
        this.edgeSlidersCluster.style.right = '8px';
      } else {
        this.edgeSlidersCluster.classList.remove('on-right');
        this.edgeSlidersCluster.style.left = '8px';
        this.edgeSlidersCluster.style.right = 'auto';
      }
      this.edgeSlidersCluster.style.top = '50%';
      this.edgeSlidersCluster.style.transform = 'translateY(-50%)';
    }
  }

  initElements() {
    this.topBar = document.getElementById('top-bar');
    this.bottomToolbar = document.getElementById('bottom-toolbar');
    this.toolStrip = document.getElementById('tool-options-strip');
    this.stripContent = document.getElementById('strip-content');
    this.moreMenuPopover = document.getElementById('more-menu-popover');
    this.edgeSlidersCluster = document.getElementById('edge-sliders-cluster');

    this.undoBtn = document.getElementById('btn-undo');
    this.redoBtn = document.getElementById('btn-redo');
    this.projectTitle = document.getElementById('project-title-display');

    // Zoom and Rotation chips
    this.zoomChip = document.getElementById('zoom-chip');
    this.rotationChip = document.getElementById('rotation-chip');

    // Bottom Sheets
    this.sheetLayers = document.getElementById('sheet-layers');
    this.sheetBrushes = document.getElementById('sheet-brushes');
    this.sheetLasso = document.getElementById('sheet-lasso');
    this.sheetColor = document.getElementById('sheet-color');

    // Modals
    this.exportModal = document.getElementById('export-modal');
    this.settingsModal = document.getElementById('settings-modal');
    this.canvasInfoModal = document.getElementById('canvas-info-modal');
  }

  initPanels() {
    // 1. Color Picker
    this.colorPicker = new ColorPicker(
      document.getElementById('sheet-color-content'),
      (hex) => {
        this.vc.currentColor = hex;
        this.updateColorAffordances(hex);
        if (this.brushPanel) {
          this.brushPanel.setColor(hex);
        }
        if (this.toolPanel) {
          this.toolPanel.drawBrushThumb();
        }
      },
      () => {
        this.closeSheets();
        this.selectTool('eyedropper', null);
      }
    );

    // 2. Layer Panel
    this.layerPanel = new LayerPanel(
      document.getElementById('sheet-layers-content'),
      this.vc.layerManager,
      () => {
        this.vc.layerManager.invalidateCaches();
        const active = this.vc.layerManager.getActiveLayer();
        this.vc.toolManager.setTool(this.activeTool, active);
        this.vc.render();
        this.app.markDirty();
      },
      this.app.history,
      this.app
    );

    // 3. Brush Panel
    this.brushPanel = new BrushPanel(
      document.getElementById('sheet-brushes-content'),
      this.vc.currentBrush,
      (brush) => {
        this.vc.currentBrush = brush;
        this.updateEdgeSliders();
        if (this.toolPanel) {
          this.toolPanel.render();
        }
      },
      this.vc.currentColor
    );
    if (this.brushPanel.currentBrush) {
      this.vc.currentBrush = this.brushPanel.currentBrush;
    }
    this.setupEraserMenuEvents();

    // 3b. Lasso Studio Panel
    this.lassoPanel = new LassoPanel(
      document.getElementById('sheet-lasso-content'),
      this.vc.toolManager.lassoFill,
      this.app
    );

    // 4. Tool Options Strip Panel
    this.toolPanel = new ToolPanel(
      this.stripContent,
      this.vc.toolManager,
      (action) => {
        if (action === 'transform-apply') {
          this.vc.redrawActiveLayer();
          this.selectTool('brush', 'bar-btn-brush');
        } else if (action === 'transform-cancel') {
          this.selectTool('brush', 'bar-btn-brush');
        }
      },
      this.app
    );
    this.toolPanel.setApp(this.app);
    this.toolPanel.update('brush');

    // Auto-revert callback (e.g. after committing transform or clicking outside)
    this.vc.onToolAutoReverted = (tool) => {
      this.selectTool(tool, tool === 'brush' ? 'bar-btn-brush' : null);
      this.toolPanel?.update(tool);
    };

    // 5. Settings Dialog
    this.settingsDialog = new SettingsDialog(
      this.settingsModal,
      this.app.config,
      (key, val) => this.app.onConfigChanged(key, val),
      () => this.resetLayout()
    );
  }

  setupEventListeners() {
    // 1. Top Bar Actions
    document.getElementById('btn-home')?.addEventListener('click', () => {
      this.closeSheets();
      this.closeMoreMenu();
      this.app.openGallery();
    });

    this.undoBtn?.addEventListener('click', () => this.app.undo());
    this.redoBtn?.addEventListener('click', () => this.app.redo());

    // Rename project on title tap
    this.projectTitle?.addEventListener('click', () => {
      const cur = this.app.currentProject?.name || 'Artwork 1';
      const newName = prompt('Rename Artwork:', cur);
      if (newName && newName.trim()) {
        if (this.app.currentProject) {
          this.app.currentProject.name = newName.trim();
        }
        this.projectTitle.textContent = newName.trim();
        this.app.saveCurrentProject();
      }
    });

    // Export button
    document.getElementById('btn-export')?.addEventListener('click', () => {
      this.closeSheets();
      this.closeMoreMenu();
      this.openExportModal();
    });

    // More (3 dots) menu toggle
    document.getElementById('btn-more-menu')?.addEventListener('click', () => {
      this.toggleMoreMenu();
    });

    // More menu options
    document.getElementById('menu-btn-settings')?.addEventListener('click', () => {
      this.closeMoreMenu();
      this.settingsDialog.open();
    });

    document.getElementById('menu-btn-canvas-info')?.addEventListener('click', () => {
      this.closeMoreMenu();
      this.openCanvasInfoModal();
    });

    document.getElementById('menu-btn-flip-view')?.addEventListener('click', () => {
      this.closeMoreMenu();
      this.vc.viewport.toggleMirror();
    });

    document.getElementById('menu-btn-guides')?.addEventListener('click', () => {
      this.closeMoreMenu();
      this.vc.toolManager.rulerGuides.toggle();
    });

    document.getElementById('menu-btn-reset-view')?.addEventListener('click', () => {
      this.closeMoreMenu();
      this.vc.viewport.fitToScreen();
      this.hideChips();
    });

    document.getElementById('menu-btn-clear-canvas')?.addEventListener('click', () => {
      this.closeMoreMenu();
      const active = this.vc.layerManager.getActiveLayer();
      if (active && !active.locked) {
        this.layerPanel.executeLayerOp('Clear Layer', () => {
          active.ctx.clearRect(0, 0, active.width, active.height);
          active.updateThumbnail();
        }, true);
      }
    });

    document.getElementById('menu-btn-new-artwork')?.addEventListener('click', () => {
      this.closeMoreMenu();
      this.app?.homeScreen?.show();
      this.app?.homeScreen?.openModal();
    });

    // Close more menu, shapes popover & eraser popover when tapping outside
    window.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#more-menu-popover, #btn-more-menu')) {
        this.closeMoreMenu();
      }
      if (!e.target.closest('#shapes-popover-menu, #top-btn-shapes')) {
        document.getElementById('shapes-popover-menu')?.classList.add('hidden');
      }
      if (!e.target.closest('#eraser-popover-menu, #bar-btn-eraser')) {
        this.closeEraserMenu();
      }
    });

    // TOP PANEL TOOLS (Box Select, Transform, Shapes, Guides, Symmetry)
    document.getElementById('top-btn-box-select')?.addEventListener('click', () => {
      this.selectTool('selection', 'top-btn-box-select');
    });

    document.getElementById('top-btn-transform')?.addEventListener('click', () => {
      const activeLayer = this.vc.layerManager.getActiveLayer();
      if (!this.vc.toolManager.transformTool.active && activeLayer) {
        const patch = this.vc.toolManager.selectionTool.hasSelection
          ? this.vc.toolManager.selectionTool.cutSelectedPixels(activeLayer)
          : null;
        this.vc.toolManager.transformTool.activate(activeLayer, patch);
        this.vc.toolManager.selectionTool.clear();
      }
      this.selectTool('transform', 'top-btn-transform');
    });

    document.getElementById('top-btn-pan')?.addEventListener('click', () => {
      this.selectTool('pan', 'top-btn-pan');
    });

    document.getElementById('top-btn-shapes')?.addEventListener('click', () => {
      this.selectTool('shape', 'top-btn-shapes');
      const popover = document.getElementById('shapes-popover-menu');
      if (popover) {
        popover.classList.toggle('hidden');
      }
    });

    document.querySelectorAll('.shapes-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const shape = item.dataset.shape || 'rect';
        this.vc.toolManager.shapeTool.setShape(shape);
        document.getElementById('shapes-popover-menu')?.classList.add('hidden');
        this.selectTool('shape', 'top-btn-shapes');
      });
    });

    document.getElementById('top-btn-guides')?.addEventListener('click', () => {
      this.vc.toolManager.rulerGuides.toggle();
      const mode = this.vc.toolManager.rulerGuides.mode;
      const label = document.getElementById('top-guides-label');
      if (label) {
        label.textContent = mode === 'off' ? 'Guides' : (mode.charAt(0).toUpperCase() + mode.slice(1));
      }
      document.getElementById('top-btn-guides')?.classList.toggle('active', mode !== 'off');
    });

    document.getElementById('top-btn-symmetry')?.addEventListener('click', () => {
      const mode = this.vc.toolManager.symmetry.toggle();
      const isActive = mode !== 'off';
      document.getElementById('top-btn-symmetry')?.classList.toggle('active', isActive);
      const label = document.getElementById('top-symmetry-label');
      if (label) {
        label.textContent = mode === 'off' ? 'Symmetry' : (mode.charAt(0).toUpperCase() + mode.slice(1));
      }
      if (isActive) {
        this.toolPanel?.update('symmetry');
      } else {
        this.toolPanel?.update(this.activeTool);
      }
      this.vc.needsRender = true;
    });

    // BOTTOM TOOLBAR BUTTONS (Pen/Brush, Eraser, Smudge, Fill, Lasso, Colour, Layers)
    const toolbarItems = [
      { id: 'bar-btn-brush', tool: 'brush' },
      { id: 'bar-btn-eraser', tool: 'eraser' },
      { id: 'bar-btn-smudge', tool: 'smudge' },
      { id: 'bar-btn-fill', tool: 'bucket' },
      { id: 'bar-btn-lasso', tool: 'lasso-fill' }
    ];

    for (const item of toolbarItems) {
      const btn = document.getElementById(item.id);
      if (!btn) continue;

      btn.addEventListener('click', () => {
        if (item.tool === 'brush' && this.activeTool === 'brush') {
          // Second tap on active Brush opens Brush Studio sheet
          this.toggleSheet('brushes');
          return;
        }
        if (item.tool === 'eraser' && this.activeTool === 'eraser') {
          // Second tap on active Eraser opens Eraser popup menu
          this.toggleEraserMenu();
          return;
        }
        if (item.tool === 'lasso-fill' && this.activeTool === 'lasso-fill') {
          // Second tap on active Lasso opens Lasso Studio sheet
          this.toggleSheet('lasso');
          return;
        }
        this.closeEraserMenu();
        this.selectTool(item.tool, item.id);
      });
    }

    // Colour Swatch Button -> Colour Sheet
    document.getElementById('bar-btn-color')?.addEventListener('click', () => {
      this.toggleSheet('color');
    });

    // Layers Button -> Layers Sheet
    document.getElementById('bar-btn-layers')?.addEventListener('click', () => {
      this.toggleSheet('layers');
    });

    // Sheet close buttons
    document.querySelectorAll('.sheet-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeSheets());
    });

    // Header tabs inside sheets
    document.getElementById('bp-tab-library')?.addEventListener('click', () => {
      this.brushPanel.activeTab = 'library';
    });
    document.getElementById('bp-tab-settings')?.addEventListener('click', () => {
      this.brushPanel.activeTab = 'settings';
    });

    // Header tabs for Lasso Studio
    document.getElementById('lp-tab-library')?.addEventListener('click', () => {
      this.lassoPanel.setTab('library');
    });
    document.getElementById('lp-tab-settings')?.addEventListener('click', () => {
      this.lassoPanel.setTab('settings');
    });

    ['disc', 'classic', 'sliders', 'palettes'].forEach(t => {
      document.getElementById(`cp-tab-${t}`)?.addEventListener('click', () => {
        this.colorPicker.setTab(t);
      });
    });

    // Rotation chip tap resets rotation to 0
    this.rotationChip?.addEventListener('click', () => {
      this.vc.viewport.rotation = 0;
      this.rotationChip.classList.add('fade-out');
    });

    // Export Modal buttons
    this.setupExportEvents();

    // Android back button
    window.handleAndroidBack = () => {
      if (this.moreMenuPopover?.classList.contains('open')) {
        this.closeMoreMenu();
        return true;
      }
      if (this.activeSheet) {
        this.closeSheets();
        return true;
      }
      if (this.exportModal?.classList.contains('open')) {
        this.exportModal.classList.remove('open');
        return true;
      }
      if (this.canvasInfoModal?.classList.contains('open')) {
        this.canvasInfoModal.classList.remove('open');
        return true;
      }
      if (this.settingsModal?.classList.contains('open')) {
        this.settingsDialog.close();
        return true;
      }
      if (this.app.homeScreen && !document.getElementById('home-screen').classList.contains('hidden')) {
        if (this.app.homeScreen.handleBack && this.app.homeScreen.handleBack()) {
          return true;
        }
        return false;
      }
      this.app.openGallery();
      return true;
    };
  }

  selectTool(toolName, btnId) {
    this.activeTool = toolName;
    this.vc.toolManager.setTool(toolName, this.vc.layerManager.getActiveLayer());

    document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.top-panel-btn').forEach(b => {
      if (b.id !== 'top-btn-guides' && b.id !== 'top-btn-symmetry') {
        b.classList.remove('active');
      }
    });

    if (btnId) {
      document.getElementById(btnId)?.classList.add('active');
    }

    this.updateTopPanelContext(toolName);
    this.updateEdgeSliders();
    this.toolPanel?.update(toolName);
  }

  updateTopPanelContext(toolName) {
    const ctxEl = document.getElementById('top-panel-context');
    if (!ctxEl) return;

    if (toolName === 'selection') {
      ctxEl.classList.remove('hidden');
      ctxEl.innerHTML = `
        <button class="context-chip" id="ctx-btn-deselect">Deselect</button>
        <button class="context-chip primary" id="ctx-btn-cut-move">Transform</button>
        <button class="context-chip" id="ctx-btn-invert">Invert</button>
        <button class="context-chip" id="ctx-btn-clear">Clear</button>
      `;

      ctxEl.querySelector('#ctx-btn-deselect')?.addEventListener('click', () => {
        this.vc.toolManager.selectionTool.clear();
      });
      ctxEl.querySelector('#ctx-btn-cut-move')?.addEventListener('click', () => {
        const activeLayer = this.vc.layerManager.getActiveLayer();
        if (activeLayer && this.vc.toolManager.selectionTool.hasSelection) {
          const patch = this.vc.toolManager.selectionTool.cutSelectedPixels(activeLayer);
          this.vc.toolManager.transformTool.activate(activeLayer, patch);
          this.vc.toolManager.selectionTool.clear();
          this.selectTool('transform', 'top-btn-transform');
        }
      });
      ctxEl.querySelector('#ctx-btn-invert')?.addEventListener('click', () => {
        this.vc.toolManager.selectionTool.invert(this.vc.docWidth, this.vc.docHeight);
        this.vc.needsRender = true;
      });
      ctxEl.querySelector('#ctx-btn-clear')?.addEventListener('click', () => {
        const activeLayer = this.vc.layerManager.getActiveLayer();
        if (activeLayer && this.vc.toolManager.selectionTool.hasSelection) {
          this.vc.toolManager.selectionTool.clearSelectedArea(
            activeLayer,
            this.vc.history,
            () => {
              this.vc.layerManager.invalidateCaches();
              this.vc.needsRender = true;
              this.app?.markDirty?.();
            }
          );
        }
      });
    } else if (toolName === 'transform') {
      ctxEl.classList.remove('hidden');
      ctxEl.innerHTML = `
        <button class="context-chip" id="ctx-btn-fliph">Flip H</button>
        <button class="context-chip" id="ctx-btn-flipv">Flip V</button>
        <button class="context-chip primary" id="ctx-btn-apply">Done</button>
        <button class="context-chip" id="ctx-btn-cancel">Cancel</button>
      `;

      ctxEl.querySelector('#ctx-btn-fliph')?.addEventListener('click', () => {
        this.vc.toolManager.transformTool.flipH();
      });
      ctxEl.querySelector('#ctx-btn-flipv')?.addEventListener('click', () => {
        this.vc.toolManager.transformTool.flipV();
      });
      ctxEl.querySelector('#ctx-btn-apply')?.addEventListener('click', () => {
        this.vc.toolManager.transformTool.applyTransform();
        this.selectTool('brush', 'bar-btn-brush');
      });
      ctxEl.querySelector('#ctx-btn-cancel')?.addEventListener('click', () => {
        this.vc.toolManager.transformTool.cancel();
        this.selectTool('brush', 'bar-btn-brush');
      });
    } else {
      ctxEl.classList.add('hidden');
      ctxEl.innerHTML = '';
    }
  }

  toggleMoreMenu() {
    this.moreMenuPopover?.classList.toggle('open');
  }

  closeMoreMenu() {
    this.moreMenuPopover?.classList.remove('open');
  }

  toggleSheet(name) {
    if (this.activeSheet === name) {
      this.closeSheets();
    } else {
      this.openSheet(name);
    }
  }

  openSheet(name) {
    this.closeSheets();
    this.activeSheet = name;

    const map = {
      brushes: this.sheetBrushes,
      lasso: this.sheetLasso,
      color: this.sheetColor,
      layers: this.sheetLayers
    };

    const sheet = map[name];
    if (sheet) {
      sheet.style.transform = '';
      sheet.classList.add('open');
      if (name === 'layers') this.layerPanel.render();
      if (name === 'brushes') this.brushPanel.render();
      if (name === 'lasso') this.lassoPanel.render();
      if (name === 'color') this.colorPicker.render();
    }
  }

  closeSheets() {
    this.activeSheet = null;
    [this.sheetBrushes, this.sheetLasso, this.sheetColor, this.sheetLayers].forEach(s => {
      if (s) {
        s.classList.remove('open');
        s.style.transform = '';
        s.style.maxHeight = '';
      }
    });
  }

  setupSheetGestures() {
    [this.sheetBrushes, this.sheetLasso, this.sheetColor, this.sheetLayers].forEach(sheet => {
      if (!sheet) return;
      const handleZone = sheet.querySelector('.sheet-drag-handle-zone');
      if (!handleZone) return;

      let startY = 0;
      let isDragging = false;
      let startHeight = 0;

      handleZone.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startHeight = sheet.getBoundingClientRect().height;
        sheet.style.transition = 'none';
        try { handleZone.setPointerCapture(e.pointerId); } catch (_) {}
      });

      handleZone.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dy = e.clientY - startY;
        if (dy > 0) {
          sheet.style.transform = `translateY(${dy}px)`;
        } else {
          const newH = Math.min(window.innerHeight * 0.9, startHeight - dy);
          sheet.style.maxHeight = `${newH}px`;
        }
      });

      const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        sheet.style.transition = '';
        const dy = e.clientY - startY;

        if (dy > 100) {
          // Closed snap point
          this.closeSheets();
        } else if (dy > 30) {
          // 40% snap point
          sheet.style.transform = 'translateY(0)';
          sheet.style.maxHeight = '40vh';
        } else if (dy < -40) {
          // 70% or full snap point
          sheet.style.transform = 'translateY(0)';
          sheet.style.maxHeight = '70vh';
        } else {
          sheet.style.transform = 'translateY(0)';
        }
      };

      handleZone.addEventListener('pointerup', onEnd);
      handleZone.addEventListener('pointercancel', onEnd);
    });
  }

  /**
   * 3. Edge sliders (size and opacity)
   * Two vertical sliders on left edge (x = 8px)
   * 32px hit area, 4px track, fill in --accent, 20px circular thumb.
   * Grip handle above cluster (44x16, grip dots) drags to left/right edge.
   */
  setupEdgeSlidersDragAndTrack() {
    const cluster = this.edgeSlidersCluster;
    const grip = document.getElementById('sliders-grip');
    if (!cluster || !grip) return;

    // Fixed to center vertically: top: 50%; transform: translateY(-50%)
    cluster.style.top = '50%';
    cluster.style.transform = 'translateY(-50%)';

    // Tap/click on grip handle switches side between left and right
    grip.addEventListener('click', () => {
      const isRight = cluster.classList.contains('on-right') || cluster.style.right === '8px';
      if (isRight) {
        cluster.classList.remove('on-right');
        cluster.style.left = '8px';
        cluster.style.right = 'auto';
      } else {
        cluster.classList.add('on-right');
        cluster.style.left = 'auto';
        cluster.style.right = '8px';
      }
      cluster.style.top = '50%';
      cluster.style.transform = 'translateY(-50%)';

      this.savedLayout.edgeSliders = {
        side: isRight ? 'left' : 'right'
      };
      this.saveLayout();
    });

    // Size slider interaction dynamically clamped to brush or eraser minSize/maxSize (never 0)
    this.bindVerticalTrack(
      document.getElementById('track-wrap-size'),
      document.getElementById('thumb-size'),
      document.getElementById('track-fill-size'),
      document.getElementById('bubble-size'),
      document.getElementById('slider-col-size'),
      () => this.activeTool === 'eraser' ? 1 : Math.max(1, Math.round(this.vc.currentBrush?.minSize || 1)),
      () => this.activeTool === 'eraser' ? 500 : Math.max(Math.max(1, Math.round(this.vc.currentBrush?.minSize || 1)) + 1, Math.round(this.vc.currentBrush?.maxSize || 200)),
      () => this.activeTool === 'eraser' ? Math.max(1, Math.round(this.vc.currentEraser?.size || 28)) : Math.max(1, Math.round(this.vc.currentBrush?.size || 8)),
      (val) => {
        if (this.activeTool === 'eraser') {
          if (this.vc.currentEraser) {
            this.vc.currentEraser.size = Math.max(1, Math.min(500, val));
            this.vc.saveEraserState?.();
            this.syncEraserMenuUI();
          }
        } else if (this.vc.currentBrush) {
          const min = Math.max(1, Math.round(this.vc.currentBrush.minSize || 1));
          const max = Math.max(min + 1, Math.round(this.vc.currentBrush.maxSize || 200));
          const clamped = Math.max(min, Math.min(max, val));
          this.vc.currentBrush.size = clamped;
          this.brushPanel?.persistBrushSettings?.(this.vc.currentBrush);
        }
      },
      (val) => `${val} px`
    );

    // Opacity slider interaction (1 to 100 %)
    this.bindVerticalTrack(
      document.getElementById('track-wrap-opacity'),
      document.getElementById('thumb-opacity'),
      document.getElementById('track-fill-opacity'),
      document.getElementById('bubble-opacity'),
      document.getElementById('slider-col-opacity'),
      1, 100, 100,
      (val) => {
        if (this.activeTool === 'eraser') {
          if (this.vc.currentEraser) {
            this.vc.currentEraser.opacity = Math.max(0.01, Math.min(1.0, val / 100));
            this.vc.saveEraserState?.();
            this.syncEraserMenuUI();
          }
        } else if (this.vc.currentBrush) {
          this.vc.currentBrush.opacity = Math.max(0.01, Math.min(1.0, val / 100));
          this.brushPanel?.persistBrushSettings?.(this.vc.currentBrush);
        }
      },
      (val) => `${val}%`
    );
  }

  bindVerticalTrack(trackWrap, thumb, fill, bubble, col, minOrGetter, maxOrGetter, valOrGetter, onChange, formatLabel) {
    if (!trackWrap || !thumb || !fill) return;

    let isDragging = false;
    let fadeTimeout = null;

    const showBubble = (text) => {
      if (!bubble) return;
      bubble.textContent = text;
      bubble.classList.add('visible');
      if (fadeTimeout) clearTimeout(fadeTimeout);
      fadeTimeout = setTimeout(() => {
        if (!isDragging) {
          bubble.classList.remove('visible');
        }
      }, 900);
    };

    const updateFromPointer = (clientY) => {
      const rect = trackWrap.getBoundingClientRect();
      if (!rect || rect.height <= 0) return;
      const pct = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
      const min = typeof minOrGetter === 'function' ? minOrGetter() : (typeof minOrGetter === 'number' ? minOrGetter : 1);
      const max = typeof maxOrGetter === 'function' ? maxOrGetter() : (typeof maxOrGetter === 'number' ? maxOrGetter : 100);
      const val = Math.round(min + pct * (max - min));

      thumb.style.bottom = `${Math.round(pct * 100)}%`;
      fill.style.height = `${Math.round(pct * 100)}%`;

      const label = formatLabel ? formatLabel(val) : `${val}`;
      showBubble(label);

      if (typeof onChange === 'function') {
        onChange(val);
      }
    };

    const onPointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      col?.classList.add('dragging');
      if (trackWrap.setPointerCapture) {
        try {
          trackWrap.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
      updateFromPointer(e.clientY);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      updateFromPointer(e.clientY);
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      col?.classList.remove('dragging');
      if (trackWrap.releasePointerCapture) {
        try {
          trackWrap.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
      if (fadeTimeout) clearTimeout(fadeTimeout);
      fadeTimeout = setTimeout(() => {
        bubble?.classList.remove('visible');
      }, 700);
    };

    trackWrap.addEventListener('pointerdown', onPointerDown);
    trackWrap.addEventListener('pointermove', onPointerMove);
    trackWrap.addEventListener('pointerup', onPointerUp);
    trackWrap.addEventListener('pointercancel', onPointerUp);
  }

  setupEraserMenuEvents() {
    const popover = document.getElementById('eraser-popover-menu');
    if (!popover) return;

    document.getElementById('eraser-popover-close')?.addEventListener('click', () => {
      this.closeEraserMenu();
    });

    const sizeSlider = document.getElementById('eraser-size-slider');
    const sizeVal = document.getElementById('eraser-size-val');
    const opacitySlider = document.getElementById('eraser-opacity-slider');
    const opacityVal = document.getElementById('eraser-opacity-val');
    const hardnessSlider = document.getElementById('eraser-hardness-slider');
    const hardnessVal = document.getElementById('eraser-hardness-val');
    const spacingSlider = document.getElementById('eraser-spacing-slider');
    const spacingVal = document.getElementById('eraser-spacing-val');

    sizeSlider?.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      this.vc.currentEraser.size = v;
      if (sizeVal) sizeVal.textContent = `${v}px`;
      this.vc.saveEraserState?.();
      this.updateEdgeSliders();
    });

    opacitySlider?.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      this.vc.currentEraser.opacity = v / 100;
      if (opacityVal) opacityVal.textContent = `${v}%`;
      this.vc.saveEraserState?.();
      this.updateEdgeSliders();
    });

    hardnessSlider?.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      this.vc.currentEraser.hardness = v / 100;
      if (hardnessVal) hardnessVal.textContent = `${v}%`;
      this.vc.saveEraserState?.();
    });

    spacingSlider?.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      this.vc.currentEraser.spacing = v / 100;
      if (spacingVal) spacingVal.textContent = `${v}%`;
      this.vc.saveEraserState?.();
    });

    // Preset types: Hard, Airbrush, Soft
    popover.querySelectorAll('.eraser-type-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const type = chip.dataset.type;
        popover.querySelectorAll('.eraser-type-chip').forEach(c => {
          const isActive = c.dataset.type === type;
          c.classList.toggle('active', isActive);
          c.style.background = isActive ? 'var(--accent)' : 'var(--control)';
          c.style.color = isActive ? '#ffffff' : 'var(--text)';
        });

        this.vc.currentEraser.type = type;
        if (type === 'hard') {
          this.vc.currentEraser.hardness = 1.0;
          this.vc.currentEraser.spacing = 0.05;
          this.vc.currentEraser.tipShape = 'round';
        } else if (type === 'airbrush') {
          this.vc.currentEraser.hardness = 0.1;
          this.vc.currentEraser.spacing = 0.04;
          this.vc.currentEraser.tipShape = 'soft';
        } else if (type === 'soft') {
          this.vc.currentEraser.hardness = 0.4;
          this.vc.currentEraser.spacing = 0.06;
          this.vc.currentEraser.tipShape = 'soft';
        }
        this.vc.saveEraserState?.();
        this.syncEraserMenuUI();
        this.updateEdgeSliders();
      });
    });

    this.syncEraserMenuUI();
  }

  syncEraserMenuUI() {
    const e = this.vc.currentEraser;
    if (!e) return;
    const popover = document.getElementById('eraser-popover-menu');
    if (!popover) return;

    popover.querySelectorAll('.eraser-type-chip').forEach(c => {
      const isActive = c.dataset.type === (e.type || 'hard');
      c.classList.toggle('active', isActive);
      c.style.background = isActive ? 'var(--accent)' : 'var(--control)';
      c.style.color = isActive ? '#ffffff' : 'var(--text)';
    });

    const sizeSlider = document.getElementById('eraser-size-slider');
    const sizeVal = document.getElementById('eraser-size-val');
    const opacitySlider = document.getElementById('eraser-opacity-slider');
    const opacityVal = document.getElementById('eraser-opacity-val');
    const hardnessSlider = document.getElementById('eraser-hardness-slider');
    const hardnessVal = document.getElementById('eraser-hardness-val');
    const spacingSlider = document.getElementById('eraser-spacing-slider');
    const spacingVal = document.getElementById('eraser-spacing-val');

    if (sizeSlider) sizeSlider.value = e.size || 28;
    if (sizeVal) sizeVal.textContent = `${Math.round(e.size || 28)}px`;
    if (opacitySlider) opacitySlider.value = Math.round((e.opacity ?? 1.0) * 100);
    if (opacityVal) opacityVal.textContent = `${Math.round((e.opacity ?? 1.0) * 100)}%`;
    if (hardnessSlider) hardnessSlider.value = Math.round((e.hardness ?? 1.0) * 100);
    if (hardnessVal) hardnessVal.textContent = `${Math.round((e.hardness ?? 1.0) * 100)}%`;
    if (spacingSlider) spacingSlider.value = Math.round((e.spacing ?? 0.05) * 100);
    if (spacingVal) spacingVal.textContent = `${Math.round((e.spacing ?? 0.05) * 100)}%`;
  }

  toggleEraserMenu() {
    const popover = document.getElementById('eraser-popover-menu');
    if (popover) {
      const isHidden = popover.classList.contains('hidden');
      if (isHidden) {
        this.syncEraserMenuUI();
        popover.classList.remove('hidden');
      } else {
        popover.classList.add('hidden');
      }
    }
  }

  closeEraserMenu() {
    document.getElementById('eraser-popover-menu')?.classList.add('hidden');
  }

  updateEdgeSliders() {
    if (this.activeTool === 'eraser') {
      const e = this.vc.currentEraser;
      if (!e) return;
      const minSize = 1;
      const maxSize = 500;
      const curSize = Math.max(1, Math.min(500, e.size || 28));

      const thumbSize = document.getElementById('thumb-size');
      const fillSize = document.getElementById('track-fill-size');
      const bubbleSize = document.getElementById('bubble-size');
      const pctSize = Math.max(0, Math.min(1, (curSize - minSize) / (maxSize - minSize)));
      if (thumbSize) thumbSize.style.bottom = `${Math.round(pctSize * 100)}%`;
      if (fillSize) fillSize.style.height = `${Math.round(pctSize * 100)}%`;
      if (bubbleSize) bubbleSize.textContent = `${Math.round(curSize)} px`;

      const opac = Math.round((e.opacity ?? 1.0) * 100);
      const thumbOpac = document.getElementById('thumb-opacity');
      const fillOpac = document.getElementById('track-fill-opacity');
      const bubbleOpac = document.getElementById('bubble-opacity');
      if (thumbOpac) thumbOpac.style.bottom = `${opac}%`;
      if (fillOpac) fillOpac.style.height = `${opac}%`;
      if (bubbleOpac) bubbleOpac.textContent = `${opac}%`;
    } else {
      const b = this.vc.currentBrush;
      if (!b) return;

      const minSize = Math.max(1, Math.round(b.minSize || 1));
      const maxSize = Math.max(minSize + 1, Math.round(b.maxSize || 200));
      b.size = Math.max(minSize, Math.min(maxSize, b.size || 8));

      const thumbSize = document.getElementById('thumb-size');
      const fillSize = document.getElementById('track-fill-size');
      const bubbleSize = document.getElementById('bubble-size');
      const pctSize = Math.max(0, Math.min(1, (b.size - minSize) / (maxSize - minSize)));
      if (thumbSize) thumbSize.style.bottom = `${Math.round(pctSize * 100)}%`;
      if (fillSize) fillSize.style.height = `${Math.round(pctSize * 100)}%`;
      if (bubbleSize) bubbleSize.textContent = `${Math.round(b.size)} px`;

      const opac = Math.round((b.opacity ?? 1.0) * 100);
      const thumbOpac = document.getElementById('thumb-opacity');
      const fillOpac = document.getElementById('track-fill-opacity');
      const bubbleOpac = document.getElementById('bubble-opacity');
      if (thumbOpac) thumbOpac.style.bottom = `${opac}%`;
      if (fillOpac) fillOpac.style.height = `${opac}%`;
      if (bubbleOpac) bubbleOpac.textContent = `${opac}%`;
    }
  }

  updateEdgeSlidersFromBrush() {
    this.updateEdgeSliders();
  }

  setupViewportFeedback() {
    const vp = this.vc?.viewport;
    if (!vp) return;

    vp.onNavigate = (zoom, rotation) => {
      if (this.zoomChip) {
        this.zoomChip.textContent = `${Math.round(zoom * 100)}%`;
        this.zoomChip.classList.remove('fade-out');
        if (this.zoomChipTimer) clearTimeout(this.zoomChipTimer);
        this.zoomChipTimer = setTimeout(() => {
          this.zoomChip?.classList.add('fade-out');
        }, 1000);
      }

      if (this.rotationChip) {
        const deg = Math.round((rotation * 180 / Math.PI) % 360);
        if (Math.abs(deg) > 1) {
          this.rotationChip.textContent = `${deg}°`;
          this.rotationChip.classList.remove('fade-out');
        } else {
          this.rotationChip.classList.add('fade-out');
        }
      }
    };
  }

  hideChips() {
    this.zoomChip?.classList.add('fade-out');
    this.rotationChip?.classList.add('fade-out');
  }

  updateColorAffordances(hex) {
    const primary = document.getElementById('swatch-primary');
    if (primary) primary.style.background = hex;
  }

  updateLayerBadge() {
    // No-op or update badge if present
  }

  openExportModal() {
    this.exportModal?.classList.add('open');
  }

  openCanvasInfoModal() {
    const w = this.vc.docWidth || 1080;
    const h = this.vc.docHeight || 1080;
    const layers = this.vc.layerManager?.layers?.length || 1;
    const dimsEl = document.getElementById('info-dims');
    const layersEl = document.getElementById('info-layers-count');
    if (dimsEl) dimsEl.textContent = `${w} × ${h} px`;
    if (layersEl) layersEl.textContent = `${layers}`;
    this.canvasInfoModal?.classList.add('open');
  }

  setupExportEvents() {
    document.getElementById('exp-close-btn')?.addEventListener('click', () => {
      this.exportModal?.classList.remove('open');
    });

    document.getElementById('info-close-btn')?.addEventListener('click', () => {
      this.canvasInfoModal?.classList.remove('open');
    });

    this.exportModal?.addEventListener('click', (e) => {
      if (e.target === this.exportModal) {
        this.exportModal.classList.remove('open');
      }
    });

    this.canvasInfoModal?.addEventListener('click', (e) => {
      if (e.target === this.canvasInfoModal) {
        this.canvasInfoModal.classList.remove('open');
      }
    });

    document.getElementById('exp-btn-png-1x')?.addEventListener('click', async () => {
      const name = (this.app.currentProject?.name || 'artwork').replace(/\s+/g, '_');
      const blob = await this.app.exporter.exportRaster('image/png', 0.95, false, 1);
      if (blob) {
        await this.app.exporter.shareOrDownload(blob, `${name}.png`, 'image/png');
      }
      this.exportModal?.classList.remove('open');
    });

    document.getElementById('exp-btn-png-4x')?.addEventListener('click', async () => {
      const name = (this.app.currentProject?.name || 'artwork').replace(/\s+/g, '_');
      const blob = await this.app.exporter.exportRaster('image/png', 0.95, false, 4);
      if (blob) {
        await this.app.exporter.shareOrDownload(blob, `${name}_4x.png`, 'image/png');
      }
      this.exportModal?.classList.remove('open');
    });

    document.getElementById('exp-btn-svg')?.addEventListener('click', async () => {
      const name = (this.app.currentProject?.name || 'artwork').replace(/\s+/g, '_');
      const svgStr = this.app.exporter.exportSVG(false);
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      await this.app.exporter.shareOrDownload(blob, `${name}.svg`, 'image/svg+xml');
      this.exportModal?.classList.remove('open');
    });

    document.getElementById('exp-btn-json')?.addEventListener('click', async () => {
      const name = (this.app.currentProject?.name || 'artwork').replace(/\s+/g, '_');
      const data = JSON.stringify(this.app.currentProject || {}, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      await this.app.exporter.shareOrDownload(blob, `${name}.vectura`, 'application/json');
      this.exportModal?.classList.remove('open');
    });
  }

  updateHistoryState(state) {
    if (this.undoBtn) this.undoBtn.disabled = !state.canUndo;
    if (this.redoBtn) this.redoBtn.disabled = !state.canRedo;
  }
}
