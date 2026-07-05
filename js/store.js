/* ============================================
   BuildMate Data Store
   localStorage-backed CRUD + Seed Data + Balance Logic
   ============================================ */

const Store = (() => {
  const KEYS = {
    customers: 'bm_customers',
    sites: 'bm_sites',
    materials: 'bm_materials',
    incoming: 'bm_incoming',
    outgoing: 'bm_outgoing',
    siteUsage: 'bm_site_usage',
    siteReturns: 'bm_site_returns',
    siteDamaged: 'bm_site_damaged',
    siteExpenses: 'bm_site_expenses',
    user: 'bm_user',
    initialized: 'bm_initialized'
  };

  // ---- Helpers ----
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }

  function set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function today() {
    return new Date().toISOString().split('T')[0];
  }

  // ---- CRUD Operations ----
  function getAll(key) { return get(key); }

  function getById(key, id) {
    return get(key).find(item => item.id === id) || null;
  }

  function add(key, item) {
    const data = get(key);
    item.id = item.id || uid();
    item.createdAt = item.createdAt || today();
    data.push(item);
    set(key, data);
    return item;
  }

  function update(key, id, updates) {
    const data = get(key);
    const idx = data.findIndex(item => item.id === id);
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...updates };
    set(key, data);
    return data[idx];
  }

  function remove(key, id) {
    const data = get(key).filter(item => item.id !== id);
    set(key, data);
  }

  // ---- Customers ----
  const Customers = {
    getAll: () => getAll(KEYS.customers),
    getById: (id) => getById(KEYS.customers, id),
    add: (c) => add(KEYS.customers, c),
    update: (id, c) => update(KEYS.customers, id, c),
    remove: (id) => remove(KEYS.customers, id)
  };

  // ---- Sites ----
  const Sites = {
    getAll: () => getAll(KEYS.sites),
    getById: (id) => getById(KEYS.sites, id),
    getByCustomer: (customerId) => getAll(KEYS.sites).filter(s => s.customerId === customerId),
    add: (s) => add(KEYS.sites, s),
    update: (id, s) => update(KEYS.sites, id, s),
    remove: (id) => remove(KEYS.sites, id)
  };

  // ---- Materials ----
  const Materials = {
    getAll: () => getAll(KEYS.materials),
    getById: (id) => getById(KEYS.materials, id),
    add: (p) => add(KEYS.materials, p),
    update: (id, p) => update(KEYS.materials, id, p),
    remove: (id) => remove(KEYS.materials, id)
  };

  // ---- Incoming Stock ----
  const Incoming = {
    getAll: () => getAll(KEYS.incoming),
    getById: (id) => getById(KEYS.incoming, id),
    add: (item) => add(KEYS.incoming, item),
    update: (id, item) => update(KEYS.incoming, id, item),
    remove: (id) => remove(KEYS.incoming, id)
  };

  // ---- Outgoing Stock ----
  const Outgoing = {
    getAll: () => getAll(KEYS.outgoing),
    getById: (id) => getById(KEYS.outgoing, id),
    add: (item) => add(KEYS.outgoing, item),
    update: (id, item) => update(KEYS.outgoing, id, item),
    remove: (id) => remove(KEYS.outgoing, id)
  };

  // ---- Site Usage ----
  const SiteUsage = {
    getAll: () => getAll(KEYS.siteUsage),
    add: (item) => add(KEYS.siteUsage, item)
  };

  // ---- Site Returns ----
  const SiteReturns = {
    getAll: () => getAll(KEYS.siteReturns),
    add: (item) => add(KEYS.siteReturns, item)
  };

  // ---- Site Damaged ----
  const SiteDamaged = {
    getAll: () => getAll(KEYS.siteDamaged),
    add: (item) => add(KEYS.siteDamaged, item)
  };

  // ---- Site Expenses ----
  const SiteExpenses = {
    getAll: () => getAll(KEYS.siteExpenses),
    add: (item) => add(KEYS.siteExpenses, item)
  };

  // ---- Inventory Balance Logic ----
  const Inventory = {
    // Get warehouse stock for a material
    getWarehouseStock(materialId) {
      const incoming = get(KEYS.incoming);
      const outgoing = get(KEYS.outgoing);

      let totalIn = 0;
      incoming.forEach(record => {
        record.items.forEach(item => {
          if (item.materialId === materialId && record.destinationType === 'warehouse') {
            totalIn += parseFloat(item.quantity) || 0;
          }
        });
      });

      let totalOut = 0;
      outgoing.forEach(record => {
        record.items.forEach(item => {
          if (item.materialId === materialId) {
            totalOut += parseFloat(item.quantity) || 0;
          }
        });
      });

      return totalIn - totalOut;
    },

    // Get stock at a specific site
    getSiteStock(materialId, siteId) {
      const outgoing = get(KEYS.outgoing);
      let total = 0;
      outgoing.forEach(record => {
        if (record.siteId === siteId) {
          record.items.forEach(item => {
            if (item.materialId === materialId) {
              total += parseFloat(item.quantity) || 0;
            }
          });
        }
      });
      return total;
    },

    // Get stock sent directly to a site via incoming
    getDirectSiteStock(materialId, siteId) {
      const incoming = get(KEYS.incoming);
      let total = 0;
      incoming.forEach(record => {
        if (record.destinationType === 'site' && record.destinationSiteId === siteId) {
          record.items.forEach(item => {
            if (item.materialId === materialId) {
              total += parseFloat(item.quantity) || 0;
            }
          });
        }
      });
      return total;
    },

    getSiteUsage(materialId, siteId) {
      let total = 0;
      get(KEYS.siteUsage).forEach(record => {
        if (record.siteId === siteId && record.materialId === materialId) {
          total += parseFloat(record.quantity) || 0;
        }
      });
      return total;
    },

    getSiteReturns(materialId, siteId) {
      let total = 0;
      get(KEYS.siteReturns).forEach(record => {
        if (record.siteId === siteId && record.materialId === materialId) {
          total += parseFloat(record.quantity) || 0;
        }
      });
      return total;
    },

    getSiteDamaged(materialId, siteId) {
      let total = 0;
      get(KEYS.siteDamaged).forEach(record => {
        if (record.siteId === siteId && record.materialId === materialId) {
          total += parseFloat(record.quantity) || 0;
        }
      });
      return total;
    },

    getSiteExpenses(siteId) {
      return get(KEYS.siteExpenses).filter(record => record.siteId === siteId);
    },

    getTotalSiteExpenses(siteId) {
      return this.getSiteExpenses(siteId).reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    },

    getSiteRevenue(siteId) {
      const materials = get(KEYS.materials);
      let totalRev = 0;
      const usage = get(KEYS.siteUsage).filter(r => r.siteId === siteId);
      usage.forEach(record => {
         const mat = materials.find(m => m.id === record.materialId);
         if (mat && mat.unitPrice) {
            // Updated calculation based on User request: Used * Unit Price
            totalRev += (parseFloat(record.quantity) || 0) * parseFloat(mat.unitPrice);
         }
      });
      return totalRev;
    },

    getSiteTotalSent(materialId, siteId) {
      return this.getSiteStock(materialId, siteId) + this.getDirectSiteStock(materialId, siteId);
    },

    getSiteCurrentBalance(materialId, siteId) {
      return this.getSiteTotalSent(materialId, siteId) - this.getSiteUsage(materialId, siteId) - this.getSiteReturns(materialId, siteId) - this.getSiteDamaged(materialId, siteId);
    },

    // Get total incoming for a material
    getTotalIncoming(materialId) {
      const incoming = get(KEYS.incoming);
      let total = 0;
      incoming.forEach(record => {
        record.items.forEach(item => {
          if (item.materialId === materialId) {
            total += parseFloat(item.quantity) || 0;
          }
        });
      });
      return total;
    },

    // Get total outgoing for a material
    getTotalOutgoing(materialId) {
      const outgoing = get(KEYS.outgoing);
      let total = 0;
      outgoing.forEach(record => {
        record.items.forEach(item => {
          if (item.materialId === materialId) {
            total += parseFloat(item.quantity) || 0;
          }
        });
      });
      return total;
    },

    // Full inventory overview
    getOverview() {
      const materials = get(KEYS.materials);
      const sites = get(KEYS.sites);
      const incoming = get(KEYS.incoming);
      const outgoing = get(KEYS.outgoing);

      return materials.map(material => {
        // Total warehouse incoming
        let warehouseIn = 0;
        incoming.forEach(record => {
          if (record.destinationType === 'warehouse') {
            record.items.forEach(item => {
              if (item.materialId === material.id) {
                warehouseIn += parseFloat(item.quantity) || 0;
              }
            });
          }
        });

        // Total outgoing (from warehouse to sites)
        let totalOut = 0;
        outgoing.forEach(record => {
          record.items.forEach(item => {
            if (item.materialId === material.id) {
              totalOut += parseFloat(item.quantity) || 0;
            }
          });
        });

        // Site-wise stocks
        const siteStocks = {};
        let totalSiteStock = 0;
        sites.forEach(site => {
          let siteQty = 0;
          outgoing.forEach(record => {
            if (record.siteId === site.id) {
              record.items.forEach(item => {
                if (item.materialId === material.id) {
                  siteQty += parseFloat(item.quantity) || 0;
                }
              });
            }
          });
          // Also add direct site incoming
          incoming.forEach(record => {
            if (record.destinationType === 'site' && record.destinationSiteId === site.id) {
              record.items.forEach(item => {
                if (item.materialId === material.id) {
                  siteQty += parseFloat(item.quantity) || 0;
                }
              });
            }
          });
          // Subtract returns from site stock, as they went back to warehouse
          const returns = this.getSiteReturns(material.id, site.id);
          siteQty -= returns;
          warehouseIn += returns; // returns go to warehouse

          siteStocks[site.id] = siteQty;
          totalSiteStock += siteQty;
        });

        const warehouseStock = warehouseIn - totalOut;

        return {
          material,
          warehouseStock,
          totalSiteStock,
          totalStock: warehouseStock + totalSiteStock,
          siteStocks,
          reorderLevel: material.reorderLevel || 50
        };
      });
    },

    // Stock ledger for a material (running balance like bank statement)
    getLedger(materialId, dateFrom, dateTo) {
      const incoming = get(KEYS.incoming);
      const outgoing = get(KEYS.outgoing);
      const sites = get(KEYS.sites);
      const customers = get(KEYS.customers);

      const entries = [];

      // Incoming entries
      incoming.forEach(record => {
        record.items.forEach(item => {
          if (item.materialId === materialId) {
            let destination = 'Warehouse';
            if (record.destinationType === 'site') {
              const site = sites.find(s => s.id === record.destinationSiteId);
              destination = site ? `${site.name} (${site.customerName || 'Unknown'})` : 'Site';
            }
            entries.push({
              date: record.date,
              type: 'Incoming',
              referenceNo: record.referenceNo || record.invoiceNo || '-',
              from: record.supplier || '-',
              to: destination,
              quantity: parseFloat(item.quantity) || 0,
              rate: parseFloat(item.rate) || 0
            });
          }
        });
      });

      // Outgoing entries
      outgoing.forEach(record => {
        record.items.forEach(item => {
          if (item.materialId === materialId) {
            const site = sites.find(s => s.id === record.siteId);
            entries.push({
              date: record.date,
              type: 'Outgoing',
              referenceNo: record.referenceNo || '-',
              from: 'Warehouse',
              to: site ? `${site.name} (${site.customerName || 'Unknown'})` : '-',
              quantity: parseFloat(item.quantity) || 0,
              rate: parseFloat(item.rate) || 0
            });
          }
        });
      });

      // Sort by date
      entries.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Filter by date range
      const filtered = entries.filter(e => {
        if (dateFrom && e.date < dateFrom) return false;
        if (dateTo && e.date > dateTo) return false;
        return true;
      });

      // Calculate running balance
      let balance = 0;
      // Calculate opening balance (all entries before dateFrom)
      if (dateFrom) {
        entries.forEach(e => {
          if (e.date < dateFrom) {
            balance += e.type === 'Incoming' ? e.quantity : -e.quantity;
          }
        });
      }

      const openingBalance = balance;

      const ledger = filtered.map(entry => {
        balance += entry.type === 'Incoming' ? entry.quantity : -entry.quantity;
        return { ...entry, balance };
      });

      return { openingBalance, entries: ledger, closingBalance: balance };
    },

    // Dashboard stats
    getStats() {
      const materials = get(KEYS.materials);
      const incoming = get(KEYS.incoming);
      const outgoing = get(KEYS.outgoing);
      const sites = get(KEYS.sites);

      let totalWarehouseValue = 0;
      let totalSiteValue = 0;
      let totalIncomingQty = 0;
      let totalOutgoingQty = 0;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      materials.forEach(p => {
        const overview = this.getOverview().find(o => o.material.id === p.id);
        if (overview) {
          totalWarehouseValue += overview.warehouseStock * (p.unitPrice || 0);
          totalSiteValue += overview.totalSiteStock * (p.unitPrice || 0);
        }
      });

      // MTD incoming
      incoming.forEach(record => {
        if (record.date >= monthStart) {
          record.items.forEach(item => {
            totalIncomingQty += parseFloat(item.quantity) || 0;
          });
        }
      });

      // MTD outgoing
      outgoing.forEach(record => {
        if (record.date >= monthStart) {
          record.items.forEach(item => {
            totalOutgoingQty += parseFloat(item.quantity) || 0;
          });
        }
      });

      // Low stock items
      const overviewData = this.getOverview();
      const lowStockItems = overviewData.filter(o => o.warehouseStock < o.reorderLevel && o.warehouseStock >= 0);

      return {
        warehouseValue: totalWarehouseValue,
        siteValue: totalSiteValue,
        incomingMTD: totalIncomingQty,
        outgoingMTD: totalOutgoingQty,
        totalMaterials: materials.length,
        totalSites: sites.length,
        lowStockItems
      };
    },

    // Recent stock movements (combined incoming + outgoing)
    getRecentMovements(limit = 10) {
      const incoming = get(KEYS.incoming);
      const outgoing = get(KEYS.outgoing);
      const materials = get(KEYS.materials);
      const sites = get(KEYS.sites);

      const movements = [];

      incoming.forEach(record => {
        record.items.forEach(item => {
          const material = materials.find(p => p.id === item.materialId);
          let destination = 'Warehouse';
          if (record.destinationType === 'site') {
            const site = sites.find(s => s.id === record.destinationSiteId);
            destination = site ? `${site.name} (${site.customerName || 'Unknown'})` : 'Site';
          }
          movements.push({
            date: record.date,
            type: 'Incoming',
            material: material ? material.name : '-',
            quantity: item.quantity,
            unit: material ? material.unit : '',
            source: record.supplier || '-',
            destination,
            reference: record.referenceNo || record.invoiceNo || '-'
          });
        });
      });

      outgoing.forEach(record => {
        record.items.forEach(item => {
          const material = materials.find(p => p.id === item.materialId);
          const site = sites.find(s => s.id === record.siteId);
          movements.push({
            date: record.date,
            type: 'Outgoing',
            material: material ? material.name : '-',
            quantity: item.quantity,
            unit: material ? material.unit : '',
            source: 'Warehouse',
            destination: site ? `${site.name} (${site.customerName || 'Unknown'})` : '-',
            reference: record.referenceNo || '-'
          });
        });
      });

      movements.sort((a, b) => new Date(b.date) - new Date(a.date));
      return movements.slice(0, limit);
    }
  };

  // ---- Auth ----
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
        localStorage.setItem(KEYS.user, JSON.stringify(session));
        return session;
      }
      return null;
    },
    getUser() {
      try { return JSON.parse(localStorage.getItem(KEYS.user)); }
      catch { return null; }
    },
    logout() {
      localStorage.removeItem(KEYS.user);
    },
    isLoggedIn() {
      return !!this.getUser();
    }
  };

  // ---- Seed Data ----
  function seed() {

    // Customers
    const customers = [
      { id: 'c1', name: 'ABC Constructions', contactPerson: 'Rahul Sharma', phone: '9876543210', email: 'rahul@abc.com', gstNo: '27ABCDE1234F1Z5', address: 'Mumbai, Maharashtra', status: 'Active' },
      { id: 'c2', name: 'XYZ Builders', contactPerson: 'Amit Patel', phone: '9012345678', email: 'amit@xyz.com', gstNo: '24XYZAB5678G1H9', address: 'Ahmedabad, Gujarat', status: 'Active' },
      { id: 'c3', name: 'Dream Homes Pvt Ltd', contactPerson: 'Neha Verma', phone: '8901234567', email: 'neha@dreamhomes.com', gstNo: 'RIESEM1234G1D3', address: 'Delhi', status: 'Active' },
      { id: 'c4', name: 'Mega Structures', contactPerson: 'Vikram Singh', phone: '9988776655', email: 'vikram@mega.com', gstNo: '29MEGAST6789K1L5', address: 'Bangalore, Karnataka', status: 'Active' },
      { id: 'c5', name: 'Sunrise Infra', contactPerson: 'Rajeshwari', phone: '9090123456', email: 'raj@sunrise.com', gstNo: '32SUNRI1234M1N5', address: 'Kochi, Kerala', status: 'Active' },
      { id: 'c6', name: 'Sai Constructions', contactPerson: 'Anil Gupta', phone: '9900112233', email: 'anil@sai.com', gstNo: 'SAICON3456P1Q5', address: 'Pune, Maharashtra', status: 'Active' }
    ];

    // Sites (wipe on seed to apply new schema)
    const sites = [];

    // Materials
    const materials = [
      { id: 'p1', name: 'Shuttering Plate 2\'x4\'', sku: 'SP-2X4', category: 'Shuttering', unit: 'Nos', unitPrice: 80, reorderLevel: 50, status: 'Active' },
      { id: 'p2', name: 'Shuttering Plate 18"x4\'', sku: 'SP-18X4', category: 'Shuttering', unit: 'Nos', unitPrice: 80, reorderLevel: 50, status: 'Active' },
      { id: 'p3', name: 'Shuttering Plate 15"x4\'', sku: 'SP-15X4', category: 'Shuttering', unit: 'Nos', unitPrice: 80, reorderLevel: 50, status: 'Active' },
      { id: 'p4', name: 'Shuttering Plate 12"x4\'', sku: 'SP-12X4', category: 'Shuttering', unit: 'Nos', unitPrice: 80, reorderLevel: 50, status: 'Active' },
      { id: 'p5', name: 'Shuttering Plate 9"x4\'', sku: 'SP-9X4', category: 'Shuttering', unit: 'Nos', unitPrice: 80, reorderLevel: 50, status: 'Active' },
      { id: 'p6', name: 'Shuttering Plate 6"x4\'', sku: 'SP-6X4', category: 'Shuttering', unit: 'Nos', unitPrice: 80, reorderLevel: 50, status: 'Active' },
      { id: 'p7', name: 'Channels', sku: 'CHAN-01', category: 'Scaffolding', unit: 'Nos', unitPrice: 120, reorderLevel: 50, status: 'Active' },
      { id: 'p8', name: 'Balli', sku: 'BAL-01', category: 'Scaffolding', unit: 'Nos', unitPrice: 150, reorderLevel: 50, status: 'Active' },
      { id: 'p9', name: 'Props', sku: 'PROP-01', category: 'Scaffolding', unit: 'Nos', unitPrice: 100, reorderLevel: 50, status: 'Active' },
      { id: 'p10', name: 'Pipe', sku: 'PIPE-01', category: 'Scaffolding', unit: 'Nos', unitPrice: 100, reorderLevel: 50, status: 'Active' },
      { id: 'p11', name: 'Ledger', sku: 'LEDG-01', category: 'Scaffolding', unit: 'Nos', unitPrice: 100, reorderLevel: 50, status: 'Active' },
      { id: 'p12', name: 'Miscellaneous', sku: 'MISC-01', category: 'Other', unit: 'Nos', unitPrice: 50, reorderLevel: 10, status: 'Active' }
    ];

    // Incoming Stock
    const incomingRecords = [];

    // Outgoing Stock
    const outgoingRecords = [];
    
    // Site Usage & Returns
    const siteUsage = [];
    const siteReturns = [];

    if (!localStorage.getItem(KEYS.customers)) set(KEYS.customers, customers);
    
    // Always wipe sites since schema changed drastically. We do not persist legacy sites.
    if (!localStorage.getItem('bm_site_schema_v2')) {
      set(KEYS.sites, []);
      localStorage.setItem('bm_site_schema_v2', 'true');
    }
    
    // Always wipe materials since prices changed.
    if (!localStorage.getItem('bm_materials_schema_v2')) {
      set(KEYS.materials, materials);
      localStorage.setItem('bm_materials_schema_v2', 'true');
    }
    
    if (!localStorage.getItem(KEYS.incoming)) set(KEYS.incoming, incomingRecords);
    if (!localStorage.getItem(KEYS.outgoing)) set(KEYS.outgoing, outgoingRecords);
    if (!localStorage.getItem(KEYS.siteUsage)) set(KEYS.siteUsage, siteUsage);
    if (!localStorage.getItem(KEYS.siteReturns)) set(KEYS.siteReturns, siteReturns);
    
    localStorage.setItem(KEYS.initialized, 'true');
  }

  // Reset data
  function reset() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    seed();
  }

  return { Customers, Sites, Materials, Incoming, Outgoing, SiteUsage, SiteReturns, SiteDamaged, SiteExpenses, Inventory, Auth, seed, reset, uid };
})();
