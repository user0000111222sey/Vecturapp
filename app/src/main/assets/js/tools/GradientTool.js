/**
 * Vectura Gradient Tool
 * Linear and Radial gradients with interactive color stops.
 */
export class GradientTool {
  constructor() {
    this.type = 'linear'; // 'linear' | 'radial'
    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
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

  commit(layer, color1, color2) {
    if (!this.active) return null;
    this.active = false;

    const ctx = layer.ctx;
    ctx.save();

    let gradient;
    if (this.type === 'linear') {
      gradient = ctx.createLinearGradient(this.startX, this.startY, this.currentX, this.currentY);
    } else {
      const radius = Math.hypot(this.currentX - this.startX, this.currentY - this.startY);
      gradient = ctx.createRadialGradient(this.startX, this.startY, 0, this.startX, this.startY, Math.max(1, radius));
    }

    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, layer.width, layer.height);
    ctx.restore();

    layer.updateThumbnail();

    const op = {
      type: 'gradient',
      gradientType: this.type,
      x0: this.startX,
      y0: this.startY,
      x1: this.currentX,
      y1: this.currentY,
      color1,
      color2
    };
    layer.addStroke(op);
    return op;
  }

  drawLive(ctx, color1, color2) {
    if (!this.active) return;
    ctx.save();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(this.startX, this.startY);
    ctx.lineTo(this.currentX, this.currentY);
    ctx.stroke();

    ctx.fillStyle = color1;
    ctx.beginPath();
    ctx.arc(this.startX, this.startY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color2;
    ctx.beginPath();
    ctx.arc(this.currentX, this.currentY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
