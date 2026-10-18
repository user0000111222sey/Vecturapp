/**
 * Vectura UI Manager
 * Master UI coordinator connecting user gestures, panels, sliders, dialogs and drawing engine.
 */
import { ColorPicker } from './ColorPicker.js';
import { LayerPanel } from './LayerPanel.js';
import { BrushPanel } from './BrushPanel.js';
import { ToolPanel } from './ToolPanel.js';
import { SettingsDialog } from './SettingsDialog.js';
import { Tutorial } from './Tutorial.js';

export class UIManager {
  constructor(app) {
    this.app = app;
    this.vc = app.vectorCanvas;

    this.activeSheet = null; // 'layers' | 'brushes' | 'color' | 'tools'
    this.uiHidden = false;

    this.initElements();
    this.initPanels();
    this.setupEventListeners();
  }

  initElements() {
    this.topBar = document.getElementById('top-bar');
    this.toolbar = document.getElementById('toolbar');
    this.toolsPopover = document.getElementById('tools-popover');
    this.edgeSliders = document.getElementById('edge-sliders');
    this.uiOverlay = document.getElementById('ui-overlay');

    this.undoBtn = document.getElementById('btn-undo');
    this.redoBtn = document.getElementById('btn-redo');
    this.projectTitle = document.getElementById('project-title-display');

    // Edge sliders
    this.sizeSlider = document.getElementById('edge-size-slider');
    this.sizeDot = document.getElementById('edge-size-dot');
    this.sizeLabel = document.getElementById('edge-size-label');

    this.opacitySlider = document.getElementById('edge-opacity-slider');
    this.opacityDot = document.getElementById('edge-opacity-dot');
    this.opacityLabel = document.getElementById('edge-opacity-label');

    // Bottom Sheets
    this.sheetLayers = document.getElementById('sheet-layers');
    this.sheetBrushes = document.getElementById('sheet-brushes');
    this.sheetColor = document.getElementById('sheet-color');
    this.sheetTools = document.getElementById('sheet-tools');

    // Modals
    this.exportModal = document.getElementById('export-modal');
    this.settingsModal = document.getElementById('settings-modal');
    this.tutorialModal = document.getElementById('tutorial-modal');
  }

  initPanels() {
    // 1. Color Picker
    this.colorPicker = new ColorPicker(
      document.getElementById('sheet-color-content'),
      (hex) => {
        this.vc.currentColor = hex;
        this.updateColorAffordances(hex);
      }
    );

    // 2. Layer Panel
    this.layerPanel = new LayerPanel(
      document.getElementById('sheet-layers-content'),
      this.vc.layerManager,
      () => {
        this.updateLayerBadge();
      }
    );

    // 3. Brush Panel
    this.brushPanel = new BrushPanel(
      document.getElementById('sheet-brushes-content'),
      this.vc.currentBrush,
      (brush) => {
        this.vc.currentBrush = brush;
        this.updateEdgeSlidersFromBrush();
      }
    );

    // 4. Tool Panel
    this.toolPanel = new ToolPanel(
      document.getElementById('sheet-tools-content'),
      this.vc.toolManager,
      (action) => {
        if (action === 'transform-apply') {
          this.vc.redrawActiveLayer();
          this.closeSheets();
        } else if (action === 'point-editor-delete') {
          this.vc.toolManager.vectorPointEditor.deleteSelectedPoint(() => this.vc.redrawActiveLayer());
        } else if (action === 'point-editor-simplify') {
          this.vc.toolManager.vectorPointEditor.simplifyStroke(() => this.vc.redrawActiveLayer());
        }
      }
    );

    // 5. Settings
    this.settingsDialog = new SettingsDialog(
      this.settingsModal,
      this.app.config,
      (key, val) => this.app.onConfigChanged(key, val)
    );

    // 6. Tutorial
    this.tutorial = new Tutorial(this.tutorialModal);
  }

  setupEventListeners() {
    // Top Bar Actions
    this.undoBtn?.addEventListener('click', () => this.app.undo());
    this.redoBtn?.addEventListener('click', () => this.app.redo());
    document.getElementById('btn-home')?.addEventListener('click', () => this.app.openGallery());
    document.getElementById('btn-fit-view')?.addEventListener('click', () => this.vc.viewport.fitToScreen());
    document.getElementById('btn-mirror-view')?.addEventListener('click', () => this.vc.viewport.toggleMirror());
    document.getElementById('btn-export')?.addEventListener('click', () => this.openExportModal());
    document.getElementById('btn-settings')?.addEventListener('click', () => this.settingsDialog.open());

    // Project Name edit
    this.projectTitle?.addEventListener('click', () => {
      const newName = prompt('Rename Artwork:', this.app.currentProject.name);
      if (newName && newName.trim()) {
        this.app.currentProject.name = newName.trim();
        this.projectTitle.textContent = newName.trim();
        this.app.saveCurrentProject();
      }
    });

    // Hide UI toggle
    document.getElementById('btn-toggle-ui')?.addEventListener('click', () => this.toggleHideUI());
    document.getElementById('btn-show-ui-floating')?.addEventListener('click', () => this.toggleHideUI());

    // Primary Toolbar Buttons
    const toolBtns = {
      'tool-btn-brush': 'brush',
      'tool-btn-eraser': 'eraser',
      'tool-btn-bucket': 'bucket',
      'tool-btn-lasso': 'lasso-fill'
    };

    for (const [btnId, toolName] of Object.entries(toolBtns)) {
      document.getElementById(btnId)?.addEventListener('click', () => {
        // If brush is already active and user taps brush again, open brush studio sheet!
        if (toolName === 'brush' && this.vc.toolManager.activeTool === 'brush') {
          this.toggleSheet('brushes');
          return;
        }
        this.closePopover();
        this.selectTool(toolName, btnId);
      });
    }

    // "More Tools" popover toggle
    document.getElementById('tool-btn-more-tools')?.addEventListener('click', () => {
      this.toolsPopover?.classList.toggle('open');
    });

    // Popover Sub-tools
    const popoverTools = {
      'tool-btn-shape': 'shape',
      'tool-btn-gradient': 'gradient',
      'tool-btn-text': 'text',
      'tool-btn-symmetry': 'symmetry'
    };

    for (const [btnId, toolName] of Object.entries(popoverTools)) {
      document.getElementById(btnId)?.addEventListener('click', () => {
        this.closePopover();
        this.selectTool(toolName, btnId);
      });
    }

    // Color button -> Color Sheet
    document.getElementById('tool-btn-color')?.addEventListener('click', () => {
      this.closePopover();
      this.toggleSheet('color');
    });

    // Layers button -> Layers Sheet
    document.getElementById('tool-btn-layers')?.addEventListener('click', () => {
      this.closePopover();
      this.toggleSheet('layers');
    });

    // Sheet close buttons & handle bars
    document.querySelectorAll('.sheet-close-btn, .sheet-handle-bar').forEach(el => {
      el.addEventListener('click', () => this.closeSheets());
    });

    // Edge Size Slider
    this.sizeSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (this.vc.currentBrush) {
        this.vc.currentBrush.size = val;
      }
      this.updateSizeSliderPreview(val);
    });

    // Edge Opacity Slider
    this.opacitySlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 100;
      if (this.vc.currentBrush) {
        this.vc.currentBrush.opacity = val;
      }
      this.updateOpacitySliderPreview(val);
    });

    // Export Modal Controls
    this.setupExportEvents();

    // Android Hardware Back Button Hook
    window.handleAndroidBack = () => {
      if (this.toolsPopover?.classList.contains('open')) {
        this.closePopover();
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
      if (this.settingsModal?.classList.contains('open')) {
        this.settingsDialog.close();
        return true;
      }
      if (this.tutorialModal?.classList.contains('open')) {
        this.tutorial.finish();
        return true;
      }
      if (this.uiHidden) {
        this.toggleHideUI();
        return true;
      }
      if (!document.getElementById('home-screen').classList.contains('hidden')) {
        return false; // Exit app
      }
      // Return to gallery
      this.app.openGallery();
      return true;
    };
  }

  closePopover() {
    this.toolsPopover?.classList.remove('open');
  }

  selectTool(toolName, btnId) {
    if (toolName === 'text') {
      const text = prompt('Enter text:');
      if (text && text.trim()) {
        const center = this.vc.viewport.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        this.vc.toolManager.textTool.commitText(
          this.vc.layerManager.getActiveLayer(),
          text.trim(),
          center.x,
          center.y,
          this.vc.currentColor
        );
        this.vc.layerManager.invalidateCaches();
      }
      return;
    }

    this.vc.toolManager.setTool(toolName, this.vc.layerManager.getActiveLayer());

    // Highlight active button
    document.querySelectorAll('#toolbar .glass-btn, #tools-popover .glass-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(btnId)?.classList.add('active');

    // Update tool panel options
    this.toolPanel.update(toolName);

    // Auto open options sheet for complex tools
    if (toolName === 'bucket' || toolName === 'transform' || toolName === 'symmetry' || toolName === 'shape') {
      this.openSheet('tools');
    }
  }

  toggleSheet(sheetName) {
    if (this.activeSheet === sheetName) {
      this.closeSheets();
    } else {
      this.openSheet(sheetName);
    }
  }

  openSheet(sheetName) {
    this.closeSheets();
    this.activeSheet = sheetName;
    const sheetMap = {
      layers: this.sheetLayers,
      brushes: this.sheetBrushes,
      color: this.sheetColor,
      tools: this.sheetTools
    };
    const target = sheetMap[sheetName];
    if (target) {
      target.classList.add('open');
      if (sheetName === 'layers') this.layerPanel.render();
      if (sheetName === 'brushes') this.brushPanel.render();
      if (sheetName === 'tools') this.toolPanel.render();
      if (sheetName === 'color') this.colorPicker.updateCanvas();
    }
  }

  closeSheets() {
    this.sheetLayers?.classList.remove('open');
    this.sheetBrushes?.classList.remove('open');
    this.sheetColor?.classList.remove('open');
    this.sheetTools?.classList.remove('open');
    this.activeSheet = null;
  }

  toggleHideUI() {
    this.uiHidden = !this.uiHidden;
    const overlay = document.getElementById('ui-overlay');
    const showBtn = document.getElementById('btn-show-ui-floating');

    if (this.uiHidden) {
      overlay.classList.add('hidden-ui');
      if (showBtn) showBtn.style.display = 'flex';
      this.closeSheets();
      this.closePopover();
    } else {
      overlay.classList.remove('hidden-ui');
      if (showBtn) showBtn.style.display = 'none';
    }
  }

  updateEdgeSlidersFromBrush() {
    if (!this.vc.currentBrush) return;
    const b = this.vc.currentBrush;
    if (this.sizeSlider) this.sizeSlider.value = b.size;
    this.updateSizeSliderPreview(b.size);

    if (this.opacitySlider) this.opacitySlider.value = Math.round(b.opacity * 100);
    this.updateOpacitySliderPreview(b.opacity);
  }

  updateSizeSliderPreview(size) {
    if (this.sizeLabel) this.sizeLabel.textContent = `${size}px`;
    if (this.sizeDot) {
      const dotInner = this.sizeDot.querySelector('.slider-preview-dot-inner');
      if (dotInner) {
        const visual = Math.max(3, Math.min(16, size * 0.35));
        dotInner.style.width = visual + 'px';
        dotInner.style.height = visual + 'px';
      }
    }
  }

  updateOpacitySliderPreview(opacity) {
    if (this.opacityLabel) this.opacityLabel.textContent = `${Math.round(opacity * 100)}%`;
    if (this.opacityDot) {
      const dotInner = this.opacityDot.querySelector('.slider-preview-dot-inner');
      if (dotInner) {
        dotInner.style.opacity = opacity;
      }
    }
  }

  updateColorAffordances(hex) {
    const colorDot = document.getElementById('tool-btn-color-dot');
    if (colorDot) colorDot.style.backgroundColor = hex;
    document.querySelectorAll('.slider-preview-dot-inner').forEach(el => {
      el.style.backgroundColor = hex;
    });
  }

  updateLayerBadge() {
    const badge = document.getElementById('tool-layers-badge');
    if (badge) {
      badge.style.display = this.vc.layerManager.layers.length > 1 ? 'block' : 'none';
    }
  }

  updateHistoryUI(state) {
    if (this.undoBtn) {
      this.undoBtn.classList.toggle('disabled', !state.canUndo);
    }
    if (this.redoBtn) {
      this.redoBtn.classList.toggle('disabled', !state.canRedo);
    }
  }

  openExportModal() {
    this.closeSheets();
    this.closePopover();
    this.exportModal?.classList.add('open');
  }

  setupExportEvents() {
    const modal = this.exportModal;
    modal?.querySelector('#exp-close-btn')?.addEventListener('click', () => modal.classList.remove('open'));

    // PNG Export
    modal?.querySelector('#exp-btn-png')?.addEventListener('click', async () => {
      const trans = modal.querySelector('#exp-png-trans')?.checked;
      const blob = await this.app.exporter.exportRaster('image/png', 1.0, trans);
      await this.app.exporter.shareOrDownload(blob, `${this.app.currentProject.name || 'artwork'}.png`, 'image/png');
      modal.classList.remove('open');
    });

    // JPEG Export
    modal?.querySelector('#exp-btn-jpg')?.addEventListener('click', async () => {
      const blob = await this.app.exporter.exportRaster('image/jpeg', 0.92, false);
      await this.app.exporter.shareOrDownload(blob, `${this.app.currentProject.name || 'artwork'}.jpg`, 'image/jpeg');
      modal.classList.remove('open');
    });

    // True SVG Export
    modal?.querySelector('#exp-btn-svg')?.addEventListener('click', async () => {
      const svgStr = this.app.exporter.exportSVG();
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      await this.app.exporter.shareOrDownload(blob, `${this.app.currentProject.name || 'artwork'}.svg`, 'image/svg+xml');
      modal.classList.remove('open');
    });

    // Project JSON Export
    modal?.querySelector('#exp-btn-json')?.addEventListener('click', async () => {
      const jsonStr = JSON.stringify(this.app.currentProject, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      await this.app.exporter.shareOrDownload(blob, `${this.app.currentProject.name || 'artwork'}.vectura`, 'application/json');
      modal.classList.remove('open');
    });
  }
}
