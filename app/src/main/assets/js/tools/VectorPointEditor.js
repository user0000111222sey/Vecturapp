/**
 * Vectura Vector Point Editor
 * Direct vector curve node manipulation, point insertion, deletion, and curve smoothing.
 */
import { simplifyPoints } from '../engine/CatmullRom.js';

export class VectorPointEditor {
  constructor() {
    this.active = false;
    this.selectedStroke = null;
    this.selectedPointIndex = -1;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
  }

  activate() {
    this.active = true;
    this.selectedStroke = null;
    this.selectedPointIndex = -1;
  }

  deactivate() {
    this.active = false;
    this.selectedStroke = null;
    this.selectedPointIndex = -1;
  }

  onPointerDown(worldX, worldY, layer) {
    if (!this.active || !layer) return false;

    // 1. If a stroke is already selected, check if we hit one of its points
    if (this.selectedStroke && this.selectedStroke.points) {
      for (let i = 0; i < this.selectedStroke.points.length; i++) {
        const pt = this.selectedStroke.points[i];
        if (Math.hypot(worldX - pt.x, worldY - pt.y) <= 18) {
          this.selectedPointIndex = i;
          this.isDragging = true;
          this.dragStart = { x: worldX, y: worldY };
          return true;
        }
      }
    }

    // 2. Otherwise search for nearest stroke on active layer
    let closestStroke = null;
    let minDist = 24;

    for (let i = layer.strokes.length - 1; i >= 0; i--) {
      const s = layer.strokes[i];
      if (s.points) {
        for (const pt of s.points) {
          const d = Math.hypot(worldX - pt.x, worldY - pt.y);
          if (d < minDist) {
            minDist = d;
            closestStroke = s;
          }
        }
      }
    }

    if (closestStroke) {
      this.selectedStroke = closestStroke;
      this.selectedPointIndex = -1;
      return true;
    }

    return false;
  }

  onPointerMove(worldX, worldY) {
    if (!this.isDragging || !this.selectedStroke || this.selectedPointIndex < 0) return false;
    const pt = this.selectedStroke.points[this.selectedPointIndex];
    if (pt) {
      pt.x = worldX;
      pt.y = worldY;
      return true; // Request redraw
    }
    return false;
  }

  onPointerUp() {
    this.isDragging = false;
  }

  deleteSelectedPoint(onRedraw) {
    if (!this.selectedStroke || this.selectedPointIndex < 0) return;
    if (this.selectedStroke.points.length > 2) {
      this.selectedStroke.points.splice(this.selectedPointIndex, 1);
      this.selectedPointIndex = -1;
      onRedraw?.();
    }
  }

  simplifyStroke(onRedraw) {
    if (!this.selectedStroke || !this.selectedStroke.points) return;
    this.selectedStroke.points = simplifyPoints(this.selectedStroke.points, 3.0);
    this.selectedPointIndex = -1;
    onRedraw?.();
  }

  drawOverlay(ctx) {
    if (!this.active || !this.selectedStroke || !this.selectedStroke.points) return;

    ctx.save();
    const pts = this.selectedStroke.points;

    // Draw control polygon in dashed cyan
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    // Draw point handles
    ctx.setLineDash([]);
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const isSelected = i === this.selectedPointIndex;

      ctx.fillStyle = isSelected ? '#f59e0b' : '#ffffff';
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}
