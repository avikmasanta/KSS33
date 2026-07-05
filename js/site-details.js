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

    // Money tracking
    const totalPaid = Store.SitePayments.getTotalBySite(site.id);
    const totalMaterialSent = materials.reduce((sum, m) => {
      return sum + Store.Inventory.getSiteTotalSent(m.id, site.id) * (parseFloat(m.unitPrice) || 0);
    }, 0);
    const balanceDue = totalMaterialSent - totalPaid;

    const fmt = (v) => '₹ ' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
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
          <button class="btn btn-primary" onclick="SiteDetailsPage.openPaymentModal()">
            ${Icons.plus} Log Payment
          </button>
        </div>
      </div>

      <!-- Money Summary -->
      <h3 style="margin-bottom: 1rem;">💰 Money Summary</h3>
      <div class="stats-grid mb-4" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
        <div class="stat-card" style="border-left: 4px solid var(--primary)">
          <div class="stat-title">Total Material Value Sent</div>
          <div class="stat-value" style="color: var(--primary)">${fmt(totalMaterialSent)}</div>
          <div class="stat-sub">All dispatched stock value</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid var(--success)">
          <div class="stat-title">Total Received (Paid)</div>
          <div class="stat-value" style="color: var(--success)">${fmt(totalPaid)}</div>
          <div class="stat-sub">Payments from customer</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid ${balanceDue > 0 ? 'var(--danger)' : 'var(--success)'}">
          <div class="stat-title">Balance Due</div>
          <div class="stat-value" style="color: ${balanceDue > 0 ? 'var(--danger)' : 'var(--success)'}">${fmt(Math.abs(balanceDue))}</div>
          <div class="stat-sub">${balanceDue > 0 ? 'Amount still pending' : (balanceDue < 0 ? 'Overpaid' : 'Fully settled ✓')}</div>
        </div>
      </div>

      <!-- Material Summary Dashboard -->
      <h3 style="margin-bottom: 1rem;">📦 Stock Summary</h3>
      <div class="stats-grid mb-4" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
        <div class="stat-card"><div class="stat-title">Total Sent</div><div class="stat-value" style="font-size:1.4rem">${fmtQ(qtySent)}</div></div>
        <div class="stat-card"><div class="stat-title">Total Used</div><div class="stat-value" style="font-size:1.4rem">${fmtQ(qtyUsed)}</div></div>
        <div class="stat-card"><div class="stat-title">Returned</div><div class="stat-value" style="font-size:1.4rem">${fmtQ(qtyReturned)}</div></div>
        <div class="stat-card"><div class="stat-title">Damaged</div><div class="stat-value" style="color:var(--danger);font-size:1.4rem">${fmtQ(qtyDamaged)}</div></div>
        <div class="stat-card"><div class="stat-title">Remaining at Site</div><div class="stat-value" style="color:var(--primary);font-size:1.4rem">${fmtQ(qtyStock)}</div></div>
      </div>

      <!-- Tables -->
      <div style="display:flex; flex-direction:column; gap:20px; margin-bottom:20px;">

        <!-- Material Inventory -->
        <div class="card">
          <div class="card-header">
            <h3>Site Material Inventory</h3>
          </div>
          <div class="table-container" id="site-materials-table">
            ${this.renderMaterialsTable(site)}
          </div>
        </div>

        <!-- Incoming / Outgoing Stock Movements -->
        <div class="card">
          <div class="card-header">
            <h3>📋 Stock Movements (Incoming &amp; Outgoing)</h3>
          </div>
          <div class="table-container">
            ${this.renderStockMovements(site)}
          </div>
        </div>

        <!-- Payment History -->
        <div class="card">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <h3>💳 Payment History</h3>
            <button class="btn btn-sm btn-primary" onclick="SiteDetailsPage.openPaymentModal()">${Icons.plus} Add Payment</button>
          </div>
          <div class="table-container" id="site-payments-table">
            ${this.renderPaymentsTable(site)}
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

      <!-- Payment Modal -->
      <div class="modal-backdrop" id="payment-modal">
        <div class="modal">
          <div class="modal-header">
            <h3>Log Payment Received</h3>
            <button class="modal-close" onclick="SiteDetailsPage.closePaymentModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <form id="payment-form">
              <div class="form-row">
                <div class="form-group">
                  <label>Date *</label>
                  <input type="date" class="form-control" id="pay-date" required>
                </div>
                <div class="form-group">
                  <label>Amount (₹) *</label>
                  <input type="number" class="form-control" id="pay-amount" required placeholder="0.00" step="0.01">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Payment Mode</label>
                  <select class="form-control" id="pay-mode">
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Reference / Cheque No.</label>
                  <input type="text" class="form-control" id="pay-ref" placeholder="Optional">
                </div>
              </div>
              <div class="form-group">
                <label>Note</label>
                <input type="text" class="form-control" id="pay-note" placeholder="e.g. Advance, Final settlement">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="SiteDetailsPage.closePaymentModal()">Cancel</button>
            <button class="btn btn-primary" onclick="SiteDetailsPage.savePayment()">Save Payment</button>
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

  renderPaymentsTable(site) {
    const payments = Store.SitePayments.getBySite(site.id);
    payments.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (payments.length === 0) {
      return '<div class="text-center text-tertiary" style="padding:20px">No payments recorded. Click "Add Payment" to log one.</div>';
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
          <td><button class="btn btn-icon btn-ghost" onclick="SiteDetailsPage.deletePayment('${p.id}')">${Icons.trash}</button></td>
        </tr>
      `;
    });
    html += '</tbody></table>';
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
    if (!data.date || data.amount <= 0) { alert('Please enter a valid date and amount.'); return; }
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

