/* ============================================
   KSS33 Site Details Page
   ============================================ */

var SiteDetailsPage = {
  siteId: null,

  render() {
    if (!this.siteId) {
      return `
        <div class="empty-state">
          <h3>No Site Selected</h3>
          <p>Please select a site from the Sites page.</p>
          <button class="btn btn-primary mt-2" onclick="App.navigate('sites')">Go to Sites</button>
        </div>
      `;
    }

    const site = Store.Sites.getById(this.siteId);
    if (!site) {
      return `
        <div class="empty-state">
          <h3>Site Not Found</h3>
          <p>The requested site could not be found.</p>
          <button class="btn btn-primary mt-2" onclick="App.navigate('sites')">Go to Sites</button>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <div class="page-header-title">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="margin: 0;">Site Dashboard: ${site.name}</h2>
            <span class="badge ${site.status === 'Completed' ? 'badge-info' : (site.status === 'Suspended' ? 'badge-warning' : 'badge-success')}">${site.status || 'Active'}</span>
          </div>
          <p>Customer: <strong>${site.customerName || '-'}</strong> ${site.gstNumber ? ' • GST: ' + site.gstNumber : ''} ${site.contactNumber ? ' • Ph: ' + site.contactNumber : ''}</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-outline" onclick="App.navigate('sites')">
            ${Icons.arrowLeft} Back
          </button>
          ${(!site.status || site.status === 'Active' || site.status === 'Suspended') ? `
            <button class="btn btn-primary" style="background:var(--info);border-color:var(--info)" onclick="SiteDetailsPage.markCompleted()">
              ${Icons.check} Mark as Done
            </button>
          ` : `
            <button class="btn btn-outline" onclick="SiteDetailsPage.markActive()">
              ${Icons.activity} Reopen Site
            </button>
          `}
          <button class="btn btn-primary" style="background:var(--success);border-color:var(--success)" onclick="OutgoingPage.newRecord('${site.id}'); App.navigate('outgoing');">
            ${Icons.box} Dispatch Material
          </button>
        </div>
      </div> </div>

      <!-- Tables -->
      <div style="display:flex; flex-direction:column; gap:20px; margin-bottom:20px;">
        <!-- Incoming / Outgoing Stock Movements -->
        <div class="card">
          <div class="card-header">
            <h3>📋 Stock Movements (Incoming &amp; Outgoing)</h3>
          </div>
          <div class="table-container">
            ${this.renderStockMovements(site)}
          </div>
        </div>
      </div>
    `;
  },

  init() {},

  renderStockMovements(site) {
    const materials = Store.Materials.getAll();
    const allOutgoing = Store.Outgoing.getAll().filter(r => r.siteId === site.id);
    const allIncoming = Store.Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id);

    const rows = [];

    allOutgoing.forEach(record => {
      record.items.forEach(item => {
        const mat = materials.find(m => m.id === item.materialId);
        rows.push({
          date: record.date,
          type: 'Outgoing',
          material: mat ? mat.name : '-',
          unit: mat ? mat.unit : '',
          qty: parseFloat(item.quantity) || 0,
          ref: record.referenceNo || '-',
          note: record.notes || '-'
        });
      });
    });

    allIncoming.forEach(record => {
      record.items.forEach(item => {
/* ============================================
   KSS33 Site Details Page
   ============================================ */

var SiteDetailsPage = {
  siteId: null,

  render() {
    if (!this.siteId) {
      return `
        <div class="empty-state">
          <h3>No Site Selected</h3>
          <p>Please select a site from the Sites page.</p>
          <button class="btn btn-primary mt-2" onclick="App.navigate('sites')">Go to Sites</button>
        </div>
      `;
    }

    const site = Store.Sites.getById(this.siteId);
    if (!site) {
      return `
        <div class="empty-state">
          <h3>Site Not Found</h3>
          <p>The requested site could not be found.</p>
          <button class="btn btn-primary mt-2" onclick="App.navigate('sites')">Go to Sites</button>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <div class="page-header-title">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="margin: 0;">Site Dashboard: ${site.name}</h2>
            <span class="badge ${site.status === 'Completed' ? 'badge-info' : (site.status === 'Suspended' ? 'badge-warning' : 'badge-success')}">${site.status || 'Active'}</span>
          </div>
          <p>Customer: <strong>${site.customerName || '-'}</strong> ${site.gstNumber ? ' • GST: ' + site.gstNumber : ''} ${site.contactNumber ? ' • Ph: ' + site.contactNumber : ''}</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-outline" onclick="App.navigate('sites')">
            ${Icons.arrowLeft} Back
          </button>
          ${(!site.status || site.status === 'Active' || site.status === 'Suspended') ? `
            <button class="btn btn-primary" style="background:var(--info);border-color:var(--info)" onclick="SiteDetailsPage.markCompleted()">
              ${Icons.check} Mark as Done
            </button>
          ` : `
            <button class="btn btn-outline" onclick="SiteDetailsPage.markActive()">
              ${Icons.activity} Reopen Site
            </button>
          `}
          <button class="btn btn-primary" style="background:var(--success);border-color:var(--success)" onclick="OutgoingPage.newRecord('${site.id}'); App.navigate('outgoing');">
            ${Icons.box} Dispatch Material
          </button>
        </div>
      </div> </div>

      <!-- Tables -->
      <div style="display:flex; flex-direction:column; gap:20px; margin-bottom:20px;">
        <!-- Incoming / Outgoing Stock Movements -->
        <div class="card">
          <div class="card-header">
            <h3>📋 Stock Movements (Incoming &amp; Outgoing)</h3>
          </div>
          <div class="table-container">
            ${this.renderStockMovements(site)}
          </div>
        </div>
      </div>
    `;
  },

  init() {},

  renderStockMovements(site) {
    const materials = Store.Materials.getAll();
    const allOutgoing = Store.Outgoing.getAll().filter(r => r.siteId === site.id);
    const allIncoming = Store.Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id);

    const rows = [];

    allOutgoing.forEach(record => {
      record.items.forEach(item => {
        const mat = materials.find(m => m.id === item.materialId);
        rows.push({
          date: record.date,
          type: 'Outgoing',
          material: mat ? mat.name : '-',
          unit: mat ? mat.unit : '',
          qty: parseFloat(item.quantity) || 0,
          ref: record.referenceNo || '-',
          note: record.notes || '-'
        });
      });
    });

    allIncoming.forEach(record => {
      record.items.forEach(item => {
        const mat = materials.find(m => m.id === item.materialId);
        rows.push({
          date: record.date,
          type: 'Incoming',
          material: mat ? mat.name : '-',
          unit: mat ? mat.unit : '',
          qty: parseFloat(item.quantity) || 0,
          ref: record.referenceNo || record.invoiceNo || '-',
          note: record.notes || '-'
        });
      });
    });

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (rows.length === 0) {
      return '<div class="text-center text-tertiary" style="padding:20px">No stock movements recorded for this site yet.</div>';
    }

    let html = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 15px;">
    `;
    
    rows.forEach(r => {
      // Outgoing (sent to site) = Green
      // Incoming (returned from site) = Red
      const isIncoming = r.type === 'Incoming';
      const color = isIncoming ? 'var(--danger)' : 'var(--success)';
      const bgColor = isIncoming ? '#fee2e2' : '#dcfce7'; // light red / light green
      const icon = isIncoming ? Icons.arrowDownCircle : Icons.arrowUpCircle;
      const sign = isIncoming ? '-' : '+';
      const label = isIncoming ? 'Returned from Site' : 'Dispatched to Site';

      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: transform 0.2s; cursor: default;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background-color: ${bgColor}; color: ${color}; flex-shrink:0;">
              ${icon}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 4px;">${r.material}</div>
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <span class="badge" style="background-color: ${bgColor}; color: ${color}; font-size: 0.75rem;">${label}</span>
                <span class="text-sm text-tertiary">Ref: ${r.ref}</span>
              </div>
            </div>
          </div>
          <div style="text-align: right; min-width: 100px;">
            <div style="font-weight: 800; font-size: 1.25rem; color: ${color};">
              ${sign}${r.qty.toLocaleString('en-IN')} <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-secondary);">${r.unit}</span>
            </div>
            <div class="text-sm text-tertiary" style="margin-top: 4px; display: flex; align-items: center; gap: 4px; justify-content: flex-end;">
              ${Icons.calendar} ${new Date(r.date).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    return html;
  },

  refresh() {
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = this.render();
      this.init();
    }
  },

  markCompleted() {
    if (confirm('Are you sure you want to mark this site as Done?')) {
      Store.Sites.update(this.siteId, { status: 'Completed' });
      this.refresh();
    }
  },

  markActive() {
    if (confirm('Are you sure you want to reopen this site as Active?')) {
      Store.Sites.update(this.siteId, { status: 'Active' });
      this.refresh();
    }
  }
};
