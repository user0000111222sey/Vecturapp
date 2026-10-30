/**
 * Vectura Brush Model
 * The brush is driven ONLY by finger velocity.
 * Complete parameter schema supporting:
 * - Velocity dynamics with factor -100 to +100
 * - Powerful smooth jitter (wide ranges, multi-target, envelope, velocity link)
 * - Advanced spacing (min px, jitter, speed factor, auto-spacing, pixel art)
 * - Taper, texture, color, blend, stabilizer
 */
import { DEFAULT_BRUSH_PRESETS } from './BrushPresets.js';

export class Brush {
  constructor(presetData) {
    this.assign(presetData || DEFAULT_BRUSH_PRESETS[0]);
  }

  assign(data) {
    this.id = data.id || 'custom_brush';
    this.name = data.name || 'Custom Brush';
    this.category = data.category || 'ink';

    // 1. Shape & Core Dimensions
    this.size = data.size ?? 12;
    this.minSize = data.minSize ?? 1;
    this.maxSize = data.maxSize ?? 200;
    this.opacity = data.opacity ?? 1.0;
    this.flow = data.flow ?? 1.0;
    this.hardness = data.hardness ?? 1.0;
    this.roundness = data.roundness ?? 1.0;
    this.aspectRatio = data.aspectRatio ?? 1.0;
    this.rotation = data.rotation ?? 0.0;
    this.tipShape = data.tipShape || 'round'; // 'round' | 'square' | 'chisel' | 'calligraphy' | 'soft' | 'star' | 'bristle'
    // 2D Noise Settings
    this.noiseScale = data.noiseScale ?? 20;
    this.noiseIntensity = data.noiseIntensity ?? 50;
    this.noiseSeed = data.noiseSeed ?? 1337;
    this.noiseOctaves = data.noiseOctaves ?? 3;

    // ONE Clean Dynamics System:
    // Sources: pressure, velocity, jitter, noise
    // Targets: size, opacity, rotation, spacing, scatter (-100 to +100)
    const d = data.dynamics || {};
    const fl = data.factorLinks || {};
    const vd = data.velocityDynamics || {};
    const jt = data.jitter || {};

    this.dynamics = {
      pressure: {
        size: d.pressure?.size ?? 50,
        opacity: d.pressure?.opacity ?? 0,
        rotation: d.pressure?.rotation ?? 0,
        spacing: d.pressure?.spacing ?? 0,
        scatter: d.pressure?.scatter ?? 0
      },
      velocity: {
        size: d.velocity?.size ?? fl.velocity?.size ?? (vd.factor ?? 0),
        opacity: d.velocity?.opacity ?? fl.velocity?.opacity ?? 0,
        rotation: d.velocity?.rotation ?? fl.velocity?.rotation ?? fl.velocity?.tipRotation ?? 0,
        spacing: d.velocity?.spacing ?? fl.velocity?.spacing ?? 0,
        scatter: d.velocity?.scatter ?? 0
      },
      jitter: {
        size: d.jitter?.size ?? fl.jitter?.size ?? (jt.enabled ? (jt.targets?.size ?? 0) : 0),
        opacity: d.jitter?.opacity ?? fl.jitter?.opacity ?? (jt.enabled ? (jt.targets?.opacity ?? 0) : 0),
        rotation: d.jitter?.rotation ?? fl.jitter?.rotation ?? fl.jitter?.tipRotation ?? 0,
        spacing: d.jitter?.spacing ?? fl.jitter?.spacing ?? 0,
        scatter: d.jitter?.scatter ?? (jt.enabled ? (jt.targets?.positionWobble ?? 0) : 0)
      },
      noise: {
        size: d.noise?.size ?? fl.noise?.size ?? 0,
        opacity: d.noise?.opacity ?? fl.noise?.opacity ?? 0,
        rotation: d.noise?.rotation ?? fl.noise?.rotation ?? fl.noise?.tipRotation ?? 0,
        spacing: d.noise?.spacing ?? fl.noise?.spacing ?? 0,
        scatter: d.noise?.scatter ?? 0
      }
    };

    // 2. Spacing Settings
    const sp = data.spacingSettings || {};
    this.spacingSettings = {
      spacing: sp.spacing ?? data.spacing ?? 0.08,    // 0.01 to 2.0 (1% to 200%)
      minSpacingPx: sp.minSpacingPx ?? 1.0,           // minimum spacing in pixels
      autoSpacing: sp.autoSpacing ?? false,           // adaptively maintain smoothness
      pixelArtMode: sp.pixelArtMode ?? false          // fixed exact pixel steps
    };
    this.spacing = this.spacingSettings.spacing;
    this.scatter = data.scatter ?? 0.0;

    // 5. Texture & Wet Edge & Quality
    this.grain = data.grain ?? 0.0;
    this.wetEdge = data.wetEdge ?? 0.0;
    this.glowWidth = data.glowWidth ?? 0.0;

    // 6. Color Dynamics
    this.colorDynamics = data.colorDynamics || {
      hueJitter: 0,
      satJitter: 0,
      brightJitter: 0
    };

    // 7. Taper
    this.taperStart = data.taperStart ?? 0;
    this.taperEnd = data.taperEnd ?? 0;

    // 8. Blend / Flow
    this.blendMode = data.blendMode || 'source-over';

    // 9. Stabilizer
    this.stabilizer = data.stabilizer ?? 30;

    // 10. Advanced Flags
    this.isEraser = !!data.isEraser;
    this.isPixel = !!data.isPixel || !!this.spacingSettings.pixelArtMode;

    this._stampCache = null;
    this._stampCacheKey = '';
  }

  // Backward compatibility alias for factorLinks
  get factorLinks() {
    return this.dynamics;
  }
  set factorLinks(val) {
    if (val) this.dynamics = val;
  }

  createSnapshot() {
    return JSON.parse(JSON.stringify({
      id: this.id,
      name: this.name,
      category: this.category,
      size: this.size,
      minSize: this.minSize,
      maxSize: this.maxSize,
      opacity: this.opacity,
      flow: this.flow,
      hardness: this.hardness,
      roundness: this.roundness,
      aspectRatio: this.aspectRatio,
      rotation: this.rotation,
      tipShape: this.tipShape,
      spacingSettings: this.spacingSettings,
      spacing: this.spacingSettings.spacing,
      scatter: this.scatter,
      dynamics: this.dynamics,
      noiseScale: this.noiseScale,
      noiseIntensity: this.noiseIntensity,
      noiseSeed: this.noiseSeed,
      noiseOctaves: this.noiseOctaves,
      grain: this.grain,
      wetEdge: this.wetEdge,
      glowWidth: this.glowWidth,
      colorDynamics: this.colorDynamics,
      taperStart: this.taperStart,
      taperEnd: this.taperEnd,
      blendMode: this.blendMode,
      stabilizer: this.stabilizer,
      isEraser: this.isEraser,
      isPixel: this.isPixel
    }));
  }
}
