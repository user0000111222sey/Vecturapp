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
    this.buildUp = data.buildUp ?? (data.id?.includes('airbrush') || false);

    // 2D Noise Settings
    this.noiseScale = data.noiseScale ?? 20;
    this.noiseIntensity = data.noiseIntensity ?? 50;
    this.noiseSeed = data.noiseSeed ?? 1337;
    this.noiseOctaves = data.noiseOctaves ?? 3;

    // Factor & Child Dynamic System
    // Factors (Inputs): velocity, jitter, noise
    // Children (Outputs): size, rotation, spacing, opacity, tipRotation
    const fl = data.factorLinks || {};
    this.factorLinks = {
      velocity: {
        size: fl.velocity?.size ?? (data.velocityDynamics?.factor ?? 0),
        opacity: fl.velocity?.opacity ?? 0,
        rotation: fl.velocity?.rotation ?? 0,
        spacing: fl.velocity?.spacing ?? 0,
        tipRotation: fl.velocity?.tipRotation ?? 0
      },
      jitter: {
        size: fl.jitter?.size ?? (data.jitter?.size ?? 0),
        opacity: fl.jitter?.opacity ?? 0,
        rotation: fl.jitter?.rotation ?? 0,
        spacing: fl.jitter?.spacing ?? 0,
        tipRotation: fl.jitter?.tipRotation ?? 0
      },
      noise: {
        size: fl.noise?.size ?? 0,
        opacity: fl.noise?.opacity ?? 0,
        rotation: fl.noise?.rotation ?? 0,
        spacing: fl.noise?.spacing ?? 0,
        tipRotation: fl.noise?.tipRotation ?? 0
      }
    };

    // 2. Spacing Settings
    const sp = data.spacingSettings || {};
    this.spacingSettings = {
      spacing: sp.spacing ?? data.spacing ?? 0.08,    // 0.01 to 2.0 (1% to 200%)
      minSpacingPx: sp.minSpacingPx ?? 1.0,           // minimum spacing in pixels
      spacingJitter: sp.spacingJitter ?? 0,           // 0 to 100%
      speedFactor: sp.speedFactor ?? 0,               // -100 to +100 linked to speed
      autoSpacing: sp.autoSpacing ?? false,           // adaptively maintain smoothness
      pixelArtMode: sp.pixelArtMode ?? false          // fixed exact pixel steps
    };
    this.spacing = this.spacingSettings.spacing;
    this.scatter = data.scatter ?? 0.0;

    // 3. Velocity Dynamics Group (-100 to +100 factor)
    const vd = data.velocityDynamics || {};
    this.velocityDynamics = {
      factor: vd.factor ?? 0,                                 // Integer -100 to +100 (0 = neutral)
      minSpeed: vd.minSpeed ?? 0.0,                           // px/ms
      maxSpeed: vd.maxSpeed ?? 3.0,                           // px/ms
      curve: vd.curve ? [...vd.curve] : [0.25, 0.1, 0.25, 1.0], // draggable cubic bezier
      smoothing: vd.smoothing ?? 0.35,                        // EMA smoothing factor
      minOutput: vd.minOutput ?? 0.1,                         // minimum output
      maxOutput: vd.maxOutput ?? 1.0                          // maximum output
    };

    // Velocity Targets Modulation
    const vt = data.velocityTargets || {};
    this.velocityTargets = {
      size: { enabled: vt.size?.enabled ?? true, factor: vt.size?.factor ?? 1.0, useCurve: vt.size?.useCurve ?? true },
      opacity: { enabled: vt.opacity?.enabled ?? true, factor: vt.opacity?.factor ?? 1.0, useCurve: vt.opacity?.useCurve ?? true },
      flow: { enabled: vt.flow?.enabled ?? false, factor: vt.flow?.factor ?? 1.0, useCurve: vt.flow?.useCurve ?? false },
      spacing: { enabled: vt.spacing?.enabled ?? false, factor: vt.spacing?.factor ?? 1.0, useCurve: vt.spacing?.useCurve ?? false },
      scatter: { enabled: vt.scatter?.enabled ?? false, factor: vt.scatter?.factor ?? 1.0, useCurve: vt.scatter?.useCurve ?? false },
      angle: { enabled: vt.angle?.enabled ?? false, factor: vt.angle?.factor ?? 1.0, useCurve: vt.angle?.useCurve ?? false },
      jitter: { enabled: vt.jitter?.enabled ?? false, factor: vt.jitter?.factor ?? 1.0, useCurve: vt.jitter?.useCurve ?? false },
      taper: { enabled: vt.taper?.enabled ?? false, factor: vt.taper?.factor ?? 1.0, useCurve: vt.taper?.useCurve ?? false }
    };

    // 4. Smooth Coherent Jitter
    const jt = data.jitter || {};
    this.jitter = {
      enabled: jt.enabled ?? false,
      amplitude: jt.amplitude ?? 1.0,                 // 0 to 200
      frequency: jt.frequency ?? 0.05,                // 0.01 to 10.0
      octaves: jt.octaves ?? 3,                       // 1 to 8
      persistence: jt.persistence ?? 0.5,             // 0.1 to 1.0
      lacunarity: jt.lacunarity ?? 2.0,               // 1.5 to 4.0
      seed: jt.seed ?? 1337,                          // PRNG seed
      noiseType: jt.noiseType || 'sines',             // 'sines' | 'perlin' | 'keyframes'
      basis: jt.basis || 'distance',                  // 'distance' | 'time'
      phaseOffset: jt.phaseOffset ?? 0,               // 0 to 360 deg
      fadeIn: jt.fadeIn ?? 0,                         // px
      fadeOut: jt.fadeOut ?? 0,                       // px
      velocityLink: jt.velocityLink ?? 0,             // -100 to +100
      targets: {
        size: jt.targets?.size ?? 30,                 // 0 to 100%
        opacity: jt.targets?.opacity ?? 0,            // 0 to 100%
        flow: jt.targets?.flow ?? 0,
        angle: jt.targets?.angle ?? 0,
        positionWobble: jt.targets?.positionWobble ?? 0,
        hue: jt.targets?.hue ?? 0,
        saturation: jt.targets?.saturation ?? 0,
        brightness: jt.targets?.brightness ?? 0,
        spacing: jt.targets?.spacing ?? 0
      }
    };

    // 5. Texture & Wet Edge
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
      velocityDynamics: this.velocityDynamics,
      velocityTargets: this.velocityTargets,
      jitter: this.jitter,
      grain: this.grain,
      wetEdge: this.wetEdge,
      glowWidth: this.glowWidth,
      colorDynamics: this.colorDynamics,
      taperStart: this.taperStart,
      taperEnd: this.taperEnd,
      blendMode: this.blendMode,
      stabilizer: this.stabilizer,
      factorLinks: this.factorLinks,
      buildUp: this.buildUp,
      isEraser: this.isEraser,
      isPixel: this.isPixel
    }));
  }
}
