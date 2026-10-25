/**
 * Vectura Layer Model
 * Each layer holds its vector strokes, a cached raster canvas, and properties.
 */
import { getCanvasCompositeOp } from './BlendModes.js';

export class Layer {
  constructor(id, name, width, height, type = 'raster') {
    this.id = id || ('layer_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
    this.name = name || 'Layer';
    this.type = type; // 'raster'
    this.width = width;
    this.height = height;

    // Layer state
    this.visible = true;
    this.locked = false;
    this.alphaLock = false;
    this.clippingMask = false;
    this.isReference = false;
    this.opacity = 1.0;
    this.blendMode = 'source-over';
    this.folderId = null;

    // Vector strokes & shapes on this layer
    this.strokes = [];

    // Cached raster canvas for 60fps performance
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Thumbnail canvas (64x64)
    this.thumbCanvas = document.createElement('canvas');
    this.thumbCanvas.width = 64;
    this.thumbCanvas.height = 64;
    this.thumbCtx = this.thumbCanvas.getContext('2d');

    this.isDirty = true;
  }

  resize(newWidth, newHeight) {
    if (this.width === newWidth && this.height === newHeight) return;
    const oldCanvas = this.canvas;
    this.width = newWidth;
    this.height = newHeight;

    this.canvas = document.createElement('canvas');
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    this.ctx.drawImage(oldCanvas, 0, 0);
    this.updateThumbnail();
    this.isDirty = true;
  }

  clear() {
    this.strokes = [];
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.updateThumbnail();
    this.isDirty = true;
  }

  addStroke(stroke) {
    this.strokes.push(stroke);
    this.isDirty = true;
  }

  updateThumbnail() {
    this.thumbCtx.clearRect(0, 0, 64, 64);
    const maxDim = 64;
    const w = this.width || 1;
    const h = this.height || 1;
    const scale = Math.min(maxDim / w, maxDim / h);
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));
    const dx = Math.round((maxDim - dw) / 2);
    const dy = Math.round((maxDim - dh) / 2);
    this.thumbCtx.drawImage(
      this.canvas,
      0, 0, w, h,
      dx, dy, dw, dh
    );
  }

  release() {
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.thumbCanvas.width = 1;
    this.thumbCanvas.height = 1;
    this.strokes = [];
  }

  clone(newId, newName) {
    const copy = new Layer(newId, newName, this.width, this.height, this.type);
    copy.visible = this.visible;
    copy.locked = this.locked;
    copy.alphaLock = this.alphaLock;
    copy.clippingMask = this.clippingMask;
    copy.isReference = this.isReference;
    copy.opacity = this.opacity;
    copy.blendMode = this.blendMode;
    copy.folderId = this.folderId;
    copy.strokes = JSON.parse(JSON.stringify(this.strokes));
    copy.ctx.drawImage(this.canvas, 0, 0);
    copy.updateThumbnail();
    return copy;
  }
}
