/**
 * Vectura Layer Manager
 * Handles layer ordering, blend modes, clipping masks, folders, and composite caching.
 */
import { Layer } from './Layer.js';
import { getCanvasCompositeOp } from './BlendModes.js';

export class LayerManager {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.docWidth = docWidth;
    this.docHeight = docHeight;
    this.layers = [];
    this.activeLayerId = null;

    // Background configuration
    this.backgroundColor = '#ffffff'; // null for transparent, or hex string
    this.isTransparentBg = false;

    // Composite caches
    this.cacheBelow = document.createElement('canvas');
    this.cacheBelow.width = docWidth;
    this.cacheBelow.height = docHeight;
    this.cacheBelowCtx = this.cacheBelow.getContext('2d');

    this.cacheAbove = document.createElement('canvas');
    this.cacheAbove.width = docWidth;
    this.cacheAbove.height = docHeight;
    this.cacheAboveCtx = this.cacheAbove.getContext('2d');

    this.cachedComposite = document.createElement('canvas');
    this.cachedComposite.width = docWidth;
    this.cachedComposite.height = docHeight;
    this.cachedCompositeCtx = this.cachedComposite.getContext('2d');

    // Clipping group offscreen buffers
    this.clipGroupCanvas = document.createElement('canvas');
    this.clipGroupCanvas.width = docWidth;
    this.clipGroupCanvas.height = docHeight;
    this.clipGroupCtx = this.clipGroupCanvas.getContext('2d');

    this.singleClipCanvas = document.createElement('canvas');
    this.singleClipCanvas.width = docWidth;
    this.singleClipCanvas.height = docHeight;
    this.singleClipCtx = this.singleClipCanvas.getContext('2d');

    this.needsRecomposite = true;

    // Initialize default base layer
    this.createInitialLayer();
  }

  get activeLayerIndex() {
    const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
    return idx >= 0 ? idx : 0;
  }

  createInitialLayer() {
    const l1 = new Layer('layer_1', 'Layer 1', this.docWidth, this.docHeight, 'raster');
    this.layers = [l1];
    this.activeLayerId = l1.id;
    this.invalidateCaches();
  }

  resizeDocument(newW, newH) {
    this.docWidth = newW;
    this.docHeight = newH;
    for (const l of this.layers) {
      l.resize(newW, newH);
    }
    this.cacheBelow.width = newW;
    this.cacheBelow.height = newH;
    this.cacheAbove.width = newW;
    this.cacheAbove.height = newH;
    this.cachedComposite.width = newW;
    this.cachedComposite.height = newH;
    this.clipGroupCanvas.width = newW;
    this.clipGroupCanvas.height = newH;
    this.singleClipCanvas.width = newW;
    this.singleClipCanvas.height = newH;
    this.invalidateCaches();
  }

  getLayer(id) {
    return this.layers.find(l => l.id === id) || null;
  }

  getActiveLayer() {
    return this.layers.find(l => l.id === this.activeLayerId) || this.layers[0];
  }

  setActiveLayer(id) {
    if (this.layers.some(l => l.id === id)) {
      this.activeLayerId = id;
      this.updateAroundActiveCaches();
    }
  }

  /**
   * Deep or lightweight snapshot of layer manager state for undo/redo.
   * If includePixels is false, avoids heavy full-resolution canvas copying.
   */
  createSnapshot(includePixels = true) {
    return {
      activeLayerId: this.activeLayerId,
      backgroundColor: this.backgroundColor,
      isTransparentBg: this.isTransparentBg,
      isMetadataOnly: !includePixels,
      layers: this.layers.map(l => {
        let copyCanvas = null;
        if (includePixels) {
          copyCanvas = document.createElement('canvas');
          copyCanvas.width = l.width;
          copyCanvas.height = l.height;
          copyCanvas.getContext('2d').drawImage(l.canvas, 0, 0);
        }

        return {
          id: l.id,
          name: l.name,
          type: l.type,
          width: l.width,
          height: l.height,
          visible: l.visible,
          locked: l.locked,
          opacity: l.opacity,
          blendMode: l.blendMode,
          clippingMask: l.clippingMask,
          alphaLock: l.alphaLock,
          isReference: l.isReference,
          strokes: [...l.strokes],
          canvasClone: copyCanvas
        };
      })
    };
  }

  /**
   * Restores complete layer manager state from snapshot.
   */
  restoreSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.layers)) return;

    this.activeLayerId = snapshot.activeLayerId;
    this.backgroundColor = snapshot.backgroundColor;
    this.isTransparentBg = snapshot.isTransparentBg;

    const existingMap = new Map();
    for (const l of this.layers) {
      existingMap.set(l.id, l);
    }

    this.layers = snapshot.layers.map(s => {
      let layer = existingMap.get(s.id);
      if (layer && !s.canvasClone) {
        // Reuse existing layer instance and update metadata instantly
        layer.name = s.name;
        layer.visible = s.visible;
        layer.locked = s.locked;
        layer.opacity = s.opacity;
        layer.blendMode = s.blendMode;
        layer.clippingMask = s.clippingMask;
        layer.alphaLock = s.alphaLock;
        layer.isReference = s.isReference;
        return layer;
      }

      layer = new Layer(s.id, s.name, s.width, s.height, s.type);
      layer.visible = s.visible;
      layer.locked = s.locked;
      layer.opacity = s.opacity;
      layer.blendMode = s.blendMode;
      layer.clippingMask = s.clippingMask;
      layer.alphaLock = s.alphaLock;
      layer.isReference = s.isReference;
      layer.strokes = [...s.strokes];

      layer.ctx.clearRect(0, 0, layer.width, layer.height);
      if (s.canvasClone) {
        layer.ctx.drawImage(s.canvasClone, 0, 0);
      }
      layer.updateThumbnail();
      return layer;
    });

    this.invalidateCaches();
  }

  addLayer(name = 'New Layer', type = 'raster') {
    const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
    const newIdx = activeIdx >= 0 ? activeIdx + 1 : this.layers.length;
    const layer = new Layer(null, name, this.docWidth, this.docHeight, type);
    this.layers.splice(newIdx, 0, layer);
    this.activeLayerId = layer.id;
    this.invalidateCaches();
    return layer;
  }

  duplicateLayer(id) {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx < 0) return null;
    const orig = this.layers[idx];
    const copy = orig.clone(null, orig.name + ' Copy');
    this.layers.splice(idx + 1, 0, copy);
    this.activeLayerId = copy.id;
    this.invalidateCaches();
    return copy;
  }

  deleteLayer(id) {
    if (this.layers.length <= 1) return false; // Keep at least one layer
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx < 0) return false;
    const removed = this.layers.splice(idx, 1)[0];
    removed.release();
    this.activeLayerId = this.layers[Math.max(0, idx - 1)].id;
    this.invalidateCaches();
    return true;
  }

  clearLayer(id) {
    const l = this.layers.find(layer => layer.id === id);
    if (l) {
      l.clear();
      this.invalidateCaches();
    }
  }

  reorder(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.layers.length || toIndex < 0 || toIndex >= this.layers.length) return;
    const [moved] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, moved);
    this.invalidateCaches();
  }

  mergeDown(id) {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx <= 0) return false; // Bottom layer cannot merge down

    const upper = this.layers[idx];
    const lower = this.layers[idx - 1];

    // Combine strokes
    lower.strokes = lower.strokes.concat(upper.strokes);

    // Composite upper onto lower bitmap
    lower.ctx.save();
    lower.ctx.globalAlpha = upper.opacity;
    lower.ctx.globalCompositeOperation = getCanvasCompositeOp(upper.blendMode);
    lower.ctx.drawImage(upper.canvas, 0, 0);
    lower.ctx.restore();

    lower.updateThumbnail();
    this.layers.splice(idx, 1);
    upper.release();
    this.activeLayerId = lower.id;
    this.invalidateCaches();
    return true;
  }

  mergeVisible() {
    if (this.layers.length <= 1) return;
    const visibleLayers = this.layers.filter(l => l.visible);
    if (visibleLayers.length <= 1) return;

    const merged = new Layer('layer_merged', 'Merged', this.docWidth, this.docHeight, 'vector');
    this.compositeToCanvas(merged.ctx, false);
    merged.updateThumbnail();

    // Release all layers and replace with merged
    for (const l of this.layers) {
      l.release();
    }
    this.layers = [merged];
    this.activeLayerId = merged.id;
    this.invalidateCaches();
  }

  drawLayerToCtx(targetCtx, layer) {
    if (!layer || !layer.visible) return;
    targetCtx.save();
    targetCtx.globalAlpha = layer.opacity;
    targetCtx.globalCompositeOperation = getCanvasCompositeOp(layer.blendMode);
    targetCtx.drawImage(layer.canvas, 0, 0);
    targetCtx.restore();
  }

  invalidateCaches() {
    this.needsRecomposite = true;
    this.updateAroundActiveCaches();
  }

  /**
   * Updates cached below and above bitmaps relative to active layer.
   * This is key for 60fps drawing with many layers.
   */
  updateAroundActiveCaches() {
    const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
    if (activeIdx < 0) return;

    // 1. Build below cache
    this.cacheBelowCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    for (let i = 0; i < activeIdx; i++) {
      this.drawLayerToCtx(this.cacheBelowCtx, this.layers[i]);
    }

    // 2. Build above cache
    this.cacheAboveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    for (let i = activeIdx + 1; i < this.layers.length; i++) {
      this.drawLayerToCtx(this.cacheAboveCtx, this.layers[i]);
    }

    this.rebuildFullComposite();
  }

  /**
   * Renders the complete layer stack respecting clipping masks, alpha lock, and live stroke.
   */
  renderLayerStack(targetCtx, liveStrokeCanvas = null, liveOpacity = 1.0, liveBlendMode = 'source-over') {
    let i = 0;
    const n = this.layers.length;
    const active = this.getActiveLayer();

    while (i < n) {
      const layer = this.layers[i];
      if (!layer.visible) {
        i++;
        continue;
      }

      // Check if following layers are clipped to this layer
      let hasClipped = false;
      let j = i + 1;
      while (j < n && this.layers[j].clippingMask) {
        if (this.layers[j].visible) hasClipped = true;
        j++;
      }

      if (hasClipped) {
        // Render isolated clipping group
        this.clipGroupCtx.clearRect(0, 0, this.docWidth, this.docHeight);

        // 1. Draw base layer into group buffer
        this.clipGroupCtx.save();
        this.clipGroupCtx.globalAlpha = 1.0;
        this.clipGroupCtx.globalCompositeOperation = 'source-over';
        this.clipGroupCtx.drawImage(layer.canvas, 0, 0);

        if (layer === active && liveStrokeCanvas) {
          this.clipGroupCtx.save();
          this.clipGroupCtx.globalAlpha = liveOpacity;
          this.clipGroupCtx.globalCompositeOperation = layer.alphaLock ? 'source-atop' : getCanvasCompositeOp(liveBlendMode);
          this.clipGroupCtx.drawImage(liveStrokeCanvas, 0, 0);
          this.clipGroupCtx.restore();
        }
        this.clipGroupCtx.restore();

        // 2. Draw each clipped layer above it respecting its own blend mode
        for (let k = i + 1; k < j; k++) {
          const clipL = this.layers[k];
          if (!clipL.visible) continue;

          // Render clipL into isolated singleClip buffer
          this.singleClipCtx.clearRect(0, 0, this.docWidth, this.docHeight);
          this.singleClipCtx.save();
          this.singleClipCtx.globalAlpha = clipL.opacity;
          this.singleClipCtx.globalCompositeOperation = 'source-over';
          this.singleClipCtx.drawImage(clipL.canvas, 0, 0);

          if (clipL === active && liveStrokeCanvas) {
            this.singleClipCtx.save();
            this.singleClipCtx.globalAlpha = liveOpacity;
            this.singleClipCtx.globalCompositeOperation = clipL.alphaLock ? 'source-atop' : getCanvasCompositeOp(liveBlendMode);
            this.singleClipCtx.drawImage(liveStrokeCanvas, 0, 0);
            this.singleClipCtx.restore();
          }
          this.singleClipCtx.restore();

          // Mask clipL to base layer's alpha shape
          this.singleClipCtx.save();
          this.singleClipCtx.globalCompositeOperation = 'destination-in';
          this.singleClipCtx.globalAlpha = 1.0;
          this.singleClipCtx.drawImage(layer.canvas, 0, 0);
          this.singleClipCtx.restore();

          // Composite masked clipL into group with its OWN blend mode
          this.clipGroupCtx.save();
          this.clipGroupCtx.globalCompositeOperation = getCanvasCompositeOp(clipL.blendMode);
          this.clipGroupCtx.globalAlpha = 1.0;
          this.clipGroupCtx.drawImage(this.singleClipCanvas, 0, 0);
          this.clipGroupCtx.restore();
        }

        // 3. Draw merged clipping group onto targetCtx
        targetCtx.save();
        targetCtx.globalAlpha = layer.opacity;
        targetCtx.globalCompositeOperation = getCanvasCompositeOp(layer.blendMode);
        targetCtx.drawImage(this.clipGroupCanvas, 0, 0);
        targetCtx.restore();

        i = j;
      } else {
        // Normal unclipped layer
        targetCtx.save();
        targetCtx.globalAlpha = layer.opacity;
        targetCtx.globalCompositeOperation = getCanvasCompositeOp(layer.blendMode);
        targetCtx.drawImage(layer.canvas, 0, 0);

        if (layer === active && liveStrokeCanvas) {
          targetCtx.save();
          targetCtx.globalAlpha = liveOpacity;
          targetCtx.globalCompositeOperation = layer.alphaLock ? 'source-atop' : getCanvasCompositeOp(liveBlendMode);
          targetCtx.drawImage(liveStrokeCanvas, 0, 0);
          targetCtx.restore();
        }

        targetCtx.restore();
        i++;
      }
    }
  }

  /**
   * Composites the entire document onto targetCtx.
   */
  compositeStack(targetCtx, liveStrokeCanvas = null, liveOpacity = 1.0, liveBlendMode = 'source-over') {
    if (!liveStrokeCanvas) {
      if (this.needsRecomposite) {
        this.rebuildFullComposite();
      }
      targetCtx.drawImage(this.cachedComposite, 0, 0);
      return;
    }

    // 1. Background
    if (!this.isTransparentBg && this.backgroundColor) {
      targetCtx.fillStyle = this.backgroundColor;
      targetCtx.fillRect(0, 0, this.docWidth, this.docHeight);
    } else {
      targetCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    }

    // 2. Render layer stack with live stroke and clipping masks
    this.renderLayerStack(targetCtx, liveStrokeCanvas, liveOpacity, liveBlendMode);
  }

  rebuildFullComposite() {
    this.cachedCompositeCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    if (!this.isTransparentBg && this.backgroundColor) {
      this.cachedCompositeCtx.fillStyle = this.backgroundColor;
      this.cachedCompositeCtx.fillRect(0, 0, this.docWidth, this.docHeight);
    }
    this.renderLayerStack(this.cachedCompositeCtx, null);
    this.needsRecomposite = false;
  }

  /**
   * Full composite export without live buffer.
   */
  compositeToCanvas(targetCtx, includeBackground = true) {
    if (includeBackground && !this.isTransparentBg && this.backgroundColor) {
      targetCtx.fillStyle = this.backgroundColor;
      targetCtx.fillRect(0, 0, this.docWidth, this.docHeight);
    } else {
      targetCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    }

    this.renderLayerStack(targetCtx, null);
  }

  getReferenceLayer() {
    return this.layers.find(l => l.isReference) || this.getActiveLayer();
  }
}
