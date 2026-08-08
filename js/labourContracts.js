/* ============================================
   BuildMate Labour Contracts Module
   Supports Monthly & Square Feet (Sq Ft) Wise Contracts
   ============================================ */

var LabourContractsPage = {
  searchTerm: '',
  basisFilter: '', // '', 'Monthly', 'SqFt'
  statusFilter: 'Active', // '', 'Active', 'Completed', 'Suspended'
  selectedContractId: null,
  paymentModalContractId: null,

  init() {
    this.bindEvents();
  },

  render() {
    const contracts = Store.LabourContracts ? Store.LabourContracts.getAll() : [];
    
    // Filter contracts
    const filtered = contracts.filter(c => {
      const st = (this.searchTerm || '').toLowerCase();
      const matchSearch = !st ||
        (c.contractTitle || '').toLowerCase().includes(st) ||
        (c.siteName || '').toLowerCase().includes(st) ||
        (c.contractorName || '').toLowerCase().includes(st) ||
        (c.notes || '').toLowerCase().includes(st);
      
      const matchBasis = !this.basisFilter || c.basisType === this.basisFilter;
      const matchStatus = !this.statusFilter || c.status === this.statusFilter;

      return matchSearch && matchBasis && matchStatus;
    });

    // Summary calculations
    let totalContracts = filtered.length;
    let totalValue = 0;
    let totalPaid = 0;

    filtered.forEach(c => {
      totalValue += (parseFloat(c.totalAmount) || 0);
      const payments = Array.isArray(c.receivedPayments) ? c.receivedPayments : [];
      payments.forEach(p => {
        totalPaid += (parseFloat(p.amount) || 0);
      });
    });

    let totalBalance = totalValue - totalPaid;

    return `
      <div class="page-header" style="background: var(--card-bg); padding: 24px; border-radius: var(--card-radius); margin-bottom: 24px; border: 1px solid var(--card-border); box-shadow: var(--card-shadow); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div class="page-header-title" style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 48px; height: 48px; background: rgba(16, 185, 129, 0.15); color: var(--success); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <h2 style="margin: 0; font-size: 1.5rem; color: var(--text-primary);">Labour Contracts</h2>
            <p style="margin: 4px 0 0 0; color: var(--text-tertiary);">Manage Monthly & Square Feet (Sq Ft) wise site labour contracts</p>
          </div>
        </div>
        <div class="page-header-actions" style="display: flex; gap: 10px;">
          <button class="btn btn-primary" onclick="LabourContractsPage.openAddModal()" style="display:inline-flex;align-items:center;gap:6px;">
            ${Icons.plus} Add New Contract
          </button>
        </div>
      </div>

      <!-- Metric Cards Summary -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div class="card" style="padding: 20px; border-left: 4px solid var(--primary-500);">
          <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); font-weight: 600;">Total Contracts</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary); margin-top: 4px;">${totalContracts}</div>
        </div>
        <div class="card" style="padding: 20px; border-left: 4px solid #3b82f6;">
          <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); font-weight: 600;">Total Contract Value</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: #2563eb; margin-top: 4px;">₹${totalValue.toLocaleString('en-IN')}</div>
        </div>
        <div class="card" style="padding: 20px; border-left: 4px solid #10b981;">
          <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); font-weight: 600;">Total Paid / Advance</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: #059669; margin-top: 4px;">₹${totalPaid.toLocaleString('en-IN')}</div>
        </div>
        <div class="card" style="padding: 20px; border-left: 4px solid ${totalBalance > 0 ? '#ef4444' : '#6b7280'};">
          <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); font-weight: 600;">Balance To Pay</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: ${totalBalance > 0 ? '#dc2626' : '#16a34a'}; margin-top: 4px;">₹${totalBalance.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <!-- Toolbar & Filters -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-body" style="padding: 16px;">
          <div style="display: flex; gap: 12px; justify-content: space-between; align-items: center; flex-wrap: wrap;">
            <div style="display: flex; gap: 12px; flex-wrap: wrap; flex: 1; min-width: 280px;">
              <div class="search-input" style="flex: 1; min-width: 200px;">
                ${Icons.search}
                <input type="text" placeholder="Search contracts, site, contractor..." id="lc-search" value="${this.searchTerm}" oninput="LabourContractsPage.onSearch(this.value)">
              </div>
              <select class="filter-select" id="lc-basis-filter" onchange="LabourContractsPage.onFilterChange()" style="min-width: 150px;">
                <option value="">All Contract Types</option>
                <option value="Monthly" ${this.basisFilter === 'Monthly' ? 'selected' : ''}>Monthly Basis</option>
                <option value="SqFt" ${this.basisFilter === 'SqFt' ? 'selected' : ''}>Square Feet Wise</option>
              </select>
              <select class="filter-select" id="lc-status-filter" onchange="LabourContractsPage.onFilterChange()" style="min-width: 140px;">
                <option value="">All Status</option>
                <option value="Active" ${this.statusFilter === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Completed" ${this.statusFilter === 'Completed' ? 'selected' : ''}>Completed</option>
                <option value="Suspended" ${this.statusFilter === 'Suspended' ? 'selected' : ''}>Suspended</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Contracts Table -->
      <div class="card">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Contract & Site</th>
                <th>Contractor</th>
                <th>Type</th>
                <th>Rate & Scope Details</th>
                <th>Total Value</th>
                <th>Paid</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr><td colspan="9" style="text-align:center; padding: 48px; color: var(--text-tertiary);">No labour contracts found. Click "Add New Contract" to create one.</td></tr>
              ` : filtered.map(c => {
                const total = parseFloat(c.totalAmount) || 0;
                const payments = Array.isArray(c.receivedPayments) ? c.receivedPayments : [];
                const paid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                const bal = total - paid;
                const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

                let rateDetailHtml = '';
                if (c.basisType === 'SqFt') {
                  const r = parseFloat(c.ratePerSqFt) || 0;
                  const a = parseFloat(c.totalSqFt) || 0;
                  rateDetailHtml = `<strong style="color:var(--text-primary);">₹${r}/sq ft</strong> × ${a.toLocaleString('en-IN')} sq ft`;
                } else {
                  const mr = parseFloat(c.monthlyRate) || 0;
                  const mos = parseFloat(c.durationMonths) || 1;
                  rateDetailHtml = `<strong style="color:var(--text-primary);">₹${mr.toLocaleString('en-IN')}/mo</strong> × ${mos} mos`;
                }

                const badgeClass = c.status === 'Active' ? 'badge-success' : c.status === 'Completed' ? 'badge-info' : 'badge-warning';

                return `
                  <tr>
                    <td>
                      <strong style="font-size:0.95rem; color: var(--text-primary);">${c.contractTitle || 'Labour Contract'}</strong>
                      <div style="font-size:0.8rem; color: var(--text-tertiary); margin-top:2px;">📍 ${c.siteName || 'No Site Selected'}</div>
                    </td>
                    <td>
                      <strong style="color: var(--text-primary);">${c.contractorName || '—'}</strong>
                    </td>
                    <td>
                      <span class="badge ${c.basisType === 'SqFt' ? 'badge-primary' : 'badge-neutral'}" style="font-size:0.75rem; padding: 4px 8px;">
                        ${c.basisType === 'SqFt' ? '📐 Square Feet' : '📅 Monthly'}
                      </span>
                    </td>
                    <td style="font-size:0.85rem; color: var(--text-secondary);">
                      ${rateDetailHtml}
                    </td>
                    <td style="font-weight: 700; color: var(--text-primary);">
                      ₹${total.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <div style="font-weight:700; color: #059669;">₹${paid.toLocaleString('en-IN')}</div>
                      <div style="width: 100px; height: 5px; background: rgba(0,0,0,0.08); border-radius: 3px; margin-top: 4px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: #10b981; border-radius: 3px;"></div>
                      </div>
                      <div style="font-size: 0.7rem; color: var(--text-tertiary); margin-top:2px;">${pct}% paid</div>
                    </td>
                    <td>
                      <strong style="color: ${bal > 0 ? '#dc2626' : '#16a34a'};">₹${bal.toLocaleString('en-IN')}</strong>
                    </td>
                    <td>
                      <span class="badge ${badgeClass}">${c.status}</span>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button class="btn btn-sm btn-ghost" onclick="LabourContractsPage.openPaymentModal('${c.id}')" title="Record Payment" style="color:#059669;">
                          💰 Pay
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="LabourContractsPage.printStatement('${c.id}')" title="Print Contract Statement">
                          ${Icons.printer}
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="LabourContractsPage.openEditModal('${c.id}')" title="Edit Contract">
                          ${Icons.edit}
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="LabourContractsPage.deleteContract('${c.id}')" title="Delete Contract" style="color: var(--danger);">
                          ${Icons.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add/Edit Contract Modal -->
      <div class="modal-backdrop" id="lc-modal-backdrop" onclick="LabourContractsPage.closeModal()">
        <div class="modal" id="lc-modal" style="max-width: 540px;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3 id="lc-modal-title">Add Labour Contract</h3>
            <button type="button" class="modal-close" onclick="LabourContractsPage.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <form id="lc-form" onsubmit="LabourContractsPage.handleSubmit(event)">
              <input type="hidden" id="lc-id">

              <div class="form-group" style="margin-bottom: 16px;">
                <label for="lc-title">Contract Title / Description <span style="color:var(--danger)">*</span></label>
                <input type="text" id="lc-title" class="form-control" placeholder="e.g. Shuttering Contract / Masonry Contract" required>
              </div>

              <div class="form-row" style="display:flex; gap:12px; margin-bottom:16px;">
                <div class="form-group" style="flex:1;">
                  <label for="lc-site">Select Site <span style="color:var(--danger)">*</span></label>
                  <select id="lc-site" class="form-control" required onchange="LabourContractsPage.onSiteSelect(this.value)">
                    <option value="">-- Choose Site --</option>
                    ${(Store.Sites ? Store.Sites.getAll().filter(s => s.status !== 'Archived') : []).map(s => `
                      <option value="${s.id}">${s.name}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-group" style="flex:1;">
                  <label for="lc-contractor">Contractor / Labour Name <span style="color:var(--danger)">*</span></label>
                  <input type="text" id="lc-contractor" class="form-control" placeholder="Contractor / Labour Name" required list="lc-labours-list">
                  <datalist id="lc-labours-list">
                    ${(Store.Labours ? Store.Labours.getAll() : []).map(l => `<option value="${l.name}">${l.phone ? l.name + ' (' + l.phone + ')' : l.name}</option>`).join('')}
                  </datalist>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 16px;">
                <label>Contract Basis Type <span style="color:var(--danger)">*</span></label>
                <div style="display:flex; gap:16px; margin-top:6px;">
                  <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:600;">
                    <input type="radio" name="lc-basis" value="Monthly" checked onchange="LabourContractsPage.toggleBasisFields('Monthly')">
                    📅 Monthly Basis (Fixed Monthly Rate)
                  </label>
                  <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:600;">
                    <input type="radio" name="lc-basis" value="SqFt" onchange="LabourContractsPage.toggleBasisFields('SqFt')">
                    📐 Square Feet Wise (₹/sq ft)
                  </label>
                </div>
              </div>

              <!-- Monthly Fields -->
              <div id="lc-monthly-fields" style="display:block; background:var(--bg-body); padding:16px; border-radius:8px; margin-bottom:16px; border:1px solid var(--border-color);">
                <div class="form-row" style="display:flex; gap:12px;">
                  <div class="form-group" style="flex:1;">
                    <label for="lc-monthly-rate">Monthly Rate (₹/month) <span style="color:var(--danger)">*</span></label>
                    <input type="number" id="lc-monthly-rate" class="form-control" placeholder="e.g. 40000" min="0" oninput="LabourContractsPage.calcTotal()">
                  </div>
                  <div class="form-group" style="flex:1;">
                    <label for="lc-duration">Duration (Months) <span style="color:var(--danger)">*</span></label>
                    <input type="number" id="lc-duration" class="form-control" value="1" min="1" step="0.5" oninput="LabourContractsPage.calcTotal()">
                  </div>
                </div>
              </div>

              <!-- SqFt Fields -->
              <div id="lc-sqft-fields" style="display:none; background:var(--bg-body); padding:16px; border-radius:8px; margin-bottom:16px; border:1px solid var(--border-color);">
                <div class="form-row" style="display:flex; gap:12px;">
                  <div class="form-group" style="flex:1;">
                    <label for="lc-rate-sqft">Rate per Sq Ft (₹/sq ft) <span style="color:var(--danger)">*</span></label>
                    <input type="number" id="lc-rate-sqft" class="form-control" placeholder="e.g. 180" min="0" step="0.01" oninput="LabourContractsPage.calcTotal()">
                  </div>
                  <div class="form-group" style="flex:1;">
                    <label for="lc-total-sqft">Total Area (Sq Ft) <span style="color:var(--danger)">*</span></label>
                    <input type="number" id="lc-total-sqft" class="form-control" placeholder="e.g. 2500" min="0" step="1" oninput="LabourContractsPage.calcTotal()">
                  </div>
                </div>
              </div>

              <div class="form-row" style="display:flex; gap:12px; margin-bottom:16px;">
                <div class="form-group" style="flex:1;">
                  <label for="lc-total-amount">Total Contract Amount (₹)</label>
                  <input type="number" id="lc-total-amount" class="form-control" placeholder="Total Amount" readonly style="font-weight:800; font-size:1.1rem; background:var(--bg-card); color:var(--primary-500);">
                </div>
                <div class="form-group" style="flex:1;">
                  <label for="lc-status">Contract Status</label>
                  <select id="lc-status" class="form-control">
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 24px;">
                <label for="lc-notes">Special Terms / Remarks</label>
                <textarea id="lc-notes" class="form-control" placeholder="Enter any payment schedule, lintel dates, or specific terms..." rows="2"></textarea>
              </div>

              <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button type="button" class="btn btn-outline" onclick="LabourContractsPage.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Contract</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Payment Modal -->
      <div class="modal-backdrop" id="lc-pay-modal-backdrop" onclick="LabourContractsPage.closePaymentModal()">
        <div class="modal" id="lc-pay-modal" style="max-width: 460px;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>Record Contract Payment / Advance</h3>
            <button type="button" class="modal-close" onclick="LabourContractsPage.closePaymentModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <form id="lc-pay-form" onsubmit="LabourContractsPage.handlePaymentSubmit(event)">
              <div class="form-group" style="margin-bottom: 14px;">
                <label for="lc-pay-date">Payment Date <span style="color:var(--danger)">*</span></label>
                <input type="date" id="lc-pay-date" class="form-control" value="${window.localDateStr()}" required>
              </div>
              <div class="form-group" style="margin-bottom: 14px;">
                <label for="lc-pay-amount">Amount Paid (₹) <span style="color:var(--danger)">*</span></label>
                <input type="number" id="lc-pay-amount" class="form-control" placeholder="e.g. 25000" min="1" step="1" required>
              </div>
              <div class="form-group" style="margin-bottom: 14px;">
                <label for="lc-pay-mode">Payment Mode / Reference</label>
                <input type="text" id="lc-pay-mode" class="form-control" placeholder="e.g. Cash / UPI / Bank Transfer">
              </div>
              <div class="form-group" style="margin-bottom: 20px;">
                <label for="lc-pay-notes">Payment Notes</label>
                <input type="text" id="lc-pay-notes" class="form-control" placeholder="e.g. 1st Advance payment for shuttering work">
              </div>
              <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button type="button" class="btn btn-outline" onclick="LabourContractsPage.closePaymentModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" style="background:#059669; border-color:#059669;">Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  onSearch(val) {
    this.searchTerm = val;
    this.refresh();
  },

  onFilterChange() {
    this.basisFilter = document.getElementById('lc-basis-filter')?.value || '';
    this.statusFilter = document.getElementById('lc-status-filter')?.value || '';
    this.refresh();
  },

  refresh() {
    const container = document.getElementById('page-container');
    if (container && window.location.hash === '#labour-contracts') {
      container.innerHTML = this.render();
      this.bindEvents();
    }
  },

  bindEvents() {},

  toggleBasisFields(type) {
    const monthlyDiv = document.getElementById('lc-monthly-fields');
    const sqftDiv = document.getElementById('lc-sqft-fields');
    if (monthlyDiv && sqftDiv) {
      if (type === 'SqFt') {
        monthlyDiv.style.display = 'none';
        sqftDiv.style.display = 'block';
      } else {
        monthlyDiv.style.display = 'block';
        sqftDiv.style.display = 'none';
      }
      this.calcTotal();
    }
  },

  onSiteSelect(siteId) {
    const site = Store.Sites ? Store.Sites.getById(siteId) : null;
    if (site && site.ratePerSqFt) {
      const rateInput = document.getElementById('lc-rate-sqft');
      if (rateInput && !rateInput.value) {
        rateInput.value = site.ratePerSqFt;
        this.calcTotal();
      }
    }
  },

  calcTotal() {
    const basis = document.querySelector('input[name="lc-basis"]:checked')?.value || 'Monthly';
    let total = 0;
    if (basis === 'SqFt') {
      const rate = parseFloat(document.getElementById('lc-rate-sqft')?.value) || 0;
      const sqft = parseFloat(document.getElementById('lc-total-sqft')?.value) || 0;
      total = rate * sqft;
    } else {
      const monthlyRate = parseFloat(document.getElementById('lc-monthly-rate')?.value) || 0;
      const duration = parseFloat(document.getElementById('lc-duration')?.value) || 1;
      total = monthlyRate * duration;
    }

    const totalEl = document.getElementById('lc-total-amount');
    if (totalEl) totalEl.value = Math.round(total);
  },

  openAddModal() {
    this.selectedContractId = null;
    document.getElementById('lc-modal-title').innerText = 'Add Labour Contract';
    document.getElementById('lc-id').value = '';
    document.getElementById('lc-title').value = '';
    document.getElementById('lc-site').value = '';
    document.getElementById('lc-contractor').value = '';
    document.querySelector('input[name="lc-basis"][value="Monthly"]').checked = true;
    this.toggleBasisFields('Monthly');
    document.getElementById('lc-monthly-rate').value = '';
    document.getElementById('lc-duration').value = '1';
    document.getElementById('lc-rate-sqft').value = '';
    document.getElementById('lc-total-sqft').value = '';
    document.getElementById('lc-total-amount').value = '';
    document.getElementById('lc-status').value = 'Active';
    document.getElementById('lc-notes').value = '';

    document.getElementById('lc-modal-backdrop').classList.add('active');
    document.getElementById('lc-modal').classList.add('active');
  },

  openEditModal(id) {
    const c = Store.LabourContracts.getById(id);
    if (!c) return;

    this.selectedContractId = id;
    document.getElementById('lc-modal-title').innerText = 'Edit Labour Contract';
    document.getElementById('lc-id').value = c.id;
    document.getElementById('lc-title').value = c.contractTitle || '';
    document.getElementById('lc-site').value = c.siteId || '';
    document.getElementById('lc-contractor').value = c.contractorName || '';
    
    const basis = c.basisType === 'SqFt' ? 'SqFt' : 'Monthly';
    document.querySelector(`input[name="lc-basis"][value="${basis}"]`).checked = true;
    this.toggleBasisFields(basis);

    document.getElementById('lc-monthly-rate').value = c.monthlyRate || '';
    document.getElementById('lc-duration').value = c.durationMonths || '1';
    document.getElementById('lc-rate-sqft').value = c.ratePerSqFt || '';
    document.getElementById('lc-total-sqft').value = c.totalSqFt || '';
    document.getElementById('lc-total-amount').value = c.totalAmount || '';
    document.getElementById('lc-status').value = c.status || 'Active';
    document.getElementById('lc-notes').value = c.notes || '';

    document.getElementById('lc-modal-backdrop').classList.add('active');
    document.getElementById('lc-modal').classList.add('active');
  },

  closeModal() {
    document.getElementById('lc-modal-backdrop')?.classList.remove('active');
    document.getElementById('lc-modal')?.classList.remove('active');
  },

  handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('lc-id').value;
    const siteId = document.getElementById('lc-site').value;
    const site = Store.Sites ? Store.Sites.getById(siteId) : null;
    const siteName = site ? site.name : '';
    const contractorName = document.getElementById('lc-contractor').value.trim();
    const contractTitle = document.getElementById('lc-title').value.trim();
    const basisType = document.querySelector('input[name="lc-basis"]:checked')?.value || 'Monthly';
    
    const monthlyRate = parseFloat(document.getElementById('lc-monthly-rate').value) || 0;
    const durationMonths = parseFloat(document.getElementById('lc-duration').value) || 1;
    const ratePerSqFt = parseFloat(document.getElementById('lc-rate-sqft').value) || 0;
    const totalSqFt = parseFloat(document.getElementById('lc-total-sqft').value) || 0;
    const totalAmount = parseFloat(document.getElementById('lc-total-amount').value) || 0;
    const status = document.getElementById('lc-status').value;
    const notes = document.getElementById('lc-notes').value.trim();

    if (!contractTitle || !siteId || !contractorName) {
      alert('Please fill in Contract Title, Site, and Contractor Name');
      return;
    }

    const payload = {
      siteId,
      siteName,
      contractorName,
      contractTitle,
      basisType,
      monthlyRate,
      durationMonths,
      ratePerSqFt,
      totalSqFt,
      totalAmount,
      status,
      notes
    };

    if (id) {
      Store.LabourContracts.update(id, payload);
    } else {
      payload.receivedPayments = [];
      payload.createdAt = window.localDateStr();
      Store.LabourContracts.add(payload);
    }

    this.closeModal();
    this.refresh();
  },

  openPaymentModal(contractId) {
    this.paymentModalContractId = contractId;
    document.getElementById('lc-pay-date').value = window.localDateStr();
    document.getElementById('lc-pay-amount').value = '';
    document.getElementById('lc-pay-mode').value = '';
    document.getElementById('lc-pay-notes').value = '';

    document.getElementById('lc-pay-modal-backdrop').classList.add('active');
    document.getElementById('lc-pay-modal').classList.add('active');
  },

  closePaymentModal() {
    document.getElementById('lc-pay-modal-backdrop')?.classList.remove('active');
    document.getElementById('lc-pay-modal')?.classList.remove('active');
  },

  handlePaymentSubmit(e) {
    e.preventDefault();
    if (!this.paymentModalContractId) return;

    const contract = Store.LabourContracts.getById(this.paymentModalContractId);
    if (!contract) return;

    const date = document.getElementById('lc-pay-date').value;
    const amount = parseFloat(document.getElementById('lc-pay-amount').value) || 0;
    const reference = document.getElementById('lc-pay-mode').value.trim();
    const notes = document.getElementById('lc-pay-notes').value.trim();

    if (amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const payments = Array.isArray(contract.receivedPayments) ? [...contract.receivedPayments] : [];
    payments.push({
      date,
      amount,
      reference,
      notes
    });

    Store.LabourContracts.update(this.paymentModalContractId, { receivedPayments: payments });
    this.closePaymentModal();
    this.refresh();
  },

  deleteContract(id) {
    if (confirm('Are you sure you want to delete this labour contract?')) {
      Store.LabourContracts.delete(id);
      this.refresh();
    }
  },

  printStatement(id) {
    const c = Store.LabourContracts.getById(id);
    if (!c) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const payments = Array.isArray(c.receivedPayments) ? c.receivedPayments : [];
    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalVal = parseFloat(c.totalAmount) || 0;
    const balDue = totalVal - totalPaid;

    let basisText = '';
    if (c.basisType === 'SqFt') {
      basisText = `Square Feet Wise: ₹${c.ratePerSqFt}/sq ft × ${(c.totalSqFt || 0).toLocaleString('en-IN')} sq ft`;
    } else {
      basisText = `Monthly Basis: ₹${(c.monthlyRate || 0).toLocaleString('en-IN')}/month × ${c.durationMonths || 1} months`;
    }

    const paymentRows = payments.map((p, idx) => `
      <tr>
        <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">${idx + 1}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${p.date}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${p.reference || 'Cash / Transfer'}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${p.notes || '—'}</td>
        <td style="padding:8px; border:1px solid #cbd5e1; text-align:right; font-weight:700; color:#059669;">₹${(p.amount || 0).toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>KSS Labour Contract Statement - ${c.contractTitle}</title>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap");
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: 'Inter', sans-serif; color: #0f172a; padding: 10px; background: #fff; line-height: 1.4; }
          .header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 20px; font-weight: 800; color: #059669; text-transform: uppercase; }
          .sub { font-size: 11px; color: #475569; margin-top: 4px; }
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; margin-bottom: 20px; }
          .info-box div:first-child { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; }
          .info-box div:last-child { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          .table th { background: #0f172a; color: white; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
          .table td { padding: 8px; border: 1px solid #cbd5e1; }
          .summary-box { display: flex; justify-content: space-between; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 16px; border-radius: 8px; margin-top: 20px; font-size: 14px; font-weight: 800; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">KSS Construction Materials</div>
            <div class="sub">Labour Contract Payment Statement</div>
          </div>
          <div style="text-align:right; font-size:10px; color:#64748b;">
            <div>Statement Date: ${window.localDateStr()}</div>
            <div>Ref: ${c.id}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div>Contract Title</div>
            <div>${c.contractTitle}</div>
          </div>
          <div class="info-box">
            <div>Site Name</div>
            <div>📍 ${c.siteName || '—'}</div>
          </div>
          <div class="info-box">
            <div>Contractor / Labour Name</div>
            <div>👤 ${c.contractorName}</div>
          </div>
          <div class="info-box">
            <div>Contract Basis & Rate</div>
            <div>${basisText}</div>
          </div>
        </div>

        <h4 style="margin: 16px 0 8px 0; color: #0f172a;">Payment & Advance History</h4>
        <table class="table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Date</th>
              <th>Mode / Ref</th>
              <th>Notes / Remarks</th>
              <th style="text-align: right;">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            ${paymentRows.length > 0 ? paymentRows : '<tr><td colspan="5" style="text-align:center; padding:16px; color:#64748b;">No advance/payments logged yet</td></tr>'}
          </tbody>
        </table>

        <div class="summary-box">
          <div>Total Contract Value: <strong>₹${totalVal.toLocaleString('en-IN')}</strong></div>
          <div style="color: #059669;">Total Paid: <strong>₹${totalPaid.toLocaleString('en-IN')}</strong></div>
          <div style="color: ${balDue > 0 ? '#dc2626' : '#16a34a'};">Net Balance Due: <strong>₹${balDue.toLocaleString('en-IN')}</strong></div>
        </div>

        <div style="margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; color: #475569;">
          <div>Contractor Signature: __________________</div>
          <div>Authorized Signatory: __________________</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          }
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  }
};
