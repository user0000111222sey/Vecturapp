/**
 * Vectura History Manager
 * Command-based undo/redo queue supporting 200+ steps with low memory footprint.
 * Guarantees:
 * - Active strokes are safely cancelled before undo/redo
 * - Full multi-layer and raster command coverage
 * - Automated debug checks to verify canvas pixel equality after undo + redo
 */
import { areCanvasesIdentical } from './Command.js';

export class HistoryManager {
  constructor(maxSteps = 200) {
    this.maxSteps = maxSteps;
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = [];
    this.cancelStrokeFn = null;
    this.layerManager = null;
    this.debugCheckEnabled = true;
  }

  setCancelStrokeHandler(fn) {
    this.cancelStrokeFn = fn;
  }

  setLayerManager(lm) {
    this.layerManager = lm;
  }

  onChange(listener) {
    this.listeners.push(listener);
  }

  notify() {
    for (const cb of this.listeners) {
      cb({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoCount: this.undoStack.length,
        redoCount: this.redoStack.length,
        undoStack: this.undoStack.map(c => c.name),
        redoStack: this.redoStack.map(c => c.name)
      });
    }
  }

  push(command) {
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
    this.notify();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Undo/redo must be safe during an active stroke (cancel the stroke first).
   */
  undo() {
    if (this.cancelStrokeFn) {
      this.cancelStrokeFn();
    }
    if (!this.canUndo()) return false;

    const cmd = this.undoStack.pop();
    cmd.undo(this.layerManager);
    this.redoStack.push(cmd);
    this.notify();
    return true;
  }

  redo() {
    if (this.cancelStrokeFn) {
      this.cancelStrokeFn();
    }
    if (!this.canRedo()) return false;

    const cmd = this.redoStack.pop();
    cmd.execute(this.layerManager);
    this.undoStack.push(cmd);
    this.notify();
    return true;
  }

  /**
   * Debug check: after undo then redo of every action type, the canvas must be identical.
   * Compares the layer's canvas before and after undo+redo.
   */
  debugVerifyCurrentAction(targetCanvas) {
    if (!this.debugCheckEnabled || !targetCanvas) return true;
    if (!this.canUndo()) return true;

    // 1. Snapshot current canvas
    const currentClone = document.createElement('canvas');
    currentClone.width = targetCanvas.width;
    currentClone.height = targetCanvas.height;
    currentClone.getContext('2d').drawImage(targetCanvas, 0, 0);

    // 2. Perform Undo
    this.undo();

    // 3. Perform Redo
    this.redo();

    // 4. Compare pixels
    const identical = areCanvasesIdentical(currentClone, targetCanvas);
    if (!identical) {
      console.warn('[HistoryManager] Debug check warning: canvas pixels differ after undo->redo!');
    } else {
      console.log('[HistoryManager] Debug check passed: canvas is 100% identical after undo->redo.');
    }
    return identical;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}
