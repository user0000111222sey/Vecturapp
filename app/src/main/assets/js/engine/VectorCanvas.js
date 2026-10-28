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
    const isMousePan = (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || this.isSpaceDown || e.altKey || isPanTool || (e.button === 0 && isOutsideDoc))) || (isPanTool && e.button === 0);

    if (isMousePan) {
      this.isMousePanning = true;
      this.lastMousePanPos = { x: pos.x, y: pos.y };
      this.viewportCanvas.style.cursor = 'grabbing';
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
        this.toolManager.lassoFill.start(world.x, world.y);
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

      const pts = Array.from(this.activePointers.values());
      const p1 = pts[0], p2 = pts[1];
      this.lastPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.lastPinchAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      this.lastPinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      this.initialPinchDist = this.lastPinchDist;
      this.initialPinchAngle = this.lastPinchAngle;
      this.initialPinchCenter = { ...this.lastPinchCenter };
      this.navigationGestureOccurred = false;
    }
  }

  onPointerMove(e) {
    e.preventDefault();
    const pos = this.getPointerPos(e);

    // Mouse Pan Navigation
    if (this.isMousePanning) {
      const dx = pos.x - this.lastMousePanPos.x;
      const dy = pos.y - this.lastMousePanPos.y;
      this.viewport.panBy(dx, dy);
      this.viewport.onNavigate?.(this.viewport.zoom, this.viewport.rotation);
      this.lastMousePanPos = { x: pos.x, y: pos.y };
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

    // Handle Eyedropper sampling if active
    if (this.toolManager.eyedropper.active) {
      const world = this.viewport.screenToWorld(pos.x, pos.y);
      const picked = this.toolManager.eyedropper.sample(world.x, world.y, pos.x, pos.y, this.layerManager);
      this.currentColor = picked;
      this.onColorPicked?.(picked);
      return;
    }

    // If navigating or multi-touch is active, don't execute any single-pointer tool
    if (this.isNavigating || this.activePointers.size >= 2 || performance.now() - (this.lastNavigationTime || 0) < 250) {
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
      this.toolManager.lassoFill.addPoint(world.x, world.y);
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

    if (this.isMousePanning) {
      this.isMousePanning = false;
      const isPan = this.toolManager.activeTool === 'pan' || this.toolManager.activeTool === 'transform';
      this.viewportCanvas.style.cursor = isPan ? 'grab' : (this.isSpaceDown ? 'grab' : 'crosshair');
      return;
    }

    const now = performance.now();
    const tapDuration = now - this.multiTouchTap.startTime;
    const maxPointers = this.multiTouchTap.maxPointers;

    this.activePointers.delete(e.pointerId);

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
          this.toolManager.lassoFill.finish(activeLayer, this.currentColor, false);
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
    if (this.isMousePanning) {
      this.isMousePanning = false;
      this.viewportCanvas.style.cursor = this.isSpaceDown ? 'grab' : 'crosshair';
    }
    this.activePointers.delete(e.pointerId);
    this.cancelStroke();
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

    const brushSnapshot = (this.currentBrush && typeof this.currentBrush.createSnapshot === 'function')
      ? this.currentBrush.createSnapshot()
      : (this.currentBrush ? JSON.parse(JSON.stringify(this.currentBrush)) : {});

    this.currentStroke = {
      id: 'stroke_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      brushId: this.currentBrush?.id || 'pencil',
      brushSnapshot: brushSnapshot,
      color: isEraser ? '#000000' : this.currentColor,
      isEraser: isEraser,
      seed: strokeSeed,
      points: [stabilized]
    };

    if (isEraser) {
      this.renderStrokeToLayer(activeLayer, this.currentStroke);
      this.layerManager.invalidateCaches();
    } else {
      this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
      this.renderLiveStroke();
    }
  }

  appendStrokePoint(e) {
    if (!this.isDrawing || !this.currentStroke) return;

    const pos = this.getPointerPos(e);
    const rawWorld = this.viewport.screenToWorld(pos.x, pos.y);
    const snapped = this.toolManager.rulerGuides.snapPoint(rawWorld.x, rawWorld.y);

    // Stop emission when finger is still unless brush has build-up enabled
    const pts = this.currentStroke.points;
    if (pts.length > 0) {
      const lastPt = pts[pts.length - 1];
      const distFromLast = Math.hypot(snapped.x - lastPt.x, snapped.y - lastPt.y);
      const isBuildUp = !!(this.currentBrush?.buildUp || this.currentBrush?.isAirbrushBuildUp);
      if (distFromLast < 1.8 && !isBuildUp) {
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
        if (activeLayer && !activeLayer.locked && this.beforeStrokeCanvas) {
          activeLayer.ctx.clearRect(0, 0, activeLayer.width, activeLayer.height);
          activeLayer.ctx.drawImage(this.beforeStrokeCanvas, 0, 0);
          this.renderStrokeToLayer(activeLayer, this.currentStroke);
          this.layerManager.invalidateCaches();
        }
      } else {
        this.renderLiveStroke();
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

    const pts = this.currentStroke.points;
    if (this.toolManager.symmetry.mode !== 'off' && pts.length > 0) {
      const symmInstances = this.toolManager.symmetry.radialAxes || 4;
      const count = this.toolManager.symmetry.mode === 'radial' ? symmInstances : 2;
      for (let s = 0; s < count; s++) {
        const mirroredPts = pts.map(p => this.toolManager.symmetry.getSymmetricPoints(p)[s] || p);
        this.renderStrokeToContext(this.liveCtx, { ...this.currentStroke, points: mirroredPts });
      }
    } else {
      this.renderStrokeToContext(this.liveCtx, this.currentStroke);
    }
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

  /**
   * Stamping and Ribbon Stroke Render Engine with Ink-Bleed Safeguards & Advanced Spacing/Jitter
   */
  renderStrokeToContext(ctx, stroke) {
    const b = stroke.brushSnapshot || {};
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

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

    // Pixel Art Mode: 1px / integer grid
    if (this.pixelArtMode || b.isPixel || b.spacingSettings?.pixelArtMode) {
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

    // Spacing calculation
    const baseSize = Math.max(1, Number.isFinite(b.size) ? b.size : 8);
    const sp = b.spacingSettings || {};
    const spacingRatio = Math.max(0.01, Math.min(2.0, sp.spacing ?? b.spacing ?? 0.08));
    let stepPx = Math.max(sp.minSpacingPx || 0.8, baseSize * spacingRatio);

    // Auto-spacing mode: keep strokes smooth at all sizes
    if (sp.autoSpacing) {
      stepPx = Math.max(1.0, Math.min(12.0, baseSize * 0.12));
    }

    const samples = this.spline.sampleStroke(pts, stepPx);
    if (samples.length === 0) {
      ctx.restore();
      return;
    }

    const baseOpacity = Math.max(0.01, Math.min(1.0, Number.isFinite(b.opacity) ? b.opacity : 1.0));
    const strokeSeed = stroke.seed || 1337;
    const totalLength = samples[samples.length - 1].distance || 1;

    // INK BLEED & SIZE SAFEGUARDS:
    const brushMinRadius = Math.max(0.25, (b.minSize || 1) / 2);
    const brushMaxRadius = Math.max(brushMinRadius + 0.5, (b.maxSize || 200) / 2);
    let lastRadius = null;

    // Single-stroke opacity capping: when !buildUp, render into stroke buffer
    // so repeated passes or lingering within the SAME stroke never exceed baseOpacity
    const useStrokeBuffer = (!b.buildUp && baseOpacity < 0.98 && this.strokeCtx);
    const targetCtx = useStrokeBuffer ? this.strokeCtx : ctx;

    if (useStrokeBuffer) {
      this.strokeCtx.clearRect(0, 0, this.docWidth, this.docHeight);
      this.strokeCtx.save();
      this.strokeCtx.fillStyle = stroke.color;
      this.strokeCtx.strokeStyle = stroke.color;
    }

    // Factor Links Matrix from brush
    const fl = b.factorLinks || {};
    const vLinks = fl.velocity || {};
    const jLinks = fl.jitter || {};
    const nLinks = fl.noise || {};

    // Render individual stamp segments
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) continue;

      let pressure = Number.isFinite(s.pressure) ? s.pressure : 0.5;
      pressure = Math.max(0.01, Math.min(1.0, pressure));

      let radius = (baseSize * pressure) / 2;

      // Taper at start and end
      if (b.taperStart > 0 && i < b.taperStart) {
        radius *= Math.max(0.05, (i + 1) / b.taperStart);
      }
      if (b.taperEnd > 0 && i > samples.length - b.taperEnd) {
        radius *= Math.max(0.05, (samples.length - i) / b.taperEnd);
      }

      // 1. Evaluate Factors: velocity, jitter, noise (smoothed limits)
      const vFactor = Math.min(1.5, Math.max(-1.0, (pressure - 0.5) * 2.0));
      const jFactor = ((Math.sin(strokeSeed + i * 1337.7) * 43758.5453) % 1.0);
      const rawNoise = CoherentNoise.computeNoiseSample(b.jitter || { enabled: true }, strokeSeed, s.distance, s.time || 0);
      const nFactor = Math.max(-1.0, Math.min(1.0, rawNoise * 0.2)); // Reduced 2D noise limit to prevent jitter explosion

      // 2. Modulate Children (Size, Rotation, Spacing, Opacity, Tip Rotation)
      // Child: Size
      let sizeMod = 1.0;
      if (vLinks.size) sizeMod += (vLinks.size / 100) * vFactor;
      if (jLinks.size) sizeMod += (jLinks.size / 100) * jFactor * 0.4;
      if (nLinks.size) sizeMod += (nLinks.size / 100) * nFactor * 0.2;
      radius = radius * Math.max(0.05, sizeMod);

      // Child: Opacity
      let stampAlpha = useStrokeBuffer ? (b.flow ?? 1.0) : (baseOpacity * (b.flow ?? 1.0));
      let alphaMod = 0;
      if (vLinks.opacity) alphaMod += (vLinks.opacity / 100) * vFactor;
      if (jLinks.opacity) alphaMod += (jLinks.opacity / 100) * jFactor * 0.4;
      if (nLinks.opacity) alphaMod += (nLinks.opacity / 100) * nFactor * 0.2;
      stampAlpha = Math.max(0.01, Math.min(1.0, stampAlpha * (1.0 + alphaMod)));

      // Child: Rotation & Tip Rotation
      let stampRotation = b.rotation || 0;
      let rotMod = 0;
      if (vLinks.rotation) rotMod += (vLinks.rotation / 100) * vFactor * Math.PI;
      if (jLinks.rotation) rotMod += (jLinks.rotation / 100) * jFactor * Math.PI;
      if (nLinks.rotation) rotMod += (nLinks.rotation / 100) * nFactor * 0.3 * Math.PI;
      if (vLinks.tipRotation) rotMod += (vLinks.tipRotation / 100) * vFactor * Math.PI;
      if (jLinks.tipRotation) rotMod += (jLinks.tipRotation / 100) * jFactor * Math.PI;
      if (nLinks.tipRotation) rotMod += (nLinks.tipRotation / 100) * nFactor * 0.3 * Math.PI;
      stampRotation += rotMod;

      let stampX = s.x;
      let stampY = s.y;

      if (b.jitter && b.jitter.enabled) {
        const jTargets = CoherentNoise.evaluateAllTargets(
          b.jitter,
          strokeSeed,
          s.distance,
          s.time,
          s.speed || 0,
          totalLength
        );
        radius = Math.max(0.25, radius * (1.0 + jTargets.sizeDelta));
        stampX += jTargets.wobbleX;
        stampY += jTargets.wobbleY;
        stampRotation += jTargets.angleDelta;
        stampAlpha = Math.max(0.01, Math.min(1.0, stampAlpha + jTargets.opacityDelta));
      }

      if (!Number.isFinite(radius)) radius = baseSize / 2;

      // RATE LIMITER: limit how much size can change between two consecutive stamps
      if (lastRadius !== null) {
        const maxDelta = Math.max(1.5, lastRadius * 0.25);
        radius = Math.max(lastRadius - maxDelta, Math.min(lastRadius + maxDelta, radius));
      }

      // HARD CLAMP: strictly enforce brush.minSize and brush.maxSize bounds
      radius = Math.max(brushMinRadius, Math.min(brushMaxRadius, radius));
      lastRadius = radius;

      targetCtx.globalAlpha = Math.max(0.01, Math.min(1.0, stampAlpha));

      // Custom Stamp Shapes, Aspect Ratio, and Hardness
      targetCtx.save();
      targetCtx.translate(stampX, stampY);
      if (stampRotation !== 0) targetCtx.rotate(stampRotation);
      if (b.aspectRatio && b.aspectRatio !== 1.0) {
        targetCtx.scale(1.0, 1.0 / Math.max(0.1, b.aspectRatio));
      }

      if (b.tipShape === 'square') {
        targetCtx.fillRect(-radius, -radius, radius * 2, radius * 2);
      } else if (b.tipShape === 'chisel') {
        targetCtx.fillRect(-radius * 1.8, -radius * 0.4, radius * 3.6, radius * 0.8);
      } else if (b.tipShape === 'star') {
        targetCtx.beginPath();
        for (let sp = 0; sp < 10; sp++) {
          const a = (sp * Math.PI) / 5 - Math.PI / 2;
          const rad = sp % 2 === 0 ? radius : radius * 0.45;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (sp === 0) targetCtx.moveTo(px, py);
          else targetCtx.lineTo(px, py);
        }
        targetCtx.closePath();
        targetCtx.fill();
      } else if (b.tipShape === 'bristle') {
        for (let br = -2; br <= 2; br++) {
          targetCtx.beginPath();
          targetCtx.arc(br * (radius * 0.35), 0, Math.max(0.4, radius * 0.25), 0, Math.PI * 2);
          targetCtx.fill();
        }
      } else if (b.tipShape === 'soft' || b.tipShape === 'gaussian' || (b.hardness !== undefined && b.hardness < 0.6)) {
        const rad = Math.max(1, radius);
        const grad = targetCtx.createRadialGradient(0, 0, rad * Math.max(0.05, b.hardness ?? 0.3), 0, 0, rad);
        grad.addColorStop(0, stroke.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        targetCtx.fillStyle = grad;
        targetCtx.beginPath();
        targetCtx.arc(0, 0, rad, 0, Math.PI * 2);
        targetCtx.fill();
      } else {
        targetCtx.beginPath();
        targetCtx.arc(0, 0, Math.max(0.5, radius), 0, Math.PI * 2);
        targetCtx.fill();
      }
      targetCtx.restore();
    }

    if (useStrokeBuffer) {
      this.strokeCtx.restore();
      ctx.globalAlpha = baseOpacity;
      ctx.drawImage(this.strokeCanvas, 0, 0);
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
          this.toolManager.lassoFill.renderOverlay(ctx, this.currentColor);
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
