/**
 * Vectura Ruler & Guides Engine
 * Straight line ruler, circular compass guide, and isometric grid with magnetic snapping.
 */
export class RulerGuides {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.docWidth = docWidth;
    this.docHeight = docHeight;
    this.mode = 'off'; // 'off' | 'grid' | 'line' | 'circle'
    this.snapThreshold = 18;

    // Line ruler
    this.line = { x0: 100, y0: docHeight / 2, x1: docWidth - 100, y1: docHeight / 2 };

    // Circle guide
    this.circle = { cx: docWidth / 2, cy: docHeight / 2, r: Math.min(docWidth, docHeight) * 0.35 };

    // Grid spacing
    this.gridSize = 60;
  }

  resize(w, h) {
    this.docWidth = w;
    this.docHeight = h;
    this.line = { x0: 100, y0: h / 2, x1: w - 100, y1: h / 2 };
    this.circle = { cx: w / 2, cy: h / 2, r: Math.min(w, h) * 0.35 };
  }

  toggle() {
    const modes = ['off', 'grid', 'line', 'circle'];
    const curIdx = modes.indexOf(this.mode);
    this.mode = modes[(curIdx + 1) % modes.length];
    return this.mode;
  }

  setMode(mode) {
    this.mode = mode;
  }

  snapPoint(x, y) {
    if (this.mode === 'off') return { x, y };

    if (this.mode === 'line') {
      const dx = this.line.x1 - this.line.x0;
      const dy = this.line.y1 - this.line.y0;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return { x, y };
      const t = ((x - this.line.x0) * dx + (y - this.line.y0) * dy) / lenSq;
      const projX = this.line.x0 + t * dx;
      const projY = this.line.y0 + t * dy;
      if (Math.hypot(x - projX, y - projY) < this.snapThreshold) {
        return { x: projX, y: projY };
      }
    } else if (this.mode === 'circle') {
      const angle = Math.atan2(y - this.circle.cy, x - this.circle.cx);
      const snapX = this.circle.cx + Math.cos(angle) * this.circle.r;
      const snapY = this.circle.cy + Math.sin(angle) * this.circle.r;
      if (Math.hypot(x - snapX, y - snapY) < this.snapThreshold) {
        return { x: snapX, y: snapY };
      }
    } else if (this.mode === 'grid') {
      const gx = Math.round(x / this.gridSize) * this.gridSize;
      const gy = Math.round(y / this.gridSize) * this.gridSize;
      if (Math.hypot(x - gx, y - gy) < this.snapThreshold) {
        return { x: gx, y: gy };
      }
    }

    return { x, y };
  }

  drawGuides(ctx, docW, docH, zoom = 1.0) {
    if (this.mode === 'off') return;

    ctx.save();
    const lw = Math.max(1, 1.2 / zoom);
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(59, 110, 220, 0.45)';

    if (this.mode === 'grid') {
      ctx.beginPath();
      for (let x = 0; x <= docW; x += this.gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, docH);
      }
      for (let y = 0; y <= docH; y += this.gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(docW, y);
      }
      ctx.stroke();
    } else if (this.mode === 'line') {
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(this.line.x0, this.line.y0);
      ctx.lineTo(this.line.x1, this.line.y1);
      ctx.stroke();

      // End handles
      ctx.setLineDash([]);
      ctx.fillStyle = '#3B6EDC';
      const r = Math.max(4, 5 / zoom);
      ctx.beginPath();
      ctx.arc(this.line.x0, this.line.y0, r, 0, Math.PI * 2);
      ctx.arc(this.line.x1, this.line.y1, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.mode === 'circle') {
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.arc(this.circle.cx, this.circle.cy, this.circle.r, 0, Math.PI * 2);
      ctx.stroke();

      // Center cross
      ctx.setLineDash([]);
      const s = Math.max(6, 8 / zoom);
      ctx.beginPath();
      ctx.moveTo(this.circle.cx - s, this.circle.cy);
      ctx.lineTo(this.circle.cx + s, this.circle.cy);
      ctx.moveTo(this.circle.cx, this.circle.cy - s);
      ctx.lineTo(this.circle.cx, this.circle.cy + s);
      ctx.stroke();
    }

    ctx.restore();
  }
}
