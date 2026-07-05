/* ============================================
   BuildMate Reports Page
   ============================================ */

var ReportsPage = {
  render() {
    const reports = [
      { id: 'stock-summary', title: 'Stock Summary Report', desc: 'Current stock levels across all products', icon: 'box', color: '#3b82f6', colorBg: '#dbeafe' },
      { id: 'stock-movement', title: 'Stock Movement Report', desc: 'All incoming and outgoing transactions', icon: 'activity', color: '#10b981', colorBg: '#d1fae5' },
      { id: 'site-stock', title: 'Site Stock Report', desc: 'Stock distributed across all sites', icon: 'mapPin', color: '#f59e0b', colorBg: '#fef3c7' },
      { id: 'utilization', title: 'Material Utilization', desc: 'Site-wise utilization & tracking', icon: 'pieChart', color: '#ef4444', colorBg: '#fee2e2' },
      { id: 'profit-dashboard', title: 'Profit Dashboard', desc: 'Revenue, Expenses, and Profitability', icon: 'trendingUp', color: '#8b5cf6', colorBg: '#ede9fe' },
      { id: 'product-report', title: 'Product Report', desc: 'Detailed product catalog', icon: 'package', color: '#06b6d4', colorBg: '#cffafe' },
      { id: 'supplier-report', title: 'Supplier Report', desc: 'Supplier-wise purchase history', icon: 'truck', color: '#64748b', colorBg: '#f1f5f9' }
    ];

    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Reports</h2>
          <p>Generate and view reports</p>
        </div>
      </div>

      <div class="report-grid" id="report-tiles">
        ${reports.map(r => `
          <div class="report-tile" onclick="ReportsPage.generate('${r.id}')">
            <div class="report-tile-icon" style="background:${r.colorBg};color:${r.color}">
              ${Icons[r.icon] || Icons.fileText}
            </div>
            <h4>${r.title}</h4>
            <p>${r.desc}</p>
            <button class="btn btn-sm btn-outline" style="margin-top:4px">Generate</button>
          </div>
        `).join('')}
      </div>

      <!-- Report Output Area -->
      <div id="report-output" class="mt-6"></div>
    `;
  },

  init() {},

  generate(reportId) {
    const output = document.getElementById('report-output');
    if (!output) return;

    let content = '';
    const formatNum = (v) => Number(v).toLocaleString('en-IN');
    const formatCurrency = (v) => '₹ ' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    switch (reportId) {
      case 'stock-summary': {
        const overview = Store.Inventory.getOverview();
        content = `
          <div class="card slide-up">
            <div class="card-header">
              <h3>Stock Summary Report</h3>
              <button class="btn btn-sm btn-outline" onclick="document.getElementById('report-output').innerHTML=''">Close</button>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr><th>#</th><th>Product</th><th>Unit</th><th>Warehouse</th><th>Site Stock</th><th>Total</th><th>Reorder</th><th>Status</th></tr>
                </thead>
                <tbody>
                  ${overview.map((o, i) => `
                    <tr>
                      <td>${i+1}</td>
                      <td><strong>${o.product.name}</strong></td>
                      <td>${o.product.unit}</td>
                      <td>${formatNum(o.warehouseStock)}</td>
                      <td>${formatNum(o.totalSiteStock)}</td>
                      <td><strong>${formatNum(o.totalStock)}</strong></td>
                      <td>${formatNum(o.reorderLevel)}</td>
                      <td>${o.warehouseStock < o.reorderLevel ? '<span class="badge badge-danger">Low</span>' : '<span class="badge badge-success">OK</span>'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
        break;
      }

      case 'stock-movement': {
        const movements = Store.Inventory.getRecentMovements(50);
        content = `
          <div class="card slide-up">
            <div class="card-header">
              <h3>Stock Movement Report</h3>
              <button class="btn btn-sm btn-outline" onclick="document.getElementById('report-output').innerHTML=''">Close</button>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Product</th><th>Qty</th><th>Source</th><th>Destination</th><th>Reference</th></tr>
                </thead>
                <tbody>
                  ${movements.map(m => `
                    <tr>
                      <td>${formatDate(m.date)}</td>
                      <td><span class="badge ${m.type === 'Incoming' ? 'badge-incoming' : 'badge-outgoing'}">${m.type}</span></td>
                      <td>${m.product}</td>
                      <td>${formatNum(m.quantity)} ${m.unit}</td>
                      <td class="secondary">${m.source}</td>
                      <td class="secondary">${m.destination}</td>
                      <td class="secondary">${m.reference}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
        break;
      }

      case 'site-stock': {
        const overview = Store.Inventory.getOverview();
        const sites = Store.Sites.getAll();
        content = `
          <div class="card slide-up">
            <div class="card-header">
              <h3>Site Stock Report</h3>
              <button class="btn btn-sm btn-outline" onclick="document.getElementById('report-output').innerHTML=''">Close</button>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    ${sites.map(s => `<th>${s.name}</th>`).join('')}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${overview.map(o => `
                    <tr>
                      <td><strong>${o.product.name}</strong></td>
                      ${sites.map(s => `<td>${formatNum(o.siteStocks[s.id] || 0)}</td>`).join('')}
                      <td><strong>${formatNum(o.totalSiteStock)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
        break;
      }

      case 'low-stock': {
        const overview = Store.Inventory.getOverview();
        const lowItems = overview.filter(o => o.warehouseStock < o.reorderLevel);
        content = `
          <div class="card slide-up">
            <div class="card-header">
              <h3>Low Stock Report (${lowItems.length} items)</h3>
              <button class="btn btn-sm btn-outline" onclick="document.getElementById('report-output').innerHTML=''">Close</button>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr><th>#</th><th>Product</th><th>Current Stock</th><th>Reorder Level</th><th>Deficit</th><th>Unit Price</th><th>Reorder Value</th></tr>
                </thead>
                <tbody>
                  ${lowItems.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:40px">No low stock items</td></tr>' :
                    lowItems.map((o, i) => {
                      const deficit = o.reorderLevel - o.warehouseStock;
                      return `
                        <tr>
                          <td>${i+1}</td>
                          <td><strong>${o.product.name}</strong></td>
                          <td><span class="text-danger font-semibold">${formatNum(o.warehouseStock)}</span></td>
                          <td>${formatNum(o.reorderLevel)}</td>
                          <td><span class="badge badge-danger">${formatNum(deficit)}</span></td>
                          <td>${formatCurrency(o.product.unitPrice)}</td>
                          <td>${formatCurrency(deficit * o.product.unitPrice)}</td>
                        </tr>
                      `;
                    }).join('')
                  }
                </tbody>
              </table>
            </div>
          </div>
        `;
        break;
      }

      case 'utilization': {
        const materials = Store.Materials.getAll();
        const sites = Store.Sites.getAll();
        let rows = '';

        materials.forEach(m => {
          let totalSent = 0, totalUsed = 0, totalReturned = 0, totalDamaged = 0, totalBal = 0;
          sites.forEach(s => {
            totalSent += Store.Inventory.getSiteTotalSent(m.id, s.id);
            totalUsed += Store.Inventory.getSiteUsage(m.id, s.id);
            totalReturned += Store.Inventory.getSiteReturns(m.id, s.id);
            totalDamaged += Store.Inventory.getSiteDamaged(m.id, s.id);
            totalBal += Store.Inventory.getSiteCurrentBalance(m.id, s.id);
          });
          
          if (totalSent > 0) {
            const utilization = ((totalUsed / totalSent) * 100).toFixed(1);
            rows += `
              <tr>
                <td><strong>${m.name}</strong></td>
                <td>${formatNum(totalSent)}</td>
                <td>${formatNum(totalUsed)}</td>
                <td>${formatNum(totalReturned)}</td>
                <td><span class="text-danger">${formatNum(totalDamaged)}</span></td>
                <td><strong>${formatNum(totalBal)}</strong></td>
                <td>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div style="flex:1; background:#e2e8f0; height:8px; border-radius:4px; overflow:hidden;">
                      <div style="background:var(--primary); width:${utilization}%; height:100%;"></div>
                    </div>
                    <span style="font-size:12px;">${utilization}%</span>
                  </div>
                </td>
              </tr>
            `;
          }
        });

        content = `
          <div class="card slide-up">
            <div class="card-header">
              <h3>Material Utilization Report</h3>
              <button class="btn btn-sm btn-outline" onclick="document.getElementById('report-output').innerHTML=''">Close</button>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr><th>Product</th><th>Sent</th><th>Used</th><th>Returned</th><th>Damaged</th><th>Available</th><th>Utilization %</th></tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="7" class="text-center text-tertiary">No materials dispatched yet.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        `;
        break;
      }

      case 'profit-dashboard': {
        const sites = Store.Sites.getAll();
        let totalRev = 0, totalExp = 0, totalDamagedLoss = 0;
        let siteProfits = [];

        sites.forEach(s => {
          const rev = Store.Inventory.getSiteRevenue(s.id);
          const exp = Store.Inventory.getTotalSiteExpenses(s.id);
          const profit = rev - exp;
          
          let loss = 0;
          Store.Materials.getAll().forEach(m => {
            loss += Store.Inventory.getSiteDamaged(m.id, s.id) * (parseFloat(m.unitPrice) || 0);
          });

          totalRev += rev;
          totalExp += exp;
          totalDamagedLoss += loss;
          
          if (rev > 0 || exp > 0) {
             siteProfits.push({ site: s, rev, exp, profit, loss });
          }
        });

        siteProfits.sort((a, b) => b.profit - a.profit);
        
        let bestSite = siteProfits.length > 0 ? siteProfits[0].site.name : 'N/A';
        let worstSite = siteProfits.length > 0 ? siteProfits[siteProfits.length - 1].site.name : 'N/A';
        let totalProfit = totalRev - totalExp;

        content = `
          <div class="card slide-up">
            <div class="card-header">
              <h3>Company Profitability Dashboard</h3>
              <button class="btn btn-sm btn-outline" onclick="document.getElementById('report-output').innerHTML=''">Close</button>
            </div>
            <div class="card-body">
              <div class="stats-grid mb-4">
                <div class="stat-card" style="border-left: 4px solid var(--primary)">
                  <div class="stat-title">Total Revenue</div>
                  <div class="stat-value" style="color: var(--primary)">${formatCurrency(totalRev)}</div>
                </div>
                <div class="stat-card" style="border-left: 4px solid var(--danger)">
                  <div class="stat-title">Total Expenses</div>
                  <div class="stat-value" style="color: var(--danger)">${formatCurrency(totalExp)}</div>
                </div>
                <div class="stat-card" style="border-left: 4px solid ${totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">
                  <div class="stat-title">Net Profit</div>
                  <div class="stat-value" style="color: ${totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(totalProfit)}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-title">Most Profitable Site</div>
                  <div class="stat-value" style="font-size:1.1rem; padding-top:4px;">${bestSite}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-title">Total Material Loss</div>
                  <div class="stat-value" style="color:var(--danger)">${formatCurrency(totalDamagedLoss)}</div>
                </div>
              </div>
              
              <h4 class="mb-3">Profit by Site</h4>
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr><th>Site Name</th><th>Revenue</th><th>Expenses</th><th>Net Profit</th><th>Asset Loss</th></tr>
                  </thead>
                  <tbody>
                    ${siteProfits.map(sp => `
                      <tr>
                        <td><strong>${sp.site.name}</strong></td>
                        <td>${formatCurrency(sp.rev)}</td>
                        <td><span class="text-danger">${formatCurrency(sp.exp)}</span></td>
                        <td><strong style="color: ${sp.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(sp.profit)}</strong></td>
                        <td><span class="text-warning">${formatCurrency(sp.loss)}</span></td>
                      </tr>
                    `).join('')}
                    ${siteProfits.length === 0 ? '<tr><td colspan="5" class="text-center text-tertiary">No financial data available.</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
        break;
      }

      case 'product-report': {
        const products = Store.Products.getAll();
        content = `
          <div class="card slide-up">
            <div class="card-header">
              <h3>Product Report</h3>
              <button class="btn btn-sm btn-outline" onclick="document.getElementById('report-output').innerHTML=''">Close</button>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr><th>#</th><th>Product</th><th>SKU</th><th>Category</th><th>Unit</th><th>Price</th><th>Reorder Level</th><th>Status</th></tr>
                </thead>
                <tbody>
                  ${products.map((p, i) => `
                    <tr>
                      <td>${i+1}</td>
                      <td><strong>${p.name}</strong></td>
                      <td>${p.sku}</td>
                      <td><span class="badge badge-neutral">${p.category}</span></td>
                      <td>${p.unit}</td>
                      <td>${formatCurrency(p.unitPrice)}</td>
                      <td>${formatNum(p.reorderLevel || 50)}</td>
                      <td><span class="badge badge-success">${p.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
        break;
      }

      case 'supplier-report': {
        const incoming = Store.Incoming.getAll();
        const supplierMap = {};
        incoming.forEach(record => {
          const s = record.supplier || 'Unknown';
          if (!supplierMap[s]) supplierMap[s] = { count: 0, totalValue: 0, products: new Set() };
          supplierMap[s].count++;
          record.items.forEach(item => {
            supplierMap[s].totalValue += parseFloat(item.amount) || 0;
            const prod = Store.Products.getById(item.productId);
            if (prod) supplierMap[s].products.add(prod.name);
          });
        });

        const suppliers = Object.entries(supplierMap).map(([name, data]) => ({
          name, ...data, products: [...data.products]
        })).sort((a, b) => b.totalValue - a.totalValue);

        content = `
          <div class="card slide-up">
            <div class="card-header">
              <h3>Supplier Report</h3>
              <button class="btn btn-sm btn-outline" onclick="document.getElementById('report-output').innerHTML=''">Close</button>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr><th>Supplier</th><th>Orders</th><th>Total Value</th><th>Products Supplied</th></tr>
                </thead>
                <tbody>
                  ${suppliers.map(s => `
                    <tr>
                      <td><strong>${s.name}</strong></td>
                      <td>${s.count}</td>
                      <td>${formatCurrency(s.totalValue)}</td>
                      <td class="secondary">${s.products.slice(0, 3).join(', ')}${s.products.length > 3 ? '...' : ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
        break;
      }

      default:
        content = `
          <div class="card slide-up">
            <div class="card-body">
              <div class="empty-state">
                ${Icons.pieChart}
                <h3>Custom Report Builder</h3>
                <p>Custom report builder coming soon. Use the other report types for now.</p>
              </div>
            </div>
          </div>
        `;
    }

    output.innerHTML = content;
    output.scrollIntoView({ behavior: 'smooth' });
  }
};
