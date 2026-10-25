/**
 * Vectura Smudge Tool Engine
 * Blends and smears underlying pixels along the stroke path.
 * Settings: strength, size, hardness, spacing, finger-painting mode.
 * Fully integrated with layers, selections, alpha lock, and undo/redo.
 */
import { RasterCommand } from '../history/Command.js';

function cloneCanvas(sourceCanvas) {
  if (!sourceCanvas) return null;
  const clone = document.createElement('canvas');
  clone.width = sourceCanvas.width;
  clone.height = sourceCanvas.height;
  clone.getContext('2d').drawImage(sourceCanvas, 0, 0);
  return clone;
}

export class SmudgeTool {
  constructor() {
    this.active = false;
    this.size = 28;
    this.strength = 0.65; // 0.05 to 1.0
    this.hardness = 0.5;   // 0.0 to 1.0
    this.spacing = 0.12;   // 0.05 to 0.5 of size
    this.fingerPainting = false;

    this.activeLayer = null;
    this.beforeCanvas = null;
    this.lastPoint = null;
    this.accumulatedDist = 0;

    // Internal pickup buffer
    this.pickupCanvas = document.createElement('canvas');
    this.pickupCanvas.width = 64;
    this.pickupCanvas.height = 64;
    this.pickupCtx = this.pickupCanvas.getContext('2d', { willReadFrequently: true });
    this.hasPickedPaint = false;
  }

  start(x, y, layer, currentColor = '#3B6EDC', selectionTool = null) {
    if (!layer || layer.locked) return;
    this.active = true;
    this.activeLayer = layer;
    this.beforeCanvas = cloneCanvas(layer.canvas);
    this.lastPoint = { x, y };
    this.accumulatedDist = 0;

    const r = Math.max(2, Math.round(this.size / 2));
    this.pickupCanvas.width = r * 2;
    this.pickupCanvas.height = r * 2;
    this.pickupCtx.clearRect(0, 0, r * 2, r * 2);

    if (this.fingerPainting) {
      // In finger-painting mode, initialize with the current color
      this.pickupCtx.save();
      this.pickupCtx.fillStyle = currentColor;
      this.pickupCtx.beginPath();
      this.pickupCtx.arc(r, r, r, 0, Math.PI * 2);
      this.pickupCtx.fill();
      this.pickupCtx.restore();
      this.hasPickedPaint = true;
    } else {
      // Sample initial paint from layer
      this.samplePaint(layer, x, y, r);
    }
  }

  samplePaint(layer, x, y, r) {
    const sx = Math.round(x - r);
    const sy = Math.round(y - r);
    const size = r * 2;

    this.pickupCtx.clearRect(0, 0, size, size);
    this.pickupCtx.save();
    // Clip to circle
    this.pickupCtx.beginPath();
    this.pickupCtx.arc(r, r, r, 0, Math.PI * 2);
    this.pickupCtx.clip();

    this.pickupCtx.drawImage(layer.canvas, sx, sy, size, size, 0, 0, size, size);
    this.pickupCtx.restore();
    this.hasPickedPaint = true;
  }

  update(x, y, selectionTool = null) {
    if (!this.active || !this.activeLayer || !this.lastPoint) return;

    const dx = x - this.lastPoint.x;
    const dy = y - this.lastPoint.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    const step = Math.max(1.5, this.size * this.spacing);
    this.accumulatedDist += dist;

    const steps = Math.floor(this.accumulatedDist / step);
    if (steps > 0) {
      const r = Math.max(2, Math.round(this.size / 2));
      for (let s = 1; s <= steps; s++) {
        const t = (s * step) / this.accumulatedDist;
        const curX = this.lastPoint.x + dx * t;
        const curY = this.lastPoint.y + dy * t;

        this.applySmudgeStep(curX, curY, r, selectionTool);
      }
      this.lastPoint = { x, y };
      this.accumulatedDist %= step;
    }
  }

  applySmudgeStep(x, y, r, selectionTool = null) {
    const layer = this.activeLayer;
    if (!layer) return;

    const ctx = layer.ctx;
    ctx.save();

    // Respect selection
    if (selectionTool && selectionTool.hasSelection && selectionTool.box) {
      const b = selectionTool.box;
      ctx.beginPath();
      ctx.rect(b.x, b.y, b.w, b.h);
      ctx.clip();
    }

    // Respect Alpha Lock
    if (layer.alphaLock) {
      ctx.globalCompositeOperation = 'source-atop';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    // 1. Deposit picked paint with strength attenuation
    ctx.globalAlpha = Math.max(0.1, Math.min(1.0, this.strength));
    ctx.drawImage(this.pickupCanvas, Math.round(x - r), Math.round(y - r));

    ctx.restore();

    // 2. Blend/pick up new paint from canvas into the finger buffer
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = r * 2;
    tempCanvas.height = r * 2;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw current canvas content into temp
    tempCtx.drawImage(layer.canvas, Math.round(x - r), Math.round(y - r), r * 2, r * 2, 0, 0, r * 2, r * 2);

    // Blend new canvas content with previous finger paint
    this.pickupCtx.save();
    this.pickupCtx.globalAlpha = 1.0 - this.strength * 0.75;
    this.pickupCtx.drawImage(tempCanvas, 0, 0);
    this.pickupCtx.restore();
  }

  commit(history = null, onComplete = null) {
    if (!this.active || !this.activeLayer) return;
    this.active = false;

    const layer = this.activeLayer;
    layer.updateThumbnail();

    if (history && this.beforeCanvas) {
      const afterCanvas = cloneCanvas(layer.canvas);
      history.push(new RasterCommand('Smudge Stroke', layer, this.beforeCanvas, afterCanvas, () => {
        layer.updateThumbnail();
        onComplete?.();
      }));
    }

    this.activeLayer = null;
    this.beforeCanvas = null;
    this.lastPoint = null;
    onComplete?.();
  }

  cancel() {
    if (!this.active) return;
    if (this.activeLayer && this.beforeCanvas) {
      this.activeLayer.ctx.clearRect(0, 0, this.activeLayer.width, this.activeLayer.height);
      this.activeLayer.ctx.drawImage(this.beforeCanvas, 0, 0);
      this.activeLayer.updateThumbnail();
    }
    this.active = false;
    this.activeLayer = null;
    this.beforeCanvas = null;
    this.lastPoint = null;
  }
}
