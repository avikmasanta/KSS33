/* ============================================
   BuildMate Dashboard Page
   ============================================ */

var DashboardPage = {
  render() {
    const movements = Store.Inventory.getRecentMovements(10);
    const incoming = Store.Incoming.getAll();
    const outgoing = Store.Outgoing.getAll();
    const sites = Store.Sites.getAll();

    const activeSites = sites.filter(s => s.status === 'Active').length;
    const completedSites = sites.filter(s => s.status === 'Completed').length;
    const totalSites = sites.length;

    let totalIncoming = 0;
    incoming.forEach(r => (r.items || []).forEach(i => totalIncoming += (parseFloat(i.quantity) || 0)));

    let totalOutgoing = 0;
    outgoing.forEach(r => (r.items || []).forEach(i => totalOutgoing += (parseFloat(i.quantity) || 0)));

    const formatNum = (v) => Number(v).toLocaleString('en-IN');
    const formatDate = (d) => {
      const dt = new Date(d);
      return dt.toISOString().split('T')[0];
    };

    return `
      <!-- Page Header -->
      <div class="page-header" style="margin-bottom: 24px;">
        <div class="page-header-title">
          <h2>Operations Dashboard</h2>
          <p>Real-time overview of stock, sites, and recent movements.</p>
        </div>
      </div>

      <!-- Stats & Quick Actions -->
      <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <!-- Sites Stat Card -->
        <div class="stat-card" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; border: none; cursor: pointer;" onclick="App.navigate('sites')">
          <div class="stat-info">
            <div class="label" style="color: #94a3b8; border: none;">Active Sites</div>
            <div class="value" style="color: white; margin-top:4px;">${activeSites} <span style="font-size:1rem;color:#64748b; font-weight: 500;">/ ${totalSites}</span></div>
            <div class="sub" style="color: #cbd5e1; margin-top:12px; font-weight: 500;">${completedSites} completed &rarr; View All</div>
          </div>
          <div class="stat-icon" style="background: rgba(255,255,255,0.1); color: white;">
            ${Icons.mapPin}
          </div>
        </div>

        <!-- Quick Action: Incoming -->
        <div class="stat-card" style="cursor: pointer; display: flex; align-items: center;" onclick="App.navigate('incoming')">
          <div class="stat-info">
            <div class="label" style="color: var(--incoming-color);">Quick Action</div>
            <div class="value" style="font-size: 1.15rem; margin-top: 6px; letter-spacing: -0.3px;">Incoming Stock</div>
            <div class="sub" style="margin-top: 10px;">Log received materials</div>
          </div>
          <div class="stat-icon" style="background: var(--incoming-bg); color: var(--incoming-color); transform: scale(1.1);">
            ${Icons.arrowDownCircle}
          </div>
        </div>

        <!-- Quick Action: Outgoing -->
        <div class="stat-card" style="cursor: pointer; display: flex; align-items: center;" onclick="App.navigate('outgoing')">
          <div class="stat-info">
            <div class="label" style="color: var(--outgoing-color);">Quick Action</div>
            <div class="value" style="font-size: 1.15rem; margin-top: 6px; letter-spacing: -0.3px;">Outgoing Stock</div>
            <div class="sub" style="margin-top: 10px;">Dispatch materials to site</div>
          </div>
          <div class="stat-icon" style="background: var(--outgoing-bg); color: var(--outgoing-color); transform: scale(1.1);">
            ${Icons.arrowUpCircle}
          </div>
        </div>
      </div>

      <!-- Chart (Full Width) -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header" style="border-bottom: none; padding-bottom: 0;">
          <div class="chart-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h3 style="font-size: 1.1rem; color: #0f172a; margin-bottom: 4px;">Stock movements trend (last 7 days)</h3>
              <p style="font-size: 0.8rem; color: #64748b;">Daily comparison of dispatched vs returned quantities.</p>
            </div>
            <div style="display: flex; gap: 16px; font-size: 0.8rem; color: #64748b;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 2px; background: #ea580c;"></div> Outgoing (Dispatched)
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 2px; background: #0f172a;"></div> Incoming (Returned)
              </div>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="chart-container" style="width: 100%;">
            <canvas id="stock-chart" height="280"></canvas>
          </div>
        </div>
      </div>

      <!-- Sq Ft Movement Card (Last 7 Days) -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header" style="border-bottom: none; padding-bottom: 0;">
          <div class="chart-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
            <div>
              <h3 style="font-size: 1.1rem; color: #0f172a; margin-bottom: 4px;">&#9633; Sq Ft Movement (Last 7 Days)</h3>
              <p style="font-size: 0.8rem; color: #64748b;">Daily plate area issued vs returned (in sq ft).</p>
            </div>
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
              ${(() => {
                const sqFtData = Store.getSqFtMovement7Days ? Store.getSqFtMovement7Days() : { totalIssued: 0, totalReturned: 0, daily: [] };
                return `
                  <div style="background: linear-gradient(135deg,#fff7ed,#fed7aa); border-radius: 12px; padding: 10px 18px; text-align:center; border:1px solid #fdba74;">
                    <div style="font-size:0.7rem;color:#9a3412;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Total Issued</div>
                    <div style="font-size:1.4rem;font-weight:800;color:#ea580c;">${sqFtData.totalIssued % 1 === 0 ? formatNum(sqFtData.totalIssued) : sqFtData.totalIssued.toFixed(1)} <span style="font-size:0.75rem;font-weight:500;">sq ft</span></div>
                  </div>
                  <div style="background: linear-gradient(135deg,#f0fdf4,#dcfce7); border-radius: 12px; padding: 10px 18px; text-align:center; border:1px solid #86efac;">
                    <div style="font-size:0.7rem;color:#166534;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Total Returned</div>
                    <div style="font-size:1.4rem;font-weight:800;color:#16a34a;">${sqFtData.totalReturned % 1 === 0 ? formatNum(sqFtData.totalReturned) : sqFtData.totalReturned.toFixed(1)} <span style="font-size:0.75rem;font-weight:500;">sq ft</span></div>
                  </div>
                `;
              })()}
              <div style="display: flex; gap: 12px; align-items: center; font-size: 0.8rem; color: #64748b; margin-left: 8px;">
                <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 12px; height: 12px; border-radius: 2px; background: #ea580c;"></div> Issued</div>
                <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 12px; height: 12px; border-radius: 2px; background: #16a34a;"></div> Returned</div>
              </div>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="chart-container" style="width: 100%;">
            <canvas id="sqft-chart" height="200"></canvas>
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
    this.drawSqFtChart();
    
    // Fix canvas stretching on window resize
    if (!this._resizeBound) {
      window.addEventListener('resize', () => {
        if (window.location.hash === '' || window.location.hash === '#dashboard') {
          this.drawStockChart();
          this.drawSqFtChart();
        }
      });
      this._resizeBound = true;
    }
  },

  drawSqFtChart() {
    const canvas = document.getElementById('sqft-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = '100%';
    canvas.style.height = '200px';

    const sqFtData = Store.getSqFtMovement7Days ? Store.getSqFtMovement7Days() : { daily: [] };
    const data = sqFtData.daily || [];

    const w = rect.width;
    const h = 200;
    const padding = { top: 16, right: 20, bottom: 36, left: 65 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const maxVal = Math.max(...data.map(d => Math.max(d.issued || 0, d.returned || 0)), 1);
    const niceMax = Math.ceil(maxVal / 10) * 10 || 10;

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      if (i < gridLines) {
        const val = niceMax - (niceMax / gridLines) * i;
        ctx.fillStyle = '#6c757d';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(val % 1 === 0 ? val.toLocaleString() : val.toFixed(1), padding.left - 8, y);
      }
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = '#6c757d';
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    ctx.lineTo(w - padding.right, padding.top + chartH);
    ctx.stroke();
    ctx.fillStyle = '#6c757d';
    ctx.fillText('0', padding.left - 8, padding.top + chartH);

    // Bars
    const groupWidth = chartW / (data.length || 7);
    const barWidth = Math.min(groupWidth * 0.35, 30);
    data.forEach((item, i) => {
      const x = padding.left + groupWidth * i + (groupWidth - barWidth * 2) / 2;
      // Issued bar (orange)
      const ih = ((item.issued || 0) / niceMax) * chartH;
      ctx.fillStyle = '#ea580c';
      this.rect(ctx, x, padding.top + chartH - ih, barWidth, ih);
      ctx.fill();
      // Returned bar (green)
      const rh = ((item.returned || 0) / niceMax) * chartH;
      ctx.fillStyle = '#16a34a';
      this.rect(ctx, x + barWidth, padding.top + chartH - rh, barWidth, rh);
      ctx.fill();
      // X label
      ctx.fillStyle = '#6c757d';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.date || '', x + barWidth, padding.top + chartH + 8);
    });
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

    const siteReturns = Store.SiteReturns.getAll();
    const outgoing = Store.Outgoing.getAll();

    const data = dates.map(date => {
      let inQty = 0;
      let outQty = 0;
      
      // Calculate Returned (inQty) for this date
      siteReturns.filter(r => r.date === date).forEach(r => {
        inQty += (parseFloat(r.quantity) || 0);
      });
      
      // Calculate Dispatched (outQty) for this date
      outgoing.filter(r => r.date === date).forEach(r => {
        outQty += (r.items || []).reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
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
