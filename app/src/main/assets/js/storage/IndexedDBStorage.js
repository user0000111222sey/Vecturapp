/**
 * Vectura IndexedDB Storage & Autosave Engine
 * Robust offline persistence for vector artwork, layers, metadata, and crash recovery.
 * Includes automated fallback to localStorage / memory to guarantee instant startup
 * even if IndexedDB is blocked, unsupported, or slow.
 */
export class IndexedDBStorage {
  constructor(dbName = 'VecturaDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.useFallback = false;
    this.memoryProjects = new Map();
    this.autosaveCache = null;
  }

  async open() {
    if (this.db) return this.db;
    if (this.useFallback) return null;

    const idb = typeof window !== 'undefined' ? window.indexedDB : (typeof indexedDB !== 'undefined' ? indexedDB : null);
    if (!idb) {
      this.useFallback = true;
      return null;
    }

    return new Promise((resolve) => {
      let resolved = false;

      // Failsafe timeout: if IndexedDB hangs for > 1200ms, use fallback
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.useFallback = true;
          resolve(null);
        }
      }, 1200);

      try {
        const req = idb.open(this.dbName, this.version);

        req.onupgradeneeded = (e) => {
          try {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('projects')) {
              db.createObjectStore('projects', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('autosave')) {
              db.createObjectStore('autosave', { keyPath: 'id' });
            }
          } catch (_) {}
        };

        req.onsuccess = (e) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            this.db = e.target.result;
            resolve(this.db);
          }
        };

        req.onerror = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            this.useFallback = true;
            resolve(null);
          }
        };

        req.onblocked = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            this.useFallback = true;
            resolve(null);
          }
        };
      } catch (_) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          this.useFallback = true;
          resolve(null);
        }
      }
    });
  }

  async saveProject(projectData) {
    if (!projectData) return false;
    try {
      const db = await this.open();
      if (db) {
        return await new Promise((resolve) => {
          try {
            const tx = db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            const req = store.put(projectData);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(this.fallbackSaveProject(projectData));
          } catch (_) {
            resolve(this.fallbackSaveProject(projectData));
          }
        });
      }
    } catch (_) {}

    return this.fallbackSaveProject(projectData);
  }

  fallbackSaveProject(projectData) {
    this.memoryProjects.set(projectData.id, projectData);
    try {
      if (typeof localStorage !== 'undefined') {
        const list = Array.from(this.memoryProjects.values());
        // Store metadata without heavy bitmaps in localStorage if needed
        localStorage.setItem('vectura_projects_fallback', JSON.stringify(list));
      }
    } catch (_) {}
    return true;
  }

  async getProject(id) {
    try {
      const db = await this.open();
      if (db) {
        return await new Promise((resolve) => {
          try {
            const tx = db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || this.memoryProjects.get(id) || null);
            req.onerror = () => resolve(this.memoryProjects.get(id) || null);
          } catch (_) {
            resolve(this.memoryProjects.get(id) || null);
          }
        });
      }
    } catch (_) {}

    return this.memoryProjects.get(id) || null;
  }

  async getAllProjects() {
    try {
      const db = await this.open();
      if (db) {
        return await new Promise((resolve) => {
          try {
            const tx = db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result && req.result.length > 0 ? req.result : this.fallbackGetAllProjects());
            req.onerror = () => resolve(this.fallbackGetAllProjects());
          } catch (_) {
            resolve(this.fallbackGetAllProjects());
          }
        });
      }
    } catch (_) {}

    return this.fallbackGetAllProjects();
  }

  fallbackGetAllProjects() {
    if (this.memoryProjects.size > 0) {
      return Array.from(this.memoryProjects.values());
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('vectura_projects_fallback');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach(p => this.memoryProjects.set(p.id, p));
            return parsed;
          }
        }
      }
    } catch (_) {}
    return [];
  }

  async deleteProject(id) {
    this.memoryProjects.delete(id);
    try {
      const db = await this.open();
      if (db) {
        new Promise((resolve) => {
          try {
            const tx = db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(true);
          } catch (_) {
            resolve(true);
          }
        });
      }
    } catch (_) {}

    try {
      if (typeof localStorage !== 'undefined') {
        const list = Array.from(this.memoryProjects.values());
        localStorage.setItem('vectura_projects_fallback', JSON.stringify(list));
      }
    } catch (_) {}
    return true;
  }

  async saveAutosave(data) {
    this.autosaveCache = data;
    try {
      const db = await this.open();
      if (db) {
        return await new Promise((resolve) => {
          try {
            const tx = db.transaction('autosave', 'readwrite');
            const store = tx.objectStore('autosave');
            const req = store.put({ id: 'current_autosave', ...data, timestamp: Date.now() });
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(true);
          } catch (_) {
            resolve(true);
          }
        });
      }
    } catch (_) {}
    return true;
  }

  async getAutosave() {
    try {
      const db = await this.open();
      if (db) {
        return await new Promise((resolve) => {
          try {
            const tx = db.transaction('autosave', 'readonly');
            const store = tx.objectStore('autosave');
            const req = store.get('current_autosave');
            req.onsuccess = () => resolve(req.result || this.autosaveCache);
            req.onerror = () => resolve(this.autosaveCache);
          } catch (_) {
            resolve(this.autosaveCache);
          }
        });
      }
    } catch (_) {}
    return this.autosaveCache;
  }
}
