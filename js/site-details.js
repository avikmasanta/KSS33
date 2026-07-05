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

    const materials = Store.Materials.getAll();
    
    // Calculate Material Summary Quantities and Values
    let qtySent = 0, qtyUsed = 0, qtyReturned = 0, qtyDamaged = 0, qtyStock = 0;
    let valStock = 0; // Total Current Material Value
    
    materials.forEach(m => {
      const price = parseFloat(m.unitPrice) || 0;
      const s = Store.Inventory.getSiteTotalSent(m.id, site.id);
      const u = Store.Inventory.getSiteUsage(m.id, site.id);
      const r = Store.Inventory.getSiteReturns(m.id, site.id);
      const d = Store.Inventory.getSiteDamaged(m.id, site.id);
      const bal = Store.Inventory.getSiteCurrentBalance(m.id, site.id);

      qtySent += s;
      qtyUsed += u;
      qtyReturned += r;
      qtyDamaged += d;
      qtyStock += bal;
      valStock += (bal * price);
    });

    const fmtQ = (v) => Number(v || 0).toLocaleString('en-IN');

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
      </div>

      <!-- Material Summary Dashboard -->
      <h3 style="margin-bottom: 1rem;">Material Summary</h3>
      <div class="stats-grid mb-4" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div class="stat-card"><div class="stat-title">Total Sent</div><div class="stat-value" style="font-size:1.5rem">${fmtQ(qtySent)}</div></div>
        <div class="stat-card"><div class="stat-title">Total Used</div><div class="stat-value" style="font-size:1.5rem">${fmtQ(qtyUsed)}</div></div>
        <div class="stat-card"><div class="stat-title">Total Returned</div><div class="stat-value" style="font-size:1.5rem">${fmtQ(qtyReturned)}</div></div>
        <div class="stat-card"><div class="stat-title">Total Damaged</div><div class="stat-value" style="color: var(--danger); font-size:1.5rem">${fmtQ(qtyDamaged)}</div></div>
        <div class="stat-card"><div class="stat-title">Remaining Quantity</div><div class="stat-value" style="font-size:1.5rem">${fmtQ(qtyStock)}</div></div>
      </div>

      <div style="margin-bottom: 20px;">
        <!-- Material Balances -->
        <div class="card">
          <div class="card-header">
            <h3>Site Material Inventory</h3>
          </div>
          <div class="table-container" id="site-materials-table">
            ${this.renderMaterialsTable(site)}
          </div>
        </div>
      </div>

      <!-- Action Modal -->
      <div class="modal-backdrop" id="site-action-modal">
        <div class="modal">
          <div class="modal-header">
            <h3>Update Material: <span id="action-mat-name"></span></h3>
            <button class="modal-close" onclick="SiteDetailsPage.closeActionModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <form id="action-form">
              <input type="hidden" id="action-mat-id">
              <input type="hidden" id="action-site-id" value="${site.id}">
              <p>Current Available Balance: <strong id="action-max-qty">0</strong></p>
              <div class="form-group">
                <label>Mark as Used (Qty)</label>
                <input type="number" class="form-control" id="action-qty-used" placeholder="0" min="0">
              </div>
              <div class="form-group">
                <label>Mark as Damaged/Lost (Qty)</label>
                <input type="number" class="form-control" id="action-qty-damaged" placeholder="0" min="0">
              </div>
              <div class="form-group">
                <label>Return to Warehouse (Qty)</label>
                <input type="number" class="form-control" id="action-qty-returned" placeholder="0" min="0">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="SiteDetailsPage.closeActionModal()">Cancel</button>
            <button class="btn btn-primary" onclick="SiteDetailsPage.saveAction()">Save Updates</button>
          </div>
        </div>
      </div>

      <!-- Expense Modal -->
      <div class="modal-backdrop" id="expense-modal">
        <div class="modal">
          <div class="modal-header">
            <h3>Log Expense</h3>
            <button class="modal-close" onclick="SiteDetailsPage.closeExpenseModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <form id="expense-form">
              <div class="form-group">
                <label>Date</label>
                <input type="date" class="form-control" id="exp-date" required>
              </div>
              <div class="form-group">
                <label>Expense Type</label>
                <select class="form-control" id="exp-type">
                  <option value="Transport">Transport</option>
                  <option value="Labour">Labour</option>
                  <option value="Repairs">Repairs</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label>Amount (₹) *</label>
                <input type="number" class="form-control" id="exp-amount" required placeholder="0.00" step="0.01">
              </div>
              <div class="form-group">
                <label>Description</label>
                <input type="text" class="form-control" id="exp-desc" placeholder="Details of expense">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="SiteDetailsPage.closeExpenseModal()">Cancel</button>
            <button class="btn btn-primary" onclick="SiteDetailsPage.saveExpense()">Save Expense</button>
          </div>
        </div>
      </div>

    `;
  },

  init() {},

  renderMaterialsTable(site) {
    const materials = Store.Materials.getAll();
    const fmt = (v) => '₹ ' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    
    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Material</th>
            <th>Unit Price</th>
            <th>Qty Sent</th>
            <th>Qty Used</th>
            <th>Qty Remaining</th>
            <th>Used Value</th>
            <th>Remaining Value</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    let hasMaterials = false;
    materials.forEach(m => {
      const price = parseFloat(m.unitPrice) || 0;
      const sent = Store.Inventory.getSiteTotalSent(m.id, site.id);
      const used = Store.Inventory.getSiteUsage(m.id, site.id);
      const returned = Store.Inventory.getSiteReturns(m.id, site.id);
      const damaged = Store.Inventory.getSiteDamaged(m.id, site.id);
      const bal = Store.Inventory.getSiteCurrentBalance(m.id, site.id);
      
      if (sent > 0 || used > 0 || returned > 0 || damaged > 0 || bal !== 0) {
        hasMaterials = true;
        html += `
          <tr>
            <td><strong>${m.name}</strong></td>
            <td class="text-tertiary">${fmt(price)}</td>
            <td>${sent.toLocaleString('en-IN')}</td>
            <td>${used.toLocaleString('en-IN')}</td>
            <td><strong style="color:var(--primary); font-size: 1.1rem;">${bal.toLocaleString('en-IN')}</strong></td>
            <td>${fmt(used * price)}</td>
            <td><strong style="color:var(--primary);">${fmt(bal * price)}</strong></td>
            <td>
              <button class="btn btn-sm btn-primary" style="padding: 4px 8px; font-size: 12px;" onclick="SiteDetailsPage.openActionModal('${m.id}', '${m.name}', ${bal})">Update Log</button>
            </td>
          </tr>
        `;
      }
    });
    
    if (!hasMaterials) {
      html += '<tr><td colspan="8" class="text-center text-tertiary" style="padding:20px">No materials dispatched to this site.</td></tr>';
    }
    
    html += `
        </tbody>
      </table>
    `;
    return html;
  },

  renderExpensesTable(site) {
    const expenses = Store.Inventory.getSiteExpenses(site.id);
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (expenses.length === 0) {
      return '<div class="text-center text-tertiary" style="padding: 20px;">No expenses logged for this site.</div>';
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
    `;

    expenses.forEach(e => {
      html += `
        <tr>
          <td>${new Date(e.date).toLocaleDateString('en-IN')}</td>
          <td><span class="badge badge-neutral">${e.type}</span></td>
          <td>${e.description || '-'}</td>
          <td style="color: var(--danger)">₹ ${parseFloat(e.amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

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
  },

  openActionModal(matId, matName, maxQty) {
    document.getElementById('site-action-modal').classList.add('active');
    document.getElementById('action-mat-name').textContent = matName;
    document.getElementById('action-mat-id').value = matId;
    document.getElementById('action-max-qty').textContent = maxQty;
    document.getElementById('action-form').reset();
  },

  closeActionModal() {
    document.getElementById('site-action-modal').classList.remove('active');
  },

  saveAction() {
    const siteId = document.getElementById('action-site-id').value;
    const matId = document.getElementById('action-mat-id').value;
    const maxQty = parseFloat(document.getElementById('action-max-qty').textContent);
    
    const used = parseFloat(document.getElementById('action-qty-used').value) || 0;
    const damaged = parseFloat(document.getElementById('action-qty-damaged').value) || 0;
    const returned = parseFloat(document.getElementById('action-qty-returned').value) || 0;
    
    const total = used + damaged + returned;
    
    if (total === 0) {
      alert("Please enter at least one quantity to update.");
      return;
    }
    
    if (total > maxQty) {
      alert("Total quantity exceeds the available balance at the site!");
      return;
    }
    
    const date = new Date().toISOString();
    
    if (used > 0) Store.SiteUsage.add({ siteId, materialId: matId, quantity: used, date });
    if (damaged > 0) Store.SiteDamaged.add({ siteId, materialId: matId, quantity: damaged, date });
    if (returned > 0) Store.SiteReturns.add({ siteId, materialId: matId, quantity: returned, date });
    
    this.closeActionModal();
    this.refresh();
  },

  renderPaymentsTable(site) {
    const payments = Store.SitePayments.getBySite(site.id);
    payments.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (payments.length === 0) {
      return '<div class="text-center text-tertiary" style="padding: 20px;">No payments recorded yet. Click "Log Payment" to add one.</div>';
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Mode</th>
            <th>Reference</th>
            <th>Note</th>
            <th style="text-align:right">Amount (₹)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    payments.forEach(p => {
      html += `
        <tr>
          <td>${new Date(p.date).toLocaleDateString('en-IN')}</td>
          <td><span class="badge badge-success">${p.mode || 'Cash'}</span></td>
          <td class="secondary">${p.reference || '-'}</td>
          <td>${p.note || '-'}</td>
          <td style="text-align:right; font-weight:600; color:var(--success)">₹ ${parseFloat(p.amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td><button class="btn btn-icon btn-ghost" title="Delete" onclick="SiteDetailsPage.deletePayment('${p.id}')">${Icons.trash}</button></td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    return html;
  },

  openPaymentModal() {
    document.getElementById('payment-modal').classList.add('active');
    document.getElementById('payment-form').reset();
    document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
  },

  closePaymentModal() {
    document.getElementById('payment-modal').classList.remove('active');
  },

  savePayment() {
    const data = {
      siteId: this.siteId,
      date: document.getElementById('pay-date').value,
      amount: parseFloat(document.getElementById('pay-amount').value) || 0,
      mode: document.getElementById('pay-mode').value,
      reference: document.getElementById('pay-ref').value.trim(),
      note: document.getElementById('pay-note').value.trim()
    };

    if (!data.date || data.amount <= 0) {
      alert('Please enter a valid date and amount.');
      return;
    }

    Store.SitePayments.add(data);
    this.closePaymentModal();
    this.refresh();
  },

  deletePayment(id) {
    if (confirm('Delete this payment record?')) {
      Store.SitePayments.remove(id);
      this.refresh();
    }
  },

  openExpenseModal() {
    document.getElementById('expense-modal').classList.add('active');
    document.getElementById('expense-form').reset();
    document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
  },

  closeExpenseModal() {
    document.getElementById('expense-modal').classList.remove('active');
  },

  saveExpense() {
    const data = {
      siteId: this.siteId,
      date: document.getElementById('exp-date').value,
      type: document.getElementById('exp-type').value,
      amount: parseFloat(document.getElementById('exp-amount').value) || 0,
      description: document.getElementById('exp-desc').value.trim()
    };
    
    if (!data.date || data.amount <= 0) {
      alert("Please enter a valid date and amount.");
      return;
    }
    
    Store.SiteExpenses.add(data);
    this.closeExpenseModal();
    this.refresh();
  }
};

