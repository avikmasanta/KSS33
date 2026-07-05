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
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Material</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
    `;
    rows.forEach(r => {
      const isIn = r.type === 'Incoming';
      html += `
        <tr>
          <td>${new Date(r.date).toLocaleDateString('en-IN')}</td>
          <td><span class="badge ${isIn ? 'badge-success' : 'badge-danger'}">${r.type}</span></td>
          <td><strong>${r.material}</strong></td>
          <td style="font-weight:600; color:${isIn ? 'var(--success)' : 'var(--danger)'}">${isIn ? '+' : '-'}${r.qty.toLocaleString('en-IN')}</td>
          <td class="secondary">${r.unit}</td>
          <td class="secondary">${r.ref}</td>
        </tr>
      `;
    });
    html += '</tbody></table>';
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
