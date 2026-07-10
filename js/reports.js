/* ============================================
   BuildMate Reports Page
   ============================================ */

var ReportsPage = {
  render() {
    const reports = [
      { id: 'stock-summary', title: 'Stock Summary Report', desc: 'Current stock levels across all products', icon: 'box', color: '#3b82f6', colorBg: '#dbeafe' },
      { id: 'stock-movement', title: 'Stock Movement Report', desc: 'All incoming and outgoing transactions', icon: 'activity', color: '#10b981', colorBg: '#d1fae5' },
      { id: 'site-cost', title: 'Site Cost & Material Report', desc: 'Total project cost, materials issued & returned per site', icon: 'mapPin', color: '#8b5cf6', colorBg: '#ede9fe' },
      { id: 'telegram-summary', title: 'Telegram Reports', desc: 'Configure Telegram Bot chat alerts and send daily summaries', icon: 'settings', color: '#f59e0b', colorBg: '#fef3c7' }
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

  activeReportId: null,
  selectedSiteId: null,

  init() {
    this.activeReportId = null;
    this.selectedSiteId = null;
  },

  refresh() {
    if (this.activeReportId) {
      const selectVal = document.getElementById('site-cost-selector')?.value;
      if (selectVal) {
        this.selectedSiteId = selectVal;
      }
      this.generate(this.activeReportId);
      if (this.activeReportId === 'site-cost' && this.selectedSiteId) {
        const selectEl = document.getElementById('site-cost-selector');
        if (selectEl) {
          selectEl.value = this.selectedSiteId;
          this.renderSiteCostReport(this.selectedSiteId);
        }
      }
    }
  },

  closeReport() {
    this.activeReportId = null;
    this.selectedSiteId = null;
    const output = document.getElementById('report-output');
    if (output) output.innerHTML = '';
  },

  generate(reportId) {
    this.activeReportId = reportId;
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
              <button class="btn btn-sm btn-outline" onclick="ReportsPage.closeReport()">Close</button>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr><th>#</th><th>Product</th><th>Unit</th><th>Warehouse</th><th>Site Stock</th><th>Total</th><th>Reorder</th><th>Status</th></tr>
                </thead>
                <tbody>
                  ${overview.map((o, i) => `
                    <tr>
                      <td>${i + 1}</td>
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

      case 'telegram-summary': {
        const chats = Store.TelegramChats.getAll();
        // Get yesterday's date in IST (UTC+5:30)
        const nowIST = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
        const yesterday = new Date(nowIST.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        content = `
          <div class="card slide-up">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
              <h3>Telegram Bot & Daily Reports</h3>
              <button class="btn btn-sm btn-outline" onclick="ReportsPage.closeReport()">Close</button>
            </div>
            <div class="card-body">
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:24px;">
                
                <!-- Left: Configured Chats -->
                <div>
                  <h4 style="margin-bottom:12px;color:var(--text-primary);">Configured Chats / Groups</h4>
                  <div class="table-container" style="border: 1px solid var(--border-color); border-radius:8px;">
                    <table class="data-table" style="width:100%;">
                      <thead>
                        <tr>
                          <th>Chat ID</th>
                          <th>Name / Label</th>
                          <th style="text-align:right;">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${chats.map(c => `
                          <tr>
                            <td><code style="font-family:monospace;background:var(--bg-body);padding:2px 6px;border-radius:4px;">${c.id}</code></td>
                            <td><strong>${c.name || 'Group Chat'}</strong></td>
                            <td style="text-align:right;">
                              <button class="btn btn-icon btn-ghost" onclick="ReportsPage.deleteTelegramChat('${c.id}')" title="Delete Chat" style="color:var(--danger); border:none; background:none; cursor:pointer;">
                                ${Icons.trash}
                              </button>
                            </td>
                          </tr>
                        `).join('')}
                        ${chats.length === 0 ? `
                          <tr>
                            <td colspan="3" style="text-align:center;padding:24px;color:var(--text-tertiary);">No chats registered yet. Add one below!</td>
                          </tr>
                        ` : ''}
                      </tbody>
                    </table>
                  </div>

                  <!-- Form to add chat -->
                  <div style="margin-top:20px; background:var(--bg-body); padding:16px; border-radius:8px; border:1px solid var(--border-color);">
                    <h5 style="margin:0 0 12px 0; color:var(--text-primary);">Add Telegram Chat / Group</h5>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                      <input type="text" id="tg-chat-id" class="form-control" placeholder="e.g. -100123456789 or 123456" style="flex:1; min-width:140px; background: var(--bg-card);">
                      <input type="text" id="tg-chat-name" class="form-control" placeholder="Group/User Name" style="flex:1; min-width:140px; background: var(--bg-card);">
                      <button class="btn btn-primary" onclick="ReportsPage.addTelegramChat()">Add</button>
                    </div>
                  </div>
                </div>

                <!-- Right: Test / Preview Actions -->
                <div>
                  <h4 style="margin-bottom:12px;color:var(--text-primary);">Send / Preview Report</h4>
                  <div style="background:var(--bg-body); padding:20px; border-radius:12px; border:1px solid var(--border-color); margin-bottom:20px;">
                    <div class="form-group" style="margin-bottom:15px;">
                      <label>Select Report Target Date</label>
                      <input type="date" id="tg-report-date" class="form-control" value="${yesterday}" style="background: var(--bg-card);">
                    </div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                      <button class="btn btn-outline" style="flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px;" onclick="ReportsPage.previewTelegramReport()">
                        ${Icons.fileText} Preview PDF
                      </button>
                      <button class="btn btn-success" style="flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px;" onclick="ReportsPage.sendTelegramReportNow()">
                        ${Icons.check} Send to Telegram
                      </button>
                    </div>
                  </div>

                  <!-- Guide/Help Card -->
                  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius:12px; padding:16px; color:#1e40af;">
                    <h5 style="margin:0 0 8px 0; font-weight:700; color:#1e3a8a;">🤖 Telegram Bot Setup Instructions</h5>
                    <p style="font-size:0.8rem; margin:0; line-height:1.5;">
                      1. Open Telegram and search for <strong>@KSS33_bot</strong> (or click <a href="https://t.me/KSS33_bot" target="_blank" style="font-weight:700; text-decoration:underline;">t.me/KSS33_bot</a>).<br>
                      2. Add the bot to your group, or start a direct chat with it.<br>
                      3. Send a message like <strong>/start</strong> to wake up the bot.<br>
                      4. To find the chat ID, search for <strong>@userinfobot</strong> in Telegram and start it to see your user ID, or use <strong>@MissRose_bot</strong> in your group (command <code>/id</code>).<br>
                      5. Register that ID here to receive automatic morning reports!
                    </p>
                  </div>
                </div>

              </div>
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
              <button class="btn btn-sm btn-outline" onclick="ReportsPage.closeReport()">Close</button>
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



      case 'low-stock': {
        const overview = Store.Inventory.getOverview();
        const lowItems = overview.filter(o => o.warehouseStock < o.reorderLevel);
        content = `
          <div class="card slide-up">
            <div class="card-header">
              <h3>Low Stock Report (${lowItems.length} items)</h3>
              <button class="btn btn-sm btn-outline" onclick="ReportsPage.closeReport()">Close</button>
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
                          <td>${i + 1}</td>
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
              <button class="btn btn-sm btn-outline" onclick="ReportsPage.closeReport()">Close</button>
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
              <button class="btn btn-sm btn-outline" onclick="ReportsPage.closeReport()">Close</button>
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
              <button class="btn btn-sm btn-outline" onclick="ReportsPage.closeReport()">Close</button>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr><th>#</th><th>Product</th><th>SKU</th><th>Category</th><th>Unit</th><th>Price</th><th>Reorder Level</th><th>Status</th></tr>
                </thead>
                <tbody>
                  ${products.map((p, i) => `
                    <tr>
                      <td>${i + 1}</td>
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
              <button class="btn btn-sm btn-outline" onclick="ReportsPage.closeReport()">Close</button>
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

      case 'site-cost': {
        const sites = Store.Sites.getAll();
        content = `
          <div class="card slide-up">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
              <div>
                <h3 style="margin:0;">Site Cost &amp; Material Report</h3>
                <p class="text-sm text-tertiary" style="margin:4px 0 0;">Material issued, returned &amp; net project cost per site</p>
              </div>
              <div style="display:flex;gap:10px;align-items:center;">
                <select id="site-cost-selector" onchange="ReportsPage.renderSiteCostReport(this.value)" class="form-control" style="min-width:200px;font-weight:600;">
                  <option value="all">All Sites</option>
                  ${sites.map(s => `<option value="${s.id}">${s.name}${s.customerName ? ' — ' + s.customerName : ''}</option>`).join('')}
                </select>
                <button class="btn btn-sm btn-outline" id="site-cost-pdf-btn" onclick="ReportsPage.exportSelectedSitePDF()" style="display:none;align-items:center;gap:6px;">
                  ${Icons.fileText} PDF
                </button>
                <button class="btn btn-sm btn-outline" onclick="ReportsPage.closeReport()">Close</button>
              </div>
            </div>
            <div id="site-cost-report-body" style="padding:0;">
              ${this.renderSiteCostReport('all')}
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

  exportSelectedSitePDF() {
    const selectEl = document.getElementById('site-cost-selector');
    if (!selectEl) return;
    const siteId = selectEl.value;
    if (siteId && siteId !== 'all') {
      SiteDetailsPage.siteId = siteId;
      SiteDetailsPage.exportPDF();
    }
  },

  renderSiteCostReport(siteId) {
    const container = document.getElementById('site-cost-report-body');
    const pdfBtn = document.getElementById('site-cost-pdf-btn');
    if (pdfBtn) {
      pdfBtn.style.display = (siteId === 'all') ? 'none' : 'inline-flex';
    }
    const materials = Store.Materials.getAll();
    const allSites = Store.Sites.getAll();
    const fmt = (v) => Number(v || 0).toLocaleString('en-IN');

    const getSiteRows = (site) => {
      const matIds = new Set();
      Store.Outgoing.getAll().filter(r => r.siteId === site.id).forEach(r => (r.items || []).forEach(i => matIds.add(typeof i.materialId === 'object' ? (i.materialId._id || i.materialId.id) : i.materialId)));
      Store.Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id).forEach(r => (r.items || []).forEach(i => matIds.add(typeof i.materialId === 'object' ? (i.materialId._id || i.materialId.id) : i.materialId)));
      Store.SiteReturns.getAll().filter(r => r.siteId === site.id).forEach(r => matIds.add(typeof r.materialId === 'object' ? (r.materialId._id || r.materialId.id) : r.materialId));
      const rows = [];
      matIds.forEach(mId => {
        const mat = materials.find(m => m.id === mId);
        const issued = Store.Inventory.getSiteTotalSent(mId, site.id);
        const returned = Store.Inventory.getSiteReturns(mId, site.id);
        if (issued === 0 && returned === 0) return;
        rows.push({ name: mat ? mat.name : 'Deleted Material', unit: mat ? mat.unit : '', issued, returned, net: issued - returned });
      });
      return rows;
    };

    const siteBlock = (site) => {
      const rows = getSiteRows(site);
      const tIss = rows.reduce((s, r) => s + r.issued, 0);
      const tRet = rows.reduce((s, r) => s + r.returned, 0);
      const tNet = tIss - tRet;
      const sc = site.status === 'Completed' ? '#10b981' : site.status === 'On Hold' ? '#f59e0b' : '#3b82f6';
      const trs = rows.length === 0
        ? `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-tertiary)">No materials recorded at this site.</td></tr>`
        : rows.map((r, i) => `
            <tr>
              <td style="color:var(--text-tertiary);font-weight:600">${i + 1}</td>
              <td><strong>${r.name}</strong> <span style="font-size:11px;color:var(--text-tertiary)">(${r.unit})</span></td>
              <td style="text-align:center;font-weight:700">${fmt(r.issued)}</td>
              <td style="text-align:center;color:#10b981;font-weight:700">${fmt(r.returned)}</td>
              <td style="text-align:center;font-weight:800">${fmt(r.net)}</td>
            </tr>`
        ).join('');
      const foot = rows.length === 0 ? '' : `
        <tfoot style="background:var(--surface-raised,#f8fafc)">
          <tr style="font-weight:800;border-top:2px solid var(--border)">
            <td colspan="2" style="padding:14px 16px;color:var(--text-secondary)">TOTAL</td>
            <td style="text-align:center;padding:14px 16px">${fmt(tIss)}</td>
            <td style="text-align:center;padding:14px 16px;color:#10b981">${fmt(tRet)}</td>
            <td style="text-align:center;padding:14px 16px;font-size:1.1rem">${fmt(tNet)}</td>
          </tr>
        </tfoot>`;
      return `
        <div style="border:1px solid var(--border);border-radius:14px;margin:20px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">
          <div style="background:linear-gradient(135deg,#1e293b,#334155);color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div>
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:1.2rem;font-weight:800">${site.name}</span>
                <span style="background:${sc};color:white;font-size:11px;padding:2px 10px;border-radius:20px;font-weight:600">${site.status || 'Active'}</span>
              </div>
              <div style="font-size:0.85rem;color:rgba(255,255,255,.6);margin-top:4px">${site.customerName ? '&#128100; ' + site.customerName + '&nbsp;&nbsp;' : ''}${site.address ? '&#128205; ' + site.address : ''}</div>
            </div>
            <div style="display:flex;gap:24px;flex-wrap:wrap">
              <div style="text-align:center"><div style="font-size:.7rem;color:rgba(255,255,255,.55);text-transform:uppercase">Total Issued</div><div style="font-size:1.8rem;font-weight:900;color:#fde68a">${fmt(tIss)}</div></div>
              <div style="text-align:center"><div style="font-size:.7rem;color:rgba(255,255,255,.55);text-transform:uppercase">Total Returned</div><div style="font-size:1.8rem;font-weight:900;color:#6ee7b7">${fmt(tRet)}</div></div>
              <div style="text-align:center;background:rgba(255,255,255,.1);padding:8px 16px;border-radius:10px"><div style="font-size:.7rem;color:rgba(255,255,255,.7);text-transform:uppercase">Net at Site</div><div style="font-size:2rem;font-weight:900">${fmt(tNet)}</div></div>
            </div>
          </div>
          <div style="overflow-x:auto">
            <table class="data-table" style="margin:0;border-radius:0">
              <thead><tr><th style="width:40px">#</th><th>Material</th><th style="text-align:center">Issued Qty</th><th style="text-align:center;color:#10b981">Returned Qty</th><th style="text-align:center">Net Qty at Site</th></tr></thead>
              <tbody>${trs}</tbody>
              ${foot}
            </table>
          </div>
        </div>`;
    };

    const allView = () => {
      const sorted = allSites.slice().sort((a, b) => a.name.localeCompare(b.name));
      const cards = sorted.map(site => {
        const rows = getSiteRows(site);
        const tIss = rows.reduce((s, r) => s + r.issued, 0);
        const tRet = rows.reduce((s, r) => s + r.returned, 0);
        const tNet = tIss - tRet;
        const sc = site.status === 'Completed' ? '#10b981' : site.status === 'On Hold' ? '#f59e0b' : '#3b82f6';
        return `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;transition:box-shadow .2s;cursor:pointer" onclick="document.getElementById('site-cost-selector').value='${site.id}';ReportsPage.renderSiteCostReport('${site.id}')" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.1)'" onmouseout="this.style.boxShadow='none'">
            <div>
              <div style="font-weight:700;font-size:1rem;color:var(--text-primary)">${site.name}</div>
              <div style="font-size:.8rem;color:var(--text-tertiary);margin-top:2px">${site.customerName || 'No customer'} &bull; <span style="color:${sc};font-weight:600">${site.status || 'Active'}</span> &bull; ${rows.length} material${rows.length !== 1 ? 's' : ''}</div>
            </div>
            <div style="display:flex;gap:20px;flex-wrap:wrap;text-align:center">
              <div><div style="font-size:.7rem;color:var(--text-tertiary);text-transform:uppercase">Issued</div><div style="font-weight:700;font-size:1.1rem;color:#3b82f6">${fmt(tIss)}</div></div>
              <div><div style="font-size:.7rem;color:var(--text-tertiary);text-transform:uppercase">Returned</div><div style="font-weight:700;font-size:1.1rem;color:#10b981">${fmt(tRet)}</div></div>
              <div style="background:#f0fdf4;border-radius:8px;padding:6px 14px"><div style="font-size:.7rem;color:#166534;text-transform:uppercase">Net at Site</div><div style="font-weight:800;font-size:1.1rem;color:#166534">${fmt(tNet)}</div></div>
            </div>
          </div>`
      }).join('');
      return `
        <div style="padding:20px">
          <p style="margin-bottom:14px;color:var(--text-tertiary);font-size:.9rem">Showing all ${sorted.length} site(s). Select a site above to see the full material breakdown.</p>
          <div style="display:flex;flex-direction:column;gap:10px">${sorted.length === 0 ? '<div style="text-align:center;color:var(--text-tertiary);padding:40px">No sites found.</div>' : cards}</div>
        </div>`;
    };

    const html = siteId === 'all' ? allView() : siteBlock(allSites.find(s => s.id === siteId) || allSites[0]);
    if (container) container.innerHTML = html;
    return html;
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
    Store.Outgoing.getAll().forEach(r => (r.items || []).forEach(i => activeMatIds.add(i.materialId)));
    Store.Incoming.getAll().filter(r => r.destinationType === 'site').forEach(r => (r.items || []).forEach(i => activeMatIds.add(i.materialId)));
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
      const m = Store.Materials.getById(mId);
      if (!m) return ''; // Skip deleted materials completely
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
    Store.Outgoing.getAll().filter(r => r.siteId === site.id).forEach(r => (r.items || []).forEach(i => activeMatIds.add(i.materialId)));
    Store.Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id).forEach(r => (r.items || []).forEach(i => activeMatIds.add(i.materialId)));
    Store.SiteReturns.getAll().filter(r => r.siteId === site.id).forEach(r => activeMatIds.add(r.materialId));
    Store.SiteUsage.getAll().filter(r => r.siteId === site.id).forEach(r => activeMatIds.add(r.materialId));
    Store.SiteDamaged.getAll().filter(r => r.siteId === site.id).forEach(r => activeMatIds.add(r.materialId));

    // Also include all current active materials
    materials.forEach(m => activeMatIds.add(m.id));

    activeMatIds.forEach(mId => {
      const m = Store.Materials.getById(mId);
      if (!m) return; // Skip deleted materials completely

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
  },

  async addTelegramChat() {
    const idInput = document.getElementById('tg-chat-id');
    const nameInput = document.getElementById('tg-chat-name');
    if (!idInput || !nameInput) return;

    const id = idInput.value.trim();
    const name = nameInput.value.trim();

    if (!id || !name) {
      alert('Please fill out both Chat ID and Name/Label.');
      return;
    }

    try {
      await Store.TelegramChats.addAsync({ id, name });
      alert('Telegram Chat added successfully!');
      this.generate('telegram-summary');
    } catch (err) {
      alert('Failed to add Telegram Chat: ' + err.message);
    }
  },

  async deleteTelegramChat(id) {
    if (confirm('Are you sure you want to remove this Telegram Chat?\nIt will no longer receive daily reports.')) {
      try {
        await Store.TelegramChats.remove(id);
        alert('Telegram Chat removed successfully!');
        this.generate('telegram-summary');
      } catch (err) {
        alert('Failed to remove: ' + err.message);
      }
    }
  },

  previewTelegramReport() {
    const dateInput = document.getElementById('tg-report-date');
    if (!dateInput) return;
    const date = dateInput.value;
    const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5000/api'
      : '/api';
    window.open(`${API_URL}/telegram-report/preview?date=${date}`, '_blank');
  },

  async sendTelegramReportNow() {
    const dateInput = document.getElementById('tg-report-date');
    if (!dateInput) return;
    const date = dateInput.value;

    const btn = document.querySelector('button[onclick="ReportsPage.sendTelegramReportNow()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Sending...';

    const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5000/api'
      : '/api';

    try {
      const res = await fetch(`${API_URL}/telegram-report/send?date=${date}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Report sent successfully! Details: ' + data.message);
      } else {
        alert('Failed to send report: ' + (data.error || data.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Error sending report: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
};
