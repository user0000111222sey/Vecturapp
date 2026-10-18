/**
 * Vectura Vector Drawing Engine
 * High-performance vector stroke engine with Catmull-Rom splines, coherent jitter,
 * coalesced pointer capture, multi-touch gestures, and 60fps layer rendering.
 */
import { CatmullRomSpline, bresenhamPixelPerfect } from './CatmullRom.js';
import { PressureEngine } from './PressureEngine.js';
import { Stabilizer } from './Stabilizer.js';
import { CoherentNoise } from './CoherentNoise.js';
import { Viewport } from './Viewport.js';
import { LayerManager } from '../layers/LayerManager.js';
import { ToolManager } from '../tools/ToolManager.js';
import { StrokeCommand } from '../history/Command.js';

export class VectorCanvas {
  constructor(viewportCanvas, docWidth = 1080, docHeight = 1080) {
    this.viewportCanvas = viewportCanvas;
    this.ctx = viewportCanvas.getContext('2d', { alpha: false, desynchronized: true });

    this.docWidth = docWidth;
    this.docHeight = docHeight;

    // Viewport & Transformations
    this.viewport = new Viewport(docWidth, docHeight);

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

    // Current Drawing State
    this.isDrawing = false;
    this.activePointerId = null;
    this.currentStroke = null;
    this.currentBrush = null;
    this.currentColor = '#8b5cf6';

    // Touch & Multi-touch navigation state
    this.activePointers = new Map(); // pointerId -> { x, y, time }
    this.isNavigating = false;
    this.lastPinchDist = 0;
    this.lastPinchAngle = 0;
    this.lastPinchCenter = { x: 0, y: 0 };
    this.tapStartTime = 0;
    this.tapMaxMovement = 0;

    // Long press eyedropper timer
    this.longPressTimer = null;
    this.longPressPoint = null;

    // Shape Assist Hold Timer
    this.shapeHoldTimer = null;
    this.shapeHoldDetected = false;

    // Settings
    this.palmRejection = true; // Reject touch if pen is active
    this.penActive = false;
    this.oneFingerDraws = true;
    this.pixelArtMode = false;

    // Callbacks
    this.onColorPicked = null;
    this.onUndoRequested = null;
    this.onRedoRequested = null;
    this.onHaptic = null;

    // Animation Loop
    this.running = true;
    this.renderLoop = this.renderLoop.bind(this);
    requestAnimationFrame(this.renderLoop);

    this.setupPointerListeners();
  }

  setDocumentSize(w, h) {
    this.docWidth = w;
    this.docHeight = h;
    this.viewport.setDocumentSize(w, h);
    this.layerManager.resizeDocument(w, h);
    this.toolManager.resizeDocument(w, h);
    this.liveCanvas.width = w;
    this.liveCanvas.height = h;
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

    // Prevent Chrome gesture defaults
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onPointerDown(e) {
    e.preventDefault();
    try {
      this.viewportCanvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const now = performance.now();
    const pos = this.getPointerPos(e);

    // Stylus palm rejection
    if (e.pointerType === 'pen') {
      this.penActive = true;
    } else if (this.palmRejection && this.penActive && e.pointerType === 'touch') {
      return; // Ignore touch while stylus active
    }

    this.activePointers.set(e.pointerId, { x: pos.x, y: pos.y, time: now });

    // Multi-finger gesture detection
    if (this.activePointers.size === 1) {
      this.tapStartTime = now;
      this.tapMaxMovement = 0;

      // Check long-press for eyedropper
      if (this.toolManager.activeTool === 'brush' || this.toolManager.activeTool === 'eyedropper') {
        const sx = pos.x, sy = pos.y;
        const world = this.viewport.screenToWorld(sx, sy);
        this.longPressPoint = { sx, sy, wx: world.x, wy: world.y };
        this.longPressTimer = setTimeout(() => {
          if (!this.isNavigating && this.tapMaxMovement < 10) {
            this.triggerEyedropper(this.longPressPoint.wx, this.longPressPoint.wy, this.longPressPoint.sx, this.longPressPoint.sy);
          }
        }, 420);
      }

      // Check tool interactions (Transform, Point editor, Fill, etc.)
      const world = this.viewport.screenToWorld(pos.x, pos.y);
      const activeLayer = this.layerManager.getActiveLayer();

      if (this.toolManager.activeTool === 'transform') {
        if (this.toolManager.transformTool.onPointerDown(world.x, world.y)) {
          return;
        }
      } else if (this.toolManager.activeTool === 'point-editor') {
        if (this.toolManager.vectorPointEditor.onPointerDown(world.x, world.y, activeLayer)) {
          return;
        }
      } else if (this.toolManager.activeTool === 'bucket') {
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
      } else if (this.toolManager.activeTool === 'shape') {
        this.toolManager.shapeTool.start(world.x, world.y);
        return;
      } else if (this.toolManager.activeTool === 'gradient') {
        this.toolManager.gradientTool.start(world.x, world.y);
        return;
      }

      // Standard Vector Stroke drawing begin
      if (activeLayer && !activeLayer.locked) {
        this.startStroke(e);
      }
    } else if (this.activePointers.size >= 2) {
      // 2 or more fingers: Cancel stroke & start Pinch / Pan / Rotate
      this.cancelLongPress();
      this.cancelStroke();
      this.isNavigating = true;

      const pts = Array.from(this.activePointers.values());
      const p1 = pts[0], p2 = pts[1];
      this.lastPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.lastPinchAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      this.lastPinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }
  }

  onPointerMove(e) {
    e.preventDefault();
    if (!this.activePointers.has(e.pointerId)) return;

    const pos = this.getPointerPos(e);
    const prevPt = this.activePointers.get(e.pointerId);
    const movement = Math.hypot(pos.x - prevPt.x, pos.y - prevPt.y);
    this.tapMaxMovement += movement;

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

    // Two-finger Pinch Zoom / Pan / Rotate
    if (this.activePointers.size >= 2 && this.isNavigating) {
      const pts = Array.from(this.activePointers.values());
      const p1 = pts[0], p2 = pts[1];
      const curDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const curAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const curCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      // Pan
      this.viewport.panBy(curCenter.x - this.lastPinchCenter.x, curCenter.y - this.lastPinchCenter.y);

      // Zoom anchored to pinch center
      if (this.lastPinchDist > 0) {
        const factor = curDist / this.lastPinchDist;
        this.viewport.zoomAt(factor, curCenter.x, curCenter.y);
      }

      // Rotate with normalized delta angle
      let deltaAngle = curAngle - this.lastPinchAngle;
      while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
      while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
      this.viewport.rotateAt(deltaAngle, curCenter.x, curCenter.y);

      this.lastPinchDist = curDist;
      this.lastPinchAngle = curAngle;
      this.lastPinchCenter = curCenter;
      return;
    }

    // Active tools move
    const world = this.viewport.screenToWorld(pos.x, pos.y);
    if (this.toolManager.activeTool === 'transform') {
      this.toolManager.transformTool.onPointerMove(world.x, world.y);
      return;
    } else if (this.toolManager.activeTool === 'point-editor') {
      if (this.toolManager.vectorPointEditor.onPointerMove(world.x, world.y)) {
        this.redrawActiveLayer();
      }
      return;
    } else if (this.toolManager.activeTool === 'lasso-fill') {
      this.toolManager.lassoFill.addPoint(world.x, world.y);
      return;
    } else if (this.toolManager.activeTool === 'selection') {
      this.toolManager.selectionTool.update(world.x, world.y);
      return;
    } else if (this.toolManager.activeTool === 'shape') {
      this.toolManager.shapeTool.update(world.x, world.y);
      return;
    } else if (this.toolManager.activeTool === 'gradient') {
      this.toolManager.gradientTool.update(world.x, world.y);
      return;
    }

    // Live Drawing stroke update with Coalesced events
    if (this.isDrawing && e.pointerId === this.activePointerId) {
      const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ce of coalesced) {
        this.appendStrokePoint(ce);
      }

      // Reset shape hold timer on movement
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

    const now = performance.now();
    const tapDuration = now - this.tapStartTime;
    const pointerCountBeforeRelease = this.activePointers.size;

    this.activePointers.delete(e.pointerId);

    // Multi-finger tap gestures for Undo & Redo (short time, minimal movement)
    if (tapDuration < 240 && this.tapMaxMovement < 14) {
      if (pointerCountBeforeRelease === 2) {
        this.onHaptic?.();
        this.onUndoRequested?.();
        this.isNavigating = false;
        return;
      } else if (pointerCountBeforeRelease === 3) {
        this.onHaptic?.();
        this.onRedoRequested?.();
        this.isNavigating = false;
        return;
      }
    }

    if (this.toolManager.eyedropper.active) {
      this.toolManager.eyedropper.hide();
      return;
    }

    // Tool commits
    const activeLayer = this.layerManager.getActiveLayer();
    if (this.toolManager.activeTool === 'transform') {
      this.toolManager.transformTool.onPointerUp();
    } else if (this.toolManager.activeTool === 'point-editor') {
      this.toolManager.vectorPointEditor.onPointerUp();
    } else if (this.toolManager.activeTool === 'lasso-fill' && activeLayer) {
      this.toolManager.lassoFill.finish(activeLayer, this.currentColor, false);
      this.layerManager.invalidateCaches();
    } else if (this.toolManager.activeTool === 'selection') {
      this.toolManager.selectionTool.commit();
    } else if (this.toolManager.activeTool === 'shape' && activeLayer) {
      this.toolManager.shapeTool.commit(activeLayer, this.currentColor, this.currentBrush?.size || 4);
      this.layerManager.invalidateCaches();
    } else if (this.toolManager.activeTool === 'gradient' && activeLayer) {
      this.toolManager.gradientTool.commit(activeLayer, this.currentColor, '#ffffff');
      this.layerManager.invalidateCaches();
    }

    if (this.isDrawing && e.pointerId === this.activePointerId) {
      this.finishStroke();
    }

    if (this.activePointers.size === 0) {
      this.isNavigating = false;
    }
  }

  onPointerCancel(e) {
    this.cancelLongPress();
    if (this.shapeHoldTimer) clearTimeout(this.shapeHoldTimer);
    this.activePointers.delete(e.pointerId);
    this.cancelStroke();
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
      // Distance from line
      const dx = pEnd.x - pStart.x;
      const dy = pEnd.y - pStart.y;
      const d = Math.abs(dy * p.x - dx * p.y + pEnd.x * pStart.y - pEnd.y * pStart.x) / Math.max(1, totalDist);
      maxPerpDist = Math.max(maxPerpDist, d);
    }

    this.onHaptic?.();
    if (maxPerpDist < 18) {
      // Snap to perfect line
      this.currentStroke.points = [
        { ...pStart, pressure: 0.8 },
        { ...pEnd, pressure: 0.8 }
      ];
      this.shapeHoldDetected = true;
      this.renderLiveStroke();
    }
  }

  startStroke(e) {
    this.isDrawing = true;
    this.activePointerId = e.pointerId;
    this.shapeHoldDetected = false;

    const pos = this.getPointerPos(e);
    const rawWorld = this.viewport.screenToWorld(pos.x, pos.y);
    const snapped = this.toolManager.rulerGuides.snapPoint(rawWorld.x, rawWorld.y);

    this.pressureEngine.reset();
    const pressure = this.pressureEngine.resolvePressure(e, snapped);

    this.stabilizer.setStrength(this.currentBrush?.stabilizer ?? 30);
    const stabilized = this.stabilizer.begin({
      x: snapped.x,
      y: snapped.y,
      pressure: pressure,
      time: performance.now()
    });

    const isEraser = this.toolManager.activeTool === 'eraser' || (this.currentBrush && this.currentBrush.isEraser);

    // Create deterministic random seed for stroke
    const strokeSeed = Math.floor(Math.random() * 0xffffff);

    this.currentStroke = {
      id: 'stroke_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      brushId: this.currentBrush?.id || 'pencil',
      brushSnapshot: this.currentBrush ? this.currentBrush.createSnapshot() : {},
      color: isEraser ? '#000000' : this.currentColor,
      isEraser: isEraser,
      seed: strokeSeed,
      points: [stabilized]
    };

    this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    this.renderLiveStroke();
  }

  appendStrokePoint(e) {
    if (!this.isDrawing || !this.currentStroke) return;

    const pos = this.getPointerPos(e);
    const rawWorld = this.viewport.screenToWorld(pos.x, pos.y);
    const snapped = this.toolManager.rulerGuides.snapPoint(rawWorld.x, rawWorld.y);

    const pressure = this.pressureEngine.resolvePressure(e, snapped);
    const stabilized = this.stabilizer.update({
      x: snapped.x,
      y: snapped.y,
      pressure: pressure,
      time: performance.now()
    });

    if (stabilized) {
      this.currentStroke.points.push(stabilized);
      this.renderLiveStroke();
    }
  }

  finishStroke() {
    if (!this.isDrawing || !this.currentStroke) return;
    this.isDrawing = false;
    this.activePointerId = null;

    // Catch up points from stabilizer on finger release
    const catchUp = this.stabilizer.finish();
    if (catchUp && catchUp.length > 0) {
      for (const pt of catchUp) {
        this.currentStroke.points.push(pt);
      }
    }

    const activeLayer = this.layerManager.getActiveLayer();
    if (!activeLayer || activeLayer.locked) {
      this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
      return;
    }

    // Handle single tap dot
    if (this.currentStroke.points.length === 1) {
      const p = this.currentStroke.points[0];
      this.currentStroke.points.push({ ...p, x: p.x + 0.1, y: p.y + 0.1 });
    }

    // Render stroke permanently onto layer canvas
    this.renderStrokeToLayer(activeLayer, this.currentStroke);

    // Create history command
    if (this.history) {
      const cmd = new StrokeCommand(activeLayer, this.currentStroke, (l, fullRedraw) => {
        if (fullRedraw) {
          this.redrawLayerStrokes(l);
        } else {
          this.layerManager.invalidateCaches();
        }
      });
      this.history.push(cmd);
    }

    // Clear live buffer and invalidate layer composite cache
    this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    this.currentStroke = null;
    this.layerManager.invalidateCaches();
  }

  cancelStroke() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.activePointerId = null;
      this.currentStroke = null;
      this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    }
  }

  renderLiveStroke() {
    if (!this.currentStroke) return;
    this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);

    // If symmetry is active, render symmetry instances
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

  renderStrokeToContext(ctx, stroke) {
    const b = stroke.brushSnapshot || {};
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    ctx.save();

    // Clip to selection mask if present
    if (this.toolManager.selectionTool.hasSelection) {
      // Selection restricts drawing
    }

    if (stroke.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = b.blendMode || 'source-over';
    }

    ctx.fillStyle = stroke.color;
    ctx.strokeStyle = stroke.color;

    // Pixel Art Mode check
    if (this.pixelArtMode || b.isPixel) {
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < pts.length - 1; i++) {
        const pixels = bresenhamPixelPerfect(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        for (const px of pixels) {
          ctx.fillRect(px.x, px.y, b.size || 1, b.size || 1);
        }
      }
      ctx.restore();
      return;
    }

    // Catmull-Rom Dense Sampling
    const samples = this.spline.sampleStroke(pts, 6);
    if (samples.length === 0) {
      ctx.restore();
      return;
    }

    const baseSize = b.size || 8;
    const baseOpacity = b.opacity ?? 1.0;
    const strokeSeed = stroke.seed || 1337;

    // Neon Glow multi-pass check
    if (b.glowWidth && b.glowWidth > 1.0 && !stroke.isEraser) {
      ctx.save();
      ctx.globalAlpha = baseOpacity * 0.35;
      ctx.lineWidth = baseSize * b.glowWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(samples[0].x, samples[0].y);
      for (let i = 1; i < samples.length; i++) {
        ctx.lineTo(samples[i].x, samples[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Render individual stamp / ribbon segments
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      let radius = (baseSize * s.pressure) / 2;

      // Taper at start and end
      if (b.taperStart > 0 && i < b.taperStart) {
        radius *= (i + 1) / b.taperStart;
      }
      if (b.taperEnd > 0 && i > samples.length - b.taperEnd) {
        radius *= (samples.length - i) / b.taperEnd;
      }

      // Coherent Noise Jitter modulation
      if (b.jitter && b.jitter.enabled) {
        const jitterVal = CoherentNoise.evaluateJitter(b.jitter, strokeSeed, s.distance, s.time);
        radius = Math.max(0.5, radius * (1.0 + jitterVal));
      }

      ctx.globalAlpha = Math.max(0.01, Math.min(1.0, baseOpacity * (b.flow ?? 1.0)));

      // Calligraphy Chisel Tip
      if (b.tipShape === 'chisel') {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(b.rotation || 0.785);
        ctx.fillRect(-radius * 2, -radius * 0.5, radius * 4, radius);
        ctx.restore();
      } else if (b.tipShape === 'gaussian' || b.hardness < 0.5) {
        // Soft airbrush radial gradient
        const rad = Math.max(1, radius);
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
        grad.addColorStop(0, stroke.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Standard round stamp
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.5, radius), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  redrawLayerStrokes(layer) {
    layer.ctx.clearRect(0, 0, layer.width, layer.height);
    for (const s of layer.strokes) {
      if (s.shapeType) {
        // Vector shape
        this.toolManager.shapeTool.constructor.renderShape(layer.ctx, s);
      } else if (s.points) {
        this.renderStrokeToContext(layer.ctx, s);
      }
    }
    layer.updateThumbnail();
    this.layerManager.invalidateCaches();
  }

  commitFillWithAnimation(info) {
    const { startX, startY, patchCanvas, activeLayer, fillColorHex } = info;
    this.onHaptic?.();

    // Trigger visual ripple expansion effect
    const rippleEl = document.createElement('div');
    rippleEl.className = 'fill-ripple-effect';
    rippleEl.style.backgroundColor = fillColorHex;

    const screenPos = this.viewport.worldToScreen(startX, startY);
    const size = Math.max(this.viewportCanvas.width, this.viewportCanvas.height) * 1.5;
    rippleEl.style.width = size + 'px';
    rippleEl.style.height = size + 'px';
    rippleEl.style.left = (screenPos.x - size / 2) + 'px';
    rippleEl.style.top = (screenPos.y - size / 2) + 'px';

    document.getElementById('ui-overlay')?.appendChild(rippleEl);
    setTimeout(() => rippleEl.remove(), 350);

    // Commit to layer canvas
    activeLayer.ctx.drawImage(patchCanvas, 0, 0);
    activeLayer.updateThumbnail();
    this.layerManager.invalidateCaches();
  }

  redrawActiveLayer() {
    const active = this.layerManager.getActiveLayer();
    if (active) {
      this.redrawLayerStrokes(active);
    }
  }

  /**
   * Main 60 FPS Viewport Render Loop
   */
  renderLoop() {
    if (!this.running) return;

    // Resize canvas if container size changed
    const w = this.viewportCanvas.clientWidth;
    const h = this.viewportCanvas.clientHeight;
    if (this.viewportCanvas.width !== w || this.viewportCanvas.height !== h) {
      this.viewportCanvas.width = w;
      this.viewportCanvas.height = h;
      this.viewport.resizeScreen(w, h);
    }

    const ctx = this.ctx;
    ctx.save();

    // 1. Clear screen viewport
    ctx.clearRect(0, 0, w, h);

    // 2. Apply pan, zoom, rotation, mirror transforms
    this.viewport.applyTransform(ctx);

    // 3. Render document layers & live stroke buffer
    const activeLayer = this.layerManager.getActiveLayer();
    const liveOpacity = this.currentBrush?.opacity ?? 1.0;
    const liveBlend = this.currentBrush?.blendMode || 'source-over';

    this.layerManager.compositeStack(
      ctx,
      this.isDrawing ? this.liveCanvas : null,
      liveOpacity,
      liveBlend
    );

    // 4. Overlays: Shapes and Lasso live preview
    if (this.toolManager.activeTool === 'shape' && this.toolManager.shapeTool.active) {
      this.toolManager.shapeTool.drawLive(ctx, this.currentColor, this.currentBrush?.size || 4);
    } else if (this.toolManager.activeTool === 'lasso-fill' && this.toolManager.lassoFill.active) {
      this.toolManager.lassoFill.drawLive(ctx, this.currentColor);
    } else if (this.toolManager.activeTool === 'gradient' && this.toolManager.gradientTool.active) {
      this.toolManager.gradientTool.drawLive(ctx, this.currentColor, '#ffffff');
    }

    // 5. Overlays: Transform handles, Point editor, Marching ants, Symmetry, Guides
    if (this.toolManager.activeTool === 'transform') {
      this.toolManager.transformTool.drawOverlay(ctx);
    }
    if (this.toolManager.activeTool === 'point-editor') {
      this.toolManager.vectorPointEditor.drawOverlay(ctx);
    }
    this.toolManager.selectionTool.drawMarchingAnts(ctx);
    this.toolManager.symmetry.drawOverlay(ctx, this.docWidth, this.docHeight);
    this.toolManager.rulerGuides.drawGuides(ctx, this.docWidth, this.docHeight);

    // 6. Stabilizer Lazy Rope visual string
    const rope = this.stabilizer.getRopeVisual();
    if (rope) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rope.finger.x, rope.finger.y);
      ctx.lineTo(rope.tip.x, rope.tip.y);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(rope.finger.x, rope.finger.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    requestAnimationFrame(this.renderLoop);
  }
}
