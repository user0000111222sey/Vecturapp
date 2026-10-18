/**
 * Vectura Main Application Controller
 * Boots all subsystems, initializes VectorCanvas engine, history, storage, and UI.
 */
import { VectorCanvas } from './engine/VectorCanvas.js';
import { HistoryManager } from './history/HistoryManager.js';
import { IndexedDBStorage } from './storage/IndexedDBStorage.js';
import { Exporter } from './storage/Exporter.js';
import { ProjectManager } from './storage/ProjectManager.js';
import { HomeScreen } from './ui/HomeScreen.js';
import { UIManager } from './ui/UIManager.js';
import { DEFAULT_BRUSH_PRESETS } from './brushes/BrushPresets.js';
import { Brush } from './brushes/Brush.js';

class VecturaApp {
  constructor() {
    this.storage = new IndexedDBStorage();
    this.history = new HistoryManager(200);

    this.currentProject = null;
    this.vectorCanvas = null;
    this.exporter = null;
    this.uiManager = null;
    this.homeScreen = null;

    // Studio Configuration
    this.config = {
      theme: 'dark',
      leftHanded: false,
      gesturesEnabled: true,
      palmRejection: true,
      haptics: true,
      perfMode: false,
      globalSpeedFactor: 1.0
    };

    this.autosaveInterval = null;
    this.init();
  }

  async init() {
    // 1. Initialize Canvas Viewport
    const canvasEl = document.getElementById('viewport-canvas');
    this.vectorCanvas = new VectorCanvas(canvasEl, 1080, 1080);
    this.vectorCanvas.history = this.history;
    this.vectorCanvas.globalSpeedFactor = this.config.globalSpeedFactor || 1.0;
    this.vectorCanvas.currentBrush = new Brush(DEFAULT_BRUSH_PRESETS[0]);

    // 2. Setup Exporter
    this.exporter = new Exporter(this.vectorCanvas);

    // 3. Setup UI & Home Gallery
    this.uiManager = new UIManager(this);
    this.homeScreen = new HomeScreen(
      this.storage,
      (project) => this.loadProject(project),
      (options) => this.createNewProject(options)
    );

    // 4. Bind History changes to UI
    this.history.onChange((state) => {
      this.uiManager.updateHistoryUI(state);
    });

    // 5. Connect VectorCanvas callbacks
    this.vectorCanvas.onColorPicked = (hex) => {
      this.uiManager.updateColorAffordances(hex);
      this.uiManager.colorPicker.setColorHex(hex);
    };

    this.vectorCanvas.onUndoRequested = () => this.undo();
    this.vectorCanvas.onRedoRequested = () => this.redo();
    this.vectorCanvas.onHaptic = () => this.triggerHaptic();

    // 6. Setup Autosave & Lifecycle hooks
    this.setupAutosave();

    // 7. Load most recent project or create default
    await this.loadInitialProject();

    // Android Lifecycle Hooks
    window.onAndroidPause = () => {
      this.saveCurrentProject();
    };
    window.onAndroidResume = () => {
      // Resumed
    };
  }

  async loadInitialProject() {
    try {
      const all = await this.storage.getAllProjects();
      if (all && all.length > 0) {
        // Open most recently updated project
        all.sort((a, b) => b.updatedAt - a.updatedAt);
        await this.loadProject(all[0]);
      } else {
        // Create initial default 1080x1080 canvas
        await this.createNewProject({ width: 1080, height: 1080 });
      }
    } catch (e) {
      await this.createNewProject({ width: 1080, height: 1080 });
    }
  }

  async createNewProject(options = {}) {
    this.currentProject = ProjectManager.createNewProject(options);
    this.vectorCanvas.setDocumentSize(this.currentProject.width, this.currentProject.height);
    this.vectorCanvas.pixelArtMode = !!this.currentProject.pixelArtMode;

    // Reset layers and history
    this.vectorCanvas.layerManager.layers = [];
    this.vectorCanvas.layerManager.createInitialLayer();
    this.history.clear();

    // Reset Viewport to fit screen
    this.vectorCanvas.viewport.fitToScreen();

    // Update UI title
    const titleEl = document.getElementById('project-title-display');
    if (titleEl) titleEl.textContent = this.currentProject.name;

    this.uiManager.updateEdgeSlidersFromBrush();
    this.uiManager.layerPanel.render();

    await this.saveCurrentProject();
  }

  async loadProject(project) {
    this.currentProject = project;
    this.vectorCanvas.setDocumentSize(project.width, project.height);
    this.vectorCanvas.pixelArtMode = !!project.pixelArtMode;

    const lm = this.vectorCanvas.layerManager;
    lm.layers = [];

    // Reconstruct layers & vector strokes
    if (project.layers && project.layers.length > 0) {
      for (const lData of project.layers) {
        const layer = lm.addLayer(lData.name, lData.type || 'vector');
        layer.id = lData.id;
        layer.opacity = lData.opacity ?? 1.0;
        layer.blendMode = lData.blendMode || 'source-over';
        layer.visible = lData.visible !== false;
        layer.locked = !!lData.locked;
        layer.alphaLock = !!lData.alphaLock;
        layer.clippingMask = !!lData.clippingMask;
        layer.isReference = !!lData.isReference;
        layer.strokes = lData.strokes || [];
        this.vectorCanvas.redrawLayerStrokes(layer);
      }
      if (project.activeLayerId) {
        lm.setActiveLayer(project.activeLayerId);
      }
    } else {
      lm.createInitialLayer();
    }

    this.history.clear();
    this.vectorCanvas.viewport.fitToScreen();

    const titleEl = document.getElementById('project-title-display');
    if (titleEl) titleEl.textContent = this.currentProject.name;

    this.uiManager.updateEdgeSlidersFromBrush();
    this.uiManager.layerPanel.render();
  }

  async saveCurrentProject() {
    if (!this.currentProject) return;

    // Generate thumbnail
    const thumbDataUrl = this.exporter.exportDataUrl('image/png', 0.8, false);
    this.currentProject.thumbnail = thumbDataUrl;
    this.currentProject.updatedAt = Date.now();

    // Snapshot layer vector strokes
    this.currentProject.activeLayerId = this.vectorCanvas.layerManager.activeLayerId;
    this.currentProject.layers = this.vectorCanvas.layerManager.layers.map(l => ({
      id: l.id,
      name: l.name,
      type: l.type,
      opacity: l.opacity,
      blendMode: l.blendMode,
      visible: l.visible,
      locked: l.locked,
      alphaLock: l.alphaLock,
      clippingMask: l.clippingMask,
      isReference: l.isReference,
      strokes: JSON.parse(JSON.stringify(l.strokes))
    }));

    await this.storage.saveProject(this.currentProject);
  }

  setupAutosave() {
    // Autosave every 5 seconds
    this.autosaveInterval = setInterval(() => {
      this.saveCurrentProject();
    }, 5000);

    // Save on visibility change or page hide
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.saveCurrentProject();
      }
    });

    window.addEventListener('pagehide', () => {
      this.saveCurrentProject();
    });
  }

  undo() {
    this.triggerHaptic();
    this.history.undo();
  }

  redo() {
    this.triggerHaptic();
    this.history.redo();
  }

  openGallery() {
    this.saveCurrentProject();
    this.homeScreen.show();
  }

  triggerHaptic() {
    if (!this.config.haptics) return;
    if (window.AndroidBridge && window.AndroidBridge.hapticTick) {
      window.AndroidBridge.hapticTick();
    } else if (navigator.vibrate) {
      navigator.vibrate(12);
    }
  }

  onConfigChanged(key, val) {
    if (key === 'theme') {
      document.body.classList.toggle('theme-light', val === 'light');
    } else if (key === 'leftHanded') {
      document.body.classList.toggle('left-handed', !!val);
    } else if (key === 'perfMode') {
      document.body.classList.toggle('perf-low-blur', !!val);
    } else if (key === 'palmRejection') {
      this.vectorCanvas.palmRejection = !!val;
    } else if (key === 'globalSpeedFactor') {
      this.vectorCanvas.globalSpeedFactor = val;
    }
  }
}

// Bootstrap application on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.vecturaApp = new VecturaApp();
});
