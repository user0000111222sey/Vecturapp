/**
 * Vectura Vector Engine - Centripetal Catmull-Rom Splines & Geometry
 * Centripetal parameterization (alpha = 0.5) avoids cusps and self-intersections.
 */
export class CatmullRomSpline {
  constructor(alpha = 0.5) {
    this.alpha = alpha; // 0.5 = centripetal, 0.0 = uniform, 1.0 = chordal
  }

  /**
   * Evaluates a segment between P1 and P2 using four points P0, P1, P2, P3.
   * Returns an array of interpolated sample points with {x, y, pressure, time, distance}.
   */
  interpolateSegment(p0, p1, p2, p3, adaptiveSteps = 8) {
    const getT = (tPrev, pA, pB) => {
      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const dist = Math.hypot(dx, dy);
      return tPrev + Math.pow(Math.max(dist, 1e-4), this.alpha);
    };

    const t0 = 0;
    const t1 = getT(t0, p0, p1);
    const t2 = getT(t1, p1, p2);
    const t3 = getT(t2, p2, p3);

    // Segment length estimate
    const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(2, Math.min(64, Math.ceil(chord / 3) * adaptiveSteps / 8));

    const samples = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = t1 + u * (t2 - t1);

      // Catmull-Rom centripetal formulation
      const a1_x = (t1 - t) / (t1 - t0) * p0.x + (t - t0) / (t1 - t0) * p1.x;
      const a1_y = (t1 - t) / (t1 - t0) * p0.y + (t - t0) / (t1 - t0) * p1.y;
      const a2_x = (t2 - t) / (t2 - t1) * p1.x + (t - t1) / (t2 - t1) * p2.x;
      const a2_y = (t2 - t) / (t2 - t1) * p1.y + (t - t1) / (t2 - t1) * p2.y;
      const a3_x = (t3 - t) / (t3 - t2) * p2.x + (t - t2) / (t3 - t2) * p3.x;
      const a3_y = (t3 - t) / (t3 - t2) * p2.y + (t - t2) / (t3 - t2) * p3.y;

      const b1_x = (t2 - t) / (t2 - t0) * a1_x + (t - t0) / (t2 - t0) * a2_x;
      const b1_y = (t2 - t) / (t2 - t0) * a1_y + (t - t0) / (t2 - t0) * a2_y;
      const b2_x = (t3 - t) / (t3 - t1) * a2_x + (t - t1) / (t3 - t1) * a3_x;
      const b2_y = (t3 - t) / (t3 - t1) * a2_y + (t - t1) / (t3 - t1) * a3_y;

      const c_x = (t2 - t) / (t2 - t1) * b1_x + (t - t1) / (t2 - t1) * b2_x;
      const c_y = (t2 - t) / (t2 - t1) * b1_y + (t - t1) / (t2 - t1) * b2_y;

      // Linear interpolation of pressure and time
      const pressure = p1.pressure + u * (p2.pressure - p1.pressure);
      const time = p1.time + u * (p2.time - p1.time);

      samples.push({
        x: c_x,
        y: c_y,
        pressure: Math.max(0.01, Math.min(1.0, pressure)),
        time: time
      });
    }

    return samples;
  }

  /**
   * Generates smooth dense polyline samples strictly spaced by stepPx arc-length distance.
   * Completely eliminates stamp piling and unpredictable opacity clustering.
   */
  sampleStroke(controlPoints, stepPx = 4) {
    if (!controlPoints || controlPoints.length === 0) return [];
    if (controlPoints.length === 1) {
      const p = controlPoints[0];
      return [{ x: p.x, y: p.y, pressure: p.pressure || 0.5, time: p.time || 0, distance: 0 }];
    }

    // 1. Generate dense polyline along spline
    const dense = [];
    const n = controlPoints.length;
    let totalDist = 0;

    for (let i = 0; i < n - 1; i++) {
      const p0 = i === 0 ? controlPoints[0] : controlPoints[i - 1];
      const p1 = controlPoints[i];
      const p2 = controlPoints[i + 1];
      const p3 = i + 2 < n ? controlPoints[i + 2] : p2;

      const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const dt = Math.max(1, (p2.time || 0) - (p1.time || 0));
      const segSpeed = segDist / dt; // real px/ms speed

      const subSteps = Math.max(2, Math.min(16, Math.ceil(segDist / 2)));
      const seg = this.interpolateSegment(p0, p1, p2, p3, subSteps);
      const startIdx = i === 0 ? 0 : 1;
      for (let j = startIdx; j < seg.length; j++) {
        const pt = seg[j];
        if (dense.length > 0) {
          const prev = dense[dense.length - 1];
          totalDist += Math.hypot(pt.x - prev.x, pt.y - prev.y);
        }
        pt.distance = totalDist;
        pt.speed = segSpeed;
        dense.push(pt);
      }
    }

    if (dense.length <= 1) return dense;

    // 2. Uniform or Variable Arc-Length Resampling strictly by step distance
    const initialStep = (typeof stepPx === 'function') ? Math.max(0.5, stepPx(dense[0])) : Math.max(0.5, stepPx || 4);
    const samples = [dense[0]];
    let nextDist = initialStep;
    let dIdx = 0;

    while (nextDist <= totalDist && dIdx < dense.length - 1) {
      while (dIdx < dense.length - 1 && dense[dIdx + 1].distance < nextDist) {
        dIdx++;
      }
      if (dIdx >= dense.length - 1) break;

      const pA = dense[dIdx];
      const pB = dense[dIdx + 1];
      const span = pB.distance - pA.distance;
      const u = span > 0.0001 ? (nextDist - pA.distance) / span : 0;

      const interpolatedSample = {
        x: pA.x + u * (pB.x - pA.x),
        y: pA.y + u * (pB.y - pA.y),
        pressure: pA.pressure + u * (pB.pressure - pA.pressure),
        time: pA.time + u * (pB.time - pA.time),
        speed: (pA.speed || 0) + u * ((pB.speed || 0) - (pA.speed || 0)),
        distance: nextDist
      };
      samples.push(interpolatedSample);

      const dynamicStep = (typeof stepPx === 'function')
        ? Math.max(0.5, stepPx(interpolatedSample))
        : Math.max(0.5, stepPx || 4);

      nextDist += dynamicStep;
    }

    const lastDense = dense[dense.length - 1];
    const finalStep = (typeof stepPx === 'function') ? Math.max(0.5, stepPx(lastDense)) : Math.max(0.5, stepPx || 4);
    if (samples.length === 1 || Math.hypot(lastDense.x - samples[samples.length - 1].x, lastDense.y - samples[samples.length - 1].y) > finalStep * 0.4) {
      samples.push(lastDense);
    }

    return samples;
  }
}

/**
 * Pixel-perfect line algorithm with L-corner removal for Pixel Art mode.
 */
export function bresenhamPixelPerfect(x0, y0, x1, y1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  const points = [];
  let currX = x0;
  let currY = y0;

  while (true) {
    points.push({ x: currX, y: currY });
    if (currX === x1 && currY === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      currX += sx;
    }
    if (e2 < dx) {
      err += dx;
      currY += sy;
    }
  }

  // Remove duplicate diagonal L-corners for clean pixel art stroke
  if (points.length < 3) return points;
  const filtered = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    // If step is a right-angle corner between prev and next
    if (
      (prev.x === curr.x && curr.y === next.y) ||
      (prev.y === curr.y && curr.x === next.x)
    ) {
      // Check if diagonal exists
      if (Math.abs(next.x - prev.x) === 1 && Math.abs(next.y - prev.y) === 1) {
        continue; // skip the extra corner pixel
      }
    }
    filtered.push(curr);
  }
  filtered.push(points[points.length - 1]);
  return filtered;
}

/**
 * Ramer-Douglas-Peucker curve simplification algorithm for vector optimization.
 */
export function simplifyPoints(points, epsilon = 1.0) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const pStart = points[0];
  const pEnd = points[points.length - 1];

  const lineDist = (p, a, b) => {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
    const projX = a.x + t * (b.x - a.x);
    const projY = a.y + t * (b.y - a.y);
    return Math.hypot(p.x - projX, p.y - projY);
  };

  for (let i = 1; i < points.length - 1; i++) {
    const d = lineDist(points[i], pStart, pEnd);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPoints(points.slice(0, index + 1), epsilon);
    const right = simplifyPoints(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [pStart, pEnd];
  }
}
