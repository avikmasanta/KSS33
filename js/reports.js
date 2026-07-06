/* ============================================
   BuildMate Reports Page
   ============================================ */

var ReportsPage = {
  render() {
    const reports = [
      { id: 'stock-summary', title: 'Stock Summary Report', desc: 'Current stock levels across all products', icon: 'box', color: '#3b82f6', colorBg: '#dbeafe' },
      { id: 'stock-movement', title: 'Stock Movement Report', desc: 'All incoming and outgoing transactions', icon: 'activity', color: '#10b981', colorBg: '#d1fae5' },
      { id: 'site-stock', title: 'Site Stock Report', desc: 'Stock distributed across all sites', icon: 'mapPin', color: '#f59e0b', colorBg: '#fef3c7' }
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
        const sites = Store.Sites.getAll();
        content = `
          <div class="card slide-up">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div>
                <h3 style="margin: 0;">Site Stock Report</h3>
                <p class="text-sm text-tertiary" style="margin-top: 4px; margin-bottom: 0;">Track materials dispatched, returned and remaining at each site.</p>
              </div>
              <div style="display: flex; gap: 10px; align-items: center;">
                <select class="form-control" style="width: 220px;" id="report-site-select" onchange="ReportsPage.onSiteReportChange(this.value)">
                  <option value="all">All Sites (Overview)</option>
                  ${sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
                <button class="btn btn-sm btn-outline" onclick="document.getElementById('report-output').innerHTML=''">Close</button>
              </div>
            </div>
            <div class="card-body" id="site-stock-report-body" style="padding-top: 15px;">
              ${this.renderSiteStockAllOverview()}
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
  },

  onSiteReportChange(val) {
    const container = document.getElementById('site-stock-report-body');
    if (!container) return;
    if (val === 'all') {
      container.innerHTML = this.renderSiteStockAllOverview();
    } else {
      container.innerHTML = this.renderSiteStockSingle(val);
    }
  },

  renderSiteStockAllOverview() {
    const materials = Store.Materials.getAll();
    const sites = Store.Sites.getAll();
    const formatNum = (v) => Number(v || 0).toLocaleString('en-IN');

    // Find all material IDs that have any history across any site (including deleted ones)
    const activeMatIds = new Set();
    Store.Outgoing.getAll().forEach(r => (r.items||[]).forEach(i => activeMatIds.add(i.materialId)));
    Store.Incoming.getAll().filter(r => r.destinationType === 'site').forEach(r => (r.items||[]).forEach(i => activeMatIds.add(i.materialId)));
    Store.SiteReturns.getAll().forEach(r => activeMatIds.add(r.materialId));
    Store.SiteUsage.getAll().forEach(r => activeMatIds.add(r.materialId));
    Store.SiteDamaged.getAll().forEach(r => activeMatIds.add(r.materialId));

    // Also include all current active materials
    materials.forEach(m => activeMatIds.add(m.id));

    return `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Material</th>
              ${sites.map(s => `<th style="text-align: center;">${s.name}<br><span style="font-size:10px; font-weight:normal; color:var(--text-tertiary);">Remaining (Returned)</span></th>`).join('')}
              <th style="text-align: right;">Total Remaining</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from(activeMatIds).map(mId => {
              const m = Store.Materials.getById(mId) || { id: mId, name: 'Deleted Material', unit: 'units' };
              let totalRemaining = 0;
              const cols = sites.map(s => {
                const remaining = Store.Inventory.getSiteCurrentBalance(m.id, s.id);
                const returned = Store.Inventory.getSiteReturns(m.id, s.id);
                totalRemaining += remaining;
                return `<td style="text-align: center;">
                  <strong>${formatNum(remaining)}</strong>
                  <span style="font-size:11px; color:var(--danger); margin-left: 4px;">(${formatNum(returned)})</span>
                </td>`;
              }).join('');

              if (totalRemaining === 0 && !sites.some(s => Store.Inventory.getSiteTotalSent(m.id, s.id) > 0)) {
                return ''; // skip unused materials
              }

              return `
                <tr>
                  <td><strong>${m.name}</strong> <span style="font-size:11px; color:var(--text-secondary);">(${m.unit})</span></td>
                  ${cols}
                  <td style="text-align: right; font-weight: 700;">${formatNum(totalRemaining)} ${m.unit}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderSiteStockSingle(siteId) {
    const site = Store.Sites.getById(siteId);
    if (!site) return '<p class="text-center text-tertiary">Site not found.</p>';

    const materials = Store.Materials.getAll();
    const formatNum = (v) => Number(v || 0).toLocaleString('en-IN');

    let rows = '';
    
    // Find all material IDs that have any history at this site (including deleted ones)
    const activeMatIds = new Set();
    Store.Outgoing.getAll().filter(r => r.siteId === site.id).forEach(r => (r.items||[]).forEach(i => activeMatIds.add(i.materialId)));
    Store.Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id).forEach(r => (r.items||[]).forEach(i => activeMatIds.add(i.materialId)));
    Store.SiteReturns.getAll().filter(r => r.siteId === site.id).forEach(r => activeMatIds.add(r.materialId));
    Store.SiteUsage.getAll().filter(r => r.siteId === site.id).forEach(r => activeMatIds.add(r.materialId));
    Store.SiteDamaged.getAll().filter(r => r.siteId === site.id).forEach(r => activeMatIds.add(r.materialId));

    // Also include all current active materials
    materials.forEach(m => activeMatIds.add(m.id));

    activeMatIds.forEach(mId => {
      const m = Store.Materials.getById(mId) || { id: mId, name: 'Deleted Material', unit: 'units' };
      const sent = Store.Inventory.getSiteTotalSent(m.id, site.id);
      const returned = Store.Inventory.getSiteReturns(m.id, site.id);
      const used = Store.Inventory.getSiteUsage(m.id, site.id);
      const remaining = Store.Inventory.getSiteCurrentBalance(m.id, site.id);

      if (sent > 0 || returned > 0 || used > 0 || remaining > 0) {
        rows += `
          <tr>
            <td><strong>${m.name}</strong></td>
            <td>${sent > 0 ? formatNum(sent) : '0'} ${m.unit}</td>
            <td style="color: var(--danger); font-weight: 500;">${returned > 0 ? formatNum(returned) : '-'} ${returned > 0 ? m.unit : ''}</td>
            <td style="color: #d97706; font-weight: 500;">${used > 0 ? formatNum(used) : '-'} ${used > 0 ? m.unit : ''}</td>
            <td><strong style="color: var(--success); font-size:1.05rem;">${formatNum(remaining)}</strong> ${m.unit}</td>
          </tr>
        `;
      }
    });

    return `
      <div style="margin-bottom: 15px;">
        <h4 style="margin: 0; color: var(--text-primary); font-size: 1rem;">Site: ${site.name}</h4>
        <p class="text-sm text-tertiary" style="margin-top: 4px;">Customer: ${site.customerName || '-'} | Location: ${site.address || '-'}</p>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Total Dispatched (Sent)</th>
              <th style="color: var(--danger)">Returned</th>
              <th style="color: #d97706">Used</th>
              <th style="color: var(--success)">Remaining Balance at Site</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" class="text-center text-tertiary" style="padding: 30px;">No materials recorded at this site.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }
};
