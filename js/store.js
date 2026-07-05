/* ============================================
   KSS33 Global Store (MongoDB / Node.js Backend)
   ============================================ */
const Store = (() => {
  const API_URL = 'http://localhost:5000/api';

  async function apiFetch(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      if (!response.ok) throw new Error(`API error: ${response.statusText}`);
      return await response.json();
    } catch (err) {
      console.error('API Error:', err);
      return null;
    }
  }

  // Base generic CRUD
  async function getAll(endpoint) { return await apiFetch(endpoint) || []; }
  async function getById(endpoint, id) { return await apiFetch(`${endpoint}/${id}`); }
  async function add(endpoint, data) { return await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
  async function update(endpoint, id, data) { return await apiFetch(`${endpoint}/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async function remove(endpoint, id) { return await apiFetch(`${endpoint}/${id}`, { method: 'DELETE' }); }

  // ---- Customers ----
  const Customers = {
    getAll: async () => await getAll('/customers'),
    getById: async (id) => await getById('/customers', id),
    add: async (c) => await add('/customers', c),
    update: async (id, c) => await update('/customers', id, c),
    remove: async (id) => await remove('/customers', id)
  };

  // ---- Sites ----
  const Sites = {
    getAll: async () => await getAll('/sites'),
    getById: async (id) => await getById('/sites', id),
    getByCustomer: async (customerId) => {
      const sites = await getAll('/sites');
      return sites.filter(s => s.customerId === customerId);
    },
    add: async (s) => await add('/sites', s),
    update: async (id, s) => await update('/sites', id, s),
    remove: async (id) => {
      // Call special cascade delete endpoint
      return await apiFetch(`/sites/${id}/cascade`, { method: 'DELETE' });
    }
  };

  // ---- Materials ----
  const Materials = {
    getAll: async () => await getAll('/materials'),
    getById: async (id) => await getById('/materials', id),
    add: async (p) => await add('/materials', p),
    update: async (id, p) => await update('/materials', id, p),
    remove: async (id) => await remove('/materials', id)
  };

  // ---- Incoming Stock ----
  const Incoming = {
    getAll: async () => await getAll('/incoming'),
    getById: async (id) => await getById('/incoming', id),
    add: async (item) => await add('/incoming', item),
    update: async (id, item) => await update('/incoming', id, item),
    remove: async (id) => await remove('/incoming', id)
  };

  // ---- Outgoing Stock ----
  const Outgoing = {
    getAll: async () => await getAll('/outgoing'),
    getById: async (id) => await getById('/outgoing', id),
    add: async (item) => await add('/outgoing', item),
    update: async (id, item) => await update('/outgoing', id, item),
    remove: async (id) => await remove('/outgoing', id)
  };

  // ---- Site Usage ----
  const SiteUsage = {
    getAll: async () => await getAll('/siteUsage'),
    add: async (item) => await add('/siteUsage', item)
  };

  // ---- Site Returns ----
  const SiteReturns = {
    getAll: async () => await getAll('/siteReturns'),
    add: async (item) => await add('/siteReturns', item)
  };

  // ---- Site Damaged ----
  const SiteDamaged = {
    getAll: async () => await getAll('/siteDamaged'),
    add: async (item) => await add('/siteDamaged', item)
  };

  // ---- Site Expenses ----
  const SiteExpenses = {
    getAll: async () => await getAll('/siteExpenses'),
    add: async (item) => await add('/siteExpenses', item),
    remove: async (id) => await remove('/siteExpenses', id)
  };

  // ---- Site Payments ----
  const SitePayments = {
    getAll: async () => await getAll('/sitePayments'),
    getBySite: async (siteId) => {
      const p = await getAll('/sitePayments');
      return p.filter(x => x.siteId === siteId);
    },
    getTotalBySite: async (siteId) => {
      const p = await getAll('/sitePayments');
      return p.filter(x => x.siteId === siteId).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    },
    add: async (item) => await add('/sitePayments', item),
    remove: async (id) => await remove('/sitePayments', id)
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
    logout: () => {
      localStorage.removeItem('bm_user');
    }
  };

  // ---- Inventory Utility ----
  const Inventory = {
    getRecentMovements: async (limit = 10) => {
      const allIncoming = await Incoming.getAll();
      const allOutgoing = await Outgoing.getAll();
      const materials = await Materials.getAll();
      const sites = await Sites.getAll();
      
      let moves = [];
      allIncoming.forEach(r => {
        r.items.forEach(i => {
          const mat = materials.find(m => m.id === i.materialId);
          const destSite = sites.find(s => s.id === r.destinationSiteId);
          moves.push({
            date: r.date,
            type: 'Incoming',
            destinationType: r.destinationType,
            destination: r.destinationType === 'site' && destSite ? destSite.name : 'Warehouse',
            material: mat ? mat.name : 'Unknown',
            sku: mat ? mat.sku : '',
            quantity: i.quantity,
            id: r.id
          });
        });
      });
      allOutgoing.forEach(r => {
        r.items.forEach(i => {
          const mat = materials.find(m => m.id === i.materialId);
          const destSite = sites.find(s => s.id === r.siteId);
          moves.push({
            date: r.date,
            type: 'Outgoing',
            destinationType: 'site',
            destination: destSite ? destSite.name : 'Site',
            material: mat ? mat.name : 'Unknown',
            sku: mat ? mat.sku : '',
            quantity: i.quantity,
            id: r.id
          });
        });
      });
      moves.sort((a,b) => new Date(b.date) - new Date(a.date));
      return moves.slice(0, limit);
    },
    getOverview: async () => {
      const materials = await Materials.getAll();
      const allIncoming = await Incoming.getAll();
      const allOutgoing = await Outgoing.getAll();
      
      return materials.map(material => {
        let totalIn = 0;
        allIncoming.filter(r => r.destinationType === 'warehouse').forEach(r => {
          r.items.forEach(i => { if (i.materialId === material.id) totalIn += (parseFloat(i.quantity) || 0); });
        });
        
        let totalOut = 0;
        allOutgoing.forEach(r => {
          r.items.forEach(i => { if (i.materialId === material.id) totalOut += (parseFloat(i.quantity) || 0); });
        });
        
        return {
          material,
          warehouseStock: totalIn - totalOut
        };
      });
    },
    getWarehouseCurrentBalance: async (materialId) => {
      const allIncoming = await Incoming.getAll();
      const allOutgoing = await Outgoing.getAll();
      
      let totalIn = 0;
      allIncoming.filter(r => r.destinationType === 'warehouse').forEach(r => {
        r.items.forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
      });
      
      let totalOut = 0;
      allOutgoing.forEach(r => {
        r.items.forEach(i => { if (i.materialId === materialId) totalOut += (parseFloat(i.quantity) || 0); });
      });
      
      return totalIn - totalOut;
    },

    getSiteCurrentBalance: async (materialId, siteId) => {
      const allOutgoing = await Outgoing.getAll();
      const allIncomingDirect = await Incoming.getAll();
      const siteReturns = await SiteReturns.getAll();
      const siteUsage = await SiteUsage.getAll();
      const siteDamaged = await SiteDamaged.getAll();

      let totalIn = 0;
      allOutgoing.filter(r => r.siteId === siteId).forEach(r => {
        r.items.forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
      });
      allIncomingDirect.filter(r => r.destinationType === 'site' && r.destinationSiteId === siteId).forEach(r => {
        r.items.forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
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
        r.items.forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
      });
      allIncomingDirect.filter(r => r.destinationType === 'site' && r.destinationSiteId === siteId).forEach(r => {
        r.items.forEach(i => { if (i.materialId === materialId) totalIn += (parseFloat(i.quantity) || 0); });
      });
      return totalIn;
    }
  };

  // Generate seed data in MongoDB
  async function seed() {
    // Only run if empty
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

    for (const m of materialsData) {
      await Materials.add(m);
    }
  }

  return { Customers, Sites, Materials, Incoming, Outgoing, SiteUsage, SiteReturns, SiteDamaged, SiteExpenses, SitePayments, Inventory, Auth, seed };
})();
