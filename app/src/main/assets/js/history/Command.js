/**
 * Vectura Unified Command Pattern & Central History System
 * Every action must go through it:
 * - strokes, erase, fill, lasso fill, shapes, gradient, text
 * - layer add/delete/duplicate/merge/reorder/rename/opacity/blend mode/visibility/lock/clipping/clear
 * - canvas property changes (resize document, etc.)
 *
 * Stores exact raster snapshots or serialized states for 100% deterministic, instant undo/redo.
 */

export class Command {
  constructor(name = 'Action') {
    this.name = name;
    this.timestamp = Date.now();
  }
  execute() {}
  undo() {}
}

/**
 * Creates an offline canvas copy of a layer or canvas for snapshotting.
 */
function cloneCanvas(sourceCanvas) {
  if (!sourceCanvas) return null;
  const clone = document.createElement('canvas');
  clone.width = sourceCanvas.width;
  clone.height = sourceCanvas.height;
  const ctx = clone.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);
  return clone;
}

/**
 * Compares two canvases and returns true if their pixel buffers are identical.
 */
export function areCanvasesIdentical(c1, c2) {
  if (!c1 || !c2) return false;
  if (c1.width !== c2.width || c1.height !== c2.height) return false;
  const ctx1 = c1.getContext('2d', { willReadFrequently: true });
  const ctx2 = c2.getContext('2d', { willReadFrequently: true });
  const img1 = ctx1.getImageData(0, 0, c1.width, c1.height).data;
  const img2 = ctx2.getImageData(0, 0, c2.width, c2.height).data;
  if (img1.length !== img2.length) return false;
  for (let i = 0; i < img1.length; i += 4) {
    if (img1[i] !== img2[i] || img1[i+1] !== img2[i+1] || img1[i+2] !== img2[i+2] || img1[i+3] !== img2[i+3]) {
      return false;
    }
  }
  return true;
}

/**
 * Command for brush and eraser raster strokes.
 */
export class StrokeCommand extends Command {
  constructor(layer, stroke, onRedraw, beforeCanvas = null, afterCanvas = null) {
    super(stroke?.isEraser ? 'Erase Stroke' : 'Draw Stroke');
    this.layerId = layer.id;
    this.layer = layer;
    this.stroke = stroke;
    this.onRedraw = onRedraw;
    this.beforeCanvas = beforeCanvas ? cloneCanvas(beforeCanvas) : null;
    this.afterCanvas = afterCanvas ? cloneCanvas(afterCanvas) : null;
  }

  execute(layerManager = null) {
    const targetLayer = layerManager ? layerManager.getLayer(this.layerId) : this.layer;
    if (!targetLayer) return;

    if (this.afterCanvas) {
      targetLayer.ctx.clearRect(0, 0, targetLayer.width, targetLayer.height);
      targetLayer.ctx.drawImage(this.afterCanvas, 0, 0);
      targetLayer.updateThumbnail();
      this.onRedraw?.(targetLayer, false);
      return;
    }
    targetLayer.addStroke(this.stroke);
    this.onRedraw?.(targetLayer);
  }

  undo(layerManager = null) {
    const targetLayer = layerManager ? layerManager.getLayer(this.layerId) : this.layer;
    if (!targetLayer) return;

    if (this.beforeCanvas) {
      targetLayer.ctx.clearRect(0, 0, targetLayer.width, targetLayer.height);
      targetLayer.ctx.drawImage(this.beforeCanvas, 0, 0);
      targetLayer.updateThumbnail();
      this.onRedraw?.(targetLayer, false);
      return;
    }
    const idx = targetLayer.strokes.lastIndexOf(this.stroke);
    if (idx >= 0) {
      targetLayer.strokes.splice(idx, 1);
      this.onRedraw?.(targetLayer, true);
    }
  }
}

/**
 * Command for raster modifications: Fill Bucket, Lasso Fill, Shapes, Gradients, Text, Clear.
 */
export class RasterCommand extends Command {
  constructor(name, layer, beforeCanvas, afterCanvas, onRedraw) {
    super(name);
    this.layerId = layer.id;
    this.layer = layer;
    this.beforeCanvas = cloneCanvas(beforeCanvas);
    this.afterCanvas = cloneCanvas(afterCanvas);
    this.onRedraw = onRedraw;
  }

  execute(layerManager = null) {
    const targetLayer = layerManager ? layerManager.getLayer(this.layerId) : this.layer;
    if (!targetLayer || !this.afterCanvas) return;
    targetLayer.ctx.clearRect(0, 0, targetLayer.width, targetLayer.height);
    targetLayer.ctx.drawImage(this.afterCanvas, 0, 0);
    targetLayer.updateThumbnail();
    this.onRedraw?.(targetLayer);
  }

  undo(layerManager = null) {
    const targetLayer = layerManager ? layerManager.getLayer(this.layerId) : this.layer;
    if (!targetLayer || !this.beforeCanvas) return;
    targetLayer.ctx.clearRect(0, 0, targetLayer.width, targetLayer.height);
    targetLayer.ctx.drawImage(this.beforeCanvas, 0, 0);
    targetLayer.updateThumbnail();
    this.onRedraw?.(targetLayer);
  }
}

/**
 * Command for structural Layer operations:
 * Add, Delete, Duplicate, Merge, Reorder, Rename, Opacity, BlendMode, Visibility, Lock, Clipping.
 */
export class LayerCommand extends Command {
  constructor(name, layerManager, beforeState, afterState, onComplete) {
    super(name);
    this.layerManager = layerManager;
    this.beforeState = beforeState; // snapshot created via layerManager.createSnapshot()
    this.afterState = afterState;   // snapshot created via layerManager.createSnapshot()
    this.onComplete = onComplete;
  }

  execute() {
    if (this.afterState) {
      this.layerManager.restoreSnapshot(this.afterState);
      this.onComplete?.();
    }
  }

  undo() {
    if (this.beforeState) {
      this.layerManager.restoreSnapshot(this.beforeState);
      this.onComplete?.();
    }
  }
}

/**
 * Command for document property changes: Resize, canvas dimensions.
 */
export class CanvasPropertyCommand extends Command {
  constructor(name, vectorCanvas, beforeProps, afterProps, onComplete) {
    super(name);
    this.vectorCanvas = vectorCanvas;
    this.beforeProps = beforeProps;
    this.afterProps = afterProps;
    this.onComplete = onComplete;
  }

  execute() {
    this.vectorCanvas.applyDocProperties(this.afterProps);
    this.onComplete?.();
  }

  undo() {
    this.vectorCanvas.applyDocProperties(this.beforeProps);
    this.onComplete?.();
  }
}
