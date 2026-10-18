/**
 * Vectura Viewport & Camera Engine
 * Handles Pan, Zoom (5% to 6400%), Rotation with soft 0 snap, Mirror view, and Inertia.
 */
export class Viewport {
  constructor(canvasWidth = 1080, canvasHeight = 1080) {
    this.docWidth = canvasWidth;
    this.docHeight = canvasHeight;

    // Viewport transforms (in screen coordinates)
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.rotation = 0; // in radians
    this.mirrored = false;

    // Constraints
    this.minZoom = 0.05; // 5%
    this.maxZoom = 64.0; // 6400%
    this.snapThreshold = (3.5 * Math.PI) / 180; // 3.5 degrees snap

    // Screen dimensions
    this.screenWidth = window.innerWidth || 360;
    this.screenHeight = window.innerHeight || 640;

    // Inertia state
    this.velocityX = 0;
    this.velocityY = 0;
  }

  resizeScreen(width, height) {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  setDocumentSize(w, h) {
    this.docWidth = w;
    this.docHeight = h;
    this.resetView();
  }

  resetView() {
    this.rotation = 0;
    this.mirrored = false;
    this.fitToScreen();
  }

  fitToScreen() {
    const margin = 24;
    const availW = Math.max(80, this.screenWidth - margin * 2);
    const availH = Math.max(80, this.screenHeight - margin * 2);

    const scaleX = availW / this.docWidth;
    const scaleY = availH / this.docHeight;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(scaleX, scaleY)));

    this.panX = this.screenWidth / 2;
    this.panY = this.screenHeight / 2;
    this.rotation = 0;
  }

  set100Percent() {
    this.zoom = 1.0;
    this.panX = this.screenWidth / 2;
    this.panY = this.screenHeight / 2;
    this.rotation = 0;
  }

  toggleMirror() {
    this.mirrored = !this.mirrored;
  }

  /**
   * Applies pan delta in screen pixels.
   */
  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
  }

  /**
   * Zooms anchored around a screen center point (cx, cy).
   */
  zoomAt(factor, cx, cy) {
    const prevZoom = this.zoom;
    const nextZoom = Math.max(this.minZoom, Math.min(this.maxZoom, prevZoom * factor));
    const ratio = nextZoom / prevZoom;

    // Anchor pan to screen point
    this.panX = cx - (cx - this.panX) * ratio;
    this.panY = cy - (cy - this.panY) * ratio;
    this.zoom = nextZoom;
  }

  /**
   * Rotates anchored around a screen center point (cx, cy).
   */
  rotateAt(deltaAngle, cx, cy) {
    if (Math.abs(deltaAngle) < 0.0001) return;

    let nextAngle = this.rotation + deltaAngle;

    // Normalize angle to [-PI, PI]
    while (nextAngle > Math.PI) nextAngle -= 2 * Math.PI;
    while (nextAngle < -Math.PI) nextAngle += 2 * Math.PI;

    // Soft snapping near 0 degrees (within threshold)
    let actualDelta = deltaAngle;
    if (Math.abs(nextAngle) < this.snapThreshold) {
      actualDelta = -this.rotation;
      nextAngle = 0;
    }

    // Anchor the rotation around the pinch center (cx, cy)
    const cos = Math.cos(actualDelta);
    const sin = Math.sin(actualDelta);
    const dx = this.panX - cx;
    const dy = this.panY - cy;
    this.panX = cx + (dx * cos - dy * sin);
    this.panY = cy + (dx * sin + dy * cos);

    this.rotation = nextAngle;
  }

  /**
   * Converts Screen (pixel) coordinates -> Canvas Document coordinates.
   */
  screenToWorld(sx, sy) {
    // 1. Shift by pan offset
    let x = sx - this.panX;
    let y = sy - this.panY;

    // 2. Undo rotation
    if (this.rotation !== 0) {
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      x = rx;
      y = ry;
    }

    // 3. Undo mirror
    if (this.mirrored) {
      x = -x;
    }

    // 4. Undo zoom
    x /= this.zoom;
    y /= this.zoom;

    // 5. Shift relative to document center
    x += this.docWidth / 2;
    y += this.docHeight / 2;

    return { x, y };
  }

  /**
   * Converts Canvas Document coordinates -> Screen (pixel) coordinates.
   */
  worldToScreen(wx, wy) {
    let x = wx - this.docWidth / 2;
    let y = wy - this.docHeight / 2;

    x *= this.zoom;
    y *= this.zoom;

    if (this.mirrored) {
      x = -x;
    }

    if (this.rotation !== 0) {
      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      x = rx;
      y = ry;
    }

    x += this.panX;
    y += this.panY;

    return { x, y };
  }

  /**
   * Applies current transform matrix to a 2D rendering context.
   */
  applyTransform(ctx) {
    ctx.translate(this.panX, this.panY);
    if (this.rotation !== 0) {
      ctx.rotate(this.rotation);
    }
    if (this.mirrored) {
      ctx.scale(-1, 1);
    }
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.docWidth / 2, -this.docHeight / 2);
  }
}
