/* ============================================
   KSS33 Global Store (localStorage - synchronous)
   ============================================ */
const Store = (() => {

  // ---------- LocalStorage Helpers ----------
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  }
  function lsSet(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
  function lsGetOne(key, id) { return lsGet(key).find(x => x.id === id) || null; }
  function lsAdd(key, data) {
    const items = lsGet(key);
    const item = { ...data, id: 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6) };
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
    lsSet(key, lsGet(key).filter(x => x.id !== id));
    return { success: true };
  }

  // ---------- CRUD factory (synchronous) ----------
  function makeStore(lsKey) {
    return {
      getAll: () => lsGet(lsKey),
      getById: (id) => lsGetOne(lsKey, id),
      add: (data) => lsAdd(lsKey, data),
      update: (id, data) => lsUpdate(lsKey, id, data),
      remove: (id) => lsRemove(lsKey, id)
    };
  }

  // ---- Collections ----
  const Customers    = makeStore('bm_customers');
  const Materials    = makeStore('bm_materials');
  const Incoming     = makeStore('bm_incoming');
  const Outgoing     = makeStore('bm_outgoing');
  const SiteUsage    = makeStore('bm_siteUsage');
  const SiteReturns  = makeStore('bm_siteReturns');
  const SiteDamaged  = makeStore('bm_siteDamaged');
  const SiteExpenses = makeStore('bm_siteExpenses');

  const SitePayments = {
    ...makeStore('bm_sitePayments'),
    getBySite: (siteId) => lsGet('bm_sitePayments').filter(x => x.siteId === siteId),
    getTotalBySite: (siteId) => lsGet('bm_sitePayments')
      .filter(x => x.siteId === siteId)
      .reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)
  };

  // ---- Sites (with cascade delete) ----
  const Sites = {
    getAll: () => lsGet('bm_sites'),
    getById: (id) => lsGetOne('bm_sites', id),
    getByCustomer: (customerId) => lsGet('bm_sites').filter(s => s.customerId === customerId),
    add: (s) => lsAdd('bm_sites', s),
    update: (id, s) => lsUpdate('bm_sites', id, s),
    remove: (id) => {
      lsRemove('bm_sites', id);
      ['bm_incoming','bm_outgoing','bm_siteUsage','bm_siteReturns','bm_siteDamaged','bm_siteExpenses','bm_sitePayments'].forEach(key => {
        lsSet(key, lsGet(key).filter(x => x.siteId !== id && x.destinationSiteId !== id));
      });
      return { success: true };
    }
  };

  // ---- Auth ----
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
    getRecentMovements: (limit = 10) => {
      const allIncoming = lsGet('bm_incoming');
      const allOutgoing = lsGet('bm_outgoing');
      const materials   = lsGet('bm_materials');
      const sites       = lsGet('bm_sites');

      let moves = [];
      allIncoming.forEach(r => {
        (r.items || []).forEach(i => {
          const mat = materials.find(m => m.id === i.materialId);
          const destSite = sites.find(s => s.id === r.destinationSiteId);
          moves.push({
            date: r.date, type: 'Incoming', destinationType: r.destinationType,
            destination: r.destinationType === 'site' && destSite ? destSite.name : 'Warehouse',
            material: mat ? mat.name : 'Unknown', sku: mat ? mat.sku : '',
            quantity: i.quantity, id: r.id
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
            material: mat ? mat.name : 'Unknown', sku: mat ? mat.sku : '',
            quantity: i.quantity, id: r.id
          });
        });
      });
      moves.sort((a, b) => new Date(b.date) - new Date(a.date));
      return moves.slice(0, limit);
    },

    getOverview: () => {
      const materials   = lsGet('bm_materials');
      const allIncoming = lsGet('bm_incoming');
      const allOutgoing = lsGet('bm_outgoing');
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
      const allIncoming = lsGet('bm_incoming');
      const allOutgoing = lsGet('bm_outgoing');
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
      const allOutgoing       = lsGet('bm_outgoing');
      const allIncomingDirect = lsGet('bm_incoming');
      const siteReturns       = lsGet('bm_siteReturns');
      const siteUsage         = lsGet('bm_siteUsage');
      const siteDamaged       = lsGet('bm_siteDamaged');
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
      const allOutgoing       = lsGet('bm_outgoing');
      const allIncomingDirect = lsGet('bm_incoming');
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

  // ---- Seed default materials ----
  function seed() {
    if (lsGet('bm_materials').length > 0) return;
    [
      { name: 'Cement (OPC 53)', sku: 'CEM-01', category: 'Raw Materials', unit: 'Bags', unitPrice: 350, reorderLevel: 100, status: 'Active' },
      { name: 'Steel TMT 12mm', sku: 'STL-12', category: 'Raw Materials', unit: 'MT', unitPrice: 55000, reorderLevel: 5, status: 'Active' },
      { name: 'Red Bricks', sku: 'BRK-01', category: 'Raw Materials', unit: 'Nos', unitPrice: 8, reorderLevel: 5000, status: 'Active' },
      { name: 'River Sand', sku: 'SND-01', category: 'Raw Materials', unit: 'CFT', unitPrice: 60, reorderLevel: 1000, status: 'Active' },
      { name: 'Cuplock Vertical 3m', sku: 'CUP-V3', category: 'Scaffolding', unit: 'Nos', unitPrice: 800, reorderLevel: 100, status: 'Active' },
      { name: 'Cuplock Ledger 1.5m', sku: 'CUP-L1', category: 'Scaffolding', unit: 'Nos', unitPrice: 400, reorderLevel: 200, status: 'Active' },
      { name: 'Shuttering Ply 12mm', sku: 'PLY-12', category: 'Scaffolding', unit: 'SqFt', unitPrice: 45, reorderLevel: 500, status: 'Active' },
      { name: 'Balli', sku: 'BAL-01', category: 'Scaffolding', unit: 'Nos', unitPrice: 150, reorderLevel: 50, status: 'Active' },
      { name: 'Props', sku: 'PROP-01', category: 'Scaffolding', unit: 'Nos', unitPrice: 100, reorderLevel: 50, status: 'Active' }
    ].forEach(m => lsAdd('bm_materials', m));
  }

  return { Customers, Sites, Materials, Incoming, Outgoing, SiteUsage, SiteReturns, SiteDamaged, SiteExpenses, SitePayments, Inventory, Auth, seed };
})();
