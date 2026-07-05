/* ============================================
   BuildMate Dashboard Page
   ============================================ */

var DashboardPage = {
  render() {
    const stats = Store.Inventory.getStats();
    const movements = Store.Inventory.getRecentMovements(8);
    const overview = Store.Inventory.getOverview();
    const sites = Store.Sites.getAll();
    const customers = Store.Customers.getAll();
    const materials = Store.Materials.getAll();
    const incoming = Store.Incoming.getAll();
    const outgoing = Store.Outgoing.getAll();

    // Calculate totals for new cards
    let warehouseUnits = 0;
    overview.forEach(o => { warehouseUnits += o.warehouseStock; });

    let movementsCount = 0;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    [...incoming, ...outgoing].forEach(r => {
      if (new Date(r.date) >= sevenDaysAgo) {
        movementsCount += r.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
      }
    });

    const formatNum = (v) => Number(v).toLocaleString('en-IN');
    const formatDate = (d) => {
      const dt = new Date(d);
      return dt.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    return `
      <!-- Page Header -->
      <div class="page-header" style="margin-bottom: 24px;">
        <div class="page-header-title">
          <h2>Operations Dashboard</h2>
          <p>Real-time overview of stock, sites and recent movements.</p>
        </div>
      </div>

      <!-- Stats Cards (6 cols) -->
      <div class="stats-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; margin-bottom: 20px;">
        <!-- Customers -->
        <div class="stat-card">
          <div class="stat-info">
            <div class="label">CUSTOMERS</div>
            <div class="value">${customers.length}</div>
          </div>
          <div class="stat-icon outline">
            ${Icons.users}
          </div>
        </div>
        
        <!-- Active Sites -->
        <div class="stat-card">
          <div class="stat-info">
            <div class="label">ACTIVE SITES</div>
            <div class="value">${sites.filter(s => s.status === 'Active').length}</div>
            <div class="sub">${sites.length} total</div>
          </div>
          <div class="stat-icon outline">
            ${Icons.mapPin}
          </div>
        </div>
        
        <!-- Materials -->
        <div class="stat-card">
          <div class="stat-info">
            <div class="label">PRODUCTS</div>
            <div class="value">${materials.length}</div>
          </div>
          <div class="stat-icon outline">
            ${Icons.package}
          </div>
        </div>
        
        <!-- Warehouse Units -->
        <div class="stat-card">
          <div class="stat-info">
            <div class="label">WAREHOUSE UNITS</div>
            <div class="value">${formatNum(warehouseUnits)}</div>
            <div class="sub">Aggregate across SKUs</div>
          </div>
          <div class="stat-icon outline">
            ${Icons.box}
          </div>
        </div>
        
        <!-- Low-Stock -->
        <div class="stat-card">
          <div class="stat-info">
            <div class="label">LOW-STOCK</div>
            <div class="value" style="color: ${stats.lowStockItems.length > 0 ? 'var(--danger)' : 'var(--success)'}">${stats.lowStockItems.length}</div>
          </div>
          <div class="stat-icon outline">
            ${Icons.alertTriangle}
          </div>
        </div>
        
        <!-- Movements (7D) -->
        <div class="stat-card">
          <div class="stat-info">
            <div class="label">MOVEMENTS (7D)</div>
            <div class="value">${formatNum(movementsCount)}</div>
          </div>
          <div class="stat-icon outline">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
          </div>
        </div>
      </div>

      <!-- Chart + Low Stock -->
      <div class="dashboard-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 20px;">
        <!-- Stock movements Chart -->
        <div class="card">
          <div class="card-header" style="border-bottom: none; padding-bottom: 0;">
            <div class="chart-header">
              <div>
                <h3 style="font-size: 1.1rem; color: #0f172a; margin-bottom: 4px;">Stock movements (last 7 days)</h3>
                <p style="font-size: 0.8rem; color: #64748b;">Incoming vs Outgoing quantities.</p>
              </div>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="stock-chart" height="280"></canvas>
            </div>
          </div>
        </div>

        <!-- Low Stock Alert -->
        <div class="card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
            <h3 style="font-size: 1.1rem; color: #0f172a;">Low-stock alerts</h3>
            <span class="stat-top-badge" style="background: ${stats.lowStockItems.length > 0 ? '#fee2e2' : '#dcfce7'}; color: ${stats.lowStockItems.length > 0 ? '#991b1b' : '#166534'}; padding: 4px 8px; font-size: 0.75rem;">${stats.lowStockItems.length}</span>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 260px;">
            ${stats.lowStockItems.length === 0 
              ? `<div style="text-align: center;">
                   <h4 style="font-size: 1rem; color: #0f172a; margin-bottom: 8px;">All stocked up</h4>
                   <p style="font-size: 0.85rem; color: #64748b;">No items below threshold.</p>
                 </div>`
              : `<div style="width: 100%; height: 100%; overflow-y: auto;">
                  ${stats.lowStockItems.map(item => `
                    <div class="alert-item" style="border-bottom: 1px solid var(--border-light); padding: 12px 0;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 500; font-size: 0.9rem;">${item.material.name}</span>
                        <span style="color: var(--danger); font-weight: 600;">${formatNum(item.warehouseStock)}</span>
                      </div>
                      <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">Reorder: ${formatNum(item.reorderLevel)}</div>
                    </div>
                  `).join('')}
                 </div>`
            }
          </div>
        </div>
      </div>

      <!-- Recent Movements Table -->
      <div class="card">
        <div class="card-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
          <h3 style="font-size: 1.1rem; color: #0f172a;">Recent movements</h3>
        </div>
        <div class="table-container">
          <table class="data-table" style="width: 100%;">
            <thead style="background: #f8f9fa;">
              <tr>
                <th style="padding: 16px 20px; color: #6c757d;">DATE</th>
                <th style="padding: 16px 20px; color: #6c757d;">TYPE</th>
                <th style="padding: 16px 20px; color: #6c757d;">PRODUCT</th>
                <th style="padding: 16px 20px; color: #6c757d; text-align: right;">QTY</th>
                <th style="padding: 16px 20px; color: #6c757d;">SITE</th>
              </tr>
            </thead>
            <tbody>
              ${movements.map(m => {
                const prodObj = Store.Materials.getAll().find(p => p.name === m.material);
                const sku = prodObj && prodObj.sku ? prodObj.sku : '';
                return `
                <tr>
                  <td style="padding: 16px 20px; font-variant-numeric: tabular-nums;">${formatDate(m.date)}</td>
                  <td style="padding: 16px 20px;">
                    <span class="badge ${m.type === 'Incoming' ? 'badge-incoming' : 'badge-outgoing'}">${m.type.toUpperCase()}</span>
                  </td>
                  <td style="padding: 16px 20px;">
                    ${m.material} <span style="color: #adb5bd; font-size: 0.75rem; margin-left: 6px;">${sku}</span>
                  </td>
                  <td style="padding: 16px 20px; text-align: right; font-variant-numeric: tabular-nums;">${formatNum(m.quantity)}</td>
                  <td style="padding: 16px 20px; color: #212529;">${m.destinationType === 'site' ? m.destination : (m.type === 'Incoming' ? 'Warehouse' : 'Site')}</td>
                </tr>
              `}).join('')}
              ${movements.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-tertiary)">No recent movements</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  init() {
    this.drawStockChart();
    
    // Fix canvas stretching on window resize
    if (!this._resizeBound) {
      window.addEventListener('resize', () => {
        if (window.location.hash === '' || window.location.hash === '#dashboard') {
          this.drawStockChart();
        }
      });
      this._resizeBound = true;
    }
  },

  drawStockChart() {
    const canvas = document.getElementById('stock-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Set actual size for sharp rendering (account for Retina displays)
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = 280 * dpr;
    ctx.scale(dpr, dpr);
    
    // Fix canvas CSS so it doesn't get distorted
    canvas.style.width = '100%';
    canvas.style.height = '280px';

    // We need to show movements for the last 7 days grouped by date
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const incoming = Store.Incoming.getAll();
    const outgoing = Store.Outgoing.getAll();

    const data = dates.map(date => {
      let inQty = 0;
      let outQty = 0;
      incoming.filter(r => r.date === date).forEach(r => {
        inQty += r.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
      });
      outgoing.filter(r => r.date === date).forEach(r => {
        outQty += r.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
      });
      return { date: date.substring(5), inQty, outQty }; // 'MM-DD'
    });

    const w = rect.width;
    const h = 280;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Find max value
    const maxVal = Math.max(...data.map(d => Math.max(d.inQty, d.outQty)), 1);
    const niceMax = Math.ceil(maxVal / 2500) * 2500 || 2500;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid lines (horizontal)
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); // dashed lines
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      if (i < gridLines) { // Don't draw 0 twice
        const val = niceMax - (niceMax / gridLines) * i;
        ctx.fillStyle = '#6c757d';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(val.toLocaleString(), padding.left - 12, y);
      }
    }
    
    // Solid bottom line (0 axis)
    ctx.setLineDash([]);
    ctx.strokeStyle = '#6c757d';
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    ctx.lineTo(w - padding.right, padding.top + chartH);
    ctx.stroke();
    // 0 label
    ctx.fillStyle = '#6c757d';
    ctx.fillText('0', padding.left - 12, padding.top + chartH);

    // Bars
    const groupWidth = chartW / dates.length;
    const barWidth = Math.min(groupWidth * 0.35, 36);
    const barGap = 0;

    data.forEach((item, i) => {
      const x = padding.left + groupWidth * i + (groupWidth - barWidth * 2 - barGap) / 2;
      
      // Incoming bar (Dark blue/black)
      const wh = (item.inQty / niceMax) * chartH;
      const wy = padding.top + chartH - wh;
      ctx.fillStyle = '#0f172a';
      this.rect(ctx, x, wy, barWidth, wh);
      ctx.fill();

      // Outgoing bar (Orange)
      const sh = (item.outQty / niceMax) * chartH;
      const sy = padding.top + chartH - sh;
      ctx.fillStyle = '#ea580c';
      this.rect(ctx, x + barWidth + barGap, sy, barWidth, sh);
      ctx.fill();

      // X-axis label
      ctx.fillStyle = '#6c757d';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.date, x + barWidth, padding.top + chartH + 12);
    });
  },

  rect(ctx, x, y, w, h) {
    if (h <= 0) return;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.closePath();
  }
};
