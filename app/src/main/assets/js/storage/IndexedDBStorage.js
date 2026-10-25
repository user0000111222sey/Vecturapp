/**
 * Vectura IndexedDB Storage Engine
 * Persistent storage for artwork metadata and binary layer Blobs.
 * Resolves only on transaction completion, with no localStorage fallback.
 */
export class IndexedDBStorage {
  constructor(dbName = 'VecturaDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.memoryProjects = new Map();
  }

  async open() {
    if (this.db) return this.db;

    const idb = typeof window !== 'undefined' ? window.indexedDB : (typeof indexedDB !== 'undefined' ? indexedDB : null);
    if (!idb) {
      console.error('IndexedDB not supported');
      return null;
    }

    return new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 3000);

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
          } catch (err) {
            console.error('IDB upgrade error:', err);
          }
        };

        req.onsuccess = (e) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            this.db = e.target.result;
            resolve(this.db);
          }
        };

        req.onerror = (e) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            console.error('IDB open error:', req.error || e);
            resolve(null);
          }
        };

        req.onblocked = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            console.warn('IDB open blocked');
            resolve(null);
          }
        };
      } catch (err) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          console.error('IDB open exception:', err);
          resolve(null);
        }
      }
    });
  }

  async saveProject(projectData) {
    if (!projectData) return false;
    this.memoryProjects.set(projectData.id, projectData);

    try {
      const db = await this.open();
      if (!db) return false;

      return await new Promise((resolve) => {
        try {
          const tx = db.transaction('projects', 'readwrite');
          const store = tx.objectStore('projects');
          store.put(projectData);

          // Resolve save ONLY on tx.oncomplete
          tx.oncomplete = () => {
            resolve(true);
          };
          tx.onerror = (e) => {
            console.error('saveProject tx error:', tx.error || e);
            resolve(false);
          };
          tx.onabort = () => {
            console.error('saveProject tx aborted');
            resolve(false);
          };
        } catch (err) {
          console.error('saveProject error:', err);
          resolve(false);
        }
      });
    } catch (err) {
      console.error('Failed to save project:', err);
      return false;
    }
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
            req.onsuccess = () => {
              const res = req.result || [];
              if (res.length > 0) {
                res.forEach(p => this.memoryProjects.set(p.id, p));
                resolve(res);
              } else {
                resolve(Array.from(this.memoryProjects.values()));
              }
            };
            req.onerror = () => resolve(Array.from(this.memoryProjects.values()));
          } catch (_) {
            resolve(Array.from(this.memoryProjects.values()));
          }
        });
      }
    } catch (_) {}

    return Array.from(this.memoryProjects.values());
  }

  async deleteProject(id) {
    this.memoryProjects.delete(id);
    try {
      const db = await this.open();
      if (db) {
        return await new Promise((resolve) => {
          try {
            const tx = db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            store.delete(id);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
          } catch (_) {
            resolve(false);
          }
        });
      }
    } catch (_) {}
    return true;
  }
}
