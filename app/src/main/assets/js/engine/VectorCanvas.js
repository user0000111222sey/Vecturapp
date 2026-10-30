/**
 * Vectura Vector Drawing Engine
 * High-performance raster canvas engine with Catmull-Rom splines, coherent jitter,
 * coalesced pointer capture, multi-touch navigation gestures, and 60fps layer rendering.
 *
 * Bugs Fixed:
 * 1. Undo/redo: Unified through HistoryManager and Command.js with active stroke cancellation.
 * 2. Gesture collision: Navigation gesture tracking, 250ms tap duration, <10px movement,
 *    200ms cooldown after navigation, gestureOccurred cancellation.
 * 3. Ink bleed: Minimum dt clamp, duplicate point rejection, isFinite validation,
 *    strict brush.maxSize clamp, and consecutive stamp size rate limiter.
 * 4. Fill tool: Smooth expanding circular reveal clipped to region, non-blocking, undoable.
 */
import { CatmullRomSpline, bresenhamPixelPerfect } from './CatmullRom.js';
import { PressureEngine } from './PressureEngine.js';
import { Stabilizer } from './Stabilizer.js';
import { CoherentNoise } from './CoherentNoise.js';
import { Viewport } from './Viewport.js';
import { LayerManager } from '../layers/LayerManager.js';
import { ToolManager } from '../tools/ToolManager.js';
import { StrokeCommand, RasterCommand, cropBoundingBox } from '../history/Command.js';

function cloneCanvas(sourceCanvas) {
  if (!sourceCanvas) return null;
  const clone = document.createElement('canvas');
  clone.width = sourceCanvas.width;
  clone.height = sourceCanvas.height;
  clone.getContext('2d').drawImage(sourceCanvas, 0, 0);
  return clone;
}

export class VectorCanvas {
  constructor(viewportCanvas, docWidth = 1080, docHeight = 1080) {
    this.viewportCanvas = viewportCanvas;
    this.ctx = viewportCanvas.getContext('2d', { alpha: true });

    this.docWidth = docWidth;
    this.docHeight = docHeight;

    // Viewport & Transformations
    this.viewport = new Viewport(docWidth, docHeight);
    this.initialFitDone = false;
    this.isSpaceDown = false;
    this.isMousePanning = false;
    this.lastMousePanPos = { x: 0, y: 0 };

    // Spline & Pressure & Stabilizer
    this.spline = new CatmullRomSpline(0.5);
    this.pressureEngine = new PressureEngine();
    this.stabilizer = new Stabilizer({ mode: 'light', strength: 30 });

    // Subsystems
    this.layerManager = new LayerManager(docWidth, docHeight);
    this.toolManager = new ToolManager(docWidth, docHeight);
    this.history = null; // Injected from app

    // Soft stamp sprite cache to avoid radial gradient recreation on every stamp
    this.softStampCache = new Map();

    // Separate eraser state (remembered independently from pen)
    this.currentEraser = {
      type: 'hard',
      size: 28,
      minSize: 1,
      maxSize: 500,
      opacity: 1.0,
      hardness: 1.0,
      spacing: 0.05,
      tipShape: 'round'
    };
    try {
      const savedEraser = localStorage.getItem('vectura_eraser_state');
      if (savedEraser) {
        Object.assign(this.currentEraser, JSON.parse(savedEraser));
      }
    } catch (_) {}

    // Live stroke buffer canvas (uncommitted drawing)
    this.liveCanvas = document.createElement('canvas');
    this.liveCanvas.width = docWidth;
    this.liveCanvas.height = docHeight;
    this.liveCtx = this.liveCanvas.getContext('2d');

    // Reusable single-stroke compositing buffer (prevents opacity blowout)
    this.strokeCanvas = document.createElement('canvas');
    this.strokeCanvas.width = docWidth;
    this.strokeCanvas.height = docHeight;
    this.strokeCtx = this.strokeCanvas.getContext('2d');

    // Current Drawing State
    this.isDrawing = false;
    this.isTransforming = false;
    this.activePointerId = null;
    this.currentStroke = null;
    this.currentBrush = null;
    this.currentColor = '#8b5cf6';
    this.beforeStrokeCanvas = null;
    this.lastRenderedSampleIndex = 0;
    this.lastStampRadius = null;

    // Active fill animations list (non-blocking)
    this.activeFillAnimations = [];

    // Global speed multiplier from quick settings
    this.globalSpeedFactor = 1.0;

    // Touch & Multi-touch navigation state
    this.activePointers = new Map(); // pointerId -> { x, y, time }
    this.isNavigating = false;
    this.navigationGestureOccurred = false;
    this.lastNavigationTime = 0;
    this.lastPinchDist = 0;
    this.lastPinchAngle = 0;
    this.lastPinchCenter = { x: 0, y: 0 };
    this.initialPinchDist = 0;
    this.initialPinchAngle = 0;
    this.initialPinchCenter = { x: 0, y: 0 };
    this.tapStartTime = 0;
    this.tapMaxMovement = 0;
    this.multiTouchTap = { startTime: 0, maxPointers: 0, maxMove: 0, hasNavigated: false };

    // Long press eyedropper timer
    this.longPressTimer = null;
    this.longPressPoint = null;

    // Shape Assist Hold Timer
    this.shapeHoldTimer = null;
    this.shapeHoldDetected = false;

    // Settings
    this.palmRejection = true;
    this.penActive = false;
    this.oneFingerDraws = true;
    this.pixelArtMode = false;

    // Callbacks
    this.onColorPicked = null;
    this.onUndoRequested = null;
    this.onRedoRequested = null;
    this.onToolAutoReverted = null;
    this.onHaptic = null;

    // Animation Loop
    this.running = true;
    this.renderLoop = this.renderLoop.bind(this);
    requestAnimationFrame(this.renderLoop);

    this.setupPointerListeners();
  }

  render() {
    this.needsRender = true;
    this.layerManager?.invalidateCaches();
  }

  saveEraserState() {
    try {
      localStorage.setItem('vectura_eraser_state', JSON.stringify(this.currentEraser));
    } catch (_) {}
  }

  /**
   * Caches circular soft stamp sprites to eliminate per-stamp radial gradient creation overhead
   */
  getSoftStampSprite(color, radius, hardness = 0.8, wetEdge = 0) {
    const r = Math.max(1, Math.round(radius));
    const h = Math.round((hardness ?? 0.8) * 100) / 100;
    const we = Math.round((wetEdge ?? 0) * 100) / 100;
    const key = `${color}_${r}_${h}_${we}`;
    let sprite = this.softStampCache.get(key);
    if (sprite) return { canvas: sprite, radius: r };

    const pad = 2;
    const size = r * 2 + pad * 2;
    sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const sCtx = sprite.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;

    const grad = sCtx.createRadialGradient(cx, cy, Math.max(0.01, r * Math.max(0.05, h)), cx, cy, r);
    grad.addColorStop(0, color);
    if (we > 0.05) {
      const rim = Math.max(0.65, Math.min(0.95, 1 - (1 - h) * 0.3));
      grad.addColorStop(rim, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      grad.addColorStop(1, 'rgba(0,0,0,0)');
    }

    sCtx.fillStyle = grad;
    sCtx.beginPath();
    sCtx.arc(cx, cy, r, 0, Math.PI * 2);
    sCtx.fill();

    if (this.softStampCache.size > 256) {
      const firstKey = this.softStampCache.keys().next().value;
      this.softStampCache.delete(firstKey);
    }
    this.softStampCache.set(key, sprite);
    return { canvas: sprite, radius: r };
  }

  setDocumentSize(w, h) {
    this.docWidth = w;
    this.docHeight = h;
    this.viewport.setDocumentSize(w, h);
    this.layerManager.resizeDocument(w, h);
    this.toolManager.resizeDocument(w, h);
    this.liveCanvas.width = w;
    this.liveCanvas.height = h;
    if (this.strokeCanvas) {
      this.strokeCanvas.width = w;
      this.strokeCanvas.height = h;
    }
  }

  applyDocProperties(props) {
    if (!props) return;
    if (props.width && props.height) {
      this.setDocumentSize(props.width, props.height);
    }
  }

  getPointerPos(e) {
    const rect = this.viewportCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  setupPointerListeners() {
    const el = this.viewportCanvas;
    el.addEventListener('pointerdown', this.onPointerDown.bind(this), { passive: false });
    el.addEventListener('pointermove', this.onPointerMove.bind(this), { passive: false });
    el.addEventListener('pointerup', this.onPointerUp.bind(this), { passive: false });
    el.addEventListener('pointercancel', this.onPointerCancel.bind(this), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    // Native Touch Events for two-finger gestures (pinch, pan, rotate)
    el.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    el.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    el.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    el.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });

    // Wheel zoom on canvas, container, and window
    const wheelHandler = this.onWheel.bind(this);
    el.addEventListener('wheel', wheelHandler, { passive: false });
    if (el.parentElement) {
      el.parentElement.addEventListener('wheel', wheelHandler, { passive: false });
    }

    // Spacebar & Alt pan navigation
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Space' || e.key === 'Alt') && !this.isSpaceDown && !e.target.closest('input, textarea, select')) {
        this.isSpaceDown = true;
        this.viewportCanvas.style.cursor = 'grab';
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.key === 'Alt') {
        this.isSpaceDown = false;
        const isPan = this.toolManager.activeTool === 'pan' || this.toolManager.activeTool === 'transform';
        this.viewportCanvas.style.cursor = isPan ? 'grab' : 'crosshair';
      }
    });
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.viewportCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Direct scroll zoom: roll up zooms in, roll down zooms out
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    this.viewport.zoomAt(factor, cx, cy);
    this.viewport.onNavigate?.(this.viewport.zoom, this.viewport.rotation);
  }

  onTouchStart(e) {
    if (e.touches.length >= 2) {
      e.preventDefault();
      this.cancelAllActiveTools();
      this.isNavigating = true;
      this.navigationGestureOccurred = true;

      const rect = this.viewportCanvas.getBoundingClientRect();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const p1 = { x: t0.clientX - rect.left, y: t0.clientY - rect.top };
      const p2 = { x: t1.clientX - rect.left, y: t1.clientY - rect.top };

      this.touchPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.touchPinchAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      this.touchPinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }
  }

  onTouchMove(e) {
    if (e.touches.length >= 2) {
      e.preventDefault();
      this.cancelAllActiveTools();
      this.isNavigating = true;
      this.navigationGestureOccurred = true;

      const rect = this.viewportCanvas.getBoundingClientRect();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const p1 = { x: t0.clientX - rect.left, y: t0.clientY - rect.top };
      const p2 = { x: t1.clientX - rect.left, y: t1.clientY - rect.top };

      const curDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const curAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const curCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      if (this.touchPinchCenter && this.touchPinchDist > 0) {
        // Pan
        const dx = curCenter.x - this.touchPinchCenter.x;
        const dy = curCenter.y - this.touchPinchCenter.y;
        this.viewport.panBy(dx, dy);

        // Zoom
        const factor = curDist / this.touchPinchDist;
        if (factor > 0.01 && factor < 100) {
          this.viewport.zoomAt(factor, curCenter.x, curCenter.y);
        }

        // Rotate
        let deltaAngle = curAngle - this.touchPinchAngle;
        while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
        this.viewport.rotateAt(deltaAngle, curCenter.x, curCenter.y);

        this.viewport.onNavigate?.(this.viewport.zoom, this.viewport.rotation);
        this.needsRender = true;
      }

      this.touchPinchDist = curDist;
      this.touchPinchAngle = curAngle;
      this.touchPinchCenter = curCenter;
    }
  }

  onTouchEnd(e) {
    if (e.touches.length < 2) {
      this.touchPinchDist = 0;
      this.touchPinchCenter = null;
      this.lastNavigationTime = performance.now();
      if (e.touches.length === 0) {
        this.isNavigating = false;
        setTimeout(() => {
          this.navigationGestureOccurred = false;
        }, 150);
      }
    }
  }

  onPointerDown(e) {
    e.preventDefault();
    if (this.isNavigating || performance.now() - (this.lastNavigationTime || 0) < 250) {
      return;
    }
    // Prevent duplicated touch & mouse events firing for the same input
    if (e.pointerType === 'mouse' && performance.now() - (this.lastTouchTime || 0) < 500) {
      return;
    }
    if (e.pointerType === 'touch') {
      this.lastTouchTime = performance.now();
    }
    if (e.pointerType === 'mouse') {
      try {
        this.viewportCanvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    const now = performance.now();
    const pos = this.getPointerPos(e);
    const world = this.viewport.screenToWorld(pos.x, pos.y);

    // Mouse navigation triggers:
    // 1. Pan tool active
    // 2. Spacebar or Alt held down
    // 3. Middle click (1) or right click (2)
    // 4. Left click (0) on workspace outside artwork bounds
    const isPanTool = this.toolManager.activeTool === 'pan';
    const isOutsideDoc = world.x < 0 || world.x > this.docWidth || world.y < 0 || world.y > this.docHeight;
    const shouldPan = isPanTool || (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || this.isSpaceDown || e.altKey || (e.button === 0 && isOutsideDoc)));

    if (shouldPan) {
      this.isPanning = true;
      this.isMousePanning = true;
      this.lastPanPos = { x: pos.x, y: pos.y };
      this.lastMousePanPos = { x: pos.x, y: pos.y };
      this.viewportCanvas.style.cursor = 'grabbing';
      try {
        this.viewportCanvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      return;
    }

    // Stylus palm rejection
    if (e.pointerType === 'pen') {
      this.penActive = true;
    } else if (this.palmRejection && this.penActive && e.pointerType === 'touch') {
      return;
    }

    this.activePointers.set(e.pointerId, { x: pos.x, y: pos.y, time: now });

    if (this.activePointers.size === 1) {
      this.tapStartTime = now;
      this.tapMaxMovement = 0;
      this.navigationGestureOccurred = false;
      this.multiTouchTap = { startTime: now, maxPointers: 1, maxMove: 0, hasNavigated: false };

      // 1. Check Symmetry Pivot Drag Handle
      if (this.toolManager.symmetry.mode !== 'off' && !this.toolManager.symmetry.locked) {
        if (this.toolManager.symmetry.hitTest(world.x, world.y, this.viewport.zoom)) {
          this.isDraggingSymmetry = true;
          try {
            this.viewportCanvas.setPointerCapture(e.pointerId);
          } catch (_) {}
          this.cancelLongPress();
          this.onHaptic?.();
          return;
        }
      }

      // Check long-press for eyedropper
      if (this.toolManager.activeTool === 'brush' || this.toolManager.activeTool === 'eyedropper') {
        const sx = pos.x, sy = pos.y;
        const world = this.viewport.screenToWorld(sx, sy);
        this.longPressPoint = { sx, sy, wx: world.x, wy: world.y };
        this.longPressTimer = setTimeout(() => {
          if (!this.isNavigating && !this.navigationGestureOccurred && this.tapMaxMovement < 10) {
            this.triggerEyedropper(this.longPressPoint.wx, this.longPressPoint.wy, this.longPressPoint.sx, this.longPressPoint.sy);
          }
        }, 420);
      }

      const world = this.viewport.screenToWorld(pos.x, pos.y);
      const activeLayer = this.layerManager.getActiveLayer();

      // Tool dispatch with strict touch priority
      if (this.toolManager.activeTool === 'bucket') {
        this.toolManager.fillBucket.fill(world.x, world.y, this.currentColor, this.layerManager, (info) => {
          this.commitFillWithAnimation(info);
        });
        return;
      } else if (this.toolManager.activeTool === 'lasso-fill') {
        this.toolManager.lassoFill.start(world.x, world.y, e.timeStamp || Date.now());
        return;
      } else if (this.toolManager.activeTool === 'selection') {
        this.toolManager.selectionTool.start(world.x, world.y);
        return;
      } else if (this.toolManager.activeTool === 'transform') {
        if (!this.toolManager.transformTool.active && activeLayer) {
          const patch = this.toolManager.selectionTool.hasSelection
            ? this.toolManager.selectionTool.cutSelectedPixels(activeLayer)
            : null;
          this.toolManager.transformTool.activate(activeLayer, patch);
        }
        const handled = this.toolManager.transformTool.onPointerDown(world.x, world.y, this.viewport.zoom);
        if (handled) {
          this.isTransforming = true;
          this.needsRender = true;
          return;
        } else {
          // Tapped outside transform box: commit and return to brush
          this.toolManager.transformTool.applyTransform(this.history, () => {
            this.layerManager.invalidateCaches();
          }, this.toolManager.selectionTool);
          this.toolManager.setTool('brush');
          this.onToolAutoReverted?.('brush');
          this.isTransforming = false;
          this.needsRender = true;
          return;
        }
      } else if (this.toolManager.activeTool === 'smudge') {
        if (activeLayer && !activeLayer.locked) {
          this.toolManager.smudgeTool.start(world.x, world.y, activeLayer, this.currentColor, this.toolManager.selectionTool);
        }
        return;
      } else if (this.toolManager.activeTool === 'shape') {
        this.toolManager.shapeTool.start(world.x, world.y);
        return;
      } else if (this.toolManager.activeTool === 'gradient') {
        this.toolManager.gradientTool.start(world.x, world.y);
        return;
      } else if (this.toolManager.activeTool === 'text') {
        if (activeLayer && !activeLayer.locked) {
          try {
            const text = prompt('Enter text:');
            if (text && text.trim()) {
              const tt = this.toolManager.textTool;
              const bounds = tt.measureTextBounds(activeLayer.ctx, text.trim(), world.x, world.y);
              const padding = 12;
              const bbox = {
                x: Math.max(0, Math.floor(bounds.x - padding)),
                y: Math.max(0, Math.floor(bounds.y - padding)),
                width: Math.min(this.docWidth, Math.ceil(bounds.width + padding * 2)),
                height: Math.min(this.docHeight, Math.ceil(bounds.height + padding * 2))
              };
              const beforeSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
              tt.commitText(activeLayer, text.trim(), world.x, world.y, this.currentColor);
              const afterSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
              if (this.history) {
                this.history.push(new RasterCommand('Add Text', activeLayer, beforeSnapshot, afterSnapshot, () => {
                  this.layerManager.invalidateCaches();
                }));
              }
              this.layerManager.invalidateCaches();
              this.render();
            }
          } catch (textErr) {
            console.error('Text tool error:', textErr);
            this.showToast('Text tool error: ' + (textErr.message || 'failed'));
          }
        }
        return;
      }

      // Drawing stroke begin
      if (activeLayer && !activeLayer.locked) {
        this.startStroke(e);
      }
    } else if (this.activePointers.size >= 2) {
      if (this.isTransforming || (this.toolManager.activeTool === 'transform' && this.toolManager.transformTool.dragHandle)) {
        return; // Don't interrupt handle dragging!
      }
      if (this.activePointers.size > this.multiTouchTap.maxPointers) {
        this.multiTouchTap.maxPointers = this.activePointers.size;
      }

      // 2 or more fingers: Cancel any active stroke/tool & initialize Pinch / Pan / Rotate
      this.cancelAllActiveTools();
      this.isNavigating = true;
      this.navigationGestureOccurred = true;

      const pts = Array.from(this.activePointers.values());
      const p1 = pts[0], p2 = pts[1];
      this.lastPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.lastPinchAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      this.lastPinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      this.initialPinchDist = this.lastPinchDist;
      this.initialPinchAngle = this.lastPinchAngle;
      this.initialPinchCenter = { ...this.lastPinchCenter };
    }
  }

  onPointerMove(e) {
    e.preventDefault();
    const pos = this.getPointerPos(e);

    // Pan Navigation (single-touch Pan tool, mouse pan, spacebar pan)
    if (this.isPanning || this.isMousePanning) {
      const last = this.lastPanPos || this.lastMousePanPos;
      if (last) {
        const dx = pos.x - last.x;
        const dy = pos.y - last.y;
        this.viewport.panBy(dx, dy);
        this.viewport.onNavigate?.(this.viewport.zoom, this.viewport.rotation);
        this.lastPanPos = { x: pos.x, y: pos.y };
        this.lastMousePanPos = { x: pos.x, y: pos.y };
        this.needsRender = true;
      }
      return;
    }

    if (!this.activePointers.has(e.pointerId)) return;

    const prevPt = this.activePointers.get(e.pointerId);
    const movement = Math.hypot(pos.x - prevPt.x, pos.y - prevPt.y);
    this.tapMaxMovement += movement;
    this.multiTouchTap.maxMove += movement;

    if (movement > 6) {
      this.cancelLongPress();
    }

    this.activePointers.set(e.pointerId, { x: pos.x, y: pos.y, time: performance.now() });

    // Multi-finger pinch / pan / rotate navigation
    if (this.activePointers.size >= 2) {
      this.cancelAllActiveTools();
      this.isNavigating = true;
      this.navigationGestureOccurred = true;

      const pts = Array.from(this.activePointers.values());
      const p1 = pts[0], p2 = pts[1];
      const curDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const curAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const curCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      if (this.lastPinchCenter && this.lastPinchDist > 0) {
        // Pan
        const dx = curCenter.x - this.lastPinchCenter.x;
        const dy = curCenter.y - this.lastPinchCenter.y;
        this.viewport.panBy(dx, dy);

        // Zoom
        const factor = curDist / this.lastPinchDist;
        if (factor > 0.01 && factor < 100) {
          this.viewport.zoomAt(factor, curCenter.x, curCenter.y);
        }

        // Rotate
        let deltaAngle = curAngle - this.lastPinchAngle;
        while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
        this.viewport.rotateAt(deltaAngle, curCenter.x, curCenter.y);

        this.viewport.onNavigate?.(this.viewport.zoom, this.viewport.rotation);
        this.needsRender = true;
      }

      this.lastPinchDist = curDist;
      this.lastPinchAngle = curAngle;
      this.lastPinchCenter = curCenter;
      return;
    }

    // Handle Eyedropper sampling if active
    if (this.toolManager.eyedropper.active) {
      const world = this.viewport.screenToWorld(pos.x, pos.y);
      const picked = this.toolManager.eyedropper.sample(world.x, world.y, pos.x, pos.y, this.layerManager);
      this.currentColor = picked;
      this.onColorPicked?.(picked);
      return;
    }

    // If navigating or multi-touch is active, don't execute any single-pointer tool
    if (this.isNavigating || performance.now() - (this.lastNavigationTime || 0) < 250) {
      this.cancelAllActiveTools();
      return;
    }

    // Symmetry pivot dragging
    if (this.isDraggingSymmetry) {
      const world = this.viewport.screenToWorld(pos.x, pos.y);
      this.toolManager.symmetry.setPivot(world.x, world.y);
      this.needsRender = true;
      return;
    }

    // Tools move
    const world = this.viewport.screenToWorld(pos.x, pos.y);
    if (this.isTransforming || (this.toolManager.activeTool === 'transform' && this.toolManager.transformTool.active && this.toolManager.transformTool.dragHandle)) {
      this.toolManager.transformTool.onPointerMove(world.x, world.y);
      this.needsRender = true;
      return;
    } else if (this.toolManager.activeTool === 'smudge' && this.toolManager.smudgeTool.active) {
      this.toolManager.smudgeTool.update(world.x, world.y, this.toolManager.selectionTool);
      this.layerManager.invalidateCaches();
      this.needsRender = true;
      return;
    } else if (this.toolManager.activeTool === 'selection' && this.toolManager.selectionTool.active) {
      this.toolManager.selectionTool.update(world.x, world.y);
      this.needsRender = true;
      return;
    } else if (this.toolManager.activeTool === 'lasso-fill' && this.toolManager.lassoFill.active) {
      this.toolManager.lassoFill.addPoint(world.x, world.y, e.timeStamp || Date.now());
      this.needsRender = true;
      return;
    } else if (this.toolManager.activeTool === 'shape' && this.toolManager.shapeTool.active) {
      this.toolManager.shapeTool.update(world.x, world.y);
      this.needsRender = true;
      return;
    } else if (this.toolManager.activeTool === 'gradient' && this.toolManager.gradientTool.active) {
      this.toolManager.gradientTool.update(world.x, world.y);
      this.needsRender = true;
      return;
    }

    // Live Drawing stroke update
    if (this.isDrawing && e.pointerId === this.activePointerId) {
      if (this.isNavigating || this.activePointers.size >= 2) {
        this.cancelStroke();
        return;
      }
      const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ce of coalesced) {
        this.appendStrokePoint(ce);
      }

      if (this.shapeHoldTimer) clearTimeout(this.shapeHoldTimer);
      this.shapeHoldTimer = setTimeout(() => {
        if (this.isDrawing && this.currentStroke && this.currentStroke.points.length > 5) {
          this.triggerShapeAssist();
        }
      }, 420);
    }
  }

  onPointerUp(e) {
    e.preventDefault();
    try {
      this.viewportCanvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
    this.cancelLongPress();
    if (this.shapeHoldTimer) clearTimeout(this.shapeHoldTimer);

    if (this.isPanning || this.isMousePanning) {
      this.isPanning = false;
      this.isMousePanning = false;
      this.lastPanPos = null;
      this.lastMousePanPos = null;
      const isPan = this.toolManager.activeTool === 'pan' || this.toolManager.activeTool === 'transform';
      this.viewportCanvas.style.cursor = isPan ? 'grab' : (this.isSpaceDown ? 'grab' : 'crosshair');
      return;
    }

    const now = performance.now();
    const tapDuration = now - this.multiTouchTap.startTime;
    const maxPointers = this.multiTouchTap.maxPointers;

    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) {
      this.touchPinchDist = 0;
      this.touchPinchCenter = null;
      this.lastPinchDist = 0;
      this.lastPinchCenter = null;
      this.lastNavigationTime = performance.now();
    }

    if (this.isDraggingSymmetry) {
      this.isDraggingSymmetry = false;
      this.needsRender = true;
      return;
    }

    // Multi-finger tap gestures for Undo & Redo:
    // 2-finger tap = Undo, 3-finger tap = Redo
    if (!this.multiTouchTap.hasNavigated && tapDuration < 340 && this.multiTouchTap.maxMove < 18) {
      if (maxPointers === 2) {
        this.onHaptic?.();
        this.onUndoRequested?.();
        this.multiTouchTap = { startTime: 0, maxPointers: 0, maxMove: 999, hasNavigated: true };
        this.cancelAllActiveTools();
        return;
      } else if (maxPointers === 3) {
        this.onHaptic?.();
        this.onRedoRequested?.();
        this.multiTouchTap = { startTime: 0, maxPointers: 0, maxMove: 999, hasNavigated: true };
        this.cancelAllActiveTools();
        return;
      }
    }

    // If navigation occurred or multiple fingers were down, cancel all tools without committing stray marks
    if (this.navigationGestureOccurred || this.multiTouchTap.hasNavigated || this.isNavigating || performance.now() - (this.lastNavigationTime || 0) < 250 || this.activePointers.size > 0) {
      this.cancelAllActiveTools();
      if (this.activePointers.size === 0) {
        this.isNavigating = false;
        setTimeout(() => {
          this.navigationGestureOccurred = false;
        }, 150);
      }
      return;
    }

    if (this.toolManager.eyedropper.active) {
      this.toolManager.eyedropper.hide();
      return;
    }

    if (this.toolManager.smudgeTool && this.toolManager.activeTool === 'smudge' && this.toolManager.smudgeTool.active) {
      this.toolManager.smudgeTool.commit(this.history, () => {
        this.layerManager.invalidateCaches();
      });
      this.needsRender = true;
      return;
    }

    if (this.toolManager.selectionTool && this.toolManager.activeTool === 'selection' && this.toolManager.selectionTool.active) {
      const rw = Math.abs(this.toolManager.selectionTool.currentX - this.toolManager.selectionTool.startX);
      const rh = Math.abs(this.toolManager.selectionTool.currentY - this.toolManager.selectionTool.startY);
      if (rw < 4 && rh < 4 && this.toolManager.selectionTool.hasSelection) {
        // Tapped outside selection box without dragging -> clear selection and revert to brush
        this.toolManager.selectionTool.clear();
        this.toolManager.setTool('brush');
        this.onToolAutoReverted?.('brush');
      } else {
        this.toolManager.selectionTool.commit();
      }
      this.needsRender = true;
      this.onSelectionChanged?.(this.toolManager.selectionTool.hasSelection);
      return;
    } else if (this.isTransforming || this.toolManager.activeTool === 'transform') {
      this.isTransforming = false;
      this.toolManager.transformTool.onPointerUp();
      this.needsRender = true;
      return;
    }

    // Tool commits with unified Command pattern (cropped bounding-box snapshots)
    const activeLayer = this.layerManager.getActiveLayer();
    if (activeLayer && !activeLayer.locked) {
      try {
        if (this.toolManager.activeTool === 'lasso-fill' && this.toolManager.lassoFill.active) {
          const pts = this.toolManager.lassoFill.points;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          const bbox = pts.length > 0 ? {
            x: Math.max(0, Math.floor(minX - 4)),
            y: Math.max(0, Math.floor(minY - 4)),
            width: Math.min(this.docWidth, Math.ceil(maxX - minX + 8)),
            height: Math.min(this.docHeight, Math.ceil(maxY - minY + 8))
          } : null;
          const beforeSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
          this.toolManager.lassoFill.finish(activeLayer, this.currentColor, this.currentBrush?.opacity ?? 1.0, this.toolManager.selectionTool);
          const afterSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
          this.layerManager.invalidateCaches();
          if (this.history) {
            this.history.push(new RasterCommand('Lasso Fill', activeLayer, beforeSnapshot, afterSnapshot, () => {
              this.layerManager.invalidateCaches();
            }));
          }
        } else if (this.toolManager.activeTool === 'shape' && this.toolManager.shapeTool.active) {
          const st = this.toolManager.shapeTool;
          const strokeW = this.currentBrush?.size || 4;
          const minX = Math.min(st.startX, st.currentX) - strokeW - 4;
          const minY = Math.min(st.startY, st.currentY) - strokeW - 4;
          const maxX = Math.max(st.startX, st.currentX) + strokeW + 4;
          const maxY = Math.max(st.startY, st.currentY) + strokeW + 4;
          const bbox = {
            x: Math.max(0, Math.floor(minX)),
            y: Math.max(0, Math.floor(minY)),
            width: Math.min(this.docWidth, Math.ceil(maxX - minX)),
            height: Math.min(this.docHeight, Math.ceil(maxY - minY))
          };
          const beforeSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
          st.commit(activeLayer, this.currentColor, strokeW);
          const afterSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
          this.layerManager.invalidateCaches();
          if (this.history) {
            this.history.push(new RasterCommand('Draw Shape', activeLayer, beforeSnapshot, afterSnapshot, () => {
              this.layerManager.invalidateCaches();
            }));
          }
        } else if (this.toolManager.activeTool === 'gradient' && this.toolManager.gradientTool.active) {
          const beforeSnapshot = cropBoundingBox(activeLayer.canvas, null);
          this.toolManager.gradientTool.commit(activeLayer, this.currentColor, '#ffffff');
          const afterSnapshot = cropBoundingBox(activeLayer.canvas, null);
          this.layerManager.invalidateCaches();
          if (this.history) {
            this.history.push(new RasterCommand('Linear Gradient', activeLayer, beforeSnapshot, afterSnapshot, () => {
              this.layerManager.invalidateCaches();
            }));
          }
        }
      } catch (toolCommitErr) {
        console.error('Tool commit failed:', toolCommitErr);
        this.showToast('Tool error: ' + (toolCommitErr.message || 'action failed'));
      }
    }

    if (this.isDrawing && e.pointerId === this.activePointerId) {
      this.finishStroke();
    }

    if (this.isNavigating) {
      this.lastNavigationTime = now;
    }
    if (this.activePointers.size === 0) {
      this.isNavigating = false;
    }
  }

  onPointerCancel(e) {
    this.cancelLongPress();
    if (this.shapeHoldTimer) clearTimeout(this.shapeHoldTimer);
    if (this.isPanning || this.isMousePanning) {
      this.isPanning = false;
      this.isMousePanning = false;
      this.lastPanPos = null;
      this.lastMousePanPos = null;
      const isPan = this.toolManager.activeTool === 'pan' || this.toolManager.activeTool === 'transform';
      this.viewportCanvas.style.cursor = this.isSpaceDown ? 'grab' : 'crosshair';
    }
    this.activePointers.delete(e.pointerId);
    this.cancelStroke();
    this.lastPinchDist = 0;
    this.lastPinchCenter = null;
    this.lastNavigationTime = performance.now();
    if (this.activePointers.size === 0) {
      this.isNavigating = false;
    }
  }

  cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  triggerEyedropper(wx, wy, sx, sy) {
    this.onHaptic?.();
    this.cancelStroke();
    this.toolManager.eyedropper.show(sx, sy, this.currentColor);
    const picked = this.toolManager.eyedropper.sample(wx, wy, sx, sy, this.layerManager);
    this.currentColor = picked;
    this.onColorPicked?.(picked);
  }

  triggerShapeAssist() {
    if (!this.currentStroke || this.currentStroke.points.length < 5) return;
    const pts = this.currentStroke.points;
    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];
    const totalDist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);

    let maxPerpDist = 0;
    for (const p of pts) {
      const dx = pEnd.x - pStart.x;
      const dy = pEnd.y - pStart.y;
      const d = Math.abs(dy * p.x - dx * p.y + pEnd.x * pStart.y - pEnd.y * pStart.x) / Math.max(1, totalDist);
      maxPerpDist = Math.max(maxPerpDist, d);
    }

    this.onHaptic?.();
    if (maxPerpDist < 18) {
      this.currentStroke.points = [
        { ...pStart, pressure: 0.8 },
        { ...pEnd, pressure: 0.8 }
      ];
      this.shapeHoldDetected = true;
      this.renderLiveStroke();
    }
  }

  startStroke(e) {
    const activeLayer = this.layerManager.getActiveLayer();
    if (!activeLayer) return;

    this.isDrawing = true;
    this.activePointerId = e.pointerId;
    this.shapeHoldDetected = false;
    this.lastStampRadius = null;
    this.lastRenderedSampleIndex = 0;

    // Snapshot layer canvas before stroke for deterministic raster undo
    this.beforeStrokeCanvas = cloneCanvas(activeLayer.canvas);

    const pos = this.getPointerPos(e);
    const rawWorld = this.viewport.screenToWorld(pos.x, pos.y);
    const snapped = this.toolManager.rulerGuides.snapPoint(rawWorld.x, rawWorld.y);

    this.pressureEngine.reset();
    const pressure = this.pressureEngine.resolvePressure(e, snapped, this.currentBrush, this.globalSpeedFactor);
    this.stabilizer.reset();

    const stabilized = this.stabilizer.begin({
      x: snapped.x,
      y: snapped.y,
      pressure: pressure,
      time: performance.now()
    });

    const isEraser = this.toolManager.activeTool === 'eraser' || (this.currentBrush && this.currentBrush.isEraser);
    const strokeSeed = Math.floor(Math.random() * 0xffffff);

    // Eraser uses its own dedicated state and does NOT inherit pen min/max limits
    let brushSnapshot;
    if (isEraser) {
      brushSnapshot = {
        id: 'eraser_' + (this.currentEraser.type || 'hard'),
        name: 'Eraser',
        size: Math.max(1, Math.min(500, this.currentEraser.size || 28)),
        opacity: Math.max(0.01, Math.min(1.0, this.currentEraser.opacity ?? 1.0)),
        hardness: this.currentEraser.hardness ?? 1.0,
        spacing: this.currentEraser.spacing ?? 0.05,
        tipShape: this.currentEraser.tipShape || 'round',
        minSize: 1,
        maxSize: 500,
        dynamics: {
          pressure: { size: 100, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
          velocity: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
          jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
          noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
        }
      };
    } else {
      brushSnapshot = (this.currentBrush && typeof this.currentBrush.createSnapshot === 'function')
        ? this.currentBrush.createSnapshot()
        : (this.currentBrush ? JSON.parse(JSON.stringify(this.currentBrush)) : {});
    }

    this.currentStroke = {
      id: 'stroke_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      brushId: isEraser ? 'eraser' : (this.currentBrush?.id || 'pencil'),
      brushSnapshot: brushSnapshot,
      color: isEraser ? '#000000' : this.currentColor,
      isEraser: isEraser,
      seed: strokeSeed,
      points: [stabilized]
    };

    if (isEraser) {
      this.renderIncrementalStroke(activeLayer.ctx, this.currentStroke);
      activeLayer.updateThumbnail();
      this.layerManager.invalidateCaches();
      this.needsRender = true;
    } else {
      this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
      this.renderIncrementalStroke(this.liveCtx, this.currentStroke);
      this.needsRender = true;
    }
  }

  appendStrokePoint(e) {
    if (!this.isDrawing || !this.currentStroke) return;

    const pos = this.getPointerPos(e);
    const rawWorld = this.viewport.screenToWorld(pos.x, pos.y);
    const snapped = this.toolManager.rulerGuides.snapPoint(rawWorld.x, rawWorld.y);

    const pts = this.currentStroke.points;
    if (pts.length > 0) {
      const lastPt = pts[pts.length - 1];
      const distFromLast = Math.hypot(snapped.x - lastPt.x, snapped.y - lastPt.y);
      if (distFromLast < 1.5) {
        return;
      }
    }

    const pressure = this.pressureEngine.resolvePressure(e, snapped, this.currentBrush, this.globalSpeedFactor);
    const stabilized = this.stabilizer.update({
      x: snapped.x,
      y: snapped.y,
      pressure: pressure,
      time: performance.now()
    });

    if (stabilized) {
      this.currentStroke.points.push(stabilized);
      if (this.currentStroke.isEraser) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (activeLayer && !activeLayer.locked) {
          // Render incrementally directly onto active layer using destination-out
          this.renderIncrementalStroke(activeLayer.ctx, this.currentStroke);
          activeLayer.updateThumbnail();
          this.layerManager.invalidateCaches();
          this.needsRender = true;
        }
      } else {
        // Render incrementally directly into liveCtx
        this.renderIncrementalStroke(this.liveCtx, this.currentStroke);
        this.needsRender = true;
      }
    }
  }

  getStrokeBoundingBox(stroke, docWidth, docHeight) {
    if (!stroke || !stroke.points || stroke.points.length === 0) {
      return null;
    }
    const brushSize = stroke.brushSnapshot?.size || 30;
    const padding = Math.max(24, Math.ceil(brushSize * 2.5));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const x = Math.max(0, Math.floor(minX - padding));
    const y = Math.max(0, Math.floor(minY - padding));
    const right = Math.min(docWidth, Math.ceil(maxX + padding));
    const bottom = Math.min(docHeight, Math.ceil(maxY + padding));
    const width = Math.max(1, right - x);
    const height = Math.max(1, bottom - y);
    return { x, y, width, height };
  }

  showToast(msg) {
    if (window.AndroidBridge?.showToast) {
      window.AndroidBridge.showToast(msg);
    } else {
      console.warn('[Vectura Toast]', msg);
    }
  }

  finishStroke() {
    if (!this.isDrawing || !this.currentStroke) return;
    this.isDrawing = false;
    this.activePointerId = null;

    try {
      const catchUp = this.stabilizer.finish();
      if (catchUp && catchUp.length > 0) {
        for (const pt of catchUp) {
          this.currentStroke.points.push(pt);
        }
      }

      const activeLayer = this.layerManager.getActiveLayer();
      if (activeLayer && !activeLayer.locked) {
        if (!this.currentStroke.isEraser) {
          this.renderStrokeToLayer(activeLayer, this.currentStroke);
        } else {
          this.renderIncrementalStroke(activeLayer.ctx, this.currentStroke);
          activeLayer.addStroke(this.currentStroke);
          activeLayer.updateThumbnail();
        }
        const bbox = this.getStrokeBoundingBox(this.currentStroke, this.docWidth, this.docHeight);
        const beforeSnapshot = cropBoundingBox(this.beforeStrokeCanvas, bbox);
        const afterSnapshot = cropBoundingBox(activeLayer.canvas, bbox);

        if (this.history) {
          const cmd = new StrokeCommand(
            activeLayer,
            this.currentStroke,
            (l) => {
              this.layerManager.invalidateCaches();
            },
            beforeSnapshot,
            afterSnapshot
          );
          this.history.push(cmd);
        }
      }
    } catch (strokeErr) {
      console.error('finishStroke error:', strokeErr);
      this.showToast('Stroke error: ' + (strokeErr.message || 'failed'));
    } finally {
      this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
      this.currentStroke = null;
      this.beforeStrokeCanvas = null;
      this.lastStampRadius = null;
      this.lastRenderedSampleIndex = 0;
      this.layerManager.invalidateCaches();
      this.onStrokeFinished?.();
    }
  }

  cancelStroke() {
    if (this.isDrawing) {
      if (this.currentStroke?.isEraser) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (activeLayer && this.beforeStrokeCanvas) {
          activeLayer.ctx.clearRect(0, 0, activeLayer.width, activeLayer.height);
          activeLayer.ctx.drawImage(this.beforeStrokeCanvas, 0, 0);
          activeLayer.updateThumbnail();
        }
      }
      this.isDrawing = false;
      this.activePointerId = null;
      this.currentStroke = null;
      this.beforeStrokeCanvas = null;
      this.lastStampRadius = null;
      this.lastRenderedSampleIndex = 0;
      this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
      this.layerManager.invalidateCaches();
      this.onStrokeFinished?.();
    }
    if (this.toolManager.lassoFill?.active) {
      this.toolManager.lassoFill.cancel();
    }
    if (this.toolManager.shapeTool?.active) {
      this.toolManager.shapeTool.cancel();
    }
    if (this.toolManager.gradientTool?.active) {
      this.toolManager.gradientTool.cancel();
    }
  }

  cancelAllActiveTools() {
    this.cancelLongPress();
    this.cancelStroke();
    this.isDraggingSymmetry = false;
    if (this.toolManager.smudgeTool) {
      this.toolManager.smudgeTool.active = false;
    }
    if (this.toolManager.lassoFill) {
      this.toolManager.lassoFill.cancel();
      this.toolManager.lassoFill.active = false;
      this.toolManager.lassoFill.points = [];
    }
    if (this.toolManager.shapeTool) {
      this.toolManager.shapeTool.cancel();
      this.toolManager.shapeTool.active = false;
    }
    if (this.toolManager.gradientTool) {
      this.toolManager.gradientTool.cancel();
      this.toolManager.gradientTool.active = false;
    }
    if (this.toolManager.selectionTool && !this.toolManager.selectionTool.hasSelection) {
      this.toolManager.selectionTool.active = false;
    }
    this.needsRender = true;
  }

  renderLiveStroke() {
    if (!this.currentStroke) return;
    this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    this.lastRenderedSampleIndex = 0;
    this.lastStampRadius = null;
    this.renderIncrementalStroke(this.liveCtx, this.currentStroke);
  }

  renderIncrementalStroke(ctx, stroke) {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    const b = stroke.brushSnapshot || {};
    const baseSize = Math.max(1, Number.isFinite(b.size) ? b.size : 8);
    const sp = b.spacingSettings || {};
    const spacingRatio = Math.max(0.01, Math.min(2.0, sp.spacing ?? b.spacing ?? 0.08));
    const stepPx = Math.max(sp.minSpacingPx || 0.8, baseSize * spacingRatio);

    const dyn = b.dynamics || {
      pressure: { size: 100, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    };

    const calcStep = (pt) => {
      const pNorm = Math.max(0, Math.min(1, pt?.pressure ?? 0.5));
      const pFactor = (pNorm - 0.5) * 2;
      const speed = Math.max(0, pt?.speed || 0);
      const vFactor = Math.min(1.5, Math.max(-1.0, (speed - 0.6) / 0.8));
      let spMod = 1.0;
      if (dyn.pressure?.spacing) spMod += (dyn.pressure.spacing / 100) * pFactor;
      if (dyn.velocity?.spacing) spMod += (dyn.velocity.spacing / 100) * vFactor;
      return Math.max(0.5, stepPx * Math.max(0.1, spMod));
    };

    const allSamples = this.spline.sampleStroke(pts, calcStep);
    if (!allSamples || allSamples.length === 0) return;

    const startIdx = this.lastRenderedSampleIndex || 0;
    if (startIdx >= allSamples.length) return;

    if (this.toolManager.symmetry.mode !== 'off' && pts.length > 0) {
      const symmInstances = this.toolManager.symmetry.radialAxes || 4;
      const count = this.toolManager.symmetry.mode === 'radial' ? symmInstances : 2;
      for (let s = 0; s < count; s++) {
        const mirroredSamples = allSamples.map(p => this.toolManager.symmetry.getSymmetricPoints(p)[s] || p);
        this.renderSamplesToContext(ctx, stroke, mirroredSamples, startIdx, allSamples.length);
      }
    } else {
      this.renderSamplesToContext(ctx, stroke, allSamples, startIdx, allSamples.length);
    }

    this.lastRenderedSampleIndex = allSamples.length;
  }

  renderStrokeToLayer(layer, stroke) {
    if (this.toolManager.symmetry.mode !== 'off' && stroke.points.length > 0) {
      const count = this.toolManager.symmetry.mode === 'radial' ? this.toolManager.symmetry.radialAxes : 2;
      for (let s = 0; s < count; s++) {
        const mirroredPts = stroke.points.map(p => this.toolManager.symmetry.getSymmetricPoints(p)[s] || p);
        const clonedStroke = { ...stroke, points: mirroredPts };
        this.renderStrokeToContext(layer.ctx, clonedStroke);
        layer.addStroke(clonedStroke);
      }
    } else {
      this.renderStrokeToContext(layer.ctx, stroke);
      layer.addStroke(stroke);
    }
    layer.updateThumbnail();
  }

  renderStrokeToContext(ctx, stroke) {
    const b = stroke.brushSnapshot || {};
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    // Pixel Art Mode: 1px / integer grid
    if (this.pixelArtMode || b.isPixel || b.spacingSettings?.pixelArtMode) {
      ctx.save();
      if (stroke.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = b.blendMode || 'source-over';
      }
      ctx.fillStyle = stroke.color;
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < pts.length - 1; i++) {
        const pixels = bresenhamPixelPerfect(
          Math.round(pts[i].x),
          Math.round(pts[i].y),
          Math.round(pts[i + 1].x),
          Math.round(pts[i + 1].y)
        );
        for (const px of pixels) {
          ctx.fillRect(px.x, px.y, b.size || 1, b.size || 1);
        }
      }
      ctx.restore();
      return;
    }

    const baseSize = Math.max(1, Number.isFinite(b.size) ? b.size : 8);
    const sp = b.spacingSettings || {};
    const spacingRatio = Math.max(0.01, Math.min(2.0, sp.spacing ?? b.spacing ?? 0.08));
    const stepPx = Math.max(sp.minSpacingPx || 0.8, baseSize * spacingRatio);

    const dyn = b.dynamics || {
      pressure: { size: 100, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    };

    const calcStep = (pt) => {
      const pNorm = Math.max(0, Math.min(1, pt?.pressure ?? 0.5));
      const pFactor = (pNorm - 0.5) * 2;
      const speed = Math.max(0, pt?.speed || 0);
      const vFactor = Math.min(1.5, Math.max(-1.0, (speed - 0.6) / 0.8));
      let spMod = 1.0;
      if (dyn.pressure?.spacing) spMod += (dyn.pressure.spacing / 100) * pFactor;
      if (dyn.velocity?.spacing) spMod += (dyn.velocity.spacing / 100) * vFactor;
      return Math.max(0.5, stepPx * Math.max(0.1, spMod));
    };

    const samples = this.spline.sampleStroke(pts, calcStep);
    if (!samples || samples.length === 0) return;

    this.renderSamplesToContext(ctx, stroke, samples, 0, samples.length);
  }

  /**
   * Stamping and Ribbon Stroke Render Engine with Ink-Bleed Safeguards & Advanced Spacing/Jitter
   */
  renderSamplesToContext(ctx, stroke, samples, startIdx = 0, endIdx = samples.length) {
    const b = stroke.brushSnapshot || {};
    if (!samples || samples.length === 0 || startIdx >= endIdx) return;

    ctx.save();

    const activeLayer = this.layerManager.getActiveLayer();
    if (stroke.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else if (activeLayer && ctx === activeLayer.ctx && activeLayer.alphaLock) {
      ctx.globalCompositeOperation = 'source-atop';
    } else {
      ctx.globalCompositeOperation = b.blendMode || 'source-over';
    }

    ctx.fillStyle = stroke.color;
    ctx.strokeStyle = stroke.color;

    // Glow width
    if (b.glowWidth && b.glowWidth > 0 && !stroke.isEraser) {
      ctx.shadowBlur = b.glowWidth;
      ctx.shadowColor = stroke.color;
    }

    const baseSize = Math.max(1, Number.isFinite(b.size) ? b.size : 8);
    const baseOpacity = Math.max(0.01, Math.min(1.0, Number.isFinite(b.opacity) ? b.opacity : 1.0));
    const strokeSeed = stroke.seed || 1337;
    const brushMinRadius = Math.max(0.25, (b.minSize || 1) / 2);
    const brushMaxRadius = Math.max(brushMinRadius + 0.5, (b.maxSize || 500) / 2);

    // Unified dynamics sources: Pressure, Velocity, Jitter, Noise
    const dyn = b.dynamics || {
      pressure: { size: 100, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    };

    const dP = dyn.pressure || {};
    const dV = dyn.velocity || {};
    const dJ = dyn.jitter || {};
    const dN = dyn.noise || {};

    const noiseScale = b.noiseScale || 0.02;
    const noiseOctaves = b.noiseOctaves || 2;
    const noiseSeed = (strokeSeed ^ (b.noiseSeed || 42)) & 0xffff;

    for (let i = startIdx; i < endIdx; i++) {
      const s = samples[i];
      if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) continue;

      const pNorm = Math.max(0, Math.min(1.0, Number.isFinite(s.pressure) ? s.pressure : 0.5));
      const pFactor = (pNorm - 0.5) * 2.0; // -1 to +1

      const speed = Math.max(0, s.speed || 0);
      const vFactor = Math.min(1.5, Math.max(-1.0, (speed - 0.6) / 0.8)); // real px/ms speed response

      const jVal = ((Math.abs(Math.sin(strokeSeed * 17 + i * 9301 + 49297)) * 233280) % 1.0) * 2 - 1; // -1 to +1

      const nVal = CoherentNoise.noise2D(s.x * noiseScale, s.y * noiseScale, noiseSeed, noiseOctaves); // -1 to +1

      // Size calculation
      let sizeMod = 1.0;
      if (dP.size) sizeMod += (dP.size / 100) * pFactor;
      if (dV.size) sizeMod += (dV.size / 100) * vFactor;
      if (dJ.size) sizeMod += (dJ.size / 100) * jVal;
      if (dN.size) sizeMod += (dN.size / 100) * nVal;

      let radius = (baseSize / 2) * Math.max(0.02, sizeMod);

      // Taper at start and end
      if (b.taperStart > 0 && i < b.taperStart) {
        radius *= Math.max(0.05, (i + 1) / b.taperStart);
      }
      if (b.taperEnd > 0 && i > samples.length - b.taperEnd) {
        radius *= Math.max(0.05, (samples.length - i) / b.taperEnd);
      }

      // Light smoothing on radius (replaces 25% rate limiter so negative velocity factors work)
      if (this.lastStampRadius !== null) {
        radius = this.lastStampRadius * 0.2 + radius * 0.8;
      }
      // Final hard clamp
      radius = Math.max(brushMinRadius, Math.min(brushMaxRadius, radius));
      this.lastStampRadius = radius;

      // Opacity calculation
      let alphaMod = 0.0;
      if (dP.opacity) alphaMod += (dP.opacity / 100) * pFactor;
      if (dV.opacity) alphaMod += (dV.opacity / 100) * vFactor;
      if (dJ.opacity) alphaMod += (dJ.opacity / 100) * jVal;
      if (dN.opacity) alphaMod += (dN.opacity / 100) * nVal;

      let stampAlpha = Math.max(0.01, Math.min(1.0, baseOpacity * Math.max(0.0, 1.0 + alphaMod) * (b.flow ?? 1.0)));

      // Grain texture modulation
      if (b.grain && b.grain > 0) {
        const grainNoise = ((Math.abs(Math.sin(s.x * 12.9898 + s.y * 78.233 + strokeSeed)) * 43758.5453) % 1.0);
        stampAlpha *= (1.0 - (b.grain * 0.5 * grainNoise));
      }

      // Rotation calculation
      let stampRotation = b.rotation || 0;
      let rotMod = 0.0;
      if (dP.rotation) rotMod += (dP.rotation / 100) * pFactor * Math.PI;
      if (dV.rotation) rotMod += (dV.rotation / 100) * vFactor * Math.PI;
      if (dJ.rotation) rotMod += (dJ.rotation / 100) * jVal * Math.PI;
      if (dN.rotation) rotMod += (dN.rotation / 100) * nVal * Math.PI;
      stampRotation += rotMod;

      // Scatter calculation
      let stampX = s.x;
      let stampY = s.y;
      let scatterMod = b.scatter || 0;
      if (dP.scatter) scatterMod += (dP.scatter / 100) * Math.abs(pFactor);
      if (dV.scatter) scatterMod += (dV.scatter / 100) * Math.max(0, vFactor);
      if (dJ.scatter) scatterMod += (dJ.scatter / 100) * Math.abs(jVal);
      if (dN.scatter) scatterMod += (dN.scatter / 100) * Math.abs(nVal);

      if (scatterMod > 0.01) {
        const scatAngle = ((Math.sin(strokeSeed + i * 7919) * 10000) % 1) * Math.PI * 2;
        const scatDist = Math.abs(((Math.sin(strokeSeed + i * 4999) * 10000) % 1)) * radius * scatterMod * 2.0;
        stampX += Math.cos(scatAngle) * scatDist;
        stampY += Math.sin(scatAngle) * scatDist;
      }

      ctx.globalAlpha = Math.max(0.01, Math.min(1.0, stampAlpha));

      ctx.save();
      ctx.translate(stampX, stampY);
      if (stampRotation !== 0) ctx.rotate(stampRotation);

      const roundness = b.roundness !== undefined ? Math.max(0.1, b.roundness) : 1.0;
      const aspect = b.aspectRatio ? Math.max(0.1, b.aspectRatio) : 1.0;
      if (roundness !== 1.0 || aspect !== 1.0) {
        ctx.scale(1.0, (1.0 / aspect) * roundness);
      }

      // Stamp shape rendering
      if (b.tipShape === 'square') {
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      } else if (b.tipShape === 'chisel') {
        ctx.fillRect(-radius * 1.8, -radius * 0.4, radius * 3.6, radius * 0.8);
      } else if (b.tipShape === 'star') {
        ctx.beginPath();
        for (let sp = 0; sp < 10; sp++) {
          const a = (sp * Math.PI) / 5 - Math.PI / 2;
          const rad = sp % 2 === 0 ? radius : radius * 0.45;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (sp === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else if (b.tipShape === 'bristle') {
        for (let br = -2; br <= 2; br++) {
          ctx.beginPath();
          ctx.arc(br * (radius * 0.35), 0, Math.max(0.4, radius * 0.25), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (b.tipShape === 'soft' || b.tipShape === 'gaussian' || (b.hardness !== undefined && b.hardness < 0.6) || (b.wetEdge && b.wetEdge > 0)) {
        const { canvas: spriteCanvas } = this.getSoftStampSprite(stroke.color, radius, b.hardness, b.wetEdge);
        ctx.drawImage(spriteCanvas, -spriteCanvas.width / 2, -spriteCanvas.height / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.5, radius), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  redrawLayerStrokes(layer) {
    layer.ctx.clearRect(0, 0, layer.width, layer.height);
    for (const s of layer.strokes) {
      if (s.points) {
        this.renderStrokeToContext(layer.ctx, s);
      }
    }
    layer.updateThumbnail();
    this.layerManager.invalidateCaches();
  }

  /**
   * iPad-style expanding circular ripple fill animation.
   * Expands smoothly (ease-out, ~300-500 ms) clipped strictly to the filled region.
   * Input is NOT blocked. Committed as one undoable step with RasterCommand.
   */
  commitFillWithAnimation(info) {
    const { startX, startY, maxRadius, patchCanvas, activeLayer, animate, duration, bbox } = info;
    this.onHaptic?.();

    const beforeSnapshot = cropBoundingBox(activeLayer.canvas, bbox);

    const commitToHistory = () => {
      try {
        const afterSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
        if (this.history) {
          this.history.push(new RasterCommand('Fill Bucket', activeLayer, beforeSnapshot, afterSnapshot, () => {
            this.layerManager.invalidateCaches();
          }));
        }
      } catch (err) {
        console.error('Fill commit error:', err);
        this.showToast('Fill commit failed: ' + (err.message || 'error'));
      }
    };

    if (!animate) {
      activeLayer.ctx.drawImage(patchCanvas, 0, 0);
      activeLayer.updateThumbnail();
      this.layerManager.invalidateCaches();
      commitToHistory();
      return;
    }

    const startTime = performance.now();
    const animDuration = Math.max(200, Math.min(800, duration || 380));

    const animCanvas = document.createElement('canvas');
    animCanvas.width = this.docWidth;
    animCanvas.height = this.docHeight;
    const animCtx = animCanvas.getContext('2d');

    const animEntry = {
      render: (targetCtx) => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1.0, elapsed / animDuration);
        const ease = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
        const currentR = maxRadius * ease;

        animCtx.clearRect(0, 0, this.docWidth, this.docHeight);
        animCtx.save();
        animCtx.beginPath();
        animCtx.arc(startX, startY, currentR, 0, Math.PI * 2);
        animCtx.clip();
        animCtx.drawImage(patchCanvas, 0, 0);
        animCtx.restore();

        targetCtx.drawImage(animCanvas, 0, 0);
        return progress < 1.0;
      }
    };

    this.activeFillAnimations.push(animEntry);

    const checkFinish = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= animDuration) {
        const idx = this.activeFillAnimations.indexOf(animEntry);
        if (idx >= 0) this.activeFillAnimations.splice(idx, 1);

        activeLayer.ctx.drawImage(patchCanvas, 0, 0);
        activeLayer.updateThumbnail();
        this.layerManager.invalidateCaches();
        commitToHistory();
      } else {
        requestAnimationFrame(checkFinish);
      }
    };
    requestAnimationFrame(checkFinish);
  }

  /**
   * 60 FPS Viewport Render Loop
   */
  renderLoop() {
    if (!this.running) return;

    try {
      const w = this.viewportCanvas.clientWidth || window.innerWidth || 800;
      const h = this.viewportCanvas.clientHeight || window.innerHeight || 600;
      if (this.viewportCanvas.width !== w || this.viewportCanvas.height !== h) {
        this.viewportCanvas.width = w;
        this.viewportCanvas.height = h;
        this.viewport.resizeScreen(w, h);
      }

      if (!this.initialFitDone && w > 80 && h > 80) {
        this.viewport.fitToScreen();
        this.initialFitDone = true;
      }

      const ctx = this.ctx;
      // 1. Workspace background (calm surround tone #D9D9DB)
      ctx.fillStyle = '#D9D9DB';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      this.viewport.applyTransform(ctx);

      // 2. Artwork background (white paper)
      ctx.fillStyle = this.layerManager.isTransparentBg ? '#FFFFFF' : (this.layerManager.backgroundColor || '#FFFFFF');
      ctx.fillRect(0, 0, this.docWidth, this.docHeight);

      // 3. 1px artwork outline
      ctx.strokeStyle = '#B8B8BC';
      ctx.lineWidth = Math.max(1, 1 / this.viewport.zoom);
      ctx.strokeRect(0, 0, this.docWidth, this.docHeight);

      // Composite layers with live buffer
      this.layerManager.compositeStack(ctx, this.liveCanvas, 1.0, 'source-over');

      // Render active fill animations
      if (this.activeFillAnimations.length > 0) {
        for (const anim of this.activeFillAnimations) {
          anim.render(ctx);
        }
      }

      // Ruler Guides overlay
      if (this.toolManager.rulerGuides.mode !== 'off') {
        this.toolManager.rulerGuides.drawGuides(ctx, this.docWidth, this.docHeight, this.viewport.zoom);
      }

      // Selection marching ants overlay
      if (this.toolManager.selectionTool.hasSelection || this.toolManager.selectionTool.active) {
        this.toolManager.selectionTool.drawMarchingAnts(ctx, this.viewport.zoom);
      }

      // Transform interactive overlay
      if (this.toolManager.transformTool.active) {
        this.toolManager.transformTool.drawOverlay(ctx, this.viewport.zoom);
      }

      // Symmetry overlay
      if (this.toolManager.symmetry.mode !== 'off') {
        this.toolManager.symmetry.render(ctx, this.docWidth, this.docHeight, this.viewport.zoom);
      }

      // Tool live overlays
      try {
        if (this.toolManager.activeTool === 'lasso-fill' && this.toolManager.lassoFill.active) {
          this.toolManager.lassoFill.renderOverlay(ctx, this.currentColor, this.currentBrush?.opacity ?? 1.0);
        } else if (this.toolManager.activeTool === 'shape' && this.toolManager.shapeTool.active) {
          this.toolManager.shapeTool.renderOverlay(ctx, this.currentColor, this.currentBrush?.size || 4);
        } else if (this.toolManager.activeTool === 'gradient' && this.toolManager.gradientTool.active) {
          this.toolManager.gradientTool.renderOverlay(ctx, this.currentColor, '#ffffff');
        }
      } catch (overlayErr) {
        // Overlay failure should never crash the engine
      }

      ctx.restore();
    } catch (err) {
      console.warn('Error in renderLoop:', err);
    } finally {
      requestAnimationFrame(this.renderLoop);
    }
  }
}
