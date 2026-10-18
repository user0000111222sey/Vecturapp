/**
 * Vectura Eyedropper Tool
 * Samples pixel color from canvas composite with visual loupe preview ring.
 */
export class Eyedropper {
  constructor(loupeEl, sampleEl, currentEl) {
    this.loupeEl = loupeEl;
    this.sampleEl = sampleEl;
    this.currentEl = currentEl;
    this.active = false;
    this.lastColor = '#000000';
  }

  show(screenX, screenY, currentColor) {
    this.active = true;
    if (this.loupeEl) {
      this.loupeEl.style.display = 'block';
      this.loupeEl.style.left = screenX + 'px';
      this.loupeEl.style.top = screenY + 'px';
    }
    if (this.currentEl) {
      this.currentEl.style.backgroundColor = currentColor;
    }
  }

  hide() {
    this.active = false;
    if (this.loupeEl) {
      this.loupeEl.style.display = 'none';
    }
  }

  sample(worldX, worldY, screenX, screenY, layerManager) {
    if (!this.active) return this.lastColor;

    const w = layerManager.docWidth;
    const h = layerManager.docHeight;
    const x = Math.floor(worldX);
    const y = Math.floor(worldY);

    if (x >= 0 && x < w && y >= 0 && y < h) {
      layerManager.compositeToCanvas(layerManager.cachedCompositeCtx, true);
      const pixel = layerManager.cachedCompositeCtx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
      this.lastColor = hex;

      if (this.sampleEl) {
        this.sampleEl.style.backgroundColor = hex;
      }
    }

    if (this.loupeEl) {
      this.loupeEl.style.left = screenX + 'px';
      this.loupeEl.style.top = screenY + 'px';
    }

    return this.lastColor;
  }
}
