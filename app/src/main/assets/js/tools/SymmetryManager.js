/**
 * Vectura Symmetry Drawing Engine
 * Vertical, Horizontal, and Radial (2-12 axes) symmetry mirroring around a movable center pivot.
 */
export class SymmetryManager {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.mode = 'off'; // 'off' | 'vertical' | 'horizontal' | 'radial'
    this.radialAxes = 4; // 2 to 12
    this.centerX = docWidth / 2;
    this.centerY = docHeight / 2;
  }

  setPivot(x, y) {
    this.centerX = x;
    this.centerY = y;
  }

  /**
   * Generates symmetric mirrored points for a given control point.
   */
  getSymmetricPoints(point) {
    if (this.mode === 'off') return [point];

    const results = [point];
    const dx = point.x - this.centerX;
    const dy = point.y - this.centerY;

    if (this.mode === 'vertical') {
      results.push({
        x: this.centerX - dx,
        y: point.y,
        pressure: point.pressure,
        time: point.time
      });
    } else if (this.mode === 'horizontal') {
      results.push({
        x: point.x,
        y: this.centerY - dy,
        pressure: point.pressure,
        time: point.time
      });
    } else if (this.mode === 'radial') {
      const angle = Math.atan2(dy, dx);
      const dist = Math.hypot(dx, dy);
      const step = (Math.PI * 2) / this.radialAxes;

      for (let i = 1; i < this.radialAxes; i++) {
        const a = angle + i * step;
        results.push({
          x: this.centerX + Math.cos(a) * dist,
          y: this.centerY + Math.sin(a) * dist,
          pressure: point.pressure,
          time: point.time
        });
      }
    }

    return results;
  }

  drawOverlay(ctx, docW, docH) {
    if (this.mode === 'off') return;

    ctx.save();
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);

    if (this.mode === 'vertical') {
      ctx.beginPath();
      ctx.moveTo(this.centerX, 0);
      ctx.lineTo(this.centerX, docH);
      ctx.stroke();
    } else if (this.mode === 'horizontal') {
      ctx.beginPath();
      ctx.moveTo(0, this.centerY);
      ctx.lineTo(docW, this.centerY);
      ctx.stroke();
    } else if (this.mode === 'radial') {
      const maxR = Math.hypot(docW, docH);
      const step = (Math.PI * 2) / this.radialAxes;
      for (let i = 0; i < this.radialAxes; i++) {
        const a = i * step;
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY);
        ctx.lineTo(this.centerX + Math.cos(a) * maxR, this.centerY + Math.sin(a) * maxR);
        ctx.stroke();
      }
    }

    // Pivot center dot
    ctx.setLineDash([]);
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
