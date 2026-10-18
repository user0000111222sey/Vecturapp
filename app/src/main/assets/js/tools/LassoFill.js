/**
 * Vectura Lasso Fill & Lasso Erase Tool
 * Supports real-time animated preview hint during drag.
 */
export class LassoFill {
  constructor() {
    this.mode = 'fill'; // 'fill' | 'erase'
    this.points = [];
    this.active = false;
  }

  start(x, y) {
    this.active = true;
    this.points = [{ x, y }];
  }

  addPoint(x, y) {
    if (!this.active) return;
    const last = this.points[this.points.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) > 3) {
      this.points.push({ x, y });
    }
  }

  /**
   * Draws a live hint while dragging lasso loop
   */
  drawLive(ctx, colorHex) {
    if (!this.active || this.points.length < 2) return;
    ctx.save();

    // 1. Fill translucent hint
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();

    if (this.mode === 'erase') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)'; // Reddish erase preview
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
    } else {
      ctx.fillStyle = colorHex.startsWith('#') ? (colorHex + '33') : 'rgba(139, 92, 246, 0.25)';
      ctx.fill();

      // Contrasting dashed outline
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();

      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 1.0;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = 3;
      ctx.stroke();
    }

    ctx.restore();
  }

  finish(layer, colorHex, isEraser = false) {
    if (!this.active || this.points.length < 3) {
      this.active = false;
      this.points = [];
      return null;
    }

    const ctx = layer.ctx;
    ctx.save();
    if (isEraser || this.mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = colorHex;
    }

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    layer.updateThumbnail();

    const shape = {
      type: 'lasso-fill',
      points: [...this.points],
      color: colorHex,
      mode: isEraser ? 'erase' : this.mode
    };
    layer.addStroke(shape);

    this.active = false;
    this.points = [];
    return shape;
  }
}
