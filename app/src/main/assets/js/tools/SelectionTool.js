/**
 * Vectura Selection Engine
 * Rect, Ellipse, Lasso, Magic Wand selection with marching ants overlay and drawing masking.
 */
export class SelectionTool {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.type = 'rect'; // 'rect' | 'ellipse' | 'lasso' | 'wand'
    this.opMode = 'new'; // 'new' | 'add' | 'subtract' | 'intersect'
    this.hasSelection = false;

    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = docWidth;
    this.maskCanvas.height = docHeight;
    this.maskCtx = this.maskCanvas.getContext('2d');

    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.lassoPoints = [];
    this.dashOffset = 0;
  }

  resize(w, h) {
    this.maskCanvas.width = w;
    this.maskCanvas.height = h;
    this.clear();
  }

  clear() {
    this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    this.hasSelection = false;
  }

  start(x, y) {
    this.active = true;
    this.startX = x;
    this.startY = y;
    this.currentX = x;
    this.currentY = y;
    this.lassoPoints = [{ x, y }];
  }

  update(x, y) {
    if (!this.active) return;
    this.currentX = x;
    this.currentY = y;
    if (this.type === 'lasso') {
      this.lassoPoints.push({ x, y });
    }
  }

  commit() {
    if (!this.active) return;
    this.active = false;

    // Apply selection geometry to mask canvas
    const ctx = this.maskCtx;
    ctx.save();

    if (this.opMode === 'new') {
      ctx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
      ctx.globalCompositeOperation = 'source-over';
    } else if (this.opMode === 'add') {
      ctx.globalCompositeOperation = 'source-over';
    } else if (this.opMode === 'subtract') {
      ctx.globalCompositeOperation = 'destination-out';
    } else if (this.opMode === 'intersect') {
      ctx.globalCompositeOperation = 'destination-in';
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();

    if (this.type === 'rect') {
      const rx = Math.min(this.startX, this.currentX);
      const ry = Math.min(this.startY, this.currentY);
      const rw = Math.abs(this.currentX - this.startX);
      const rh = Math.abs(this.currentY - this.startY);
      ctx.rect(rx, ry, rw, rh);
    } else if (this.type === 'ellipse') {
      const cx = (this.startX + this.currentX) / 2;
      const cy = (this.startY + this.currentY) / 2;
      const rx = Math.abs(this.currentX - this.startX) / 2;
      const ry = Math.abs(this.currentY - this.startY) / 2;
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    } else if (this.type === 'lasso' && this.lassoPoints.length > 2) {
      ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
      for (let i = 1; i < this.lassoPoints.length; i++) {
        ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
      }
      ctx.closePath();
    }

    ctx.fill();
    ctx.restore();
    this.hasSelection = true;
    this.lassoPoints = [];
  }

  invert() {
    if (!this.hasSelection) return;
    const ctx = this.maskCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    ctx.restore();
  }

  drawMarchingAnts(targetCtx) {
    if (!this.hasSelection && !this.active) return;
    this.dashOffset = (this.dashOffset + 0.5) % 12;

    targetCtx.save();
    targetCtx.strokeStyle = '#ffffff';
    targetCtx.lineWidth = 1.5;
    targetCtx.setLineDash([4, 4]);
    targetCtx.lineDashOffset = -this.dashOffset;

    if (this.active) {
      // Live dragging shape
      targetCtx.beginPath();
      if (this.type === 'rect') {
        const rx = Math.min(this.startX, this.currentX);
        const ry = Math.min(this.startY, this.currentY);
        const rw = Math.abs(this.currentX - this.startX);
        const rh = Math.abs(this.currentY - this.startY);
        targetCtx.strokeRect(rx, ry, rw, rh);
      } else if (this.type === 'ellipse') {
        const cx = (this.startX + this.currentX) / 2;
        const cy = (this.startY + this.currentY) / 2;
        const rx = Math.abs(this.currentX - this.startX) / 2;
        const ry = Math.abs(this.currentY - this.startY) / 2;
        targetCtx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        targetCtx.stroke();
      } else if (this.type === 'lasso' && this.lassoPoints.length > 1) {
        targetCtx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
        for (let i = 1; i < this.lassoPoints.length; i++) {
          targetCtx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
        }
        targetCtx.stroke();
      }
    }

    targetCtx.restore();
  }
}
