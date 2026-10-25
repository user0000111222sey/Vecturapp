/**
 * Vectura Unified Command Pattern & Central History System
 * Stores cropped bounding-box snapshots to preserve low memory footprint.
 */

export class Command {
  constructor(name = 'Action') {
    this.name = name;
    this.timestamp = Date.now();
  }
  execute() {}
  undo() {}
  release() {}
}

/**
 * Crops a bounding box region from a canvas. If bbox is null, crops full canvas.
 */
export function cropBoundingBox(canvas, bbox = null) {
  if (!canvas) return null;
  const cw = canvas.width || 1;
  const ch = canvas.height || 1;

  let x = bbox ? Math.max(0, Math.floor(bbox.x)) : 0;
  let y = bbox ? Math.max(0, Math.floor(bbox.y)) : 0;
  let w = bbox ? Math.min(cw - x, Math.ceil(bbox.width)) : cw;
  let h = bbox ? Math.min(ch - y, Math.ceil(bbox.height)) : ch;

  if (w <= 0 || h <= 0) {
    x = 0; y = 0; w = cw; h = ch;
  }

  const crop = document.createElement('canvas');
  crop.width = w;
  crop.height = h;
  const ctx = crop.getContext('2d');
  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  return {
    canvas: crop,
    x,
    y,
    width: w,
    height: h,
    byteSize: w * h * 4
  };
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
  constructor(layer, stroke, onRedraw, beforeSnapshot = null, afterSnapshot = null) {
    super(stroke?.isEraser ? 'Erase Stroke' : 'Draw Stroke');
    this.layerId = layer.id;
    this.layer = layer;
    this.stroke = stroke;
    this.onRedraw = onRedraw;

    // Snapshot can be pre-cropped object or raw canvas
    this.beforeSnapshot = beforeSnapshot && beforeSnapshot.canvas ? beforeSnapshot : cropBoundingBox(beforeSnapshot);
    this.afterSnapshot = afterSnapshot && afterSnapshot.canvas ? afterSnapshot : cropBoundingBox(afterSnapshot);
  }

  execute(layerManager = null) {
    const targetLayer = layerManager ? layerManager.getLayer(this.layerId) : this.layer;
    if (!targetLayer) return;

    if (this.afterSnapshot) {
      const { canvas, x, y, width, height } = this.afterSnapshot;
      targetLayer.ctx.clearRect(x, y, width, height);
      targetLayer.ctx.drawImage(canvas, x, y);
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

    if (this.beforeSnapshot) {
      const { canvas, x, y, width, height } = this.beforeSnapshot;
      targetLayer.ctx.clearRect(x, y, width, height);
      targetLayer.ctx.drawImage(canvas, x, y);
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

  release() {
    if (this.beforeSnapshot?.canvas) {
      this.beforeSnapshot.canvas.width = 1;
      this.beforeSnapshot.canvas.height = 1;
    }
    if (this.afterSnapshot?.canvas) {
      this.afterSnapshot.canvas.width = 1;
      this.afterSnapshot.canvas.height = 1;
    }
  }
}

/**
 * Command for raster modifications: Fill Bucket, Lasso Fill, Shapes, Gradients, Text, Clear.
 */
export class RasterCommand extends Command {
  constructor(name, layer, beforeCanvasOrSnapshot, afterCanvasOrSnapshot, onRedraw, bbox = null) {
    super(name);
    this.layerId = layer.id;
    this.layer = layer;
    this.onRedraw = onRedraw;

    this.beforeSnapshot = beforeCanvasOrSnapshot && beforeCanvasOrSnapshot.canvas
      ? beforeCanvasOrSnapshot
      : cropBoundingBox(beforeCanvasOrSnapshot, bbox);

    this.afterSnapshot = afterCanvasOrSnapshot && afterCanvasOrSnapshot.canvas
      ? afterCanvasOrSnapshot
      : cropBoundingBox(afterCanvasOrSnapshot, bbox);
  }

  execute(layerManager = null) {
    const targetLayer = layerManager ? layerManager.getLayer(this.layerId) : this.layer;
    if (!targetLayer || !this.afterSnapshot) return;

    const { canvas, x, y, width, height } = this.afterSnapshot;
    targetLayer.ctx.clearRect(x, y, width, height);
    targetLayer.ctx.drawImage(canvas, x, y);
    targetLayer.updateThumbnail();
    this.onRedraw?.(targetLayer);
  }

  undo(layerManager = null) {
    const targetLayer = layerManager ? layerManager.getLayer(this.layerId) : this.layer;
    if (!targetLayer || !this.beforeSnapshot) return;

    const { canvas, x, y, width, height } = this.beforeSnapshot;
    targetLayer.ctx.clearRect(x, y, width, height);
    targetLayer.ctx.drawImage(canvas, x, y);
    targetLayer.updateThumbnail();
    this.onRedraw?.(targetLayer);
  }

  release() {
    if (this.beforeSnapshot?.canvas) {
      this.beforeSnapshot.canvas.width = 1;
      this.beforeSnapshot.canvas.height = 1;
    }
    if (this.afterSnapshot?.canvas) {
      this.afterSnapshot.canvas.width = 1;
      this.afterSnapshot.canvas.height = 1;
    }
  }
}

/**
 * Command for structural Layer operations.
 */
export class LayerCommand extends Command {
  constructor(name, layerManager, beforeState, afterState, onComplete) {
    super(name);
    this.layerManager = layerManager;
    this.beforeState = beforeState;
    this.afterState = afterState;
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

  release() {}
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

  release() {}
}
