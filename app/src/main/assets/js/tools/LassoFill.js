/**
 * Vectura Lasso Engine (LassoFill.js)
 * High-performance interconnected polygon lasso engine with:
 * - Real-time polygon simplification with sharp-turn anchor preservation
 * - Dynamic velocity point density (speed-dependent vertex count)
 * - 4 Pre-made Lasso Brushes (Precise, Smooth, Angular, Loose)
 * - Color and Pattern Fill modes (Dots, Squares, Vertical Lines, Horizontal Lines, Crosshatch)
 * - Live non-destructive overlay preview
 * - Alpha lock and Layer lock awareness
 */

export const LASSO_PRESETS = [
  {
    id: 'precise',
    name: 'Precise',
    description: 'Pixel-exact contour tracing with maximum vertex density and sharp corner retention.',
    polyCount: 92, // High polygon count
    sharpTurnAngle: 35, // Degrees threshold for sharp turn
    velocityEnabled: false,
    velocityAmount: 0,
    fillMode: 'color',
    pattern: {
      type: 'dots',
      size: 6,
      spacing: 16,
      lineWidth: 2,
      angle: 0
    }
  },
  {
    id: 'smooth',
    name: 'Smooth',
    description: 'Curvature-smoothed organic contours with gentle velocity-based point tapering.',
    polyCount: 65, // Balanced polygon count
    sharpTurnAngle: 48,
    velocityEnabled: true,
    velocityAmount: 45,
    fillMode: 'color',
    pattern: {
      type: 'crosshatch',
      size: 8,
      spacing: 20,
      lineWidth: 2,
      angle: 45
    }
  },
  {
    id: 'angular',
    name: 'Angular',
    description: 'Low-poly geometric silhouette that snaps aggressively to sharp corner angles.',
    polyCount: 22, // Low polygon count
    sharpTurnAngle: 28, // Sensitive to sharp turns
    velocityEnabled: false,
    velocityAmount: 0,
    fillMode: 'color',
    pattern: {
      type: 'squares',
      size: 8,
      spacing: 22,
      lineWidth: 2,
      angle: 0
    }
  },
  {
    id: 'loose',
    name: 'Loose',
    description: 'Expressive gestural lasso that simplifies fast strokes into bold, economical facets.',
    polyCount: 12, // Very low polygon count
    sharpTurnAngle: 65,
    velocityEnabled: true,
    velocityAmount: 85,
    fillMode: 'color',
    pattern: {
      type: 'horizontal-lines',
      size: 8,
      spacing: 18,
      lineWidth: 3,
      angle: 0
    }
  }
];

function perpendicularDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / mag;
}

function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }
  if (dmax > epsilon) {
    const rec1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const rec2 = douglasPeucker(points.slice(index), epsilon);
    return rec1.slice(0, rec1.length - 1).concat(rec2);
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Simplifies a polyline while guaranteeing that all points marked isCritical are preserved.
 */
function simplifyWithAnchors(points, epsilon) {
  if (points.length <= 2) return points;
  const criticalIndices = [0];
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i].isCritical) criticalIndices.push(i);
  }
  criticalIndices.push(points.length - 1);

  let result = [];
  for (let k = 0; k < criticalIndices.length - 1; k++) {
    const startIdx = criticalIndices[k];
    const endIdx = criticalIndices[k + 1];
    const segment = points.slice(startIdx, endIdx + 1);
    const simplifiedSegment = douglasPeucker(segment, epsilon);
    if (k === 0) {
      result = simplifiedSegment;
    } else {
      result = result.concat(simplifiedSegment.slice(1));
    }
  }
  return result;
}

/**
 * Generates an offscreen tile canvas for repeating patterns.
 */
export function createPatternTileCanvas(pattern, colorHex, opacity = 1.0) {
  const type = pattern?.type || 'dots';
  const size = Math.max(2, Math.min(64, pattern?.size || 8));
  const spacing = Math.max(size + 2, Math.min(80, pattern?.spacing || 18));
  const lineWidth = Math.max(1, Math.min(24, pattern?.lineWidth || 2));

  const canvas = document.createElement('canvas');
  const w = spacing;
  const h = spacing;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = colorHex;
  ctx.strokeStyle = colorHex;
  ctx.globalAlpha = Math.max(0.01, Math.min(1.0, opacity));
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';

  switch (type) {
    case 'dots': {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'squares': {
      const offset = (spacing - size) / 2;
      ctx.fillRect(offset, offset, size, size);
      break;
    }
    case 'vertical-lines': {
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
      break;
    }
    case 'horizontal-lines': {
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      break;
    }
    case 'crosshatch': {
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      break;
    }
  }

  return canvas;
}

export class LassoFill {
  constructor() {
    this.active = false;
    this.rawPoints = [];
    this.polygonPoints = [];

    // Speed tracking
    this.lastSampleTime = 0;
    this.smoothedSpeed = 0;

    // Presets & Active Brush State
    this.presets = JSON.parse(JSON.stringify(LASSO_PRESETS));
    this.activePresetId = 'precise';

    // Current configurable parameters
    this.polyCount = 92;
    this.sharpTurnAngle = 35;
    this.velocityEnabled = false;
    this.velocityAmount = 0;
    this.fillMode = 'color'; // 'color' | 'pattern'
    this.pattern = {
      type: 'dots',
      size: 6,
      spacing: 16,
      lineWidth: 2,
      angle: 0
    };

    this.loadSavedSettings();
  }

  loadSavedSettings() {
    try {
      const savedPresetId = localStorage.getItem('vectura_lasso_active_preset');
      if (savedPresetId && this.presets.some(p => p.id === savedPresetId)) {
        this.activePresetId = savedPresetId;
      }

      // Restore saved per-preset adjustments
      for (const p of this.presets) {
        const stored = localStorage.getItem(`vectura_lasso_preset_${p.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          Object.assign(p, parsed);
        }
      }

      this.applyPreset(this.activePresetId, false);
    } catch (_) {}
  }

  applyPreset(presetId, persist = true) {
    const p = this.presets.find(item => item.id === presetId) || this.presets[0];
    this.activePresetId = p.id;
    this.polyCount = p.polyCount ?? 92;
    this.sharpTurnAngle = p.sharpTurnAngle ?? 35;
    this.velocityEnabled = p.velocityEnabled ?? false;
    this.velocityAmount = p.velocityAmount ?? 0;
    this.fillMode = p.fillMode || 'color';
    this.pattern = Object.assign({
      type: 'dots',
      size: 6,
      spacing: 16,
      lineWidth: 2,
      angle: 0
    }, p.pattern);

    if (persist) {
      try {
        localStorage.setItem('vectura_lasso_active_preset', this.activePresetId);
        this.persistActivePresetSettings();
      } catch (_) {}
    }
  }

  persistActivePresetSettings() {
    try {
      const cur = this.presets.find(p => p.id === this.activePresetId);
      if (cur) {
        cur.polyCount = this.polyCount;
        cur.sharpTurnAngle = this.sharpTurnAngle;
        cur.velocityEnabled = this.velocityEnabled;
        cur.velocityAmount = this.velocityAmount;
        cur.fillMode = this.fillMode;
        cur.pattern = { ...this.pattern };
        localStorage.setItem(`vectura_lasso_preset_${cur.id}`, JSON.stringify({
          polyCount: this.polyCount,
          sharpTurnAngle: this.sharpTurnAngle,
          velocityEnabled: this.velocityEnabled,
          velocityAmount: this.velocityAmount,
          fillMode: this.fillMode,
          pattern: { ...this.pattern }
        }));
      }
    } catch (_) {}
  }

  // --- Drawing Lifecycle ---

  start(x, y, timestamp = Date.now()) {
    this.active = true;
    this.rawPoints = [{ x, y, t: timestamp, isCritical: true }];
    this.polygonPoints = [{ x, y, isCritical: true }];
    this.lastSampleTime = timestamp;
    this.smoothedSpeed = 0;
  }

  addPoint(x, y, timestamp = Date.now()) {
    if (!this.active) return;
    const len = this.rawPoints.length;
    const last = this.rawPoints[len - 1];
    if (!last) return;

    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.hypot(dx, dy);

    // Compute stroke velocity (px/ms)
    const dt = Math.max(1, timestamp - (last.t || this.lastSampleTime || timestamp));
    this.lastSampleTime = timestamp;
    const instSpeed = dist / dt;
    this.smoothedSpeed = this.smoothedSpeed * 0.75 + instSpeed * 0.25;
    const normSpeed = Math.min(1.0, this.smoothedSpeed / 2.5);

    // Minimum distance threshold with optional velocity modulation
    let minDist = 2.5;
    if (this.velocityEnabled && this.velocityAmount > 0) {
      // Fast speed = larger step (fewer points), slow speed = smaller step (more points)
      minDist = 2.5 * (1 + (this.velocityAmount / 100) * normSpeed * 3.5);
    }

    if (dist < minDist) return;

    const newPoint = { x, y, t: timestamp, isCritical: false };
    this.rawPoints.push(newPoint);

    // Sharp turn detection on last 3 samples
    const updatedLen = this.rawPoints.length;
    if (updatedLen >= 3) {
      const pPrev = this.rawPoints[updatedLen - 3];
      const pMid = this.rawPoints[updatedLen - 2];
      const pCur = newPoint;

      const v1x = pMid.x - pPrev.x;
      const v1y = pMid.y - pPrev.y;
      const v2x = pCur.x - pMid.x;
      const v2y = pCur.y - pMid.y;
      const m1 = Math.hypot(v1x, v1y);
      const m2 = Math.hypot(v2x, v2y);

      if (m1 > 1.5 && m2 > 1.5) {
        const dot = v1x * v2x + v1y * v2y;
        const cosAngle = Math.max(-1, Math.min(1, dot / (m1 * m2)));
        const turnAngleDeg = Math.acos(cosAngle) * (180 / Math.PI);

        if (turnAngleDeg >= this.sharpTurnAngle) {
          pMid.isCritical = true; // Mark as non-negotiable anchor point
        }
      }
    }

    this.updatePolygon();
  }

  updatePolygon() {
    if (this.rawPoints.length <= 2) {
      this.polygonPoints = [...this.rawPoints];
      return;
    }

    // Map polyCount (1..100) to Douglas-Peucker epsilon (e.g. 24px down to 0.5px)
    // 1 = Very Low (large epsilon, highly simplified), 100 = Very High (fine epsilon)
    const normalizedCount = Math.max(1, Math.min(100, this.polyCount));
    let epsilon = 24 * Math.pow(1 - (normalizedCount - 1) / 99, 1.8) + 0.45;

    // Apply velocity influence to epsilon if enabled
    if (this.velocityEnabled && this.velocityAmount > 0) {
      const normSpeed = Math.min(1.0, this.smoothedSpeed / 2.5);
      epsilon *= (1 + (this.velocityAmount / 100) * normSpeed * 1.5);
    }

    this.polygonPoints = simplifyWithAnchors(this.rawPoints, epsilon);
  }

  get points() {
    return this.polygonPoints;
  }

  /**
   * Optimized live overlay rendering:
   * Displays the preview on the ephemeral canvas overlay without touching layer bitmaps.
   */
  renderOverlay(ctx, colorHex, opacity = 1.0) {
    if (!this.active || this.polygonPoints.length < 2) return;
    const pts = this.polygonPoints;

    ctx.save();

    // 1. Live Polygon Fill Preview
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();

    if (this.fillMode === 'pattern') {
      const patCanvas = createPatternTileCanvas(this.pattern, colorHex, 0.4);
      if (patCanvas) {
        const pat = ctx.createPattern(patCanvas, 'repeat');
        if (pat) {
          if (this.pattern.angle && typeof DOMMatrix !== 'undefined') {
            try {
              pat.setTransform(new DOMMatrix().rotate(this.pattern.angle));
            } catch (_) {}
          }
          ctx.fillStyle = pat;
          ctx.fill();
        }
      }
    } else {
      // Translucent tint
      ctx.fillStyle = colorHex.startsWith('#')
        ? (colorHex + '33')
        : 'rgba(99, 102, 241, 0.22)';
      ctx.fill();
    }

    // 2. High-contrast dual dashed boundary
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.stroke();

    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 1.0;
    ctx.setLineDash([3, 6]);
    ctx.lineDashOffset = 3;
    ctx.stroke();

    // 3. Draw vertex points along polygon (highlighting sharp turns)
    ctx.setLineDash([]);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      ctx.beginPath();
      if (p.isCritical) {
        // Distinct anchor marker for sharp turns
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = colorHex;
        ctx.lineWidth = 1.5;
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Standard polygon vertex dot
        ctx.fillStyle = colorHex;
        ctx.arc(p.x, p.y, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Commits the closed polygon fill to the target layer.
   * Respects alphaLock, layer locks, opacity and current color/pattern.
   */
  finish(layer, colorHex, opacity = 1.0, selectionTool = null) {
    if (!this.active || this.polygonPoints.length < 3) {
      this.cancel();
      return null;
    }

    if (!layer || layer.locked) {
      this.cancel();
      return null;
    }

    const pts = this.polygonPoints;
    const ctx = layer.ctx;
    ctx.save();

    // Respect Layer Alpha Lock (source-atop restricts painting to existing pixels)
    ctx.globalCompositeOperation = layer.alphaLock ? 'source-atop' : 'source-over';
    ctx.globalAlpha = Math.max(0.01, Math.min(1.0, opacity));

    // Optional clipping to active Selection Tool marquee
    if (selectionTool && selectionTool.hasSelection && selectionTool.box) {
      const b = selectionTool.box;
      ctx.beginPath();
      ctx.rect(b.x, b.y, b.w, b.h);
      ctx.clip();
    }

    // Clip to closed lasso polygon
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();

    if (this.fillMode === 'pattern') {
      ctx.clip();

      const patCanvas = createPatternTileCanvas(this.pattern, colorHex, opacity);
      if (patCanvas) {
        const pat = ctx.createPattern(patCanvas, 'repeat');
        if (pat) {
          if (this.pattern.angle && typeof DOMMatrix !== 'undefined') {
            try {
              pat.setTransform(new DOMMatrix().rotate(this.pattern.angle));
            } catch (_) {}
          }
          ctx.fillStyle = pat;

          // Fill the polygon bounds
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          const pad = 40;
          ctx.fillRect(minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2);
        }
      }
    } else {
      // Solid Color Fill
      ctx.fillStyle = colorHex;
      ctx.fill();
    }

    ctx.restore();
    layer.updateThumbnail();

    const shapeRecord = {
      type: 'lasso-fill',
      points: pts.map(p => ({ x: p.x, y: p.y, isCritical: !!p.isCritical })),
      color: colorHex,
      opacity: opacity,
      fillMode: this.fillMode,
      pattern: this.fillMode === 'pattern' ? { ...this.pattern } : null
    };

    if (layer.addStroke) {
      layer.addStroke(shapeRecord);
    }

    this.cancel();
    return shapeRecord;
  }

  cancel() {
    this.active = false;
    this.rawPoints = [];
    this.polygonPoints = [];
    this.smoothedSpeed = 0;
  }
}
