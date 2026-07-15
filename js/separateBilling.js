/* ============================================
   KSS Double Fin — Separate Billing Module
   Fully independent of Customer/Site/Inventory
   ============================================ */

var SeparateBillingPage = (() => {
  // ── State ────────────────────────────────────────────────────────────────
  let state = {
    view: 'list',          // 'list' | 'form' | 'detail'
    editId: null,
    searchTerm: '',
    searchField: 'all',
    formItems: [{ materialName: '', length: '', breadth: '', quantity: '', area: 0 }],
    formData: {
      siteName: '',
      contractorName: '',
      ownerName: '',
      location: '',
      lintelDate: '',
      ratePerSqFt: ''
    }
  };

  // ── Helper: calc area for a row ───────────────────────────────────────────
  function calcArea(item) {
    const l = parseFloat(item.length) || 0;
    const b = parseFloat(item.breadth) || 0;
    const q = parseFloat(item.quantity) || 0;
    return parseFloat((l * b * q).toFixed(3));
  }

  // ── Helper: calc totals ───────────────────────────────────────────────────
  function calcTotals() {
    const totalArea = state.formItems.reduce((s, i) => s + (parseFloat(i.area) || 0), 0);
    const rate = parseFloat(state.formData.ratePerSqFt) || 0;
    const totalAmount = rate > 0 ? totalArea * rate : null;
    return { totalArea: parseFloat(totalArea.toFixed(3)), totalAmount };
  }

  // ── Helper: format numbers ────────────────────────────────────────────────
  function fNum(n) {
    if (n === null || n === undefined) return '—';
    return parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  // ── Filtered records ──────────────────────────────────────────────────────
  function getFiltered() {
    let records = (Store.SeparateBillings.getAll() || []).sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    if (state.searchTerm) {
      const st = state.searchTerm.toLowerCase();
      records = records.filter(r => {
        if (state.searchField === 'siteName')      return (r.siteName || '').toLowerCase().includes(st);
        if (state.searchField === 'contractorName') return (r.contractorName || '').toLowerCase().includes(st);
        if (state.searchField === 'ownerName')     return (r.ownerName || '').toLowerCase().includes(st);
        if (state.searchField === 'date')          return (r.lintelDate || r.createdAt || '').includes(st);
        // all
        return (r.siteName || '').toLowerCase().includes(st) ||
               (r.contractorName || '').toLowerCase().includes(st) ||
               (r.ownerName || '').toLowerCase().includes(st) ||
               (r.lintelDate || '').includes(st) ||
               (r.createdAt || '').includes(st);
      });
    }
    return records;
  }

  // ── Render Shell ──────────────────────────────────────────────────────────
  function render() {
    if (state.view === 'form') return renderFormPage();
    if (state.view === 'detail') return renderDetailPage();
    return renderListPage();
  }

  // ── List Page ─────────────────────────────────────────────────────────────
  function renderListPage() {
    const records = getFiltered();

    return `
      <div class="sb-page">
        <!-- Page Header -->
        <div class="sb-header">
          <div class="sb-header-left">
            <div class="sb-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <h2 class="sb-header-title">Separate Billing</h2>
              <p class="sb-header-subtitle">KSS Double Fin — Independent billing without customer or site setup</p>
            </div>
          </div>
          <div class="sb-header-actions">
            <button class="sb-btn sb-btn-primary" id="sb-new-btn" onclick="SeparateBillingPage.newBill()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Bill
            </button>
          </div>
        </div>

        <!-- Stats Row -->
        <div class="sb-stats-row">
          <div class="sb-stat-card">
            <div class="sb-stat-icon sb-stat-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <div class="sb-stat-value">${Store.SeparateBillings.getAll().length}</div>
              <div class="sb-stat-label">Total Bills</div>
            </div>
          </div>
          <div class="sb-stat-card">
            <div class="sb-stat-icon sb-stat-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <div>
              <div class="sb-stat-value">${fNum(Store.SeparateBillings.getAll().reduce((s, r) => s + (parseFloat(r.totalArea) || 0), 0))} Sq Ft</div>
              <div class="sb-stat-label">Total Area Billed</div>
            </div>
          </div>
          <div class="sb-stat-card">
            <div class="sb-stat-icon sb-stat-amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <div class="sb-stat-value">₹${fNum(Store.SeparateBillings.getAll().reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0))}</div>
              <div class="sb-stat-label">Total Amount</div>
            </div>
          </div>
          <div class="sb-stat-card">
            <div class="sb-stat-icon sb-stat-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <div class="sb-stat-value">${new Set(Store.SeparateBillings.getAll().map(r => r.contractorName).filter(Boolean)).size}</div>
              <div class="sb-stat-label">Contractors</div>
            </div>
          </div>
        </div>

        <!-- Search & Filter -->
        <div class="sb-search-row">
          <div class="sb-search-wrap">
            <svg class="sb-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="sb-search-input" placeholder="Search bills..." 
                   value="${state.searchTerm}" 
                   oninput="SeparateBillingPage.onSearch(event)" id="sb-search-input">
          </div>
          <select class="sb-select" onchange="SeparateBillingPage.onSearchField(event)" id="sb-search-field">
            <option value="all" ${state.searchField==='all' ? 'selected':''}>All Fields</option>
            <option value="siteName" ${state.searchField==='siteName' ? 'selected':''}>Site Name</option>
            <option value="contractorName" ${state.searchField==='contractorName' ? 'selected':''}>Contractor</option>
            <option value="ownerName" ${state.searchField==='ownerName' ? 'selected':''}>Owner</option>
            <option value="date" ${state.searchField==='date' ? 'selected':''}>Date</option>
          </select>
        </div>

        <!-- Bills Table -->
        <div class="sb-table-card">
          ${records.length === 0 ? `
            <div class="sb-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:56px;height:56px;opacity:0.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <h3>No bills found</h3>
              <p>${state.searchTerm ? 'Try adjusting your search.' : 'Click "New Bill" to create your first billing record.'}</p>
              ${!state.searchTerm ? `<button class="sb-btn sb-btn-primary" onclick="SeparateBillingPage.newBill()" style="margin-top:16px">Create First Bill</button>` : ''}
            </div>
          ` : `
            <div class="sb-table-scroll">
              <table class="sb-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Site Name</th>
                    <th>Contractor</th>
                    <th>Owner</th>
                    <th>Lintel Date</th>
                    <th>Total Area</th>
                    <th>Rate/Sq Ft</th>
                    <th>Total Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${records.map((r, idx) => `
                    <tr class="sb-table-row" onclick="SeparateBillingPage.viewDetail('${r.id}')">
                      <td><span class="sb-row-num">${idx + 1}</span></td>
                      <td><strong>${r.siteName || '—'}</strong></td>
                      <td>${r.contractorName || '—'}</td>
                      <td>${r.ownerName || '—'}</td>
                      <td>${r.lintelDate || '—'}</td>
                      <td><span class="sb-area-badge">${fNum(r.totalArea)} Sq Ft</span></td>
                      <td>${r.ratePerSqFt ? '₹' + fNum(r.ratePerSqFt) : '—'}</td>
                      <td>${r.totalAmount ? '<strong style="color:var(--success)">₹' + fNum(r.totalAmount) + '</strong>' : '—'}</td>
                      <td onclick="event.stopPropagation()">
                        <div class="sb-action-row">
                          <button class="sb-icon-btn sb-icon-view" title="View" onclick="SeparateBillingPage.viewDetail('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          </button>
                          <button class="sb-icon-btn sb-icon-edit" title="Edit" onclick="SeparateBillingPage.editBill('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button class="sb-icon-btn sb-icon-copy" title="Duplicate" onclick="SeparateBillingPage.duplicateBill('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          </button>
                          <button class="sb-icon-btn sb-icon-print" title="Print" onclick="SeparateBillingPage.printBill('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                          </button>
                          <button class="sb-icon-btn sb-icon-delete" title="Delete" onclick="SeparateBillingPage.deleteBill('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="sb-table-footer">
              Showing ${records.length} of ${Store.SeparateBillings.getAll().length} records
              <button class="sb-btn sb-btn-outline sb-btn-sm" onclick="SeparateBillingPage.exportExcel()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                Export Excel
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // ── Form Page ─────────────────────────────────────────────────────────────
  function renderFormPage() {
    const { totalArea, totalAmount } = calcTotals();
    const isEdit = !!state.editId;

    return `
      <div class="sb-page">
        <div class="sb-header">
          <div class="sb-header-left">
            <button class="sb-back-btn" onclick="SeparateBillingPage.goList()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div class="sb-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            </div>
            <div>
              <h2 class="sb-header-title">${isEdit ? 'Edit Billing' : 'New Separate Bill'}</h2>
              <p class="sb-header-subtitle">${isEdit ? 'Update the billing details below' : 'Create a billing record without customer or site setup'}</p>
            </div>
          </div>
        </div>

        <div class="sb-form-layout">
          <!-- Basic Information Card -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--primary-500)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <h3>Basic Information</h3>
            </div>
            <div class="sb-card-body">
              <div class="sb-form-grid">
                <div class="sb-form-group">
                  <label class="sb-label">Site Name <span class="sb-required">*</span></label>
                  <input type="text" class="sb-input" id="sb-siteName" placeholder="Enter site name" 
                         value="${state.formData.siteName}" oninput="SeparateBillingPage.onFormChange('siteName', this.value)">
                </div>
                <div class="sb-form-group">
                  <label class="sb-label">Contractor Name <span class="sb-required">*</span></label>
                  <input type="text" class="sb-input" id="sb-contractorName" placeholder="Enter contractor name" 
                         value="${state.formData.contractorName}" oninput="SeparateBillingPage.onFormChange('contractorName', this.value)">
                </div>
                <div class="sb-form-group">
                  <label class="sb-label">Owner Name</label>
                  <input type="text" class="sb-input" id="sb-ownerName" placeholder="Enter owner name" 
                         value="${state.formData.ownerName}" oninput="SeparateBillingPage.onFormChange('ownerName', this.value)">
                </div>
                <div class="sb-form-group">
                  <label class="sb-label">Lintel Date</label>
                  <input type="date" class="sb-input" id="sb-lintelDate" 
                         value="${state.formData.lintelDate}" oninput="SeparateBillingPage.onFormChange('lintelDate', this.value)">
                </div>
                <div class="sb-form-group sb-full-span">
                  <label class="sb-label">Location</label>
                  <textarea class="sb-input sb-textarea" id="sb-location" placeholder="Enter location / address" 
                            rows="2" oninput="SeparateBillingPage.onFormChange('location', this.value)">${state.formData.location}</textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- Material Details Card -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--primary-500)"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <h3>Material Details</h3>
              <button type="button" class="sb-btn sb-btn-outline sb-btn-sm" onclick="SeparateBillingPage.addRow()" style="margin-left:auto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Row
              </button>
            </div>
            <div class="sb-card-body" style="padding:0">
              <div class="sb-material-table-wrap">
                <table class="sb-material-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Material Name</th>
                      <th>Length (ft)</th>
                      <th>Breadth (ft)</th>
                      <th>Quantity</th>
                      <th>Area (Sq Ft)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="sb-material-rows">
                    ${state.formItems.map((item, idx) => renderMaterialRow(item, idx)).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Totals & Rate Card -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--primary-500)"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <h3>Pricing & Totals</h3>
            </div>
            <div class="sb-card-body">
              <div class="sb-totals-row">
                <div class="sb-total-item">
                  <div class="sb-total-label">Total Area</div>
                  <div class="sb-total-value sb-total-area" id="sb-total-area">${fNum(totalArea)} Sq Ft</div>
                </div>
                <div class="sb-total-sep">×</div>
                <div class="sb-rate-group">
                  <div class="sb-total-label">Rate per Sq Ft (Optional)</div>
                  <div class="sb-rate-input-wrap">
                    <span class="sb-rate-prefix">₹</span>
                    <input type="number" class="sb-input sb-rate-input" id="sb-ratePerSqFt" min="0" step="0.01"
                           placeholder="Enter rate (optional)"
                           value="${state.formData.ratePerSqFt}" 
                           oninput="SeparateBillingPage.onFormChange('ratePerSqFt', this.value); SeparateBillingPage.refreshTotals()">
                  </div>
                </div>
                <div class="sb-total-sep">=</div>
                <div class="sb-total-item">
                  <div class="sb-total-label">Total Amount</div>
                  <div class="sb-total-value sb-total-amount" id="sb-total-amount">${totalAmount !== null ? '₹' + fNum(totalAmount) : '—'}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="sb-form-actions">
            <button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.goList()">Cancel</button>
            <button class="sb-btn sb-btn-primary sb-btn-lg" onclick="SeparateBillingPage.saveBill()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              ${isEdit ? 'Update Bill' : 'Save Bill'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderMaterialRow(item, idx) {
    return `
      <tr id="sb-row-${idx}">
        <td class="sb-row-num-cell">${idx + 1}</td>
        <td>
          <input type="text" class="sb-cell-input" placeholder="Material name" 
                 value="${item.materialName || ''}"
                 oninput="SeparateBillingPage.updateRowField(${idx}, 'materialName', this.value)">
        </td>
        <td>
          <input type="number" class="sb-cell-input sb-cell-num" placeholder="0" min="0" step="0.01"
                 value="${item.length || ''}"
                 oninput="SeparateBillingPage.updateRowField(${idx}, 'length', this.value)">
        </td>
        <td>
          <input type="number" class="sb-cell-input sb-cell-num" placeholder="0" min="0" step="0.01"
                 value="${item.breadth || ''}"
                 oninput="SeparateBillingPage.updateRowField(${idx}, 'breadth', this.value)">
        </td>
        <td>
          <input type="number" class="sb-cell-input sb-cell-num" placeholder="0" min="1" step="1"
                 value="${item.quantity || ''}"
                 oninput="SeparateBillingPage.updateRowField(${idx}, 'quantity', this.value)">
        </td>
        <td>
          <span class="sb-area-cell" id="sb-area-${idx}">${item.area > 0 ? fNum(item.area) : '—'}</span>
        </td>
        <td>
          ${idx > 0 ? `
            <button class="sb-icon-btn sb-icon-delete" onclick="SeparateBillingPage.removeRow(${idx})" title="Remove row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ` : '<span style="display:inline-block;width:28px"></span>'}
        </td>
      </tr>
    `;
  }

  // ── Detail Page ───────────────────────────────────────────────────────────
  function renderDetailPage() {
    const bill = Store.SeparateBillings.getById(state.editId);
    if (!bill) { goList(); return '<div class="sb-page"></div>'; }

    return `
      <div class="sb-page">
        <div class="sb-header">
          <div class="sb-header-left">
            <button class="sb-back-btn" onclick="SeparateBillingPage.goList()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div class="sb-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <h2 class="sb-header-title">${bill.siteName || 'Bill Detail'}</h2>
              <p class="sb-header-subtitle">Created: ${bill.createdAt || '—'} &bull; Lintel: ${bill.lintelDate || '—'}</p>
            </div>
          </div>
          <div class="sb-header-actions">
            <button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.duplicateBill('${bill.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Duplicate
            </button>
            <button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.editBill('${bill.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.exportPDF('${bill.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Download PDF
            </button>
            <button class="sb-btn sb-btn-primary" onclick="SeparateBillingPage.printBill('${bill.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Invoice
            </button>
          </div>
        </div>

        <div class="sb-detail-layout">
          <!-- Info Card -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <h3>Bill Information</h3>
            </div>
            <div class="sb-card-body">
              <div class="sb-info-grid">
                <div class="sb-info-item">
                  <div class="sb-info-label">Site Name</div>
                  <div class="sb-info-value">${bill.siteName || '—'}</div>
                </div>
                <div class="sb-info-item">
                  <div class="sb-info-label">Contractor Name</div>
                  <div class="sb-info-value">${bill.contractorName || '—'}</div>
                </div>
                <div class="sb-info-item">
                  <div class="sb-info-label">Owner Name</div>
                  <div class="sb-info-value">${bill.ownerName || '—'}</div>
                </div>
                <div class="sb-info-item">
                  <div class="sb-info-label">Lintel Date</div>
                  <div class="sb-info-value">${bill.lintelDate || '—'}</div>
                </div>
                <div class="sb-info-item sb-full-span">
                  <div class="sb-info-label">Location</div>
                  <div class="sb-info-value">${bill.location || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Materials Table -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <h3>Material Details</h3>
            </div>
            <div class="sb-card-body" style="padding:0">
              <div class="sb-table-scroll">
                <table class="sb-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Material</th>
                      <th>Length (ft)</th>
                      <th>Breadth (ft)</th>
                      <th>Qty</th>
                      <th>Area (Sq Ft)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(bill.items || []).map((item, idx) => `
                      <tr class="sb-table-row">
                        <td><span class="sb-row-num">${idx + 1}</span></td>
                        <td><strong>${item.materialName || '—'}</strong></td>
                        <td>${fNum(item.length)}</td>
                        <td>${fNum(item.breadth)}</td>
                        <td>${fNum(item.quantity)}</td>
                        <td><span class="sb-area-badge">${fNum(item.area)} Sq Ft</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Summary Card -->
          <div class="sb-card sb-summary-card">
            <div class="sb-summary-row">
              <div class="sb-summary-item">
                <div class="sb-summary-label">Total Area</div>
                <div class="sb-summary-value">${fNum(bill.totalArea)} Sq Ft</div>
              </div>
              ${bill.ratePerSqFt ? `
                <div class="sb-summary-sep">×</div>
                <div class="sb-summary-item">
                  <div class="sb-summary-label">Rate / Sq Ft</div>
                  <div class="sb-summary-value">₹${fNum(bill.ratePerSqFt)}</div>
                </div>
                <div class="sb-summary-sep">=</div>
                <div class="sb-summary-item sb-summary-total">
                  <div class="sb-summary-label">Grand Total</div>
                  <div class="sb-summary-value sb-grand-total">₹${fNum(bill.totalAmount)}</div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Event Handlers ─────────────────────────────────────────────────────────
  function init() {
    // Add hover effects to table rows
    document.querySelectorAll('.sb-table-row').forEach(row => {
      row.addEventListener('mouseenter', () => row.style.background = 'var(--table-row-hover)');
      row.addEventListener('mouseleave', () => row.style.background = '');
    });
  }

  function onSearch(e) {
    state.searchTerm = e.target.value;
    refreshList();
  }

  function onSearchField(e) {
    state.searchField = e.target.value;
    refreshList();
  }

  function onFormChange(field, value) {
    state.formData[field] = value;
  }

  function refreshList() {
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = render();
      init();
    }
  }

  function refreshForm() {
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = render();
      init();
    }
  }

  function refreshTotals() {
    const { totalArea, totalAmount } = calcTotals();
    const areaEl = document.getElementById('sb-total-area');
    const amtEl = document.getElementById('sb-total-amount');
    if (areaEl) areaEl.textContent = fNum(totalArea) + ' Sq Ft';
    if (amtEl) amtEl.textContent = totalAmount !== null ? '₹' + fNum(totalAmount) : '—';
  }

  function goList() {
    state.view = 'list';
    state.editId = null;
    refreshList();
  }

  function newBill() {
    state.view = 'form';
    state.editId = null;
    state.formData = { siteName: '', contractorName: '', ownerName: '', location: '', lintelDate: '', ratePerSqFt: '' };
    state.formItems = [{ materialName: '', length: '', breadth: '', quantity: '', area: 0 }];
    refreshForm();
  }

  function editBill(id) {
    const bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    state.view = 'form';
    state.editId = id;
    state.formData = {
      siteName: bill.siteName || '',
      contractorName: bill.contractorName || '',
      ownerName: bill.ownerName || '',
      location: bill.location || '',
      lintelDate: bill.lintelDate || '',
      ratePerSqFt: bill.ratePerSqFt || ''
    };
    state.formItems = (bill.items || []).map(i => ({ ...i }));
    if (state.formItems.length === 0) {
      state.formItems = [{ materialName: '', length: '', breadth: '', quantity: '', area: 0 }];
    }
    refreshForm();
  }

  function viewDetail(id) {
    state.view = 'detail';
    state.editId = id;
    refreshList();
  }

  function duplicateBill(id) {
    const bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    state.view = 'form';
    state.editId = null; // new record
    state.formData = {
      siteName: bill.siteName || '',
      contractorName: bill.contractorName || '',
      ownerName: bill.ownerName || '',
      location: bill.location || '',
      lintelDate: '',
      ratePerSqFt: bill.ratePerSqFt || ''
    };
    state.formItems = (bill.items || []).map(i => ({ ...i }));
    if (state.formItems.length === 0) {
      state.formItems = [{ materialName: '', length: '', breadth: '', quantity: '', area: 0 }];
    }
    refreshForm();
  }

  function addRow() {
    state.formItems.push({ materialName: '', length: '', breadth: '', quantity: '', area: 0 });
    refreshForm();
  }

  function removeRow(idx) {
    if (state.formItems.length <= 1) return;
    // Sync current values before removing
    syncFormInputs();
    state.formItems.splice(idx, 1);
    refreshForm();
  }

  function updateRowField(idx, field, value) {
    if (!state.formItems[idx]) return;
    state.formItems[idx][field] = value;
    state.formItems[idx].area = calcArea(state.formItems[idx]);

    // Update area cell in DOM directly (fast path)
    const areaCell = document.getElementById(`sb-area-${idx}`);
    if (areaCell) {
      areaCell.textContent = state.formItems[idx].area > 0 ? fNum(state.formItems[idx].area) : '—';
    }
    refreshTotals();
  }

  function syncFormInputs() {
    // Read all current form inputs into state before re-rendering
    state.formItems.forEach((item, idx) => {
      const nameInput = document.querySelector(`#sb-row-${idx} input:nth-child(1)`);
      const lenInput  = document.querySelector(`#sb-row-${idx} td:nth-child(3) input`);
      const breInput  = document.querySelector(`#sb-row-${idx} td:nth-child(4) input`);
      const qtyInput  = document.querySelector(`#sb-row-${idx} td:nth-child(5) input`);
      if (lenInput) item.length   = lenInput.value;
      if (breInput) item.breadth  = breInput.value;
      if (qtyInput) item.quantity = qtyInput.value;
      item.area = calcArea(item);
    });
    // Sync basic fields
    ['siteName', 'contractorName', 'ownerName', 'location', 'lintelDate', 'ratePerSqFt'].forEach(f => {
      const el = document.getElementById(`sb-${f}`);
      if (el) state.formData[f] = el.value;
    });
  }

  function saveBill() {
    syncFormInputs();

    const { siteName, contractorName } = state.formData;
    if (!siteName.trim()) {
      alert('Please enter a Site Name.');
      document.getElementById('sb-siteName')?.focus();
      return;
    }
    if (!contractorName.trim()) {
      alert('Please enter a Contractor Name.');
      document.getElementById('sb-contractorName')?.focus();
      return;
    }

    // Build items — filter blank rows
    const items = state.formItems
      .filter(i => i.materialName || i.length || i.breadth || i.quantity)
      .map(i => ({
        materialName: i.materialName || '',
        length: parseFloat(i.length) || 0,
        breadth: parseFloat(i.breadth) || 0,
        quantity: parseFloat(i.quantity) || 0,
        area: calcArea(i)
      }));

    if (items.length === 0) {
      alert('Please add at least one material row with data.');
      return;
    }

    const totalArea = parseFloat(items.reduce((s, i) => s + i.area, 0).toFixed(3));
    const rate = parseFloat(state.formData.ratePerSqFt) || null;
    const totalAmount = rate ? parseFloat((totalArea * rate).toFixed(2)) : null;

    const record = {
      siteName: state.formData.siteName.trim(),
      contractorName: state.formData.contractorName.trim(),
      ownerName: state.formData.ownerName.trim(),
      location: state.formData.location.trim(),
      lintelDate: state.formData.lintelDate || '',
      ratePerSqFt: rate,
      items,
      totalArea,
      totalAmount,
      createdAt: state.editId
        ? (Store.SeparateBillings.getById(state.editId)?.createdAt || window.localDateStr())
        : window.localDateStr()
    };

    if (state.editId) {
      Store.SeparateBillings.update(state.editId, record);
      showToast('Bill updated successfully!', 'success');
    } else {
      Store.SeparateBillings.add(record);
      showToast('Bill saved successfully!', 'success');
    }

    goList();
  }

  function deleteBill(id) {
    const bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    if (!confirm(`Delete bill for "${bill.siteName}"? This cannot be undone.`)) return;
    Store.SeparateBillings.remove(id);
    if (state.editId === id) {
      state.editId = null;
      state.view = 'list';
    }
    showToast('Bill deleted.', 'info');
    refreshList();
  }

  // ── Print / PDF ───────────────────────────────────────────────────────────
  function buildInvoiceHTML(bill, forPrint = false) {
    const items = bill.items || [];
    const rows = items.map((item, idx) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${idx + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${item.materialName || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${item.length}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${item.breadth}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${fNum(item.area)} Sq Ft</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>KSS Double Fin — Invoice</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; }
          .invoice-wrap { max-width: 800px; margin: 0 auto; background: #fff; padding: 48px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .inv-header { text-align: center; margin-bottom: 36px; border-bottom: 3px solid #2563eb; padding-bottom: 24px; }
          .inv-company { font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
          .inv-subtitle { font-size: 15px; color: #64748b; margin-top: 4px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
          .inv-badge { display: inline-block; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 13px; font-weight: 700; padding: 4px 14px; border-radius: 20px; margin-top: 8px; }
          .inv-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; background: #f8fafc; padding: 20px; border-radius: 10px; }
          .inv-meta-item label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
          .inv-meta-item span { font-size: 15px; color: #0f172a; font-weight: 600; }
          .inv-meta-full { grid-column: 1/-1; }
          .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .inv-table th { background: #1e40af; color: white; padding: 10px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
          .inv-table th:nth-child(n+3) { text-align: center; }
          .inv-table th:last-child { text-align: right; }
          .inv-footer { background: #0f172a; color: white; border-radius: 10px; padding: 20px 24px; }
          .inv-footer-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
          .inv-footer-row:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,0.1); }
          .inv-footer-label { font-size: 13px; color: #94a3b8; }
          .inv-footer-val { font-size: 15px; font-weight: 700; color: white; }
          .inv-grand { font-size: 22px !important; color: #60a5fa !important; }
          @media print {
            body { background: white; }
            .invoice-wrap { box-shadow: none; padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-wrap">
          <div class="inv-header">
            <div class="inv-company">KSS Double Fin</div>
            <div class="inv-subtitle">Separate Billing Invoice</div>
            <div class="inv-badge">BILL #${bill.id ? bill.id.substring(0, 8).toUpperCase() : 'DRAFT'}</div>
          </div>

          <div class="inv-meta">
            <div class="inv-meta-item">
              <label>Site Name</label>
              <span>${bill.siteName || '—'}</span>
            </div>
            <div class="inv-meta-item">
              <label>Lintel Date</label>
              <span>${bill.lintelDate || '—'}</span>
            </div>
            <div class="inv-meta-item">
              <label>Contractor Name</label>
              <span>${bill.contractorName || '—'}</span>
            </div>
            <div class="inv-meta-item">
              <label>Owner Name</label>
              <span>${bill.ownerName || '—'}</span>
            </div>
            <div class="inv-meta-item inv-meta-full">
              <label>Location</label>
              <span>${bill.location || '—'}</span>
            </div>
          </div>

          <table class="inv-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Material</th>
                <th>Length (ft)</th>
                <th>Breadth (ft)</th>
                <th>Qty</th>
                <th style="text-align:right">Area (Sq Ft)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="inv-footer">
            <div class="inv-footer-row">
              <span class="inv-footer-label">Total Area</span>
              <span class="inv-footer-val">${fNum(bill.totalArea)} Sq Ft</span>
            </div>
            ${bill.ratePerSqFt ? `
              <div class="inv-footer-row">
                <span class="inv-footer-label">Rate per Sq Ft</span>
                <span class="inv-footer-val">₹${fNum(bill.ratePerSqFt)}</span>
              </div>
              <div class="inv-footer-row">
                <span class="inv-footer-label">Grand Total</span>
                <span class="inv-footer-val inv-grand">₹${fNum(bill.totalAmount)}</span>
              </div>
            ` : ''}
          </div>
        </div>
        ${forPrint ? '<script>window.print(); window.onafterprint = () => window.close();<\/script>' : ''}
      </body>
      </html>
    `;
  }

  function printBill(id) {
    const bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Please allow popups to print.'); return; }
    w.document.write(buildInvoiceHTML(bill, true));
    w.document.close();
  }

  function exportPDF(id) {
    const bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    // Open in new tab for user to save as PDF via browser Print > Save as PDF
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Please allow popups to download PDF.'); return; }
    w.document.write(buildInvoiceHTML(bill, false));
    w.document.close();
    // Trigger print dialog so user can save as PDF
    setTimeout(() => {
      try { w.print(); } catch(e) {}
    }, 800);
  }

  // ── Excel Export ──────────────────────────────────────────────────────────
  function exportExcel() {
    const records = getFiltered();
    if (records.length === 0) { alert('No records to export.'); return; }

    const rows = [
      ['#', 'Site Name', 'Contractor', 'Owner', 'Location', 'Lintel Date', 'Total Area (Sq Ft)', 'Rate/Sq Ft', 'Total Amount', 'Created']
    ];

    records.forEach((r, idx) => {
      rows.push([
        idx + 1,
        r.siteName || '',
        r.contractorName || '',
        r.ownerName || '',
        r.location || '',
        r.lintelDate || '',
        r.totalArea || 0,
        r.ratePerSqFt || '',
        r.totalAmount || '',
        r.createdAt || ''
      ]);
    });

    // Also add material rows
    rows.push([]);
    rows.push(['--- MATERIAL DETAILS ---']);
    rows.push(['Bill #', 'Site Name', 'Material', 'Length (ft)', 'Breadth (ft)', 'Qty', 'Area (Sq Ft)']);
    records.forEach((r, rIdx) => {
      (r.items || []).forEach((item, iIdx) => {
        rows.push([
          rIdx + 1,
          r.siteName || '',
          item.materialName || '',
          item.length || 0,
          item.breadth || 0,
          item.quantity || 0,
          item.area || 0
        ]);
      });
    });

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KSS_Separate_Billings_${window.localDateStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Excel exported successfully!', 'success');
  }

  // ── Toast Notification ────────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const existing = document.getElementById('sb-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'sb-toast';
    const colors = { success: '#059669', info: '#2563eb', error: '#dc2626' };
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: ${colors[type] || colors.success}; color: white;
      padding: 12px 20px; border-radius: 10px; font-weight: 600;
      font-size: 14px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      animation: sb-toast-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      max-width: 320px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 2500);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    render,
    init,
    onSearch,
    onSearchField,
    onFormChange,
    refreshTotals,
    goList,
    newBill,
    editBill,
    viewDetail,
    duplicateBill,
    addRow,
    removeRow,
    updateRowField,
    saveBill,
    deleteBill,
    printBill,
    exportPDF,
    exportExcel
  };
})();
