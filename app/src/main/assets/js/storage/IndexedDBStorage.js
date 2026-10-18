/**
 * Vectura IndexedDB Storage & Autosave Engine
 * Robust offline persistence for vector artwork, layers, metadata, and crash recovery.
 */
export class IndexedDBStorage {
  constructor(dbName = 'VecturaDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('autosave')) {
          db.createObjectStore('autosave', { keyPath: 'id' });
        }
      };

      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  async saveProject(projectData) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.put(projectData);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getProject(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllProjects() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteProject(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async saveAutosave(data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('autosave', 'readwrite');
      const store = tx.objectStore('autosave');
      const req = store.put({ id: 'current_autosave', ...data, timestamp: Date.now() });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getAutosave() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('autosave', 'readonly');
      const store = tx.objectStore('autosave');
      const req = store.get('current_autosave');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
}
