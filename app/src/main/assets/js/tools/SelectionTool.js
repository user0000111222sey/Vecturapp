/**
 * Vectura Box Selection & Marquee Engine
 * High-performance rectangular box selection with animated marching ants overlay,
 * pixel extraction, clearing, and transform integration.
 */
export class SelectionTool {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.docWidth = docWidth;
    this.docHeight = docHeight;
    this.type = 'rect'; // 'rect' (box) | 'lasso'
    this.hasSelection = false;
    this.active = false;

    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;

    // Active selection box in document coordinates
    this.box = null; // { x, y, w, h }
    this.dashOffset = 0;
  }

  resize(w, h) {
    this.docWidth = w;
    this.docHeight = h;
    if (this.box) {
      this.box.x = Math.max(0, Math.min(w, this.box.x));
      this.box.y = Math.max(0, Math.min(h, this.box.y));
      this.box.w = Math.min(w - this.box.x, this.box.w);
      this.box.h = Math.min(h - this.box.y, this.box.h);
    }
  }

  start(x, y) {
    this.active = true;
    this.startX = Math.max(0, Math.min(this.docWidth, x));
    this.startY = Math.max(0, Math.min(this.docHeight, y));
    this.currentX = this.startX;
    this.currentY = this.startY;
  }

  update(x, y) {
    if (!this.active) return;
    this.currentX = Math.max(0, Math.min(this.docWidth, x));
    this.currentY = Math.max(0, Math.min(this.docHeight, y));
  }

  commit() {
    if (!this.active) return;
    this.active = false;

    const rx = Math.round(Math.min(this.startX, this.currentX));
    const ry = Math.round(Math.min(this.startY, this.currentY));
    const rw = Math.round(Math.abs(this.currentX - this.startX));
    const rh = Math.round(Math.abs(this.currentY - this.startY));

    // Reject tiny accidental clicks (< 4px)
    if (rw < 4 || rh < 4) {
      return;
    }

    this.box = { x: rx, y: ry, w: rw, h: rh };
    this.hasSelection = true;
  }

  setBox(x, y, w, h) {
    this.box = {
      x: Math.round(Math.max(0, x)),
      y: Math.round(Math.max(0, y)),
      w: Math.round(Math.min(this.docWidth - x, w)),
      h: Math.round(Math.min(this.docHeight - y, h))
    };
    this.hasSelection = true;
  }

  clear() {
    this.box = null;
    this.hasSelection = false;
    this.active = false;
  }

  selectAll() {
    this.box = { x: 0, y: 0, w: this.docWidth, h: this.docHeight };
    this.hasSelection = true;
  }

  getBounds() {
    if (this.active) {
      const rx = Math.min(this.startX, this.currentX);
      const ry = Math.min(this.startY, this.currentY);
      const rw = Math.abs(this.currentX - this.startX);
      const rh = Math.abs(this.currentY - this.startY);
      return { x: rx, y: ry, w: rw, h: rh };
    }
    if (this.hasSelection && this.box) {
      return { ...this.box };
    }
    return null;
  }

  containsPoint(x, y) {
    const b = this.getBounds();
    if (!b) return false;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  /**
   * Cuts the raster pixels inside the box selection from the given layer.
   * Returns a detached canvas containing the extracted content.
   */
  cutSelectedPixels(layer) {
    if (!this.hasSelection || !this.box || !layer) return null;
    const { x, y, w, h } = this.box;
    if (w <= 0 || h <= 0) return null;

    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = w;
    patchCanvas.height = h;
    const patchCtx = patchCanvas.getContext('2d');

    // Copy selected region
    patchCtx.drawImage(layer.canvas, x, y, w, h, 0, 0, w, h);

    // Clear selected region on the layer
    layer.ctx.save();
    layer.ctx.clearRect(x, y, w, h);
    layer.ctx.restore();
    layer.updateThumbnail();

    return {
      canvas: patchCanvas,
      x,
      y,
      w,
      h
    };
  }

  /**
   * Clears the raster content inside the selection box on the layer.
   */
  clearSelectedArea(layer) {
    if (!this.hasSelection || !this.box || !layer) return;
    const { x, y, w, h } = this.box;
    layer.ctx.clearRect(x, y, w, h);
    layer.updateThumbnail();
  }

  /**
   * Draws animated marching ants around the active box or committed selection.
   */
  drawMarchingAnts(targetCtx, zoom = 1.0) {
    const bounds = this.getBounds();
    if (!bounds || bounds.w < 2 || bounds.h < 2) return;

    this.dashOffset = (this.dashOffset + 0.4) % 12;

    targetCtx.save();
    const lw = Math.max(1, 1.5 / zoom);
    targetCtx.lineWidth = lw;

    // Outer dark stroke
    targetCtx.strokeStyle = '#1B1B1D';
    targetCtx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

    // Inner marching ants stroke
    targetCtx.strokeStyle = '#FFFFFF';
    targetCtx.setLineDash([5 / zoom, 5 / zoom]);
    targetCtx.lineDashOffset = -this.dashOffset / zoom;
    targetCtx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

    // Corner grip handles
    targetCtx.fillStyle = '#3B6EDC';
    const hs = Math.max(4, 6 / zoom);
    const corners = [
      [bounds.x, bounds.y],
      [bounds.x + bounds.w, bounds.y],
      [bounds.x + bounds.w, bounds.y + bounds.h],
      [bounds.x, bounds.y + bounds.h]
    ];
    for (const [cx, cy] of corners) {
      targetCtx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
    }

    targetCtx.restore();
  }
}
