/**
 * Vectura Flood Fill Engine
 * Fast Uint32Array scanline flood fill with tolerance, sample sources, and iPad-style
 * expanding circular ripple animation clipped strictly to the filled region.
 * Committed as a single undoable step via the central Command system.
 */
export class FillBucket {
  constructor() {
    this.tolerance = 25;       // 0 to 100
    this.expand = 1;           // -10 to +10 px
    this.sampleSource = 'all'; // 'current' | 'reference' | 'all'
    this.animateFill = true;   // Animation on/off
    this.animationDuration = 380; // ms (300 to 500 ms)
  }

  hexToRgba(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
      a: 255
    };
  }

  /**
   * Performs fast scanline flood fill on target layer.
   * Can run asynchronously so input is never blocked.
   */
  async fill(startX, startY, fillColorHex, layerManager, onAnimatedCommit) {
    const activeLayer = layerManager.getActiveLayer();
    if (!activeLayer || activeLayer.locked) return false;

    const w = layerManager.docWidth;
    const h = layerManager.docHeight;
    startX = Math.floor(startX);
    startY = Math.floor(startY);

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return false;

    // 1. Get sample canvas depending on sampleSource
    let sampleCanvas;
    if (this.sampleSource === 'current') {
      sampleCanvas = activeLayer.canvas;
    } else if (this.sampleSource === 'reference') {
      sampleCanvas = layerManager.getReferenceLayer().canvas;
    } else {
      layerManager.compositeToCanvas(layerManager.cachedCompositeCtx, true);
      sampleCanvas = layerManager.cachedComposite;
    }

    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = sampleCtx.getImageData(0, 0, w, h);
    const data32 = new Uint32Array(imgData.data.buffer);

    const startIndex = startY * w + startX;
    const targetColor = data32[startIndex];

    const fillRgba = this.hexToRgba(fillColorHex);
    // 32-bit little-endian: (A << 24) | (B << 16) | (G << 8) | R
    const fillColor32 = ((fillRgba.a << 24) | (fillRgba.b << 16) | (fillRgba.g << 8) | fillRgba.r) >>> 0;

    if (targetColor === fillColor32) return false;

    const tr = targetColor & 0xff;
    const tg = (targetColor >> 8) & 0xff;
    const tb = (targetColor >> 16) & 0xff;
    const ta = (targetColor >> 24) & 0xff;
    const tolSq = (this.tolerance * 2.55) ** 2;

    const colorMatch = (idx) => {
      const c = data32[idx];
      const r = c & 0xff;
      const g = (c >> 8) & 0xff;
      const b = (c >> 16) & 0xff;
      const a = (c >> 24) & 0xff;
      const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2 + (a - ta) ** 2;
      return d <= tolSq;
    };

    // Scanline flood fill algorithm
    const visited = new Uint8Array(w * h);
    const filledMask = new Uint8Array(w * h);
    const queue = [[startX, startY]];
    visited[startIndex] = 1;

    let minX = startX, maxX = startX, minY = startY, maxY = startY;

    // Fast loop with micro-task yielding for 2048px+ canvases if needed
    let iterations = 0;
    while (queue.length > 0) {
      const [curX, curY] = queue.pop();
      let left = curX;
      let right = curX;

      while (left > 0 && !visited[curY * w + (left - 1)] && colorMatch(curY * w + (left - 1))) {
        left--;
        visited[curY * w + left] = 1;
      }

      while (right < w - 1 && !visited[curY * w + (right + 1)] && colorMatch(curY * w + (right + 1))) {
        right++;
        visited[curY * w + right] = 1;
      }

      minX = Math.min(minX, left);
      maxX = Math.max(maxX, right);
      minY = Math.min(minY, curY);
      maxY = Math.max(maxY, curY);

      for (let x = left; x <= right; x++) {
        filledMask[curY * w + x] = 1;

        if (curY > 0) {
          const topIdx = (curY - 1) * w + x;
          if (!visited[topIdx] && colorMatch(topIdx)) {
            visited[topIdx] = 1;
            queue.push([x, curY - 1]);
          }
        }

        if (curY < h - 1) {
          const botIdx = (curY + 1) * w + x;
          if (!visited[botIdx] && colorMatch(botIdx)) {
            visited[botIdx] = 1;
            queue.push([x, curY + 1]);
          }
        }
      }

      iterations++;
      if (iterations % 4000 === 0 && w * h > 1000000) {
        // Yield to allow user touch responsiveness
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const finalMask = this.expandMask(filledMask, w, h, this.expand);

    // Create fill patch canvas containing the filled pixels
    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = w;
    patchCanvas.height = h;
    const patchCtx = patchCanvas.getContext('2d');
    const patchImg = patchCtx.createImageData(w, h);
    const patchData32 = new Uint32Array(patchImg.data.buffer);

    for (let i = 0; i < w * h; i++) {
      if (finalMask[i]) {
        patchData32[i] = fillColor32;
      }
    }
    patchCtx.putImageData(patchImg, 0, 0);

    // Calculate maximum distance from start point to bounding box corners for ripple
    const d1 = Math.hypot(startX - minX, startY - minY);
    const d2 = Math.hypot(startX - maxX, startY - minY);
    const d3 = Math.hypot(startX - minX, startY - maxY);
    const d4 = Math.hypot(startX - maxX, startY - maxY);
    const maxRadius = Math.max(d1, d2, d3, d4, 30);

    const pad = Math.abs(this.expand) + 2;
    const bx = Math.max(0, minX - pad);
    const by = Math.max(0, minY - pad);
    const bw = Math.min(w - bx, (maxX - minX + 1) + pad * 2);
    const bh = Math.min(h - by, (maxY - minY + 1) + pad * 2);

    onAnimatedCommit?.({
      startX,
      startY,
      maxRadius,
      patchCanvas,
      activeLayer,
      fillColorHex,
      animate: this.animateFill,
      duration: this.animationDuration,
      bbox: { x: bx, y: by, width: bw, height: bh }
    });

    return true;
  }

  expandMask(mask, w, h, amount) {
    if (amount === 0) return mask;
    const out = new Uint8Array(mask);
    const radius = Math.abs(amount);

    if (amount > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (mask[y * w + x]) {
            for (let dy = -radius; dy <= radius; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= h) continue;
              for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= w) continue;
                if (dx * dx + dy * dy <= radius * radius) {
                  out[ny * w + nx] = 1;
                }
              }
            }
          }
        }
      }
    }
    return out;
  }
}
