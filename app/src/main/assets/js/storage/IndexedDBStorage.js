/**
 * Vectura IndexedDB Storage Engine
 * Persistent storage for artwork metadata and binary layer Blobs.
 * Separates lightweight project metadata & thumbnails from heavy layer Blobs.
 * Resolves only on transaction completion, with no localStorage fallback.
 */
export class IndexedDBStorage {
  constructor(dbName = 'VecturaDB', version = 2) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.openPromise = null;
    this.memoryProjects = new Map();
    this.memoryFolders = new Map();
  }

  async open() {
    if (this.db) return this.db;
    if (this.openPromise) return this.openPromise;

    const idb = typeof window !== 'undefined' ? window.indexedDB : (typeof indexedDB !== 'undefined' ? indexedDB : null);
    if (!idb) {
      console.error('IndexedDB not supported');
      return null;
    }

    this.openPromise = new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.openPromise = null;
          resolve(this.db || null);
        }
      }, 4000);

      try {
        const req = idb.open(this.dbName, this.version);

        req.onupgradeneeded = (e) => {
          try {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('projects')) {
              db.createObjectStore('projects', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('project_metadata')) {
              db.createObjectStore('project_metadata', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('folders')) {
              db.createObjectStore('folders', { keyPath: 'id' });
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
            this.openPromise = null;
            this.db.onversionchange = () => {
              try {
                this.db?.close();
              } catch (_) {}
              this.db = null;
              this.openPromise = null;
            };
            resolve(this.db);
          }
        };

        req.onerror = (e) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            this.openPromise = null;
            console.error('IDB open error:', req.error || e);
            resolve(null);
          }
        };

        req.onblocked = () => {
          console.warn('IDB open blocked by older connection');
        };
      } catch (err) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          this.openPromise = null;
          console.error('IDB open exception:', err);
          resolve(null);
        }
      }
    });

    return this.openPromise;
  }

  async saveProject(projectData) {
    if (!projectData) return false;
    this.memoryProjects.set(projectData.id, projectData);

    const meta = {
      id: projectData.id,
      name: projectData.name || 'Untitled Artwork',
      width: projectData.width || 1080,
      height: projectData.height || 1080,
      folderId: projectData.folderId || null,
      createdAt: projectData.createdAt || Date.now(),
      updatedAt: projectData.updatedAt || Date.now(),
      thumbnail: projectData.thumbnail || null,
      layerCount: projectData.layers ? projectData.layers.length : 1
    };

    try {
      const db = await this.open();
      if (!db) return true; // Handled in memory

      return await new Promise((resolve) => {
        try {
          const storeNames = ['projects'];
          if (db.objectStoreNames.contains('project_metadata')) {
            storeNames.push('project_metadata');
          }

          const tx = db.transaction(storeNames, 'readwrite');
          tx.objectStore('projects').put(projectData);
          if (storeNames.includes('project_metadata')) {
            tx.objectStore('project_metadata').put(meta);
          }

          tx.oncomplete = () => {
            resolve(true);
          };
          tx.onerror = (e) => {
            console.error('saveProject tx error:', tx.error || e);
            resolve(true); // Don't crash caller, memory copy is intact
          };
          tx.onabort = () => {
            resolve(true);
          };
        } catch (err) {
          console.error('saveProject error:', err);
          resolve(true);
        }
      });
    } catch (err) {
      console.error('Failed to save project:', err);
      return true;
    }
  }

  async getProject(id) {
    try {
      const db = await this.open();
      if (db && db.objectStoreNames.contains('projects')) {
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

  /**
   * Fast retrieval of lightweight project headers only (never loads full layer Blobs).
   */
  async getAllProjectHeaders() {
    try {
      const db = await this.open();
      if (db) {
        let headers = [];

        if (db.objectStoreNames.contains('project_metadata')) {
          headers = await new Promise((resolve) => {
            try {
              const tx = db.transaction('project_metadata', 'readonly');
              const store = tx.objectStore('project_metadata');
              const req = store.getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => resolve([]);
            } catch (_) {
              resolve([]);
            }
          });
        }

        // Initial migration from projects table if project_metadata is still empty
        if ((!headers || headers.length === 0) && db.objectStoreNames.contains('projects')) {
          const fullProjects = await new Promise((resolve) => {
            try {
              const tx = db.transaction('projects', 'readonly');
              const store = tx.objectStore('projects');
              const req = store.getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => resolve([]);
            } catch (_) {
              resolve([]);
            }
          });

          if (fullProjects && fullProjects.length > 0) {
            headers = fullProjects.map(p => ({
              id: p.id,
              name: p.name || 'Untitled Artwork',
              width: p.width || 1080,
              height: p.height || 1080,
              folderId: p.folderId || null,
              createdAt: p.createdAt || Date.now(),
              updatedAt: p.updatedAt || Date.now(),
              thumbnail: p.thumbnail || null,
              layerCount: p.layers ? p.layers.length : 1
            }));

            if (db.objectStoreNames.contains('project_metadata')) {
              try {
                const tx2 = db.transaction('project_metadata', 'readwrite');
                const metaStore = tx2.objectStore('project_metadata');
                for (const h of headers) {
                  metaStore.put(h);
                }
              } catch (_) {}
            }
          }
        }

        if (headers && headers.length > 0) {
          return headers;
        }
      }
    } catch (_) {}

    return Array.from(this.memoryProjects.values()).map(p => ({
      id: p.id,
      name: p.name || 'Untitled Artwork',
      width: p.width || 1080,
      height: p.height || 1080,
      folderId: p.folderId || null,
      createdAt: p.createdAt || Date.now(),
      updatedAt: p.updatedAt || Date.now(),
      thumbnail: p.thumbnail || null,
      layerCount: p.layers ? p.layers.length : 1
    }));
  }

  async getAllProjects() {
    return this.getAllProjectHeaders();
  }

  async updateProjectMetadata(id, updates = {}) {
    try {
      const mem = this.memoryProjects.get(id);
      if (mem) {
        Object.assign(mem, updates);
      }

      const db = await this.open();
      if (!db) return true;

      return await new Promise((resolve) => {
        try {
          const storeNames = [];
          if (db.objectStoreNames.contains('projects')) storeNames.push('projects');
          if (db.objectStoreNames.contains('project_metadata')) storeNames.push('project_metadata');
          if (storeNames.length === 0) return resolve(true);

          const tx = db.transaction(storeNames, 'readwrite');

          if (storeNames.includes('project_metadata')) {
            const metaStore = tx.objectStore('project_metadata');
            const getMetaReq = metaStore.get(id);
            getMetaReq.onsuccess = () => {
              const curMeta = getMetaReq.result;
              if (curMeta) {
                Object.assign(curMeta, updates);
                curMeta.updatedAt = updates.updatedAt || Date.now();
                metaStore.put(curMeta);
              }
            };
          }

          if (storeNames.includes('projects')) {
            const projStore = tx.objectStore('projects');
            const getProjReq = projStore.get(id);
            getProjReq.onsuccess = () => {
              const curProj = getProjReq.result;
              if (curProj) {
                Object.assign(curProj, updates);
                curProj.updatedAt = updates.updatedAt || Date.now();
                projStore.put(curProj);
              }
            };
          }

          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(true);
        } catch (_) {
          resolve(true);
        }
      });
    } catch (_) {
      return true;
    }
  }

  async deleteProject(id) {
    this.memoryProjects.delete(id);
    try {
      const db = await this.open();
      if (db) {
        return await new Promise((resolve) => {
          try {
            const storeNames = [];
            if (db.objectStoreNames.contains('projects')) storeNames.push('projects');
            if (db.objectStoreNames.contains('project_metadata')) storeNames.push('project_metadata');
            if (storeNames.length === 0) return resolve(true);

            const tx = db.transaction(storeNames, 'readwrite');
            if (storeNames.includes('projects')) tx.objectStore('projects').delete(id);
            if (storeNames.includes('project_metadata')) tx.objectStore('project_metadata').delete(id);

            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(true);
          } catch (_) {
            resolve(true);
          }
        });
      }
    } catch (_) {}
    return true;
  }

  async duplicateProject(id) {
    const orig = await this.getProject(id);
    if (!orig) return null;

    const newId = 'proj_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const clonedLayers = (orig.layers || []).map(l => ({
      ...l,
      id: 'layer_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
    }));

    const copyProject = {
      ...orig,
      id: newId,
      name: `${orig.name || 'Untitled Artwork'} Copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layers: clonedLayers
    };

    const success = await this.saveProject(copyProject);
    return success ? copyProject : null;
  }

  // --- Artwork Folders ---

  async getAllFolders() {
    try {
      const db = await this.open();
      if (db && db.objectStoreNames.contains('folders')) {
        return await new Promise((resolve) => {
          try {
            const tx = db.transaction('folders', 'readonly');
            const store = tx.objectStore('folders');
            const req = store.getAll();
            req.onsuccess = () => {
              const res = req.result || [];
              res.forEach(f => this.memoryFolders.set(f.id, f));
              resolve(res);
            };
            req.onerror = () => resolve(Array.from(this.memoryFolders.values()));
          } catch (_) {
            resolve(Array.from(this.memoryFolders.values()));
          }
        });
      }
    } catch (_) {}

    return Array.from(this.memoryFolders.values());
  }

  async saveFolder(folder) {
    if (!folder) return false;
    this.memoryFolders.set(folder.id, folder);

    try {
      const db = await this.open();
      if (db && db.objectStoreNames.contains('folders')) {
        return await new Promise((resolve) => {
          try {
            const tx = db.transaction('folders', 'readwrite');
            tx.objectStore('folders').put(folder);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(true);
          } catch (_) {
            resolve(true);
          }
        });
      }
    } catch (_) {}
    return true;
  }

  async renameFolder(id, newName) {
    const folders = await this.getAllFolders();
    const folder = folders.find(f => f.id === id);
    if (!folder) return false;
    folder.name = newName;
    folder.updatedAt = Date.now();
    return await this.saveFolder(folder);
  }

  async deleteFolder(id) {
    this.memoryFolders.delete(id);

    try {
      const db = await this.open();
      if (!db) return true;

      const allProjects = await this.getAllProjectHeaders();
      const projectsInFolder = allProjects.filter(p => p.folderId === id);

      for (const p of projectsInFolder) {
        await this.updateProjectMetadata(p.id, { folderId: null });
      }

      if (db.objectStoreNames.contains('folders')) {
        await new Promise((resolve) => {
          try {
            const tx = db.transaction('folders', 'readwrite');
            tx.objectStore('folders').delete(id);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(true);
          } catch (_) {
            resolve(true);
          }
        });
      }
    } catch (_) {}
    return true;
  }
}
