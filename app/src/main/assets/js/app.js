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
import { Layer } from './layers/Layer.js';

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
      globalSpeedFactor: 1.0,
      reduceAnimations: false,
      fillAnimation: true,
      fillSpeed: 380
    };

    this.autosaveInterval = null;
    this.init();
  }

  async init() {
    const savedTheme = localStorage.getItem('vectura_theme') || this.config.theme || 'dark-oled';
    this.applyTheme(savedTheme);

    // 1. Initialize Canvas Viewport
    const canvasEl = document.getElementById('viewport-canvas');
    this.vectorCanvas = new VectorCanvas(canvasEl, 1080, 1080);
    this.vectorCanvas.history = this.history;
    this.vectorCanvas.globalSpeedFactor = this.config.globalSpeedFactor || 1.0;
    this.vectorCanvas.currentBrush = new Brush(DEFAULT_BRUSH_PRESETS[0]);

    // Connect cancel stroke callback to history so undo/redo cancels active stroke first
    this.history.setCancelStrokeHandler(() => this.vectorCanvas.cancelStroke());
    this.history.setLayerManager(this.vectorCanvas.layerManager);

    // 2. Setup Exporter
    this.exporter = new Exporter(this.vectorCanvas);

    // 3. Setup UI & Home Gallery
    this.uiManager = new UIManager(this);
    this.homeScreen = new HomeScreen(
      this.storage,
      (project) => this.loadProject(project),
      (options) => this.createNewProject(options)
    );

    // 4. Bind History changes to UI & autosave
    this.history.onChange((state) => {
      this.uiManager.updateHistoryState(state);
      this.markDirty();
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

    try {
      // 7. Load most recent project in background, and ALWAYS open on Project View (Artworks gallery)
      await this.loadInitialProject();
      if (this.homeScreen) {
        this.homeScreen.show();
      }

      // Android Lifecycle Hooks
      window.onAndroidPause = () => {
        this.saveCurrentProject();
      };
      window.onAndroidResume = () => {
        // Resumed
      };
    } catch (err) {
      console.warn('Vectura init error:', err);
    } finally {
      setTimeout(() => {
        this.hideSplash();
      }, 400);
    }
  }

  hideSplash() {
    const splash = document.getElementById('app-splash-screen');
    if (splash && !splash.classList.contains('fade-out')) {
      splash.classList.add('fade-out');
      setTimeout(() => {
        splash.style.display = 'none';
      }, 350);
    }
  }

  async loadInitialProject() {
    try {
      const all = await this.storage.getAllProjects();
      if (all && all.length > 0) {
        all.sort((a, b) => b.updatedAt - a.updatedAt);
        await this.loadProject(all[0]);
      } else {
        await this.createNewProject({ width: 1080, height: 1080 });
      }
    } catch (_) {
      await this.createNewProject({ width: 1080, height: 1080 });
    }
  }

  async createNewProject(options = {}) {
    const w = options.width || 1080;
    const h = options.height || 1080;
    const name = options.name || 'Untitled Artwork';

    const project = {
      id: 'proj_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: name,
      width: w,
      height: h,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layers: []
    };

    this.currentProject = project;
    this.vectorCanvas.setDocumentSize(w, h);
    this.vectorCanvas.layerManager.createInitialLayer();
    this.history.clear();

    if (this.uiManager) {
      this.uiManager.projectTitle.textContent = name;
      this.uiManager.updateLayerBadge();
      this.uiManager.closeSheets();
    }

    this.homeScreen.hide();
    this.vectorCanvas.viewport.fitToScreen();
    await this.saveCurrentProject();
  }

  async loadProject(project) {
    if (!project) return;
    this.currentProject = project;

    const w = project.width || 1080;
    const h = project.height || 1080;
    this.vectorCanvas.setDocumentSize(w, h);

    this.isLoadingLayers = true;
    try {
      if (project.layers && project.layers.length > 0) {
        const loadedLayers = await Promise.all(
          project.layers.map(async (lData) => {
            const l = new Layer(lData.id, lData.name, w, h, 'raster');
            l.visible = lData.visible ?? true;
            l.locked = lData.locked ?? false;
            l.opacity = lData.opacity ?? 1.0;
            l.blendMode = lData.blendMode || 'source-over';
            l.clippingMask = lData.clippingMask ?? false;
            l.alphaLock = lData.alphaLock ?? false;
            l.isReference = lData.isReference ?? false;
            l.strokes = lData.strokes || [];

            const source = lData.blob || lData.dataUrl;
            if (source) {
              await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                  l.ctx.drawImage(img, 0, 0);
                  l.updateThumbnail();
                  if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
                  resolve();
                };
                img.onerror = () => {
                  if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
                  resolve();
                };
                if (source instanceof Blob) {
                  img.src = URL.createObjectURL(source);
                } else {
                  img.src = source;
                }
              });
            } else {
              this.vectorCanvas.redrawLayerStrokes(l);
            }
            return l;
          })
        );
        this.vectorCanvas.layerManager.layers = loadedLayers;
        this.vectorCanvas.layerManager.activeLayerId = project.activeLayerId || loadedLayers[0].id;
        this.vectorCanvas.layerManager.invalidateCaches();
      } else {
        this.vectorCanvas.layerManager.createInitialLayer();
      }
    } finally {
      this.isLoadingLayers = false;
    }

    this.history.clear();
    this.isDirty = false;

    if (this.uiManager) {
      this.uiManager.projectTitle.textContent = project.name || 'Untitled';
      this.uiManager.updateLayerBadge();
      this.uiManager.closeSheets();
    }

    this.homeScreen.hide();
    this.vectorCanvas.viewport.fitToScreen();
  }

  async saveCurrentProject() {
    if (!this.currentProject) return;
    if (this.isLoadingLayers) {
      console.warn('Skipping save: layer images are still loading');
      return;
    }
    if (this.vectorCanvas?.isDrawing) {
      console.warn('Skipping save: active stroke in progress');
      return;
    }
    if (this.isSaving) return;
    this.isSaving = true;

    try {
      this.currentProject.updatedAt = Date.now();
      this.currentProject.activeLayerId = this.vectorCanvas.layerManager.activeLayerId;

      // Convert layer canvases to Blobs for IndexedDB
      const layerBlobs = await Promise.all(
        this.vectorCanvas.layerManager.layers.map(l => {
          return new Promise(resolve => {
            if (l.canvas && typeof l.canvas.toBlob === 'function') {
              l.canvas.toBlob(blob => resolve(blob), 'image/png');
            } else {
              resolve(null);
            }
          });
        })
      );

      this.currentProject.layers = this.vectorCanvas.layerManager.layers.map((l, idx) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        blendMode: l.blendMode,
        clippingMask: l.clippingMask,
        alphaLock: l.alphaLock,
        isReference: l.isReference,
        strokes: l.strokes,
        blob: layerBlobs[idx]
      }));

      // Create thumbnail scaled to fit 160px preserving aspect ratio
      const maxThumb = 160;
      const docW = this.vectorCanvas.docWidth || 1;
      const docH = this.vectorCanvas.docHeight || 1;
      const scale = Math.min(maxThumb / docW, maxThumb / docH);
      const thumbW = Math.max(1, Math.round(docW * scale));
      const thumbH = Math.max(1, Math.round(docH * scale));

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = thumbW;
      thumbCanvas.height = thumbH;
      const tCtx = thumbCanvas.getContext('2d');
      tCtx.scale(scale, scale);
      this.vectorCanvas.layerManager.compositeToCanvas(tCtx, true);
      this.currentProject.thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.8);

      const success = await this.storage.saveProject(this.currentProject);
      if (!success) {
        this.showToast('Failed to save project');
      } else {
        this.isDirty = false;
      }
    } catch (saveErr) {
      console.error('Failed to save project:', saveErr);
      this.showToast('Save failed: ' + (saveErr.message || 'error'));
    } finally {
      this.isSaving = false;
    }
  }

  markDirty() {
    this.isDirty = true;
    if (this.autosaveTimeout) {
      clearTimeout(this.autosaveTimeout);
    }
    this.autosaveTimeout = setTimeout(() => {
      this.checkAndAutosave();
    }, 10000); // Debounced ~10s after last change
  }

  checkAndAutosave() {
    if (!this.isDirty) return;
    if (this.vectorCanvas?.isDrawing || this.vectorCanvas?.isInteracting) {
      this.autosaveTimeout = setTimeout(() => this.checkAndAutosave(), 2500);
      return;
    }
    this.saveCurrentProject();
  }

  setupAutosave() {
    if (this.autosaveTimeout) clearTimeout(this.autosaveTimeout);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.isDirty) {
        this.saveCurrentProject();
      }
    });

    window.addEventListener('pagehide', () => {
      if (this.isDirty) {
        this.saveCurrentProject();
      }
    });
  }

  showToast(message) {
    if (window.AndroidBridge?.showToast) {
      window.AndroidBridge.showToast(message);
    } else {
      console.log('Toast:', message);
    }
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

  applyTheme(themeName) {
    const validThemes = ['dark-oled', 'grey', 'blue-grey', 'white', 'sepia'];
    let theme = themeName || 'dark-oled';
    if (theme === 'dark' || theme === 'oled') theme = 'dark-oled';
    if (theme === 'light') theme = 'white';
    if (!validThemes.includes(theme)) theme = 'dark-oled';

    for (const t of validThemes) {
      document.body.classList.remove(`theme-${t}`);
    }
    document.body.classList.remove('theme-light', 'theme-dark');

    document.body.classList.add(`theme-${theme}`);
    document.body.setAttribute('data-theme', theme);
    this.config.theme = theme;
    try {
      localStorage.setItem('vectura_theme', theme);
    } catch (_) {}
  }

  onConfigChanged(key, val) {
    if (key === 'theme') {
      this.applyTheme(val);
    } else if (key === 'leftHanded') {
      document.body.classList.toggle('left-handed', !!val);
    } else if (key === 'perfMode') {
      document.body.classList.toggle('perf-low-blur', !!val);
    } else if (key === 'palmRejection') {
      this.vectorCanvas.palmRejection = !!val;
    } else if (key === 'globalSpeedFactor') {
      this.vectorCanvas.globalSpeedFactor = val;
    } else if (key === 'reduceAnimations') {
      document.body.classList.toggle('reduce-animations', !!val);
    } else if (key === 'fillAnimation') {
      this.vectorCanvas.toolManager.fillBucket.animateFill = !!val;
    } else if (key === 'fillSpeed') {
      this.vectorCanvas.toolManager.fillBucket.animationDuration = parseInt(val, 10);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.vecturaApp = new VecturaApp();
});
