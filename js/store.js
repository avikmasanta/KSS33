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
    sitePayments: [],
    transactions: [],
    rentalSites: [],
    categories: []
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
    bm_sitePayments: { cacheKey: 'sitePayments', url: 'sitePayments' },
    bm_transactions: { cacheKey: 'transactions', url: 'transactions' },
    bm_rentalSites: { cacheKey: 'rentalSites', url: 'rentalSites' },
    bm_categories: { cacheKey: 'categories', url: 'categories' }
  };

  // Phase 1: Load from localStorage INSTANTLY (zero wait)
  function initFromLocal() {
    const CACHE_VERSION = 'kss33_v8';
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
          cache[config.cacheKey] = cloudData;
          persistLocal(key, cloudData);
        }
      } catch (err) {
        // Network error — silently keep local data
      }
    }));

    // Seed default materials if completely empty everywhere
    if (cache.materials.length === 0) {
      await seedDefaultMaterials();
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
          fetch(`${API_URL}/sites/${site.id}/cascade`, { method: 'DELETE' }).catch(console.error);
          
          // Remove from local cache
          cache.sites = cache.sites.filter(s => s.id !== site.id);
          persistLocal('bm_sites', cache.sites);
        }
      }
    });
  }

  async function seedDefaultCategories() {
    if (!cache.categories || cache.categories.length === 0) {
      const defaults = [
        { name: 'Steel Plate', sortOrder: 1 },
        { name: 'Scaffolding', sortOrder: 2 },
        { name: 'Cement', sortOrder: 3 },
        { name: 'Sand', sortOrder: 4 },
        { name: 'Steel', sortOrder: 5 },
        { name: 'Bricks', sortOrder: 6 },
        { name: 'Aggregate', sortOrder: 7 },
        { name: 'Other', sortOrder: 999 }
      ];
      cache.categories = [];
      for (const cat of defaults) {
        const item = { id: cat.name, sortOrder: cat.sortOrder };
        cache.categories.push(item);
        try {
          await fetch(`${API_URL}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          });
        } catch (e) { /* silent */ }
      }
      persistLocal('bm_categories', cache.categories);
    }
  }

  // Main init: instant local load, then silent background cloud sync
  async function init() {
    initFromLocal();
    syncFromCloud().then(async () => {
      // Seed default categories if empty
      await seedDefaultCategories();

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
      // Auto-patch plate materials with sqFtPerUnit (runs after cloud sync)
      patchMaterialSqFt();
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
        // Generate a unique temporary ID (preserve data.id if present)
        const id = data.id || 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
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
        const id = data.id || 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
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
  const TransactionsStore = makeStore('bm_transactions');
  const RentalSitesStore = makeStore('bm_rentalSites');
  const CategoriesStore  = makeStore('bm_categories');
 
  const Customers    = CustomersStore;
  const Categories   = CategoriesStore;
  // Materials extended with getSorted() and getSqFtPerUnit() — defined after PLATE_SQFT_MAP below
  const Incoming     = IncomingStore;
  const Outgoing     = OutgoingStore;
  const SiteUsage    = UsageStore;
  const SiteReturns  = ReturnsStore;
  const SiteDamaged  = DamagedStore;
  const SiteExpenses = ExpensesStore;
  const Transactions = TransactionsStore;
  const RentalSites   = RentalSitesStore;


  function logTransaction(materialId, quantity, action, siteId = '') {
    const material = cache.materials.find(m => m.id === materialId);
    const site = siteId ? cache.sites.find(s => s.id === siteId) : null;
    const user = Auth.getUser();
    
    return TransactionsStore.add({
      materialId: materialId,
      materialName: material ? material.name : 'Unknown Material',
      quantity: parseFloat(quantity) || 0,
      action: action, // 'Add', 'Deduct', 'Dispatch', 'Return'
      siteId: siteId,
      siteName: site ? site.name : '',
      date: new Date().toISOString(),
      user: user ? user.name : 'System'
    });
  }

  const SitePayments = {
    ...PaymentsStore,
    getBySite: (siteId) => cache.sitePayments.filter(x => x.siteId === siteId),
    getTotalBySite: (siteId) => cache.sitePayments
      .filter(x => x.siteId === siteId)
      .reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)
  };

  const resetStock = async () => {
    try {
      const res = await fetch(`${API_URL}/reset-stock`, { method: 'POST' });
      if (res.ok) {
        cache.incoming = [];
        cache.outgoing = [];
        cache.siteReturns = [];
        cache.siteUsage = [];
        cache.siteDamaged = [];
        cache.transactions = [];
        
        persistLocal('bm_incoming', []);
        persistLocal('bm_outgoing', []);
        persistLocal('bm_siteReturns', []);
        persistLocal('bm_siteUsage', []);
        persistLocal('bm_siteDamaged', []);
        persistLocal('bm_transactions', []);
        return { success: true };
      }
      return { success: false, error: 'Reset failed on server' };
    } catch (err) {
      console.error('Error resetting stock:', err);
      return { success: false, error: err.message };
    }
  };

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
      // 1. Instantly update all client caches locally
      cache.outgoing = (cache.outgoing || []).filter(r => r && r.siteId !== id);
      cache.incoming = (cache.incoming || []).filter(r => r && !(r.destinationType === 'site' && r.destinationSiteId === id));
      cache.siteReturns = (cache.siteReturns || []).filter(r => r && r.siteId !== id);
      cache.siteUsage = (cache.siteUsage || []).filter(r => r && r.siteId !== id);
      cache.siteDamaged = (cache.siteDamaged || []).filter(r => r && r.siteId !== id);
      cache.siteExpenses = (cache.siteExpenses || []).filter(r => r && r.siteId !== id);
      cache.sitePayments = (cache.sitePayments || []).filter(r => r && r.siteId !== id);
      cache.sites = (cache.sites || []).filter(r => r && r.id !== id);

      persistLocal('bm_outgoing', cache.outgoing);
      persistLocal('bm_incoming', cache.incoming);
      persistLocal('bm_siteReturns', cache.siteReturns);
      persistLocal('bm_siteUsage', cache.siteUsage);
      persistLocal('bm_siteDamaged', cache.siteDamaged);
      persistLocal('bm_siteExpenses', cache.siteExpenses);
      persistLocal('bm_sitePayments', cache.sitePayments);
      persistLocal('bm_sites', cache.sites);

      // 2. Perform a single cascade delete on backend
      const r = await fetch(`${API_URL}/sites/${id}/cascade`, {
        method: 'DELETE'
      });
      return await r.json();
    }
  };


  const Auth = {
    login(email, password) {
      const users = [
        { email: 'admin@kss.com', password: 'admin123', name: 'Admin User', role: 'Admin' },
        { email: 'manager@kss.com', password: 'manager123', name: 'Site Manager', role: 'Manager' },
        { email: 'staff@kss.com', password: 'staff123', name: 'Staff Member', role: 'Staff' }
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

  // Normalise a materialId that may be a plain string OR a Mongoose-populated object
  function resolveId(id) {
    if (!id) return '';
    if (typeof id === 'object') return String(id._id || id.id || '');
    return String(id);
  }

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
      const materials   = Materials.getSorted ? Materials.getSorted() : cache.materials;
      const allIncoming = cache.incoming;
      const allOutgoing = cache.outgoing;
      const siteReturns = cache.siteReturns;
      return materials.map(material => {
        let totalPurchased = 0;
        let totalReturned = 0;
        
        allIncoming.filter(r => r.destinationType === 'warehouse').forEach(r => {
          (r.items || []).forEach(i => { 
            if (resolveId(i.materialId) === resolveId(material.id)) {
              const qty = parseFloat(i.quantity) || 0;
              // If it says return in supplier, count as returned
              if (r.supplier && r.supplier.toLowerCase().includes('return')) {
                totalReturned += qty;
              } else {
                totalPurchased += qty;
              }
            } 
          });
        });
        siteReturns.forEach(r => {
          if (resolveId(r.materialId) === resolveId(material.id)) totalReturned += (parseFloat(r.quantity) || 0);
        });
        let totalSent = 0;
        allOutgoing.forEach(r => {
          (r.items || []).forEach(i => { if (resolveId(i.materialId) === resolveId(material.id)) totalSent += (parseFloat(i.quantity) || 0); });
        });

        let totalSiteStock = 0;
        cache.sites.forEach(site => {
          let totalIn = 0;
          allOutgoing.filter(r => r.siteId === site.id).forEach(r => {
            (r.items || []).forEach(i => { if (resolveId(i.materialId) === resolveId(material.id)) totalIn += (parseFloat(i.quantity) || 0); });
          });
          allIncoming.filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id).forEach(r => {
            (r.items || []).forEach(i => { if (resolveId(i.materialId) === resolveId(material.id)) totalIn += (parseFloat(i.quantity) || 0); });
          });
          let totalOut = 0;
          siteReturns.filter(r => r.siteId === site.id && resolveId(r.materialId) === resolveId(material.id)).forEach(r => totalOut += (parseFloat(r.quantity) || 0));
          cache.siteUsage.filter(r => r.siteId === site.id && resolveId(r.materialId) === resolveId(material.id)).forEach(r => totalOut += (parseFloat(r.quantity) || 0));
          cache.siteDamaged.filter(r => r.siteId === site.id && resolveId(r.materialId) === resolveId(material.id)).forEach(r => totalOut += (parseFloat(r.quantity) || 0));
          
          totalSiteStock += (totalIn - totalOut);
        });

        const warehouseStock = (totalPurchased + totalReturned) - totalSent - (() => {
          let totalRented = 0;
          (cache.rentalSites || []).filter(r => r.status === 'Active').forEach(r => {
            (r.items || []).forEach(i => {
              if (resolveId(i.materialId) === resolveId(material.id)) {
                totalRented += (parseFloat(i.quantity) || 0);
              }
            });
          });
          return totalRented;
        })();

        return { 
          material, 
          totalPurchased, 
          totalReturned, 
          totalSent, 
          warehouseStock,
          totalSiteStock,
          totalStock: warehouseStock + totalSiteStock
        };
      });
    },

    getWarehouseBalanceOn: (materialId, date) => {
      const allIncoming = cache.incoming;
      const allOutgoing = cache.outgoing;
      const siteReturns = cache.siteReturns;
      let totalIn = 0;
      allIncoming.filter(r => r.destinationType === 'warehouse' && (!date || r.date <= date)).forEach(r => {
        (r.items || []).forEach(i => { if (resolveId(i.materialId) === resolveId(materialId)) totalIn += (parseFloat(i.quantity) || 0); });
      });
      siteReturns.filter(r => !date || r.date <= date).forEach(r => {
        if (resolveId(r.materialId) === resolveId(materialId)) totalIn += (parseFloat(r.quantity) || 0);
      });
      let totalOut = 0;
      allOutgoing.filter(r => !date || r.date <= date).forEach(r => {
        (r.items || []).forEach(i => { if (resolveId(i.materialId) === resolveId(materialId)) totalOut += (parseFloat(i.quantity) || 0); });
      });
      let totalRented = 0;
      (cache.rentalSites || []).forEach(r => {
        if (r.goingDate <= date) {
          if (r.status === 'Active' || (r.comingDate && r.comingDate > date)) {
            (r.items || []).forEach(i => {
              if (resolveId(i.materialId) === resolveId(materialId)) {
                totalRented += (parseFloat(i.quantity) || 0);
              }
            });
          }
        }
      });
      return totalIn - totalOut - totalRented;
    },

    getWarehouseCurrentBalance: (materialId) => {
      const allIncoming = cache.incoming;
      const allOutgoing = cache.outgoing;
      const siteReturns = cache.siteReturns;
      let totalIn = 0;
      allIncoming.filter(r => r.destinationType === 'warehouse').forEach(r => {
        (r.items || []).forEach(i => { if (resolveId(i.materialId) === resolveId(materialId)) totalIn += (parseFloat(i.quantity) || 0); });
      });
      siteReturns.forEach(r => {
        if (resolveId(r.materialId) === resolveId(materialId)) totalIn += (parseFloat(r.quantity) || 0);
      });
      let totalOut = 0;
      allOutgoing.forEach(r => {
        (r.items || []).forEach(i => { if (resolveId(i.materialId) === resolveId(materialId)) totalOut += (parseFloat(i.quantity) || 0); });
      });
      let totalRented = 0;
      (cache.rentalSites || []).filter(r => r.status === 'Active').forEach(r => {
        (r.items || []).forEach(i => {
          if (resolveId(i.materialId) === resolveId(materialId)) {
            totalRented += (parseFloat(i.quantity) || 0);
          }
        });
      });
      return totalIn - totalOut - totalRented;
    },

    getSiteCurrentBalance: (materialId, siteId) => {
      const allOutgoing       = cache.outgoing;
      const allIncomingDirect = cache.incoming;
      const siteReturns       = cache.siteReturns;
      const siteUsage         = cache.siteUsage;
      const siteDamaged       = cache.siteDamaged;
      let totalIn = 0;
      allOutgoing.filter(r => r.siteId === siteId).forEach(r => {
        (r.items || []).forEach(i => { if (resolveId(i.materialId) === resolveId(materialId)) totalIn += (parseFloat(i.quantity) || 0); });
      });
      allIncomingDirect.filter(r => r.destinationType === 'site' && r.destinationSiteId === siteId).forEach(r => {
        (r.items || []).forEach(i => { if (resolveId(i.materialId) === resolveId(materialId)) totalIn += (parseFloat(i.quantity) || 0); });
      });
      let totalOut = 0;
      siteReturns.filter(r => r.siteId === siteId && resolveId(r.materialId) === resolveId(materialId)).forEach(r => totalOut += (parseFloat(r.quantity) || 0));
      siteUsage.filter(r => r.siteId === siteId && resolveId(r.materialId) === resolveId(materialId)).forEach(r => totalOut += (parseFloat(r.quantity) || 0));
      siteDamaged.filter(r => r.siteId === siteId && resolveId(r.materialId) === resolveId(materialId)).forEach(r => totalOut += (parseFloat(r.quantity) || 0));
      return totalIn - totalOut;
    },

    getSiteTotalSent: (materialId, siteId) => {
      const allOutgoing       = cache.outgoing;
      const allIncomingDirect = cache.incoming;
      let totalIn = 0;
      allOutgoing.filter(r => r.siteId === siteId).forEach(r => {
        (r.items || []).forEach(i => { if (resolveId(i.materialId) === resolveId(materialId)) totalIn += (parseFloat(i.quantity) || 0); });
      });
      allIncomingDirect.filter(r => r.destinationType === 'site' && r.destinationSiteId === siteId).forEach(r => {
        (r.items || []).forEach(i => { if (resolveId(i.materialId) === resolveId(materialId)) totalIn += (parseFloat(i.quantity) || 0); });
      });
      return totalIn;
    },

    getSiteUsage: (materialId, siteId) => {
      return cache.siteUsage
        .filter(r => r.siteId === siteId && resolveId(r.materialId) === resolveId(materialId))
        .reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
    },

    getSiteReturns: (materialId, siteId) => {
      return cache.siteReturns
        .filter(r => r.siteId === siteId && resolveId(r.materialId) === resolveId(materialId))
        .reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
    },

    getSiteDamaged: (materialId, siteId) => {
      return cache.siteDamaged
        .filter(r => r.siteId === siteId && resolveId(r.materialId) === resolveId(materialId))
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
      { name: 'Shuttering plate 2\'x4\'', sku: 'SHUT-2x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 8.0 },
      { name: 'Shuttering plate 18"x4\'', sku: 'SHUT-18x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 6.0 },
      { name: 'Shuttering plate 15"x4\'', sku: 'SHUT-15x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 5.0 },
      { name: 'Shuttering plate 12"x4\'', sku: 'SHUT-12x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 4.0 },
      { name: 'Shuttering plate 9"x4\'', sku: 'SHUT-9x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 3.0 },
      { name: 'Shuttering plate 6"x4\'', sku: 'SHUT-6x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 2.0 },
      { name: 'Shuttering plate 2\'x3\'', sku: 'SHUT-2x3', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 6.0 },
      { name: 'Shuttering plate 18"x3\'', sku: 'SHUT-18x3', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 4.5 },
      { name: 'Shuttering plate 15"x3\'', sku: 'SHUT-15x3', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 3.75 },
      { name: 'Shuttering plate 12"x3\'', sku: 'SHUT-12x3', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 3.0 },
      { name: 'Shuttering plate 9"x3\'', sku: 'SHUT-9x3', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 2.25 },
      { name: 'Shuttering plate 6"x3\'', sku: 'SHUT-6x3', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 1.5 },
      
      { name: 'Channels', sku: 'CHAN', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 0 },
      { name: 'Balli', sku: 'BAL', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 0 },
      { name: 'Props', sku: 'PROP', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 0 },
      { name: 'Pipe', sku: 'PIPE', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 0 },
      { name: 'Ledger', sku: 'LEDG', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 0 },
      
      { name: 'Miscellaneous', sku: 'MISC', category: 'General', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', sqFtPerUnit: 0 }
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

  // ---- Plate Sq Ft Lookup Map (by SKU) ----
  const PLATE_SQFT_MAP = {
    'SHUT-2x4': 8.0, 'SHUT-18x4': 6.0, 'SHUT-15x4': 5.0, 'SHUT-12x4': 4.0, 'SHUT-9x4': 3.0, 'SHUT-6x4': 2.0,
    'SHUT-2x3': 6.0, 'SHUT-18x3': 4.5, 'SHUT-15x3': 3.75, 'SHUT-12x3': 3.0, 'SHUT-9x3': 2.25, 'SHUT-6x3': 1.5
  };

  // Plate SKU sort order (largest → smallest)
  const PLATE_SKU_ORDER = ['SHUT-2x4','SHUT-18x4','SHUT-15x4','SHUT-12x4','SHUT-9x4','SHUT-6x4','SHUT-2x3','SHUT-18x3','SHUT-15x3','SHUT-12x3','SHUT-9x3','SHUT-6x3'];

  // ---- SKU normalizer: converts unicode × → ASCII x, trims spaces, lowercase ----
  function normSku(sku) {
    if (!sku) return '';
    return sku.replace(/[\u00D7\u2715Xx]/g, 'x').replace(/\s+/g, '').toLowerCase();
  }

  // Helper: is this material a plate? (case-insensitive, matches STEEL PLATE and Shuttering plate)
  function isPlate(m) {
    const cat = (m.category || '').trim().toLowerCase();
    return cat === 'steel plate' || cat === 'shuttering plate';
  }

  // Build normalized lookup map for sqFtPerUnit (keys are normalized SKUs)
  const PLATE_SQFT_MAP_NORM = {};
  Object.keys(PLATE_SQFT_MAP).forEach(k => { PLATE_SQFT_MAP_NORM[normSku(k)] = PLATE_SQFT_MAP[k]; });

  // Normalized plate sort order
  const PLATE_SKU_ORDER_NORM = PLATE_SKU_ORDER.map(normSku);

  // Robust dimension extractor looking at Name first, then SKU
  function extractSqFtFromNameOrSku(name, sku) {
    function parseStr(str) {
      if (!str) return 0;
      const s = str.replace(/[\u00D7\u2715Xx]/g, 'x').replace(/[\u2019\u2018']/g, "'").replace(/[\u201D\u201C"]/g, '"').toLowerCase();
      
      // Look for exact dimension combinations
      if (s.includes("2'x4'") || s.includes("2'x4") || s.includes("2x4'") || s.includes("2 x 4") || /\b2\s*x\s*4\b/.test(s)) return 8.0;
      if (s.includes("2'x3'") || s.includes("2'x3") || s.includes("2x3'") || s.includes("2 x 3") || /\b2\s*x\s*3\b/.test(s)) return 6.0;

      if (/18\D*4/.test(s)) return 6.0;
      if (/15\D*4/.test(s)) return 5.0;
      if (/12\D*4/.test(s)) return 4.0;
      if (/9\D*4/.test(s)) return 3.0;
      if (/6\D*4/.test(s)) return 2.0;

      if (/18\D*3/.test(s)) return 4.5;
      if (/15\D*3/.test(s)) return 3.75;
      if (/12\D*3/.test(s)) return 3.0;
      if (/9\D*3/.test(s)) return 2.25;
      if (/6\D*3/.test(s)) return 1.5;
      
      return 0;
    }
    
    const valFromName = parseStr(name);
    if (valFromName > 0) return valFromName;
    return parseStr(sku);
  }

  // Robust default sort order extractor matching the user's target sequence (1-13)
  function getDefaultSortOrder(name, sku) {
    const combined = ((name || '') + ' ' + (sku || '')).replace(/[\u00D7\u2715Xx]/g, 'x').replace(/[\u2019\u2018']/g, "'").replace(/[\u201D\u201C"]/g, '"').toLowerCase();
    
    // Check 2x4
    if (combined.includes("2'x4'") || combined.includes("2'x4") || combined.includes("2x4'") || combined.includes("2 x 4") || /\b2\s*x\s*4\b/.test(combined)) return 1;
    
    // Check 18"x4'
    if (combined.includes("18") && combined.includes("4")) return 2;
    // Check 15"x4'
    if (combined.includes("15") && combined.includes("4")) return 3;
    // Check 12"x4'
    if (combined.includes("12") && combined.includes("4")) return 4;
    // Check 9"x4'
    if (combined.includes("9") && combined.includes("4")) return 5;
    // Check 6"x4'
    if (combined.includes("6") && combined.includes("4")) return 6;
    
    // Check 2x3
    if (combined.includes("2'x3'") || combined.includes("2'x3") || combined.includes("2x3'") || combined.includes("2 x 3") || /\b2\s*x\s*3\b/.test(combined)) return 7;
    
    // Check 18"x3'
    if (combined.includes("18") && combined.includes("3")) return 8;
    // Check 15"x3'
    if (combined.includes("15") && combined.includes("3")) return 9;
    // Check 12"x3'
    if (combined.includes("12") && combined.includes("3")) return 10;
    // Check 9"x3'
    if (combined.includes("9") && combined.includes("3")) return 11;
    // Check 6"x3'
    if (combined.includes("6") && combined.includes("3")) return 12;

    // Check Balli
    if (combined.includes("balli") || (sku || '').toLowerCase() === 'bal') return 13;

    return 999;
  }

  // ---- Auto-patch existing materials with sqFtPerUnit and sortOrder if missing ----
  async function patchMaterialSqFt() {
    // Step 1: Remove duplicate ASCII-x 3-foot plates that were incorrectly seeded
    const asciiThreeFootSkus = ['SHUT-2x3','SHUT-18x3','SHUT-15x3','SHUT-12x3','SHUT-9x3','SHUT-6x3'];
    const duplicatesToRemove = [];
    for (const sku of asciiThreeFootSkus) {
      const withSku = cache.materials.filter(m => m.sku === sku);
      if (withSku.length > 1) {
        const sortedByDate = [...withSku].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        sortedByDate.slice(1).forEach(m => duplicatesToRemove.push(m.id));
      }
    }
    for (const id of duplicatesToRemove) {
      cache.materials = cache.materials.filter(m => m.id !== id);
      try { await fetch(`${API_URL}/materials/${id}`, { method: 'DELETE' }); } catch(e) { /* silent */ }
    }

    // Step 2: Patch all plate/balli materials that have missing/incorrect values
    const toUpdate = cache.materials.filter(m => {
      const expectedSqFt = extractSqFtFromNameOrSku(m.name, m.sku);
      const expectedOrder = getDefaultSortOrder(m.name, m.sku);
      
      const needsSqFt = expectedSqFt > 0 && (!m.sqFtPerUnit || parseFloat(m.sqFtPerUnit) !== expectedSqFt);
      const needsOrder = !m.hasOwnProperty('sortOrder') || m.sortOrder === undefined || (m.sortOrder !== expectedOrder && expectedOrder !== 999);
      
      return needsSqFt || needsOrder;
    });

    for (const m of toUpdate) {
      const sqFt = extractSqFtFromNameOrSku(m.name, m.sku);
      const order = getDefaultSortOrder(m.name, m.sku);
      
      if (sqFt > 0) m.sqFtPerUnit = sqFt;
      if (order !== 999) m.sortOrder = order;
      
      try {
        await fetch(`${API_URL}/materials/${m.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sqFtPerUnit: m.sqFtPerUnit || 0, sortOrder: m.sortOrder || 999 })
        });
      } catch (e) { /* silent */ }
    }
    if (toUpdate.length > 0 || duplicatesToRemove.length > 0) {
      persistLocal('bm_materials', cache.materials);
    }
  }

  // ---- Extended Materials store with sorting ----
  const Materials = {
    ...MaterialsStore,
    getSorted() {
      const all = cache.materials || [];
      const cats = cache.categories || [];
      
      const getCatOrder = (catName) => {
        const found = cats.find(c => String(c.id).toLowerCase() === String(catName).toLowerCase());
        return found ? (typeof found.sortOrder === 'number' ? found.sortOrder : 999) : 999;
      };

      return [...all].sort((a, b) => {
        // 1. Sort by Category sortOrder first
        const aCatOrder = getCatOrder(a.category);
        const bCatOrder = getCatOrder(b.category);
        if (aCatOrder !== bCatOrder) return aCatOrder - bCatOrder;

        // 2. Sort by Material sortOrder second
        const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : 999;
        const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : 999;
        if (aOrder !== bOrder) return aOrder - bOrder;

        // 3. Fallback to alphabetical sorting by name
        return (a.name || '').localeCompare(b.name || '');
      });
    },

    getSqFtPerUnit(materialId) {
      const m = cache.materials.find(x => String(x.id) === String(materialId) || String(x._id) === String(materialId));
      if (!m) return 0;
      const parsed = extractSqFtFromNameOrSku(m.name, m.sku);
      if (parsed > 0) return parsed;
      return parseFloat(m.sqFtPerUnit) || 0;
    }
  };



  // ---- Sq Ft Movement (last 7 days) for dashboard ----
  function getSqFtMovement7Days() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    const siteReturns = cache.siteReturns || [];
    const outgoing = cache.outgoing || [];
    let totalIssued = 0, totalReturned = 0;
    const daily = dates.map(date => {
      let issued = 0, returned = 0;
      outgoing.filter(r => r.date === date).forEach(r => {
        (r.items || []).forEach(item => {
          const sqFt = Materials.getSqFtPerUnit(item.materialId);
          issued += (parseFloat(item.quantity) || 0) * sqFt;
        });
      });
      siteReturns.filter(r => r.date === date).forEach(r => {
        const sqFt = Materials.getSqFtPerUnit(r.materialId);
        returned += (parseFloat(r.quantity) || 0) * sqFt;
      });
      totalIssued += issued;
      totalReturned += returned;
      return { date: date.substring(5), issued, returned };
    });
    return { totalIssued, totalReturned, daily };
  }

  return { Customers, Sites, Materials, Incoming, Outgoing, SiteUsage, SiteReturns, SiteDamaged, SiteExpenses, SitePayments, Transactions, RentalSites, Categories, logTransaction, resetStock, Inventory, Auth, init, patchMaterialSqFt, getSqFtMovement7Days };

})();
