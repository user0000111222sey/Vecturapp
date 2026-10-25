/**
 * Vectura Transform & Translation Engine
 * Translates (moves), scales, rotates, and flips raster layer content or selections.
 * Interactive on-canvas handles with real-time hardware-accelerated preview and Undo/Redo.
 */
import { RasterCommand } from '../history/Command.js';

function cloneCanvas(sourceCanvas) {
  if (!sourceCanvas) return null;
  const clone = document.createElement('canvas');
  clone.width = sourceCanvas.width;
  clone.height = sourceCanvas.height;
  clone.getContext('2d').drawImage(sourceCanvas, 0, 0);
  return clone;
}

export class TransformTool {
  constructor() {
    this.active = false;
    this.targetLayer = null;
    this.beforeStateCanvas = null; // For Undo

    // Floating patch canvas holding pixels being transformed
    this.patchCanvas = null;
    this.patchOrigin = { x: 0, y: 0 }; // Initial top-left in document coords
    this.patchSize = { w: 100, h: 100 };

    // Transformations
    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0; // radians

    // Drag tracking
    this.dragHandle = null; // 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'rot'
    this.dragStart = { x: 0, y: 0 };
    this.initialTransform = null;
  }

  /**
   * Activates transform on a layer, optionally using a cut selection patch.
   */
  activate(layer, selectionPatch = null) {
    if (!layer) return;
    this.targetLayer = layer;
    this.active = true;

    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0;

    // Snapshot layer canvas before transformation for undo / cancel
    this.beforeStateCanvas = cloneCanvas(layer.canvas);

    if (selectionPatch && selectionPatch.canvas) {
      // Transforming extracted selection box
      this.isSelection = true;
      this.patchCanvas = selectionPatch.canvas;
      this.patchOrigin = { x: selectionPatch.x, y: selectionPatch.y };
      this.patchSize = { w: selectionPatch.w, h: selectionPatch.h };
    } else {
      // Transforming whole layer
      this.isSelection = false;
      this.patchCanvas = cloneCanvas(layer.canvas);
      this.patchOrigin = { x: 0, y: 0 };
      this.patchSize = { w: layer.width, h: layer.height };

      // Temporarily clear layer while actively transforming so preview doesn't double-draw
      layer.ctx.clearRect(0, 0, layer.width, layer.height);
    }
  }

  flipHorizontal() {
    this.scaleX *= -1;
  }

  flipVertical() {
    this.scaleY *= -1;
  }

  flipH() {
    this.flipHorizontal();
  }

  flipV() {
    this.flipVertical();
  }

  resetTransform() {
    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0;
  }

  getPivot() {
    return {
      x: this.patchOrigin.x + this.patchSize.w / 2,
      y: this.patchOrigin.y + this.patchSize.h / 2
    };
  }

  onPointerDown(worldX, worldY, zoom = 1.0) {
    if (!this.active) return false;
    const handle = this.hitTestHandle(worldX, worldY, zoom);
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
    const pivot = this.getPivot();

    if (this.dragHandle === 'move') {
      this.translateX = this.initialTransform.tx + dx;
      this.translateY = this.initialTransform.ty + dy;
    } else if (this.dragHandle === 'rot') {
      const angle = Math.atan2(worldY - (pivot.y + this.initialTransform.ty), worldX - (pivot.x + this.initialTransform.tx));
      const startAngle = Math.atan2(this.dragStart.y - (pivot.y + this.initialTransform.ty), this.dragStart.x - (pivot.x + this.initialTransform.tx));
      this.rotation = this.initialTransform.rot + (angle - startAngle);
    } else if (this.dragHandle === 'se' || this.dragHandle === 'nw' || this.dragHandle === 'ne' || this.dragHandle === 'sw') {
      const origDist = Math.hypot(this.patchSize.w / 2, this.patchSize.h / 2);
      const curDist = Math.hypot(worldX - (pivot.x + this.translateX), worldY - (pivot.y + this.translateY));
      const factor = Math.max(0.05, curDist / Math.max(1, origDist));
      const signX = Math.sign(this.initialTransform.sx) || 1;
      const signY = Math.sign(this.initialTransform.sy) || 1;
      this.scaleX = signX * factor;
      this.scaleY = signY * factor;
    }
  }

  onPointerUp() {
    this.dragHandle = null;
  }

  hitTestHandle(wx, wy, zoom = 1.0) {
    const r = 38 / Math.max(0.1, zoom); // Generous touch target for mobile
    const pivot = this.getPivot();
    const cx = pivot.x + this.translateX;
    const cy = pivot.y + this.translateY;

    // Un-rotate world point around pivot to local transform space
    let lx = wx;
    let ly = wy;
    if (this.rotation !== 0) {
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      const dx = wx - cx;
      const dy = wy - cy;
      lx = cx + (dx * cos - dy * sin);
      ly = cy + (dx * sin + dy * cos);
    }

    const wHalf = (this.patchSize.w * Math.abs(this.scaleX)) / 2;
    const hHalf = (this.patchSize.h * Math.abs(this.scaleY)) / 2;

    // Test rotation handle (above top edge)
    const rotY = cy - hHalf - 36 / Math.max(0.1, zoom);
    if (Math.hypot(lx - cx, ly - rotY) <= r) return 'rot';

    // Test 4 corner handles
    const corners = [
      { name: 'nw', x: cx - wHalf, y: cy - hHalf },
      { name: 'ne', x: cx + wHalf, y: cy - hHalf },
      { name: 'se', x: cx + wHalf, y: cy + hHalf },
      { name: 'sw', x: cx - wHalf, y: cy + hHalf }
    ];

    for (const c of corners) {
      if (Math.hypot(lx - c.x, ly - c.y) <= r) return c.name;
    }

    // Test inside bounding box = move
    if (lx >= cx - wHalf && lx <= cx + wHalf && ly >= cy - hHalf && ly <= cy + hHalf) {
      return 'move';
    }

    return null;
  }

  isInsideBox(wx, wy) {
    if (!this.active || !this.patchCanvas) return false;
    const pivot = this.getPivot();
    const cx = pivot.x + this.translateX;
    const cy = pivot.y + this.translateY;

    let lx = wx;
    let ly = wy;
    if (this.rotation !== 0) {
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      const dx = wx - cx;
      const dy = wy - cy;
      lx = cx + (dx * cos - dy * sin);
      ly = cy + (dx * sin + dy * cos);
    }
    const wHalf = (this.patchSize.w * Math.abs(this.scaleX)) / 2;
    const hHalf = (this.patchSize.h * Math.abs(this.scaleY)) / 2;
    return lx >= cx - wHalf && lx <= cx + wHalf && ly >= cy - hHalf && ly <= cy + hHalf;
  }

  /**
   * Commits the transformation to the target layer and pushes a RasterCommand to History.
   */
  applyTransform(history = null, onComplete = null, selectionTool = null) {
    if (!this.active || !this.targetLayer || !this.patchCanvas) return;

    const layer = this.targetLayer;
    const pivot = this.getPivot();
    const cx = pivot.x + this.translateX;
    const cy = pivot.y + this.translateY;

    // Bake transformed patch into layer canvas
    layer.ctx.save();
    layer.ctx.translate(cx, cy);
    layer.ctx.rotate(this.rotation);
    layer.ctx.scale(this.scaleX, this.scaleY);
    layer.ctx.drawImage(this.patchCanvas, -this.patchSize.w / 2, -this.patchSize.h / 2);
    layer.ctx.restore();

    layer.updateThumbnail();

    if (history && this.beforeStateCanvas) {
      const afterStateCanvas = cloneCanvas(layer.canvas);
      history.push(new RasterCommand('Transform', layer, this.beforeStateCanvas, afterStateCanvas));
    }

    // Preserve and update selection bounds if transforming a selection!
    if (this.isSelection && selectionTool) {
      const nw = Math.round(this.patchSize.w * Math.abs(this.scaleX));
      const nh = Math.round(this.patchSize.h * Math.abs(this.scaleY));
      selectionTool.setBox(Math.round(cx - nw / 2), Math.round(cy - nh / 2), nw, nh);
    }

    this.active = false;
    this.patchCanvas = null;
    this.beforeStateCanvas = null;
    this.isSelection = false;
    onComplete?.();
  }

  /**
   * Cancels transform and restores original layer state.
   */
  cancel(onComplete = null) {
    if (!this.active) return;
    if (this.targetLayer && this.beforeStateCanvas) {
      this.targetLayer.ctx.clearRect(0, 0, this.targetLayer.width, this.targetLayer.height);
      this.targetLayer.ctx.drawImage(this.beforeStateCanvas, 0, 0);
      this.targetLayer.updateThumbnail();
    }
    this.active = false;
    this.patchCanvas = null;
    this.beforeStateCanvas = null;
    onComplete?.();
  }

  /**
   * Renders the transformed floating content and interactive handles in real-time.
   */
  drawOverlay(ctx, zoom = 1.0) {
    if (!this.active || !this.patchCanvas) return;

    const pivot = this.getPivot();
    const cx = pivot.x + this.translateX;
    const cy = pivot.y + this.translateY;
    const w = this.patchSize.w;
    const h = this.patchSize.h;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    // 1. Draw floating raster content
    ctx.save();
    ctx.scale(this.scaleX, this.scaleY);
    ctx.drawImage(this.patchCanvas, -w / 2, -h / 2);
    ctx.restore();

    // 2. Bounding Box
    const wHalf = (w * Math.abs(this.scaleX)) / 2;
    const hHalf = (h * Math.abs(this.scaleY)) / 2;
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = Math.max(1.5, 2.0 / zoom);
    ctx.strokeRect(-wHalf, -hHalf, wHalf * 2, hHalf * 2);

    // 3. Corner Handles (crisp square controls, high visibility)
    const hs = Math.max(14, 16 / zoom);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = Math.max(1.5, 2.0 / zoom);

    const corners = [
      [-wHalf, -hHalf],
      [wHalf, -hHalf],
      [wHalf, hHalf],
      [-wHalf, hHalf]
    ];

    for (const [hx, hy] of corners) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }

    // 4. Rotation handle (stem and top circle)
    const stemLen = 36 / Math.max(0.1, zoom);
    ctx.beginPath();
    ctx.moveTo(0, -hHalf);
    ctx.lineTo(0, -hHalf - stemLen);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -hHalf - stemLen, Math.max(8, 9 / zoom), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}
