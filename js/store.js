/* ============================================
   KSS33 Global Store (MongoDB Atlas Cloud Sync)
   ============================================ */
const Store = (() => {

  // Dynamic API URL: localhost uses local server, production uses Vercel serverless API
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : '/api'; // Vercel serverless API — same domain, zero cold starts!

  // In-memory collections data cache
  const cache = {
    customers: [],
    sites: [],
    materials: [],
    incoming: [],
    outgoing: [],
    siteUsage: [],
    siteReturns: [],
    siteDamaged: [],
    siteExpenses: [],
    sitePayments: []
  };

  // Maps collection store key to cache object key and API endpoint
  const endpointMap = {
    bm_customers: { cacheKey: 'customers', url: 'customers' },
    bm_sites: { cacheKey: 'sites', url: 'sites' },
    bm_materials: { cacheKey: 'materials', url: 'materials' },
    bm_incoming: { cacheKey: 'incoming', url: 'incoming' },
    bm_outgoing: { cacheKey: 'outgoing', url: 'outgoing' },
    bm_siteUsage: { cacheKey: 'siteUsage', url: 'siteUsage' },
    bm_siteReturns: { cacheKey: 'siteReturns', url: 'siteReturns' },
    bm_siteDamaged: { cacheKey: 'siteDamaged', url: 'siteDamaged' },
    bm_siteExpenses: { cacheKey: 'siteExpenses', url: 'siteExpenses' },
    bm_sitePayments: { cacheKey: 'sitePayments', url: 'sitePayments' }
  };

  // Phase 1: Load from localStorage INSTANTLY (zero wait)
  function initFromLocal() {
    const CACHE_VERSION = 'kss33_v4';
    if (localStorage.getItem('bm_cache_version') !== CACHE_VERSION) {
      // Clear old cache keys if version mismatch
      Object.keys(endpointMap).forEach(key => localStorage.removeItem(key));
      localStorage.setItem('bm_cache_version', CACHE_VERSION);
    }
    Object.keys(endpointMap).forEach(key => {
      const config = endpointMap[key];
      try {
        cache[config.cacheKey] = JSON.parse(localStorage.getItem(key)) || [];
      } catch (err) {
        console.error('Error parsing localStorage for', key, err);
        cache[config.cacheKey] = [];
      }
    });
  }

  // Phase 2: Sync with cloud in background — silently updates cache + localStorage
  async function syncFromCloud() {
    const keys = Object.keys(endpointMap);

    await Promise.all(keys.map(async (key) => {
      const config = endpointMap[key];
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(`${API_URL}/${config.url}`, { signal: controller.signal });
        clearTimeout(timer);

        if (res.ok) {
          const cloudData = await res.json();
          // Read CURRENT localStorage at response time (not at sync start — avoids race condition)
          const currentLocal = JSON.parse(localStorage.getItem(key)) || [];
          // Only replace local with cloud if cloud has data, or local is also empty
          // This prevents an empty/stale cloud response from wiping fresh local data
          if (cloudData.length > 0 || currentLocal.length === 0) {
            cache[config.cacheKey] = cloudData;
            persistLocal(key, cloudData);
          }
        }
      } catch (err) {
        // Network error — silently keep local data
      }
    }));

    // Seed default materials if completely empty everywhere
    if (cache.materials.length === 0) {
      await seedDefaultMaterials();
    }
    
    // TEMPORARY: Force wipe and re-seed with new materials if the old ones exist
    if (cache.materials.some(m => m.name === 'Cement (OPC 53)')) {
      await seedDefaultMaterials(true);
    }

    // Auto-delete archived sites older than 3 days
    cleanupOldArchives();
  }

  function cleanupOldArchives() {
    const now = new Date();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    cache.sites.forEach(site => {
      if (site.status === 'Archived' && site.archivedAt) {
        const archivedDate = new Date(site.archivedAt);
        if (now - archivedDate > threeDays) {
          // Permanently delete site and all its dependencies
          console.log(`Auto-deleting archived site: ${site.id}`);
          fetch(`${API_URL}/sites/${site.id}?action=cascade`, { method: 'DELETE' }).catch(console.error);
          
          // Remove from local cache
          cache.sites = cache.sites.filter(s => s.id !== site.id);
          persistLocal('bm_sites', cache.sites);
        }
      }
    });
  }

  // Main init: instant local load, then silent background cloud sync
  async function init() {
    initFromLocal();
    syncFromCloud().then(() => {
      // Clean up any orphaned records (from before cascade delete was implemented)
      const validSiteIds = new Set(cache.sites.map(s => s.id));
      
      const cleanOrphans = (store, cacheKey, siteIdField = 'siteId') => {
        if (!cache[cacheKey]) return;
        cache[cacheKey].forEach(record => {
          const sId = record[siteIdField];
          if (sId && !validSiteIds.has(sId)) {
            store.remove(record.id);
          }
        });
      };

      cleanOrphans(OutgoingStore, 'outgoing');
      cleanOrphans(ReturnsStore, 'siteReturns');
      cleanOrphans(UsageStore, 'siteUsage');
      cleanOrphans(DamagedStore, 'siteDamaged');
      cleanOrphans(ExpensesStore, 'siteExpenses');
      cleanOrphans(PaymentsStore, 'sitePayments');
      
      // Incoming has destinationSiteId
      if (cache.incoming) {
        cache.incoming.forEach(record => {
          if (record.destinationType === 'site' && record.destinationSiteId && !validSiteIds.has(record.destinationSiteId)) {
            IncomingStore.remove(record.id);
          }
        });
      }
    }); // Fire and forget
  }


  // Backup sync to localStorage for offline redundancy
  function persistLocal(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  }

  // ---------- In-Memory Cache CRUD Operations with Backend Background Sync ----------
  function makeStore(lsKey) {
    const config = endpointMap[lsKey];
    const cacheKey = config.cacheKey;
    const path = config.url;

    return {
      getAll: () => cache[cacheKey] || [],
      getById: (id) => cache[cacheKey].find(x => x.id === id) || null,

      add: (data) => {
        // Generate a unique temporary ID
        const id = 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const newItem = { ...data, id };
        
        // 1. Instantly update in-memory cache and local backup
        cache[cacheKey].push(newItem);
        persistLocal(lsKey, cache[cacheKey]);

        // 2. Async background HTTP POST call to MongoDB API
        fetch(`${API_URL}/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        })
        .then(async (res) => {
          if (res.ok) {
            const savedItem = await res.json();
            // Update the temporary ID with the official database ID in memory
            const idx = cache[cacheKey].findIndex(x => x.id === id);
            if (idx > -1) {
              cache[cacheKey][idx] = savedItem;
              persistLocal(lsKey, cache[cacheKey]);
            }
          }
        })
        .catch(err => console.error(`Error syncing ADD ${path}:`, err));

        return newItem;
      },

      addAsync: async (data) => {
        const id = 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const newItem = { ...data, id };
        
        cache[cacheKey].push(newItem);
        persistLocal(lsKey, cache[cacheKey]);

        try {
          const res = await fetch(`${API_URL}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
          });
          if (res.ok) {
            const savedItem = await res.json();
            const idx = cache[cacheKey].findIndex(x => x.id === id);
            if (idx > -1) {
              cache[cacheKey][idx] = savedItem;
              persistLocal(lsKey, cache[cacheKey]);
            }
            return savedItem;
          }
        } catch (err) {
          console.error(`Error syncing ADD ${path}:`, err);
        }
        return newItem;
      },

      update: (id, data) => {
        // 1. Instantly update in-memory cache
        const idx = cache[cacheKey].findIndex(x => x.id === id);
        if (idx > -1) {
          cache[cacheKey][idx] = { ...cache[cacheKey][idx], ...data };
          persistLocal(lsKey, cache[cacheKey]);

          // 2. Async background HTTP PUT call
          fetch(`${API_URL}/${path}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(err => console.error(`Error syncing UPDATE ${path}:`, err));

          return cache[cacheKey][idx];
        }
        return null;
      },

      remove: (id) => {
        // 1. Instantly update in-memory cache
        cache[cacheKey] = cache[cacheKey].filter(x => x.id !== id);
        persistLocal(lsKey, cache[cacheKey]);

        // 2. Async background HTTP DELETE call
        fetch(`${API_URL}/${path}/${id}`, {
          method: 'DELETE'
        }).catch(err => console.error(`Error syncing DELETE ${path}:`, err));

        return { success: true };
      }
    };
  }

  // ---- Collections ----
  const CustomersStore = makeStore('bm_customers');
  const SitesStore     = makeStore('bm_sites');
  const MaterialsStore = makeStore('bm_materials');
  const IncomingStore  = makeStore('bm_incoming');
  const OutgoingStore  = makeStore('bm_outgoing');
  const UsageStore     = makeStore('bm_siteUsage');
  const ReturnsStore   = makeStore('bm_siteReturns');
  const DamagedStore   = makeStore('bm_siteDamaged');
  const ExpensesStore  = makeStore('bm_siteExpenses');
  const PaymentsStore  = makeStore('bm_sitePayments');

  const Customers    = CustomersStore;
  const Materials    = MaterialsStore;
  const Incoming     = IncomingStore;
  const Outgoing     = OutgoingStore;
  const SiteUsage    = UsageStore;
  const SiteReturns  = ReturnsStore;
  const SiteDamaged  = DamagedStore;
  const SiteExpenses = ExpensesStore;

  const SitePayments = {
    ...PaymentsStore,
    getBySite: (siteId) => cache.sitePayments.filter(x => x.siteId === siteId),
    getTotalBySite: (siteId) => cache.sitePayments
      .filter(x => x.siteId === siteId)
      .reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)
  };

  // ---- Sites (with cascade delete) ----
  const Sites = {
    getAll: () => cache.sites,
    getById: (id) => cache.sites.find(s => s.id === id) || null,
    getByCustomer: (customerId) => cache.sites.filter(s => s.customerId === customerId),
    add: (s) => SitesStore.add(s),
    update: (id, s) => SitesStore.update(id, s),
    remove: (id) => {
      // Soft Delete: update status to 'Archived' and set archivedAt timestamp
      return SitesStore.update(id, { status: 'Archived', archivedAt: new Date().toISOString() });
    },
    hardDelete: async (id) => {
      // Cascade delete all associated records
      Outgoing.getAll().filter(r => r.siteId === id).forEach(r => Outgoing.remove(r.id));
      Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === id).forEach(r => Incoming.remove(r.id));
      SiteReturns.getAll().filter(r => r.siteId === id).forEach(r => SiteReturns.remove(r.id));
      SiteUsage.getAll().filter(r => r.siteId === id).forEach(r => SiteUsage.remove(r.id));
      SiteDamaged.getAll().filter(r => r.siteId === id).forEach(r => SiteDamaged.remove(r.id));
      SiteExpenses.getAll().filter(r => r.siteId === id).forEach(r => SiteExpenses.remove(r.id));
      SitePayments.getAll().filter(r => r.siteId === id).forEach(r => SitePayments.remove(r.id));

      // Perform a real deletion from the database
      return await SitesStore.remove(id);
    }
  };

  const Auth = {
    login(email, password) {
      const users = [
        { email: 'admin@kss33.com', password: 'admin123', name: 'Admin User', role: 'Admin' },
        { email: 'manager@kss33.com', password: 'manager123', name: 'Site Manager', role: 'Manager' },
        { email: 'staff@kss33.com', password: 'staff123', name: 'Staff Member', role: 'Staff' }
      ];
      const user = users.find(u => u.email === email && u.password === password);
      if (user) {
        const session = { ...user };
        delete session.password;
        localStorage.setItem('bm_user', JSON.stringify(session));
        return session;
      }
      return null;
    },
    getUser() {
      try { return JSON.parse(localStorage.getItem('bm_user')); }
      catch { return null; }
    },
    logout() {
      localStorage.removeItem('bm_user');
    },
    isLoggedIn() {
      return !!this.getUser();
    }
  };

  // ---- Inventory Utility ----
  const Inventory = {
    getRecentMovements: (limit = 10) => {
      const allOutgoing = cache.outgoing;
      const allReturns  = cache.siteReturns;
      const materials   = cache.materials;
      const sites       = cache.sites;

      const allIncoming = cache.incoming;

      let moves = [];
      // Show Site Returns as Incoming
      allReturns.forEach(r => {
        const mat = materials.find(m => m.id === r.materialId);
        const sourceSite = sites.find(s => s.id === r.siteId);
        moves.push({
          date: r.date, type: 'Incoming', destinationType: 'site',
          destination: sourceSite ? sourceSite.name : 'Site',
          material: mat ? mat.name : 'Unknown', sku: mat ? mat.sku : '',
          quantity: r.quantity, id: r.id
        });
      });
      // Show Warehouse purchases as Incoming
      allIncoming.forEach(r => {
        (r.items || []).forEach(i => {
          const mat = materials.find(m => m.id === i.materialId);
          moves.push({
            date: r.date, type: 'Incoming', destinationType: 'warehouse',
            destination: 'Warehouse',
            material: mat ? mat.name : 'Unknown', sku: mat ? mat.sku : '',
            quantity: i.quantity, id: r.id
          });
        });
      });
      // Show Outgoing
      allOutgoing.forEach(r => {
        (r.items || []).forEach(i => {
          const mat = materials.find(m => m.id === i.materialId);
          const destSite = sites.find(s => s.id === r.siteId);
          moves.push({
            date: r.date, type: 'Outgoing', destinationType: 'site',
            destination: destSite ? destSite.name : 'Site',
            material: mat ? mat.name : 'Unknown', sku: mat ? mat.sku : '',
            quantity: i.quantity, id: r.id
          });
        });
      });
      moves.sort((a, b) => new Date(b.date) - new Date(a.date));
      return moves.slice(0, limit);
    },

    getOverview: () => {
      const materials   = cache.materials;
      const allIncoming = cache.incoming;
      const allOutgoing = cache.outgoing;
      return materials.map(material => {
        let totalIn = 0;
        allIncoming.filter(r => r.destinationType === 'warehouse').forEach(r => {
          (r.items || []).forEach(i => { if (i.materialId === material.id) totalIn += (parseFloat(i.quantity) || 0); });
        });
        let totalOut = 0;
        allOutgoing.forEach(r => {
          (r.items || []).forEach(i => { if (i.materialId === material.id) totalOut += (parseFloat(i.quantity) || 0); });
        });
        return { material, warehouseStock: totalIn - totalOut };
      });
    },

    getWarehouseCurrentBalance: (materialId) => {
      const allIncoming = cache.incoming;
      const allOutgoing = cache.outgoing;
      let totalIn = 0;
      allIncoming.filter(r => r.destinationType === 'warehouse').forEach(r => {
        (r.items || []).forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
      });
      let totalOut = 0;
      allOutgoing.forEach(r => {
        (r.items || []).forEach(i => { if (i.materialId === materialId) totalOut += (parseFloat(i.quantity) || 0); });
      });
      return totalIn - totalOut;
    },

    getSiteCurrentBalance: (materialId, siteId) => {
      const allOutgoing       = cache.outgoing;
      const allIncomingDirect = cache.incoming;
      const siteReturns       = cache.siteReturns;
      const siteUsage         = cache.siteUsage;
      const siteDamaged       = cache.siteDamaged;
      let totalIn = 0;
      allOutgoing.filter(r => r.siteId === siteId).forEach(r => {
        (r.items || []).forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
      });
      allIncomingDirect.filter(r => r.destinationType === 'site' && r.destinationSiteId === siteId).forEach(r => {
        (r.items || []).forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
      });
      let totalOut = 0;
      siteReturns.filter(r => r.siteId === siteId && r.materialId === materialId).forEach(r => totalOut += (parseFloat(r.quantity) || 0));
      siteUsage.filter(r => r.siteId === siteId && r.materialId === materialId).forEach(r => totalOut += (parseFloat(r.quantity) || 0));
      siteDamaged.filter(r => r.siteId === siteId && r.materialId === materialId).forEach(r => totalOut += (parseFloat(r.quantity) || 0));
      return totalIn - totalOut;
    },

    getSiteTotalSent: (materialId, siteId) => {
      const allOutgoing       = cache.outgoing;
      const allIncomingDirect = cache.incoming;
      let totalIn = 0;
      allOutgoing.filter(r => r.siteId === siteId).forEach(r => {
        (r.items || []).forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
      });
      allIncomingDirect.filter(r => r.destinationType === 'site' && r.destinationSiteId === siteId).forEach(r => {
        (r.items || []).forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
      });
      return totalIn;
    },

    getSiteUsage: (materialId, siteId) => {
      return cache.siteUsage
        .filter(r => r.siteId === siteId && r.materialId === materialId)
        .reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
    },

    getSiteReturns: (materialId, siteId) => {
      return cache.siteReturns
        .filter(r => r.siteId === siteId && r.materialId === materialId)
        .reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
    },

    getSiteDamaged: (materialId, siteId) => {
      return cache.siteDamaged
        .filter(r => r.siteId === siteId && r.materialId === materialId)
        .reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
    },

    getSiteRevenue: (siteId) => {
      return cache.sitePayments
        .filter(p => p.siteId === siteId)
        .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    },

    getTotalSiteExpenses: (siteId) => {
      return cache.siteExpenses
        .filter(e => e.siteId === siteId)
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    },

    getLedger: (materialId, dateFrom, dateTo) => {
      const allIncoming = cache.incoming;
      const allOutgoing = cache.outgoing;
      const sites = cache.sites;
      let entries = [];
      allIncoming.forEach(r => {
        (r.items || []).forEach(i => {
          if (i.materialId !== materialId) return;
          if (dateFrom && r.date < dateFrom) return;
          if (dateTo && r.date > dateTo) return;
          const site = sites.find(s => s.id === r.destinationSiteId);
          entries.push({ date: r.date, type: 'Incoming', destination: r.destinationType === 'site' && site ? site.name : 'Warehouse', quantity: parseFloat(i.quantity) || 0, referenceNo: r.referenceNo || '', notes: r.notes || '' });
        });
      });
      allOutgoing.forEach(r => {
        (r.items || []).forEach(i => {
          if (i.materialId !== materialId) return;
          if (dateFrom && r.date < dateFrom) return;
          if (dateTo && r.date > dateTo) return;
          const site = sites.find(s => s.id === r.siteId);
          entries.push({ date: r.date, type: 'Outgoing', destination: site ? site.name : 'Site', quantity: parseFloat(i.quantity) || 0, referenceNo: r.referenceNo || '', notes: r.notes || '' });
        });
      });
      entries.sort((a, b) => new Date(a.date) - new Date(b.date));
      let balance = 0;
      return entries.map(e => {
        if (e.type === 'Incoming' && e.destination === 'Warehouse') balance += e.quantity;
        else if (e.type === 'Outgoing') balance -= e.quantity;
        return { ...e, balance };
      });
    }
  };

  // Seeding helper to post default materials to DB
  async function seedDefaultMaterials(force = false) {
    if (force) {
      // Wipe existing materials
      await Promise.all(cache.materials.map(async (m) => {
        try {
          await fetch(`${API_URL}/materials/${m.id}`, { method: 'DELETE' });
        } catch(e) {}
      }));
      cache.materials = [];
    }

    const defaults = [
      { name: 'Shuttering plate 2\'x4\'', sku: 'SHUT-2x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' },
      { name: 'Shuttering plate 18"x4\'', sku: 'SHUT-18x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' },
      { name: 'Shuttering plate 15"x4\'', sku: 'SHUT-15x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' },
      { name: 'Shuttering plate 12"x4\'', sku: 'SHUT-12x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' },
      { name: 'Shuttering plate 9"x4\'', sku: 'SHUT-9x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' },
      { name: 'Shuttering plate 6"x4\'', sku: 'SHUT-6x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' },
      
      { name: 'Channels', sku: 'CHAN', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' },
      { name: 'Balli', sku: 'BAL', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' },
      { name: 'Props', sku: 'PROP', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' },
      { name: 'Pipe', sku: 'PIPE', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' },
      { name: 'Ledger', sku: 'LEDG', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' },
      
      { name: 'Miscellaneous', sku: 'MISC', category: 'General', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active' }
    ];

    await Promise.all(defaults.map(async (m) => {
      let saved = false;
      try {
        const res = await fetch(`${API_URL}/materials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(m)
        });
        if (res.ok) {
          cache.materials.push(await res.json());
          saved = true;
        }
      } catch (err) {
        console.error('Error seeding material API:', err);
      }
      
      // Fallback: If API fails or is offline, save directly to local cache
      if (!saved) {
        m.id = 'mat_' + Math.random().toString(36).substr(2, 9);
        cache.materials.push(m);
      }
    }));
    persistLocal('bm_materials', cache.materials);
  }

  return { Customers, Sites, Materials, Incoming, Outgoing, SiteUsage, SiteReturns, SiteDamaged, SiteExpenses, SitePayments, Inventory, Auth, init };
})();
