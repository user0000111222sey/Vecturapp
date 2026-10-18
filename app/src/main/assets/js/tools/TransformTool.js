/**
 * Vectura Transform Engine
 * Move, uniform/free scale, rotate, flip H/V with interactive on-canvas handles.
 */
export class TransformTool {
  constructor() {
    this.active = false;
    this.targetLayer = null;

    // Bounding box of content being transformed
    this.bounds = { x: 0, y: 0, w: 100, h: 100 };
    this.pivot = { x: 50, y: 50 };

    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0; // radians

    this.dragHandle = null; // 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'rot' | 'pivot'
    this.dragStart = { x: 0, y: 0 };
    this.initialTransform = null;
  }

  activate(layer) {
    this.active = true;
    this.targetLayer = layer;
    this.calculateBounds();
    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0;
  }

  calculateBounds() {
    if (!this.targetLayer || this.targetLayer.strokes.length === 0) {
      this.bounds = { x: 100, y: 100, w: this.targetLayer.width - 200, h: this.targetLayer.height - 200 };
      this.pivot = { x: this.bounds.x + this.bounds.w / 2, y: this.bounds.y + this.bounds.h / 2 };
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of this.targetLayer.strokes) {
      if (s.points) {
        for (const p of s.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }
    }

    if (minX === Infinity) {
      this.bounds = { x: 50, y: 50, w: 200, h: 200 };
    } else {
      const pad = 10;
      this.bounds = {
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        w: Math.max(20, (maxX - minX) + pad * 2),
        h: Math.max(20, (maxY - minY) + pad * 2)
      };
    }
    this.pivot = { x: this.bounds.x + this.bounds.w / 2, y: this.bounds.y + this.bounds.h / 2 };
  }

  flipHorizontal() {
    this.scaleX *= -1;
  }

  flipVertical() {
    this.scaleY *= -1;
  }

  onPointerDown(worldX, worldY) {
    if (!this.active) return false;
    // Hit test handles
    const handle = this.hitTestHandle(worldX, worldY);
    if (handle) {
      this.dragHandle = handle;
      this.dragStart = { x: worldX, y: worldY };
      this.initialTransform = {
        tx: this.translateX,
        ty: this.translateY,
        sx: this.scaleX,
        sy: this.scaleY,
        rot: this.rotation
      };
      return true;
    }
    return false;
  }

  onPointerMove(worldX, worldY) {
    if (!this.active || !this.dragHandle) return;
    const dx = worldX - this.dragStart.x;
    const dy = worldY - this.dragStart.y;

    if (this.dragHandle === 'move') {
      this.translateX = this.initialTransform.tx + dx;
      this.translateY = this.initialTransform.ty + dy;
    } else if (this.dragHandle === 'rot') {
      const angle = Math.atan2(worldY - this.pivot.y, worldX - this.pivot.x);
      const startAngle = Math.atan2(this.dragStart.y - this.pivot.y, this.dragStart.x - this.pivot.x);
      this.rotation = this.initialTransform.rot + (angle - startAngle);
    } else if (this.dragHandle === 'se') {
      const origW = this.bounds.w;
      const newW = origW + dx;
      const factor = Math.max(0.1, newW / origW);
      this.scaleX = this.initialTransform.sx * factor;
      this.scaleY = this.initialTransform.sy * factor;
    }
  }

  onPointerUp() {
    this.dragHandle = null;
  }

  hitTestHandle(wx, wy) {
    const handleRadius = 24;
    const cx = this.pivot.x + this.translateX;
    const cy = this.pivot.y + this.translateY;

    // Rotation lever: 40px above top edge
    const rotY = (this.bounds.y + this.translateY) - 35;
    if (Math.hypot(wx - cx, wy - rotY) <= handleRadius) return 'rot';

    // SE handle
    const seX = this.bounds.x + this.bounds.w + this.translateX;
    const seY = this.bounds.y + this.bounds.h + this.translateY;
    if (Math.hypot(wx - seX, wy - seY) <= handleRadius) return 'se';

    // Inside box = move
    const bx = this.bounds.x + this.translateX;
    const by = this.bounds.y + this.translateY;
    if (wx >= bx && wx <= bx + this.bounds.w && wy >= by && wy <= by + this.bounds.h) {
      return 'move';
    }

    return null;
  }

  applyTransform(onComplete) {
    if (!this.active || !this.targetLayer) return;

    // Apply matrix to all vector strokes losslessly
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const cx = this.pivot.x;
    const cy = this.pivot.y;

    for (const stroke of this.targetLayer.strokes) {
      if (stroke.points) {
        for (const p of stroke.points) {
          // 1. Shift to pivot
          let x = (p.x - cx) * this.scaleX;
          let y = (p.y - cy) * this.scaleY;

          // 2. Rotate
          const rx = x * cos - y * sin;
          const ry = x * sin + y * cos;

          // 3. Translate + Pivot
          p.x = rx + cx + this.translateX;
          p.y = ry + cy + this.translateY;
        }
      }
    }

    this.active = false;
    onComplete?.();
  }

  cancel() {
    this.active = false;
  }

  drawOverlay(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.translateX, this.translateY);
    ctx.translate(this.pivot.x, this.pivot.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scaleX, this.scaleY);
    ctx.translate(-this.pivot.x, -this.pivot.y);

    // Bounding Box
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);

    // Handles
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;

    const corners = [
      [this.bounds.x, this.bounds.y],
      [this.bounds.x + this.bounds.w, this.bounds.y],
      [this.bounds.x + this.bounds.w, this.bounds.y + this.bounds.h],
      [this.bounds.x, this.bounds.y + this.bounds.h]
    ];

    for (const [hx, hy] of corners) {
      ctx.beginPath();
      ctx.arc(hx, hy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Rotation lever
    const midTopX = this.bounds.x + this.bounds.w / 2;
    const midTopY = this.bounds.y;
    ctx.beginPath();
    ctx.moveTo(midTopX, midTopY);
    ctx.lineTo(midTopX, midTopY - 30);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midTopX, midTopY - 30, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}
