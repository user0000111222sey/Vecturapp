/**
 * Vectura Symmetry Drawing Engine
 * Vertical, Horizontal, and Radial (2-12 axes) symmetry mirroring around a movable center pivot.
 * Features: Draggable pivot handle, Lock toggle to prevent accidental dragging while drawing, and Reset option.
 */
export class SymmetryManager {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.mode = 'off'; // 'off' | 'vertical' | 'horizontal' | 'radial'
    this.radialAxes = 4; // 2 to 12
    this.centerX = docWidth / 2;
    this.centerY = docHeight / 2;
    this.locked = false; // Prevents dragging pivot when drawing
  }

  setPivot(x, y) {
    if (this.locked) return;
    this.centerX = x;
    this.centerY = y;
  }

  reset(docW = 1080, docH = 1080) {
    this.centerX = docW / 2;
    this.centerY = docH / 2;
  }

  toggleLock() {
    this.locked = !this.locked;
    return this.locked;
  }

  toggle() {
    const modes = ['off', 'vertical', 'horizontal', 'radial'];
    const idx = modes.indexOf(this.mode);
    this.mode = modes[(idx + 1) % modes.length];
    return this.mode;
  }

  hitTest(wx, wy, zoom = 1.0) {
    if (this.mode === 'off' || this.locked) return false;
    const hitRadius = 28 / Math.max(0.1, zoom);
    const dist = Math.hypot(wx - this.centerX, wy - this.centerY);
    return dist <= hitRadius;
  }

  render(ctx, docW = null, docH = null, zoom = 1.0) {
    const w = docW || this.centerX * 2;
    const h = docH || this.centerY * 2;
    this.drawOverlay(ctx, w, h, zoom);
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

  drawOverlay(ctx, docW, docH, zoom = 1.0) {
    if (this.mode === 'off') return;

    ctx.save();
    const isLocked = this.locked;
    const guideColor = isLocked ? 'rgba(245, 158, 11, 0.4)' : 'rgba(99, 102, 241, 0.45)';
    const handleColor = isLocked ? '#f59e0b' : '#6366f1';

    ctx.strokeStyle = guideColor;
    ctx.lineWidth = Math.max(1.5, 2.0 / zoom);
    ctx.setLineDash([6 / zoom, 6 / zoom]);

    // Draw symmetry guide lines
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

    // Modern Cohesive Circular Handle
    ctx.setLineDash([]);
    const rOuter = Math.max(14, 18 / zoom);
    const rInner = Math.max(4, 5 / zoom);
    const tickLen = Math.max(5, 7 / zoom);

    // Crosshair ticks
    ctx.strokeStyle = handleColor;
    ctx.lineWidth = Math.max(1.5, 2.0 / zoom);
    ctx.beginPath();
    ctx.moveTo(this.centerX - rOuter - tickLen, this.centerY);
    ctx.lineTo(this.centerX - rOuter + 2 / zoom, this.centerY);
    ctx.moveTo(this.centerX + rOuter - 2 / zoom, this.centerY);
    ctx.lineTo(this.centerX + rOuter + tickLen, this.centerY);
    ctx.moveTo(this.centerX, this.centerY - rOuter - tickLen);
    ctx.lineTo(this.centerX, this.centerY - rOuter + 2 / zoom);
    ctx.moveTo(this.centerX, this.centerY + rOuter - 2 / zoom);
    ctx.lineTo(this.centerX, this.centerY + rOuter + tickLen);
    ctx.stroke();

    // Outer Target Ring
    ctx.fillStyle = isLocked ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.18)';
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, rOuter, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center Core
    ctx.fillStyle = handleColor;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, rInner, 0, Math.PI * 2);
    ctx.fill();

    // Lock Indicator Badge if locked
    if (isLocked) {
      const badgeR = Math.max(6, 8 / zoom);
      const bx = this.centerX + rOuter * 0.7;
      const by = this.centerY - rOuter * 0.7;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.0, 1.5 / zoom);
      ctx.stroke();
    }

    ctx.restore();
  }
}
