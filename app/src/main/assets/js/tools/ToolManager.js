/**
 * Vectura Tool Manager
 * Routes interactions between active tools and the raster canvas engine.
 */
import { FillBucket } from './FillBucket.js';
import { LassoFill } from './LassoFill.js';
import { SelectionTool } from './SelectionTool.js';
import { TransformTool } from './TransformTool.js';
import { VectorPointEditor } from './VectorPointEditor.js';
import { ShapeTool } from './ShapeTool.js';
import { GradientTool } from './GradientTool.js';
import { TextTool } from './TextTool.js';
import { RulerGuides } from './RulerGuides.js';
import { Eyedropper } from './Eyedropper.js';
import { SymmetryManager } from './SymmetryManager.js';

export class ToolManager {
  constructor(docWidth, docHeight) {
    this.activeTool = 'brush'; // 'brush' | 'eraser' | 'bucket' | 'lasso-fill' | 'shape' | 'gradient' | 'text' | 'eyedropper'

    this.fillBucket = new FillBucket();
    this.lassoFill = new LassoFill();
    this.selectionTool = new SelectionTool(docWidth, docHeight);
    this.transformTool = new TransformTool();
    this.vectorPointEditor = new VectorPointEditor();
    this.shapeTool = new ShapeTool();
    this.gradientTool = new GradientTool();
    this.textTool = new TextTool();
    this.rulerGuides = new RulerGuides(docWidth, docHeight);
    this.eyedropper = new Eyedropper();
    this.symmetry = new SymmetryManager(docWidth, docHeight);
  }

  setTool(toolName, layer = null) {
    // Selection and transform removed for raster stability
    if (toolName === 'selection' || toolName === 'transform' || toolName === 'point-editor') {
      toolName = 'brush';
    }

    if (this.activeTool === 'transform' && toolName !== 'transform') {
      this.transformTool.cancel();
    }
    if (this.activeTool === 'point-editor' && toolName !== 'point-editor') {
      this.vectorPointEditor.deactivate();
    }

    this.activeTool = toolName;
  }

  resizeDocument(w, h) {
    this.selectionTool.resize(w, h);
    this.symmetry.setPivot(w / 2, h / 2);
  }
}
