/**
 * Vectura Exporter Engine
 * PNG (transparent/opaque), JPEG, WebP, True Vector SVG, Timelapse Replay, and Web Share API.
 */
import { CatmullRomSpline } from '../engine/CatmullRom.js';

export class Exporter {
  constructor(vectorCanvas) {
    this.vectorCanvas = vectorCanvas;
    this.spline = new CatmullRomSpline(0.5);
  }

  /**
   * Exports document composite as a raster Blob (PNG, JPEG, WebP).
   * Optional scale parameter renders at larger resolution (capped so longest side <= 4096).
   */
  async exportRaster(format = 'image/png', quality = 0.92, transparent = false, scale = 1) {
    const vc = this.vectorCanvas;
    let targetW = Math.round(vc.docWidth * Math.max(0.1, scale));
    let targetH = Math.round(vc.docHeight * Math.max(0.1, scale));

    // Cap so the longest side <= 4096
    const maxDim = Math.max(targetW, targetH);
    if (maxDim > 4096) {
      const factor = 4096 / maxDim;
      targetW = Math.max(1, Math.round(targetW * factor));
      targetH = Math.max(1, Math.round(targetH * factor));
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetW;
    exportCanvas.height = targetH;
    const ctx = exportCanvas.getContext('2d');

    if (scale !== 1 || targetW !== vc.docWidth || targetH !== vc.docHeight) {
      ctx.scale(targetW / vc.docWidth, targetH / vc.docHeight);
    }

    vc.layerManager.compositeToCanvas(ctx, !transparent);

    return new Promise((resolve) => {
      exportCanvas.toBlob((blob) => resolve(blob), format, quality);
    });
  }

  /**
   * Generates a Data URL for raster export.
   */
  exportDataUrl(format = 'image/png', quality = 0.92, transparent = false) {
    const vc = this.vectorCanvas;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = vc.docWidth;
    exportCanvas.height = vc.docHeight;
    const ctx = exportCanvas.getContext('2d');

    vc.layerManager.compositeToCanvas(ctx, !transparent);
    return exportCanvas.toDataURL(format, quality);
  }

  /**
   * Generates a True Vector SVG document string from all vector strokes.
   */
  exportSVG(transparent = false) {
    const vc = this.vectorCanvas;
    const w = vc.docWidth;
    const h = vc.docHeight;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n`;

    // Background rect
    if (!transparent && !vc.layerManager.isTransparentBg && vc.layerManager.backgroundColor) {
      svg += `  <rect width="${w}" height="${h}" fill="${vc.layerManager.backgroundColor}" />\n`;
    }

    // Export each layer in stack order
    for (const layer of vc.layerManager.layers) {
      if (!layer.visible) continue;
      svg += `  <g id="${layer.id}" opacity="${layer.opacity}">\n`;

      for (const stroke of layer.strokes) {
        if (stroke.shapeType) {
          // Export basic vector shape
          if (stroke.shapeType === 'line') {
            svg += `    <line x1="${stroke.x0}" y1="${stroke.y0}" x2="${stroke.x1}" y2="${stroke.y1}" stroke="${stroke.color}" stroke-width="${stroke.strokeWidth}" stroke-linecap="round" />\n`;
          } else if (stroke.shapeType === 'rect') {
            const rx = Math.min(stroke.x0, stroke.x1);
            const ry = Math.min(stroke.y0, stroke.y1);
            const rw = Math.abs(stroke.x1 - stroke.x0);
            const rh = Math.abs(stroke.y1 - stroke.y0);
            svg += `    <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${stroke.fill ? stroke.color : 'none'}" stroke="${stroke.color}" stroke-width="${stroke.strokeWidth}" />\n`;
          } else if (stroke.shapeType === 'ellipse') {
            const cx = (stroke.x0 + stroke.x1) / 2;
            const cy = (stroke.y0 + stroke.y1) / 2;
            const rx = Math.abs(stroke.x1 - stroke.x0) / 2;
            const ry = Math.abs(stroke.y1 - stroke.y0) / 2;
            svg += `    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${stroke.fill ? stroke.color : 'none'}" stroke="${stroke.color}" stroke-width="${stroke.strokeWidth}" />\n`;
          }
        } else if (stroke.points && stroke.points.length > 0) {
          // Sample spline points
          const samples = this.spline.sampleStroke(stroke.points, 6);
          if (samples.length > 1) {
            let pathD = `M ${samples[0].x.toFixed(2)} ${samples[0].y.toFixed(2)}`;
            for (let i = 1; i < samples.length; i++) {
              pathD += ` L ${samples[i].x.toFixed(2)} ${samples[i].y.toFixed(2)}`;
            }
            const strokeWidth = stroke.brushSnapshot?.size || 4;
            svg += `    <path d="${pathD}" fill="none" stroke="${stroke.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.brushSnapshot?.opacity ?? 1}" />\n`;
          }
        }
      }

      svg += `  </g>\n`;
    }

    svg += `</svg>`;
    return svg;
  }

  /**
   * Converts a Blob, File, or DataURL to raw Base64 string.
   */
  async blobOrDataUrlToBase64(data) {
    if (typeof data === 'string') {
      return data.includes(',') ? data.substring(data.indexOf(',') + 1) : data;
    }
    if (data instanceof Blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result;
          const b64 = typeof res === 'string' && res.includes(',') ? res.substring(res.indexOf(',') + 1) : res;
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(data);
      });
    }
    return '';
  }

  /**
   * Triggers native Android export/share in chunks or web download.
   */
  async shareOrDownload(dataUrlOrBlob, filename, mimeType) {
    // 1. AndroidBridge: stream chunks of ~512KB base64
    if (window.AndroidBridge && (window.AndroidBridge.beginFile || window.AndroidBridge.shareFile)) {
      try {
        const b64 = await this.blobOrDataUrlToBase64(dataUrlOrBlob);
        if (window.AndroidBridge.beginFile && window.AndroidBridge.appendChunk && window.AndroidBridge.finishFile) {
          window.AndroidBridge.beginFile(filename, mimeType);
          const chunkSize = 512 * 1024; // 512KB chunk
          for (let i = 0; i < b64.length; i += chunkSize) {
            window.AndroidBridge.appendChunk(b64.slice(i, i + chunkSize));
          }
          window.AndroidBridge.finishFile(filename, mimeType);
          return;
        } else if (window.AndroidBridge.shareFile) {
          window.AndroidBridge.shareFile(b64, mimeType, filename);
          return;
        }
      } catch (err) {
        console.error('AndroidBridge chunked export failed:', err);
        window.AndroidBridge.showToast?.('Export failed: ' + err.message);
      }
    }

    // 2. Web Share API fallback for modern mobile browsers
    if (navigator.canShare && navigator.share && dataUrlOrBlob instanceof Blob) {
      try {
        const file = new File([dataUrlOrBlob], filename, { type: mimeType });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: filename,
            files: [file]
          });
          return;
        }
      } catch (e) {
        // Fallback to link download
      }
    }

    // 3. Fallback: standard file download trigger
    const link = document.createElement('a');
    link.download = filename;
    if (typeof dataUrlOrBlob === 'string') {
      link.href = dataUrlOrBlob;
    } else {
      link.href = URL.createObjectURL(dataUrlOrBlob);
    }
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      if (typeof dataUrlOrBlob !== 'string') URL.revokeObjectURL(link.href);
    }, 1000);
  }
}
