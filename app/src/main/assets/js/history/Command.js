/**
 * Vectura History Command Pattern
 * High-performance raster canvas snapshotting and layer operations for instant undo/redo.
 */
export class Command {
  constructor(name = 'Action') {
    this.name = name;
  }
  execute() {}
  undo() {}
}

export class StrokeCommand extends Command {
  constructor(layer, stroke, onRedraw, beforeCanvas = null, afterCanvas = null) {
    super('Draw Stroke');
    this.layer = layer;
    this.stroke = stroke;
    this.onRedraw = onRedraw;
    this.beforeCanvas = beforeCanvas;
    this.afterCanvas = afterCanvas;
  }

  execute() {
    if (this.afterCanvas) {
      this.layer.ctx.clearRect(0, 0, this.layer.width, this.layer.height);
      this.layer.ctx.drawImage(this.afterCanvas, 0, 0);
      this.layer.updateThumbnail();
      this.onRedraw?.(this.layer, false);
      return;
    }
    this.layer.addStroke(this.stroke);
    this.onRedraw?.(this.layer);
  }

  undo() {
    if (this.beforeCanvas) {
      this.layer.ctx.clearRect(0, 0, this.layer.width, this.layer.height);
      this.layer.ctx.drawImage(this.beforeCanvas, 0, 0);
      this.layer.updateThumbnail();
      this.onRedraw?.(this.layer, false);
      return;
    }
    const idx = this.layer.strokes.lastIndexOf(this.stroke);
    if (idx >= 0) {
      this.layer.strokes.splice(idx, 1);
      this.onRedraw?.(this.layer, true);
    }
  }
}

export class LayerOpCommand extends Command {
  constructor(name, applyFn, revertFn, onComplete) {
    super(name);
    this.applyFn = applyFn;
    this.revertFn = revertFn;
    this.onComplete = onComplete;
  }

  execute() {
    this.applyFn();
    this.onComplete?.();
  }

  undo() {
    this.revertFn();
    this.onComplete?.();
  }
}
