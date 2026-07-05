/* ============================================
   KSS33 Global Store
   Dual-mode: MongoDB (local) or localStorage (Vercel/offline)
   ============================================ */
const Store = (() => {
  const API_URL = 'http://localhost:5000/api';
  let _useAPI = null; // null = not yet detected

  // ---------- LocalStorage Helpers ----------
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  }
  function lsSet(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
  function lsGetOne(key, id) { return lsGet(key).find(x => x.id === id) || null; }
  function lsAdd(key, data) {
    const items = lsGet(key);
    const item = { ...data, id: 'ls_' + Date.now() + '_' + Math.random().toString(36).substr(2,6) };
    items.push(item);
    lsSet(key, items);
    return item;
  }
  function lsUpdate(key, id, data) {
    const items = lsGet(key);
    const idx = items.findIndex(x => x.id === id);
    if (idx > -1) { items[idx] = { ...items[idx], ...data }; lsSet(key, items); return items[idx]; }
    return null;
  }
  function lsRemove(key, id) {
    const items = lsGet(key).filter(x => x.id !== id);
    lsSet(key, items);
    return { success: true };
  }

  // ---------- API availability check ----------
  async function checkAPI() {
    if (_useAPI !== null) return _useAPI;
    try {
      const res = await Promise.race([
        fetch(`${API_URL}/materials`, { method: 'GET' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]);
      _useAPI = res.ok;
    } catch {
      _useAPI = false;
    }
    console.log(_useAPI ? '✅ MongoDB connected' : '⚡ Offline mode (localStorage)');
    return _useAPI;
  }

  // ---------- Smart fetch ----------
  async function apiFetch(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      if (!response.ok) throw new Error(`API error: ${response.statusText}`);
      return await response.json();
    } catch (err) {
      return null;
    }
  }

  // ---------- Dual-mode CRUD factory ----------
  function makeStore(apiPath, lsKey) {
    return {
      getAll: async () => {
        if (await checkAPI()) return await apiFetch(apiPath) || [];
        return lsGet(lsKey);
      },
      getById: async (id) => {
        if (await checkAPI()) return await apiFetch(`${apiPath}/${id}`);
        return lsGetOne(lsKey, id);
      },
      add: async (data) => {
        if (await checkAPI()) return await apiFetch(apiPath, { method: 'POST', body: JSON.stringify(data) });
        return lsAdd(lsKey, data);
      },
      update: async (id, data) => {
        if (await checkAPI()) return await apiFetch(`${apiPath}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        return lsUpdate(lsKey, id, data);
      },
      remove: async (id) => {
        if (await checkAPI()) return await apiFetch(`${apiPath}/${id}`, { method: 'DELETE' });
        return lsRemove(lsKey, id);
      }
    };
  }

  // ---- Collections ----
  const Customers   = makeStore('/customers', 'bm_customers');
  const Materials   = makeStore('/materials', 'bm_materials');
  const Incoming    = makeStore('/incoming', 'bm_incoming');
  const Outgoing    = makeStore('/outgoing', 'bm_outgoing');
  const SiteUsage   = makeStore('/siteUsage', 'bm_siteUsage');
  const SiteReturns = makeStore('/siteReturns', 'bm_siteReturns');
  const SiteDamaged = makeStore('/siteDamaged', 'bm_siteDamaged');
  const SiteExpenses = makeStore('/siteExpenses', 'bm_siteExpenses');
  const SitePayments = {
    ...makeStore('/sitePayments', 'bm_sitePayments'),
    getBySite: async (siteId) => {
      const all = await SitePayments.getAll();
      return all.filter(x => x.siteId === siteId);
    },
    getTotalBySite: async (siteId) => {
      const all = await SitePayments.getAll();
      return all.filter(x => x.siteId === siteId).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    }
  };

  // ---- Sites (with cascade delete) ----
  const Sites = {
    getAll: async () => {
      if (await checkAPI()) return await apiFetch('/sites') || [];
      return lsGet('bm_sites');
    },
    getById: async (id) => {
      if (await checkAPI()) return await apiFetch(`/sites/${id}`);
      return lsGetOne('bm_sites', id);
    },
    getByCustomer: async (customerId) => {
      const sites = await Sites.getAll();
      return sites.filter(s => s.customerId === customerId);
    },
    add: async (s) => {
      if (await checkAPI()) return await apiFetch('/sites', { method: 'POST', body: JSON.stringify(s) });
      return lsAdd('bm_sites', s);
    },
    update: async (id, s) => {
      if (await checkAPI()) return await apiFetch(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(s) });
      return lsUpdate('bm_sites', id, s);
    },
    remove: async (id) => {
      if (await checkAPI()) return await apiFetch(`/sites/${id}/cascade`, { method: 'DELETE' });
      // localStorage cascade
      lsRemove('bm_sites', id);
      ['bm_incoming','bm_outgoing','bm_siteUsage','bm_siteReturns','bm_siteDamaged','bm_siteExpenses','bm_sitePayments'].forEach(key => {
        lsSet(key, lsGet(key).filter(x => x.siteId !== id));
      });
      return { success: true };
    }
  };

  // ---- Auth (always localStorage) ----
  const Auth = {
    isLoggedIn: () => !!localStorage.getItem('bm_user'),
    getUser: () => {
      const stored = localStorage.getItem('bm_user');
      return stored ? JSON.parse(stored) : { name: 'Harsh' };
    },
    login: (password) => {
      if (password === 'kss33') {
        localStorage.setItem('bm_user', JSON.stringify({ name: 'Harsh', role: 'admin' }));
        return true;
      }
      return false;
    },
    logout: () => { localStorage.removeItem('bm_user'); }
  };

  // ---- Inventory Utility ----
  const Inventory = {
    getRecentMovements: async (limit = 10) => {
      const allIncoming = await Incoming.getAll();
      const allOutgoing = await Outgoing.getAll();
      const materials   = await Materials.getAll();
      const sites       = await Sites.getAll();

      let moves = [];
      allIncoming.forEach(r => {
        (r.items || []).forEach(i => {
          const mat = materials.find(m => m.id === i.materialId);
          const destSite = sites.find(s => s.id === r.destinationSiteId);
          moves.push({
            date: r.date, type: 'Incoming', destinationType: r.destinationType,
            destination: r.destinationType === 'site' && destSite ? destSite.name : 'Warehouse',
            material: mat ? mat.name : 'Unknown', sku: mat ? mat.sku : '', quantity: i.quantity, id: r.id
          });
        });
      });
      allOutgoing.forEach(r => {
        (r.items || []).forEach(i => {
          const mat = materials.find(m => m.id === i.materialId);
          const destSite = sites.find(s => s.id === r.siteId);
          moves.push({
            date: r.date, type: 'Outgoing', destinationType: 'site',
            destination: destSite ? destSite.name : 'Site',
            material: mat ? mat.name : 'Unknown', sku: mat ? mat.sku : '', quantity: i.quantity, id: r.id
          });
        });
      });
      moves.sort((a, b) => new Date(b.date) - new Date(a.date));
      return moves.slice(0, limit);
    },

    getOverview: async () => {
      const materials   = await Materials.getAll();
      const allIncoming = await Incoming.getAll();
      const allOutgoing = await Outgoing.getAll();
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

    getWarehouseCurrentBalance: async (materialId) => {
      const allIncoming = await Incoming.getAll();
      const allOutgoing = await Outgoing.getAll();
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

    getSiteCurrentBalance: async (materialId, siteId) => {
      const allOutgoing = await Outgoing.getAll();
      const allIncomingDirect = await Incoming.getAll();
      const siteReturns = await SiteReturns.getAll();
      const siteUsage   = await SiteUsage.getAll();
      const siteDamaged = await SiteDamaged.getAll();
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

    getSiteTotalSent: async (materialId, siteId) => {
      const allOutgoing = await Outgoing.getAll();
      const allIncomingDirect = await Incoming.getAll();
      let totalIn = 0;
      allOutgoing.filter(r => r.siteId === siteId).forEach(r => {
        (r.items || []).forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
      });
      allIncomingDirect.filter(r => r.destinationType === 'site' && r.destinationSiteId === siteId).forEach(r => {
        (r.items || []).forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
      });
      return totalIn;
    }
  };

  // ---- Seed (only for localStorage mode) ----
  async function seed() {
    if (await checkAPI()) {
      // MongoDB handles its own seed via the server
      const mats = await Materials.getAll();
      if (mats && mats.length > 0) return;
      const materialsData = [
        { name: 'Cement (OPC 53)', sku: 'CEM-01', category: 'Raw Materials', unit: 'Bags', unitPrice: 350, reorderLevel: 100, status: 'Active' },
        { name: 'Steel TMT 12mm', sku: 'STL-12', category: 'Raw Materials', unit: 'MT', unitPrice: 55000, reorderLevel: 5, status: 'Active' },
        { name: 'Red Bricks', sku: 'BRK-01', category: 'Raw Materials', unit: 'Nos', unitPrice: 8, reorderLevel: 5000, status: 'Active' },
        { name: 'River Sand', sku: 'SND-01', category: 'Raw Materials', unit: 'CFT', unitPrice: 60, reorderLevel: 1000, status: 'Active' },
        { name: 'Cuplock Vertical 3m', sku: 'CUP-V3', category: 'Scaffolding', unit: 'Nos', unitPrice: 800, reorderLevel: 100, status: 'Active' },
        { name: 'Cuplock Ledger 1.5m', sku: 'CUP-L1', category: 'Scaffolding', unit: 'Nos', unitPrice: 400, reorderLevel: 200, status: 'Active' },
        { name: 'Shuttering Ply 12mm', sku: 'PLY-12', category: 'Scaffolding', unit: 'SqFt', unitPrice: 45, reorderLevel: 500, status: 'Active' },
        { name: 'Balli', sku: 'BAL-01', category: 'Scaffolding', unit: 'Nos', unitPrice: 150, reorderLevel: 50, status: 'Active' },
        { name: 'Props', sku: 'PROP-01', category: 'Scaffolding', unit: 'Nos', unitPrice: 100, reorderLevel: 50, status: 'Active' }
      ];
      for (const m of materialsData) await Materials.add(m);
    } else {
      // localStorage seed
      if (lsGet('bm_materials').length > 0) return;
      const materialsData = [
        { name: 'Cement (OPC 53)', sku: 'CEM-01', category: 'Raw Materials', unit: 'Bags', unitPrice: 350, reorderLevel: 100, status: 'Active' },
        { name: 'Steel TMT 12mm', sku: 'STL-12', category: 'Raw Materials', unit: 'MT', unitPrice: 55000, reorderLevel: 5, status: 'Active' },
        { name: 'Red Bricks', sku: 'BRK-01', category: 'Raw Materials', unit: 'Nos', unitPrice: 8, reorderLevel: 5000, status: 'Active' },
        { name: 'River Sand', sku: 'SND-01', category: 'Raw Materials', unit: 'CFT', unitPrice: 60, reorderLevel: 1000, status: 'Active' },
        { name: 'Cuplock Vertical 3m', sku: 'CUP-V3', category: 'Scaffolding', unit: 'Nos', unitPrice: 800, reorderLevel: 100, status: 'Active' },
        { name: 'Cuplock Ledger 1.5m', sku: 'CUP-L1', category: 'Scaffolding', unit: 'Nos', unitPrice: 400, reorderLevel: 200, status: 'Active' },
        { name: 'Shuttering Ply 12mm', sku: 'PLY-12', category: 'Scaffolding', unit: 'SqFt', unitPrice: 45, reorderLevel: 500, status: 'Active' },
        { name: 'Balli', sku: 'BAL-01', category: 'Scaffolding', unit: 'Nos', unitPrice: 150, reorderLevel: 50, status: 'Active' },
        { name: 'Props', sku: 'PROP-01', category: 'Scaffolding', unit: 'Nos', unitPrice: 100, reorderLevel: 50, status: 'Active' }
      ];
      materialsData.forEach(m => lsAdd('bm_materials', m));
    }
  }

  return { Customers, Sites, Materials, Incoming, Outgoing, SiteUsage, SiteReturns, SiteDamaged, SiteExpenses, SitePayments, Inventory, Auth, seed };
})();
