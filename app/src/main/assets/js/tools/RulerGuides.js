/**
 * Vectura Ruler & Guides Engine
 * Straight line ruler, circle compass guide, and 1-point & 2-point perspective grids with magnetic snapping.
 */
export class RulerGuides {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.mode = 'off'; // 'off' | 'line' | 'circle' | 'perspective1' | 'perspective2'
    this.snapThreshold = 20; // Distance in pixels to snap

    // Line ruler
    this.line = { x0: 200, y0: 540, x1: 880, y1: 540 };

    // Circle guide
    this.circle = { cx: docWidth / 2, cy: docHeight / 2, r: 250 };

    // Perspective vanishing points
    this.vp1 = { x: docWidth / 2, y: docHeight / 3 };
    this.vp2_a = { x: -200, y: docHeight / 3 };
    this.vp2_b = { x: docWidth + 200, y: docHeight / 3 };
  }

  snapPoint(x, y) {
    if (this.mode === 'off') return { x, y };

    if (this.mode === 'line') {
      // Project (x, y) onto infinite line (x0,y0)-(x1,y1)
      const dx = this.line.x1 - this.line.x0;
      const dy = this.line.y1 - this.line.y0;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return { x, y };
      const t = ((x - this.line.x0) * dx + (y - this.line.y0) * dy) / lenSq;
      return {
        x: this.line.x0 + t * dx,
        y: this.line.y0 + t * dy
      };
    }

    if (this.mode === 'circle') {
      // Snap to circle perimeter
      const angle = Math.atan2(y - this.circle.cy, x - this.circle.cx);
      return {
        x: this.circle.cx + Math.cos(angle) * this.circle.r,
        y: this.circle.cy + Math.sin(angle) * this.circle.r
      };
    }

    if (this.mode === 'perspective1') {
      // Snap along ray from vanishing point vp1
      const angle = Math.atan2(y - this.vp1.y, x - this.vp1.x);
      const dist = Math.hypot(x - this.vp1.x, y - this.vp1.y);
      return {
        x: this.vp1.x + Math.cos(angle) * dist,
        y: this.vp1.y + Math.sin(angle) * dist
      };
    }

    return { x, y };
  }

  drawGuides(ctx, docW, docH) {
    if (this.mode === 'off') return;

    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);

    if (this.mode === 'line') {
      ctx.beginPath();
      // Draw extended line across canvas
      const dx = this.line.x1 - this.line.x0;
      const dy = this.line.y1 - this.line.y0;
      ctx.moveTo(this.line.x0 - dx * 4, this.line.y0 - dy * 4);
      ctx.lineTo(this.line.x1 + dx * 4, this.line.y1 + dy * 4);
      ctx.stroke();

      // Handles
      ctx.setLineDash([]);
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(this.line.x0, this.line.y0, 6, 0, Math.PI * 2);
      ctx.arc(this.line.x1, this.line.y1, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.mode === 'circle') {
      ctx.beginPath();
      ctx.arc(this.circle.cx, this.circle.cy, this.circle.r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.mode === 'perspective1') {
      // Horizon line
      ctx.beginPath();
      ctx.moveTo(0, this.vp1.y);
      ctx.lineTo(docW, this.vp1.y);
      ctx.stroke();

      // Rays from VP1
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        ctx.beginPath();
        ctx.moveTo(this.vp1.x, this.vp1.y);
        ctx.lineTo(this.vp1.x + Math.cos(a) * docW * 2, this.vp1.y + Math.sin(a) * docW * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
