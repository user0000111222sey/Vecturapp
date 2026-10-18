/**
 * Vectura History Manager
 * Command-based undo/redo queue supporting 200+ steps with low memory footprint.
 */
export class HistoryManager {
  constructor(maxSteps = 200) {
    this.maxSteps = maxSteps;
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = [];
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

  undo() {
    if (!this.canUndo()) return false;
    const cmd = this.undoStack.pop();
    cmd.undo();
    this.redoStack.push(cmd);
    this.notify();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    const cmd = this.redoStack.pop();
    cmd.execute();
    this.undoStack.push(cmd);
    this.notify();
    return true;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}
