/**
 * Vectura Vector Shape Tool
 * Generates vector lines, rectangles, ellipses, regular polygons, and stars as vector strokes.
 */
export class ShapeTool {
  constructor() {
    this.type = 'rect'; // 'line' | 'rect' | 'ellipse' | 'polygon' | 'star'
    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.sides = 5; // polygon/star points
  }

  start(x, y) {
    this.active = true;
    this.startX = x;
    this.startY = y;
    this.currentX = x;
    this.currentY = y;
  }

  update(x, y) {
    if (!this.active) return;
    this.currentX = x;
    this.currentY = y;
  }

  commit(layer, colorHex, strokeWidth = 4, fill = false) {
    if (!this.active) return null;
    this.active = false;

    const shape = {
      type: 'vector-shape',
      shapeType: this.type,
      x0: this.startX,
      y0: this.startY,
      x1: this.currentX,
      y1: this.currentY,
      color: colorHex,
      strokeWidth: strokeWidth,
      fill: fill,
      sides: this.sides
    };

    // Draw to layer canvas
    ShapeTool.renderShape(layer.ctx, shape);
    layer.updateThumbnail();
    layer.addStroke(shape);
    return shape;
  }

  static renderShape(ctx, shape) {
    ctx.save();
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const { x0, y0, x1, y1, shapeType, sides, fill } = shape;

    if (shapeType === 'line') {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    } else if (shapeType === 'rect') {
      const rx = Math.min(x0, x1);
      const ry = Math.min(y0, y1);
      const rw = Math.abs(x1 - x0);
      const rh = Math.abs(y1 - y0);
      if (fill) ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    } else if (shapeType === 'ellipse') {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const rx = Math.abs(x1 - x0) / 2;
      const ry = Math.abs(y1 - y0) / 2;
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (fill) ctx.fill();
      ctx.stroke();
    } else if (shapeType === 'polygon' || shapeType === 'star') {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const r = Math.hypot(x1 - x0, y1 - y0) / 2;
      const totalPoints = shapeType === 'star' ? sides * 2 : sides;

      for (let i = 0; i < totalPoints; i++) {
        const angle = (i * Math.PI * 2) / totalPoints - Math.PI / 2;
        const currentRadius = shapeType === 'star' && i % 2 !== 0 ? r * 0.45 : r;
        const px = cx + Math.cos(angle) * currentRadius;
        const py = cy + Math.sin(angle) * currentRadius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (fill) ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  drawLive(ctx, colorHex, strokeWidth) {
    if (!this.active) return;
    ShapeTool.renderShape(ctx, {
      shapeType: this.type,
      x0: this.startX,
      y0: this.startY,
      x1: this.currentX,
      y1: this.currentY,
      color: colorHex,
      strokeWidth: strokeWidth,
      fill: false,
      sides: this.sides
    });
  }
}
