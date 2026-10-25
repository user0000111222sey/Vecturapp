/**
 * Vectura History Manager
 * Memory-budgeted undo/redo queue (~100MB budget) storing bounding-box snapshots.
 */
export class HistoryManager {
  constructor(maxMemoryMB = 100) {
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024; // 100 MB budget
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = [];
    this.cancelStrokeFn = null;
    this.layerManager = null;
    this.debugCheckEnabled = false;
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

  getCommandBytes(cmd) {
    if (!cmd) return 0;
    let size = 1024;
    if (cmd.beforeSnapshot?.byteSize) size += cmd.beforeSnapshot.byteSize;
    if (cmd.afterSnapshot?.byteSize) size += cmd.afterSnapshot.byteSize;
    return size;
  }

  getTotalMemory() {
    let total = 0;
    for (const cmd of this.undoStack) total += this.getCommandBytes(cmd);
    for (const cmd of this.redoStack) total += this.getCommandBytes(cmd);
    return total;
  }

  notify() {
    for (const cb of this.listeners) {
      cb({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoCount: this.undoStack.length,
        redoCount: this.redoStack.length,
        undoStack: this.undoStack.map(c => c.name),
        redoStack: this.redoStack.map(c => c.name),
        memoryMB: (this.getTotalMemory() / (1024 * 1024)).toFixed(1)
      });
    }
  }

  push(command) {
    this.undoStack.push(command);

    // Evict oldest commands when exceeding 100MB budget
    while (this.undoStack.length > 1 && this.getTotalMemory() > this.maxMemoryBytes) {
      const dropped = this.undoStack.shift();
      dropped?.release?.();
    }

    // Clear redo stack on new action
    while (this.redoStack.length > 0) {
      const r = this.redoStack.pop();
      r?.release?.();
    }

    this.notify();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

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

  clear() {
    for (const cmd of this.undoStack) cmd?.release?.();
    for (const cmd of this.redoStack) cmd?.release?.();
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  debugVerifyCurrentAction() {
    return true;
  }
}
