/* ============================================
   KSS Double Fin — Separate Billing Module
   Fully independent of Customer/Site/Inventory
   ============================================
   Material Types:
     Slab  → Area = L × B × Qty  (positive)
     Beam  → Area = Qty × 2 × B  (positive, 2 sides)
     Open  → Area = L × B × Qty  (DEDUCTED from total)
   ============================================ */

var SeparateBillingPage = (() => {

  // ── State ────────────────────────────────────────────────────────────────
  let state = {
    view: 'list',          // 'list' | 'form' | 'detail'
    editId: null,
    searchTerm: '',
    searchField: 'all',
    formItems: [{ type: 'Slab', materialName: '', length: '', breadth: '', quantity: '', area: 0 }],
    formData: {
      siteName: '',
      contractorName: '',
      ownerName: '',
      location: '',
      lintelDate: '',
      ratePerSqFt: ''
    }
  };

  // ── Material Types Config ─────────────────────────────────────────────────
  const TYPES = {
    Slab: {
      label: 'Slab',
      color: '#2563eb',
      bg: 'rgba(37,99,235,0.09)',
      badge: '#eff6ff',
      badgeText: '#1d4ed8',
      formula: 'L × B × Qty',
      sign: +1
    },
    Beam: {
      label: 'Beam',
      color: '#d97706',
      bg: 'rgba(217,119,6,0.09)',
      badge: '#fef3c7',
      badgeText: '#92400e',
      formula: 'Qty × 2 × B',
      sign: +1
    },
    Open: {
      label: 'Open',
      color: '#dc2626',
      bg: 'rgba(220,38,38,0.07)',
      badge: '#fee2e2',
      badgeText: '#991b1b',
      formula: 'L × B × Qty  (−)',
      sign: -1
    }
  };

  // ── Helper: calc area for a row (type-aware) ──────────────────────────────
  function calcArea(item) {
    const l = parseFloat(item.length)   || 0;
    const b = parseFloat(item.breadth)  || 0;
    const q = parseFloat(item.quantity) || 0;
    if (item.type === 'Beam') {
      // Qty × 2 × B  (two sides of beam)
      return parseFloat((q * 2 * b).toFixed(3));
    }
    // Slab and Open: L × B × Qty
    return parseFloat((l * b * q).toFixed(3));
  }

  // ── Helper: calc totals (separating additions & deductions) ───────────────
  function calcTotals(items) {
    const src = items || state.formItems;
    let slabArea = 0, beamArea = 0, openArea = 0;

    src.forEach(i => {
      const a = parseFloat(i.area) || 0;
      if (i.type === 'Open')      openArea += a;
      else if (i.type === 'Beam') beamArea += a;
      else                        slabArea += a;
    });

    const grossArea = slabArea + beamArea;
    const netArea   = parseFloat(Math.max(0, grossArea - openArea).toFixed(3));
    const rate      = parseFloat(state.formData.ratePerSqFt) || 0;
    const totalAmount = rate > 0 ? parseFloat((netArea * rate).toFixed(2)) : null;

    return {
      slabArea:  parseFloat(slabArea.toFixed(3)),
      beamArea:  parseFloat(beamArea.toFixed(3)),
      openArea:  parseFloat(openArea.toFixed(3)),
      grossArea: parseFloat(grossArea.toFixed(3)),
      netArea,
      totalAmount
    };
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
        if (state.searchField === 'siteName')       return (r.siteName || '').toLowerCase().includes(st);
        if (state.searchField === 'contractorName') return (r.contractorName || '').toLowerCase().includes(st);
        if (state.searchField === 'ownerName')      return (r.ownerName || '').toLowerCase().includes(st);
        if (state.searchField === 'date')           return (r.lintelDate || r.createdAt || '').includes(st);
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
    if (state.view === 'form')   return renderFormPage();
    if (state.view === 'detail') return renderDetailPage();
    return renderListPage();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST PAGE
  // ─────────────────────────────────────────────────────────────────────────
  function renderListPage() {
    const records  = getFiltered();
    const allBills = Store.SeparateBillings.getAll();
    const totalNetArea = allBills.reduce((s, r) => s + (parseFloat(r.netArea  || r.totalArea) || 0), 0);
    const totalAmount  = allBills.reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
    const contractors  = new Set(allBills.map(r => r.contractorName).filter(Boolean)).size;

    return `
      <div class="sb-page">
        <!-- Header -->
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
              <p class="sb-header-subtitle">KSS Double Fin — Slab / Beam / Open (deduction) formulas</p>
            </div>
          </div>
          <div class="sb-header-actions">
            <button class="sb-btn sb-btn-primary" onclick="SeparateBillingPage.newBill()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Bill
            </button>
          </div>
        </div>

        <!-- Formula Legend -->
        <div class="sb-legend-strip">
          <div class="sb-legend-item sb-legend-slab">
            <strong>① Slab</strong><span>L × B × Qty</span>
          </div>
          <div class="sb-legend-sep">+</div>
          <div class="sb-legend-item sb-legend-beam">
            <strong>② Beam</strong><span>Qty × 2 × B</span>
          </div>
          <div class="sb-legend-sep">−</div>
          <div class="sb-legend-item sb-legend-open">
            <strong>③ Open</strong><span>L × B × Qty (deduct)</span>
          </div>
          <div class="sb-legend-sep">=</div>
          <div class="sb-legend-item sb-legend-net">
            <strong>Net Area</strong><span>× Rate = Amount</span>
          </div>
        </div>

        <!-- Stats -->
        <div class="sb-stats-row">
          <div class="sb-stat-card">
            <div class="sb-stat-icon sb-stat-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <div class="sb-stat-value">${allBills.length}</div>
              <div class="sb-stat-label">Total Bills</div>
            </div>
          </div>
          <div class="sb-stat-card">
            <div class="sb-stat-icon sb-stat-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <div>
              <div class="sb-stat-value">${fNum(totalNetArea)} Sq Ft</div>
              <div class="sb-stat-label">Total Net Area</div>
            </div>
          </div>
          <div class="sb-stat-card">
            <div class="sb-stat-icon sb-stat-amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <div class="sb-stat-value">₹${fNum(totalAmount)}</div>
              <div class="sb-stat-label">Total Amount</div>
            </div>
          </div>
          <div class="sb-stat-card">
            <div class="sb-stat-icon sb-stat-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <div class="sb-stat-value">${contractors}</div>
              <div class="sb-stat-label">Contractors</div>
            </div>
          </div>
        </div>

        <!-- Search -->
        <div class="sb-search-row">
          <div class="sb-search-wrap">
            <svg class="sb-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="sb-search-input" placeholder="Search bills..."
                   value="${state.searchTerm}" oninput="SeparateBillingPage.onSearch(event)">
          </div>
          <select class="sb-select" onchange="SeparateBillingPage.onSearchField(event)">
            <option value="all" ${state.searchField==='all'?'selected':''}>All Fields</option>
            <option value="siteName" ${state.searchField==='siteName'?'selected':''}>Site Name</option>
            <option value="contractorName" ${state.searchField==='contractorName'?'selected':''}>Contractor</option>
            <option value="ownerName" ${state.searchField==='ownerName'?'selected':''}>Owner</option>
            <option value="date" ${state.searchField==='date'?'selected':''}>Date</option>
          </select>
        </div>

        <!-- Table -->
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
                    <th>Gross Area</th>
                    <th>Deductions</th>
                    <th>Net Area</th>
                    <th>Rate</th>
                    <th>Total Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${records.map((r, idx) => {
                    const gross = parseFloat(r.grossArea || r.totalArea) || 0;
                    const open  = parseFloat(r.openArea)  || 0;
                    const net   = parseFloat(r.netArea   || r.totalArea) || 0;
                    return `
                    <tr class="sb-table-row" onclick="SeparateBillingPage.viewDetail('${r.id}')">
                      <td><span class="sb-row-num">${idx+1}</span></td>
                      <td><strong>${r.siteName || '—'}</strong></td>
                      <td>${r.contractorName || '—'}</td>
                      <td>${r.ownerName || '—'}</td>
                      <td>${r.lintelDate || '—'}</td>
                      <td><span class="sb-area-badge">${fNum(gross)} Sq Ft</span></td>
                      <td><span class="sb-deduct-badge">${open > 0 ? '−' + fNum(open) + ' Sq Ft' : '—'}</span></td>
                      <td><span class="sb-net-badge">${fNum(net)} Sq Ft</span></td>
                      <td>${r.ratePerSqFt ? '₹'+fNum(r.ratePerSqFt) : '—'}</td>
                      <td>${r.totalAmount ? '<strong style="color:var(--success)">₹'+fNum(r.totalAmount)+'</strong>' : '—'}</td>
                      <td onclick="event.stopPropagation()">
                        <div class="sb-action-row">
                          <button class="sb-icon-btn sb-icon-view" title="View" onclick="SeparateBillingPage.viewDetail('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          </button>
                          <button class="sb-icon-btn sb-icon-edit" title="Edit" onclick="SeparateBillingPage.editBill('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button class="sb-icon-btn sb-icon-copy" title="Duplicate" onclick="SeparateBillingPage.duplicateBill('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          </button>
                          <button class="sb-icon-btn sb-icon-print" title="Print" onclick="SeparateBillingPage.printBill('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                          </button>
                          <button class="sb-icon-btn sb-icon-delete" title="Delete" onclick="SeparateBillingPage.deleteBill('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
            <div class="sb-table-footer">
              Showing ${records.length} of ${allBills.length} records
              <button class="sb-btn sb-btn-outline sb-btn-sm" onclick="SeparateBillingPage.exportExcel()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Export Excel
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORM PAGE
  // ─────────────────────────────────────────────────────────────────────────
  function renderFormPage() {
    const t = calcTotals();
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
              <p class="sb-header-subtitle">Slab (L×B×Qty) + Beam (Qty×2×B) − Open deductions</p>
            </div>
          </div>
        </div>

        <div class="sb-form-layout">
          <!-- Basic Info -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
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

          <!-- Material Rows -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <h3>Material Details</h3>
              <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="sb-btn sb-btn-type-slab sb-btn-sm" onclick="SeparateBillingPage.addRow('Slab')">+ Slab</button>
                <button type="button" class="sb-btn sb-btn-type-beam sb-btn-sm" onclick="SeparateBillingPage.addRow('Beam')">+ Beam</button>
                <button type="button" class="sb-btn sb-btn-type-open sb-btn-sm" onclick="SeparateBillingPage.addRow('Open')">+ Open</button>
              </div>
            </div>
            <div class="sb-card-body" style="padding:0">
              <div class="sb-material-table-wrap">
                <table class="sb-material-table">
                  <thead>
                    <tr>
                      <th style="width:38px">#</th>
                      <th style="width:90px">Type</th>
                      <th>Material Name</th>
                      <th style="width:90px">Length (ft)</th>
                      <th style="width:90px">Breadth (ft)</th>
                      <th style="width:80px">Qty</th>
                      <th style="width:110px">Formula</th>
                      <th style="width:110px">Area (Sq Ft)</th>
                      <th style="width:36px"></th>
                    </tr>
                  </thead>
                  <tbody id="sb-material-rows">
                    ${state.formItems.map((item, idx) => renderMaterialRow(item, idx)).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Totals -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <h3>Calculation Summary</h3>
            </div>
            <div class="sb-card-body">
              <div class="sb-calc-grid" id="sb-calc-grid">
                ${renderCalcGrid(t)}
              </div>
            </div>
          </div>

          <!-- Rate & Amount -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              <h3>Pricing</h3>
            </div>
            <div class="sb-card-body">
              <div class="sb-totals-row">
                <div class="sb-total-item">
                  <div class="sb-total-label">Net Area</div>
                  <div class="sb-total-value sb-total-area" id="sb-net-area-display">${fNum(t.netArea)} Sq Ft</div>
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
                  <div class="sb-total-value sb-total-amount" id="sb-total-amount">${t.totalAmount !== null ? '₹'+fNum(t.totalAmount) : '—'}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
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

  function renderCalcGrid(t) {
    return `
      <div class="sb-calc-row">
        <div class="sb-calc-item sb-calc-slab">
          <div class="sb-calc-label">① Slab Area</div>
          <div class="sb-calc-val">${fNum(t.slabArea)} Sq Ft</div>
          <div class="sb-calc-formula">L × B × Qty</div>
        </div>
        <div class="sb-calc-op">+</div>
        <div class="sb-calc-item sb-calc-beam">
          <div class="sb-calc-label">② Beam Area</div>
          <div class="sb-calc-val">${fNum(t.beamArea)} Sq Ft</div>
          <div class="sb-calc-formula">Qty × 2 × B</div>
        </div>
        <div class="sb-calc-op">−</div>
        <div class="sb-calc-item sb-calc-open">
          <div class="sb-calc-label">③ Open (deduct)</div>
          <div class="sb-calc-val">${fNum(t.openArea)} Sq Ft</div>
          <div class="sb-calc-formula">L × B × Qty</div>
        </div>
        <div class="sb-calc-op">=</div>
        <div class="sb-calc-item sb-calc-net">
          <div class="sb-calc-label">Net Area</div>
          <div class="sb-calc-val sb-calc-net-val" id="sb-net-area-calc">${fNum(t.netArea)} Sq Ft</div>
          <div class="sb-calc-formula">${fNum(t.slabArea)} + ${fNum(t.beamArea)} − ${fNum(t.openArea)}</div>
        </div>
      </div>
    `;
  }

  function renderMaterialRow(item, idx) {
    const cfg    = TYPES[item.type] || TYPES.Slab;
    const isOpen = item.type === 'Open';
    const formula = item.type === 'Beam'
      ? `${item.quantity||0} × 2 × ${item.breadth||0}`
      : `${item.length||0} × ${item.breadth||0} × ${item.quantity||0}`;

    return `
      <tr id="sb-row-${idx}" style="background:${cfg.bg}">
        <td class="sb-row-num-cell">${idx+1}</td>
        <td>
          <select class="sb-type-select" data-idx="${idx}" onchange="SeparateBillingPage.updateRowType(${idx}, this.value)"
                  style="border-color:${cfg.color};color:${cfg.color};background:${cfg.badge};">
            <option value="Slab" ${item.type==='Slab'?'selected':''}>Slab</option>
            <option value="Beam" ${item.type==='Beam'?'selected':''}>Beam</option>
            <option value="Open" ${item.type==='Open'?'selected':''}>Open</option>
          </select>
        </td>
        <td>
          <input type="text" class="sb-cell-input" placeholder="Material name"
                 value="${item.materialName||''}"
                 oninput="SeparateBillingPage.updateRowField(${idx},'materialName',this.value)">
        </td>
        <td>
          ${item.type === 'Beam' ? `<span class="sb-na-cell">—</span>` : `
          <input type="number" class="sb-cell-input sb-cell-num" placeholder="0" min="0" step="0.01"
                 value="${item.length||''}"
                 oninput="SeparateBillingPage.updateRowField(${idx},'length',this.value)">`}
        </td>
        <td>
          <input type="number" class="sb-cell-input sb-cell-num" placeholder="0" min="0" step="0.01"
                 value="${item.breadth||''}"
                 oninput="SeparateBillingPage.updateRowField(${idx},'breadth',this.value)">
        </td>
        <td>
          <input type="number" class="sb-cell-input sb-cell-num" placeholder="0" min="1" step="1"
                 value="${item.quantity||''}"
                 oninput="SeparateBillingPage.updateRowField(${idx},'quantity',this.value)">
        </td>
        <td>
          <span class="sb-formula-cell" style="color:${cfg.color}">${formula}</span>
        </td>
        <td>
          <span class="sb-area-cell ${isOpen ? 'sb-area-deduct' : ''}" id="sb-area-${idx}">
            ${isOpen ? '−' : ''}${item.area > 0 ? fNum(item.area) : '—'}${item.area > 0 ? ' Sq Ft' : ''}
          </span>
        </td>
        <td>
          ${state.formItems.length > 1 ? `
            <button class="sb-icon-btn sb-icon-delete" onclick="SeparateBillingPage.removeRow(${idx})" title="Remove">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ` : '<span style="display:inline-block;width:28px"></span>'}
        </td>
      </tr>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETAIL PAGE
  // ─────────────────────────────────────────────────────────────────────────
  function renderDetailPage() {
    const bill = Store.SeparateBillings.getById(state.editId);
    if (!bill) { goList(); return '<div class="sb-page"></div>'; }

    const slabItems = (bill.items||[]).filter(i => i.type !== 'Beam' && i.type !== 'Open');
    const beamItems = (bill.items||[]).filter(i => i.type === 'Beam');
    const openItems = (bill.items||[]).filter(i => i.type === 'Open');

    const gross = parseFloat(bill.grossArea || bill.totalArea) || 0;
    const open  = parseFloat(bill.openArea)  || 0;
    const net   = parseFloat(bill.netArea   || bill.totalArea) || 0;

    function renderItemSection(items, type) {
      if (!items.length) return '';
      const cfg = TYPES[type] || TYPES.Slab;
      return `
        <tr style="background:${cfg.badge}">
          <td colspan="6" style="padding:8px 14px;font-weight:700;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.05em;color:${cfg.color}">
            ${cfg.label} — ${cfg.formula}
          </td>
        </tr>
        ${items.map((item, i) => `
          <tr class="sb-table-row" style="background:${cfg.bg}">
            <td><span class="sb-row-num" style="background:${cfg.badge};color:${cfg.color}">${i+1}</span></td>
            <td><strong>${item.materialName || '—'}</strong></td>
            <td>${type === 'Beam' ? '—' : fNum(item.length)}</td>
            <td>${fNum(item.breadth)}</td>
            <td>${fNum(item.quantity)}</td>
            <td>
              <span class="${type==='Open' ? 'sb-deduct-badge' : 'sb-area-badge'}">
                ${type==='Open' ? '−' : ''}${fNum(item.area)} Sq Ft
              </span>
            </td>
          </tr>
        `).join('')}
      `;
    }

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
              <h2 class="sb-header-title">${bill.siteName||'Bill Detail'}</h2>
              <p class="sb-header-subtitle">Created: ${bill.createdAt||'—'} &bull; Lintel: ${bill.lintelDate||'—'}</p>
            </div>
          </div>
          <div class="sb-header-actions">
            <button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.duplicateBill('${bill.id}')">Duplicate</button>
            <button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.editBill('${bill.id}')">Edit</button>
            <button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.exportPDF('${bill.id}')">Download PDF</button>
            <button class="sb-btn sb-btn-primary" onclick="SeparateBillingPage.printBill('${bill.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Invoice
            </button>
          </div>
        </div>

        <div class="sb-detail-layout">
          <!-- Info -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <h3>Bill Information</h3>
            </div>
            <div class="sb-card-body">
              <div class="sb-info-grid">
                <div class="sb-info-item"><div class="sb-info-label">Site Name</div><div class="sb-info-value">${bill.siteName||'—'}</div></div>
                <div class="sb-info-item"><div class="sb-info-label">Contractor</div><div class="sb-info-value">${bill.contractorName||'—'}</div></div>
                <div class="sb-info-item"><div class="sb-info-label">Owner</div><div class="sb-info-value">${bill.ownerName||'—'}</div></div>
                <div class="sb-info-item"><div class="sb-info-label">Lintel Date</div><div class="sb-info-value">${bill.lintelDate||'—'}</div></div>
                <div class="sb-info-item sb-full-span"><div class="sb-info-label">Location</div><div class="sb-info-value">${bill.location||'—'}</div></div>
              </div>
            </div>
          </div>

          <!-- Materials -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <h3>Material Details</h3>
            </div>
            <div class="sb-card-body" style="padding:0">
              <div class="sb-table-scroll">
                <table class="sb-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Material</th><th>Length (ft)</th><th>Breadth (ft)</th><th>Qty</th><th>Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${renderItemSection(slabItems, 'Slab')}
                    ${renderItemSection(beamItems, 'Beam')}
                    ${renderItemSection(openItems, 'Open')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Calculation Summary -->
          <div class="sb-card">
            <div class="sb-card-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
              <h3>Calculation Breakdown</h3>
            </div>
            <div class="sb-card-body">
              <div class="sb-calc-row">
                <div class="sb-calc-item sb-calc-slab">
                  <div class="sb-calc-label">① Slab Area</div>
                  <div class="sb-calc-val">${fNum(parseFloat(bill.slabArea)||0)} Sq Ft</div>
                  <div class="sb-calc-formula">L × B × Qty</div>
                </div>
                <div class="sb-calc-op">+</div>
                <div class="sb-calc-item sb-calc-beam">
                  <div class="sb-calc-label">② Beam Area</div>
                  <div class="sb-calc-val">${fNum(parseFloat(bill.beamArea)||0)} Sq Ft</div>
                  <div class="sb-calc-formula">Qty × 2 × B</div>
                </div>
                <div class="sb-calc-op">−</div>
                <div class="sb-calc-item sb-calc-open">
                  <div class="sb-calc-label">③ Open (deduct)</div>
                  <div class="sb-calc-val">${fNum(open)} Sq Ft</div>
                  <div class="sb-calc-formula">L × B × Qty</div>
                </div>
                <div class="sb-calc-op">=</div>
                <div class="sb-calc-item sb-calc-net">
                  <div class="sb-calc-label">Net Area</div>
                  <div class="sb-calc-val sb-calc-net-val">${fNum(net)} Sq Ft</div>
                  <div class="sb-calc-formula">${fNum(gross)} − ${fNum(open)}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Grand Total -->
          <div class="sb-card sb-summary-card">
            <div class="sb-summary-row">
              <div class="sb-summary-item">
                <div class="sb-summary-label">Net Area</div>
                <div class="sb-summary-value">${fNum(net)} Sq Ft</div>
              </div>
              ${bill.ratePerSqFt ? `
                <div class="sb-summary-sep">×</div>
                <div class="sb-summary-item">
                  <div class="sb-summary-label">Rate / Sq Ft</div>
                  <div class="sb-summary-value">₹${fNum(bill.ratePerSqFt)}</div>
                </div>
                <div class="sb-summary-sep">=</div>
                <div class="sb-summary-item">
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

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.sb-table-row').forEach(row => {
      row.addEventListener('mouseenter', () => row.style.filter = 'brightness(0.96)');
      row.addEventListener('mouseleave', () => row.style.filter = '');
    });
  }

  function onSearch(e)      { state.searchTerm  = e.target.value; refreshList(); }
  function onSearchField(e) { state.searchField = e.target.value; refreshList(); }
  function onFormChange(field, value) { state.formData[field] = value; }

  function refreshList() {
    const c = document.getElementById('page-container');
    if (c) { c.innerHTML = render(); init(); }
  }
  function refreshForm() {
    const c = document.getElementById('page-container');
    if (c) { c.innerHTML = render(); init(); }
  }

  function refreshTotals() {
    const rateEl = document.getElementById('sb-ratePerSqFt');
    if (rateEl) state.formData.ratePerSqFt = rateEl.value;

    const t = calcTotals();

    // Update calc grid
    const grid = document.getElementById('sb-calc-grid');
    if (grid) grid.innerHTML = renderCalcGrid(t);

    // Update net area display
    const netDisp = document.getElementById('sb-net-area-display');
    if (netDisp) netDisp.textContent = fNum(t.netArea) + ' Sq Ft';

    // Update amount
    const amtEl = document.getElementById('sb-total-amount');
    if (amtEl) amtEl.textContent = t.totalAmount !== null ? '₹' + fNum(t.totalAmount) : '—';
  }

  function goList() {
    state.view  = 'list';
    state.editId = null;
    refreshList();
  }

  function newBill() {
    state.view  = 'form';
    state.editId = null;
    state.formData = { siteName:'', contractorName:'', ownerName:'', location:'', lintelDate:'', ratePerSqFt:'' };
    state.formItems = [{ type:'Slab', materialName:'', length:'', breadth:'', quantity:'', area:0 }];
    refreshForm();
  }

  function editBill(id) {
    const bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    state.view  = 'form';
    state.editId = id;
    state.formData = {
      siteName:       bill.siteName       || '',
      contractorName: bill.contractorName || '',
      ownerName:      bill.ownerName      || '',
      location:       bill.location       || '',
      lintelDate:     bill.lintelDate     || '',
      ratePerSqFt:    bill.ratePerSqFt    || ''
    };
    state.formItems = (bill.items||[]).map(i => ({...i}));
    if (!state.formItems.length) state.formItems = [{ type:'Slab', materialName:'', length:'', breadth:'', quantity:'', area:0 }];
    refreshForm();
  }

  function viewDetail(id) {
    state.view  = 'detail';
    state.editId = id;
    refreshList();
  }

  function duplicateBill(id) {
    const bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    state.view  = 'form';
    state.editId = null;
    state.formData = {
      siteName:       bill.siteName       || '',
      contractorName: bill.contractorName || '',
      ownerName:      bill.ownerName      || '',
      location:       bill.location       || '',
      lintelDate:     '',
      ratePerSqFt:    bill.ratePerSqFt    || ''
    };
    state.formItems = (bill.items||[]).map(i => ({...i}));
    if (!state.formItems.length) state.formItems = [{ type:'Slab', materialName:'', length:'', breadth:'', quantity:'', area:0 }];
    refreshForm();
  }

  function addRow(type) {
    syncFormInputs();
    state.formItems.push({ type: type||'Slab', materialName:'', length:'', breadth:'', quantity:'', area:0 });
    refreshForm();
  }

  function removeRow(idx) {
    if (state.formItems.length <= 1) return;
    syncFormInputs();
    state.formItems.splice(idx, 1);
    refreshForm();
  }

  function updateRowType(idx, type) {
    if (!state.formItems[idx]) return;
    state.formItems[idx].type = type;
    state.formItems[idx].area = calcArea(state.formItems[idx]);
    refreshForm();
  }

  function updateRowField(idx, field, value) {
    if (!state.formItems[idx]) return;
    state.formItems[idx][field] = value;
    state.formItems[idx].area   = calcArea(state.formItems[idx]);

    // Fast-path DOM update for area cell
    const areaCell = document.getElementById(`sb-area-${idx}`);
    if (areaCell) {
      const isOpen = state.formItems[idx].type === 'Open';
      const a      = state.formItems[idx].area;
      areaCell.textContent = a > 0 ? (isOpen ? '−' : '') + fNum(a) + ' Sq Ft' : '—';
    }

    // Also update formula cell
    const row = document.getElementById(`sb-row-${idx}`);
    if (row) {
      const fCell = row.querySelector('.sb-formula-cell');
      if (fCell) {
        const it = state.formItems[idx];
        fCell.textContent = it.type === 'Beam'
          ? `${it.quantity||0} × 2 × ${it.breadth||0}`
          : `${it.length||0} × ${it.breadth||0} × ${it.quantity||0}`;
      }
    }

    refreshTotals();
  }

  function syncFormInputs() {
    // Sync basic fields
    ['siteName','contractorName','ownerName','location','lintelDate','ratePerSqFt'].forEach(f => {
      const el = document.getElementById(`sb-${f}`);
      if (el) state.formData[f] = el.value;
    });
    // Sync material row inputs
    state.formItems.forEach((item, idx) => {
      const row = document.getElementById(`sb-row-${idx}`);
      if (!row) return;
      const inputs = row.querySelectorAll('input');
      inputs.forEach(inp => {
        if (inp.placeholder === 'Material name' || inp.type === 'text') item.materialName = inp.value;
        else if (inp.placeholder === '0' && inp.classList.contains('sb-cell-num')) {
          // length / breadth / quantity — identify by column order
        }
      });
      // More reliable: query by position
      const nums = row.querySelectorAll('.sb-cell-num');
      if (item.type === 'Beam') {
        if (nums[0]) item.breadth  = nums[0].value;
        if (nums[1]) item.quantity = nums[1].value;
      } else {
        if (nums[0]) item.length   = nums[0].value;
        if (nums[1]) item.breadth  = nums[1].value;
        if (nums[2]) item.quantity = nums[2].value;
      }
      item.area = calcArea(item);
    });
  }

  function saveBill() {
    syncFormInputs();

    const { siteName, contractorName } = state.formData;
    if (!siteName.trim())       { alert('Please enter a Site Name.');       document.getElementById('sb-siteName')?.focus(); return; }
    if (!contractorName.trim()) { alert('Please enter a Contractor Name.'); document.getElementById('sb-contractorName')?.focus(); return; }

    const items = state.formItems
      .filter(i => i.materialName || i.length || i.breadth || i.quantity)
      .map(i => ({
        type:         i.type         || 'Slab',
        materialName: i.materialName || '',
        length:       parseFloat(i.length)   || 0,
        breadth:      parseFloat(i.breadth)  || 0,
        quantity:     parseFloat(i.quantity) || 0,
        area:         calcArea(i)
      }));

    if (!items.length) { alert('Please add at least one material row with data.'); return; }

    const t    = calcTotals(items);
    const rate = parseFloat(state.formData.ratePerSqFt) || null;

    const record = {
      siteName:       state.formData.siteName.trim(),
      contractorName: state.formData.contractorName.trim(),
      ownerName:      state.formData.ownerName.trim(),
      location:       state.formData.location.trim(),
      lintelDate:     state.formData.lintelDate || '',
      ratePerSqFt:    rate,
      items,
      slabArea:    t.slabArea,
      beamArea:    t.beamArea,
      openArea:    t.openArea,
      grossArea:   t.grossArea,
      netArea:     t.netArea,
      totalArea:   t.netArea, // backward compat
      totalAmount: rate ? parseFloat((t.netArea * rate).toFixed(2)) : null,
      createdAt:   state.editId
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
    if (state.editId === id) { state.editId = null; state.view = 'list'; }
    showToast('Bill deleted.', 'info');
    refreshList();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRINT / PDF
  // ─────────────────────────────────────────────────────────────────────────
  function buildInvoiceHTML(bill, forPrint) {
    const items = bill.items || [];
    const slabItems = items.filter(i => i.type !== 'Beam' && i.type !== 'Open');
    const beamItems = items.filter(i => i.type === 'Beam');
    const openItems = items.filter(i => i.type === 'Open');

    function sectionRows(arr, type) {
      if (!arr.length) return '';
      const cfg = TYPES[type] || TYPES.Slab;
      return `
        <tr><td colspan="6" style="background:${cfg.badge};color:${cfg.color};font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;padding:8px 12px">${cfg.label} — ${cfg.formula}</td></tr>
        ${arr.map((item, i) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;background:${cfg.bg}">${i+1}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;background:${cfg.bg}">${item.materialName||'—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;background:${cfg.bg}">${type==='Beam'?'—':item.length}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;background:${cfg.bg}">${item.breadth}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;background:${cfg.bg}">${item.quantity}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;background:${cfg.bg};color:${cfg.color}">${type==='Open'?'−':''}${fNum(item.area)} Sq Ft</td>
          </tr>
        `).join('')}
      `;
    }

    const gross = parseFloat(bill.grossArea || bill.totalArea) || 0;
    const open  = parseFloat(bill.openArea) || 0;
    const net   = parseFloat(bill.netArea  || bill.totalArea) || 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>KSS Double Fin — Invoice</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; }
  .wrap { max-width: 820px; margin: 0 auto; background: #fff; padding: 48px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .hd { text-align: center; margin-bottom: 32px; border-bottom: 3px solid #2563eb; padding-bottom: 24px; }
  .hd-co { font-size: 28px; font-weight: 800; color: #0f172a; }
  .hd-sub { font-size: 14px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .hd-badge { display:inline-block;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:12px;font-weight:700;padding:3px 12px;border-radius:20px;margin-top:8px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 28px; background: #f8fafc; padding: 18px; border-radius: 10px; }
  .meta-full { grid-column: 1/-1; }
  .meta label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 3px; }
  .meta span { font-size: 14px; color: #0f172a; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { background: #1e40af; color: white; padding: 10px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  thead th:nth-child(n+3) { text-align: center; }
  thead th:last-child { text-align: right; }
  .calc-row { display: flex; gap: 0; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 20px; }
  .calc-cell { flex: 1; padding: 14px 16px; text-align: center; border-right: 1px solid #e2e8f0; }
  .calc-cell:last-child { border-right: none; }
  .calc-cell .lbl { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
  .calc-cell .val { font-size: 16px; font-weight: 800; }
  .calc-cell .fm { font-size: 11px; color: #94a3b8; margin-top: 3px; }
  .footer { background: #0f172a; color: white; border-radius: 10px; padding: 18px 24px; }
  .frow { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .frow:last-child { border-bottom: none; }
  .flbl { font-size: 13px; color: #94a3b8; }
  .fval { font-size: 15px; font-weight: 700; }
  .fgrand { font-size: 22px !important; color: #60a5fa !important; }
  @media print { body { background: white; } .wrap { box-shadow: none; padding: 20px; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="hd">
    <div class="hd-co">KSS Double Fin</div>
    <div class="hd-sub">Separate Billing Invoice</div>
    <div class="hd-badge">BILL #${bill.id ? bill.id.substring(0,8).toUpperCase() : 'DRAFT'}</div>
  </div>
  <div class="meta">
    <div><label>Site Name</label><span>${bill.siteName||'—'}</span></div>
    <div><label>Lintel Date</label><span>${bill.lintelDate||'—'}</span></div>
    <div><label>Contractor</label><span>${bill.contractorName||'—'}</span></div>
    <div><label>Owner</label><span>${bill.ownerName||'—'}</span></div>
    <div class="meta-full"><label>Location</label><span>${bill.location||'—'}</span></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Material</th><th>Length (ft)</th><th>Breadth (ft)</th><th>Qty</th><th style="text-align:right">Area (Sq Ft)</th></tr></thead>
    <tbody>
      ${sectionRows(slabItems,'Slab')}
      ${sectionRows(beamItems,'Beam')}
      ${sectionRows(openItems,'Open')}
    </tbody>
  </table>
  <div class="calc-row">
    <div class="calc-cell" style="background:#eff6ff"><div class="lbl" style="color:#1d4ed8">① Slab</div><div class="val" style="color:#1d4ed8">${fNum(parseFloat(bill.slabArea)||0)} Sq Ft</div><div class="fm">L × B × Qty</div></div>
    <div class="calc-cell" style="background:#fff;font-size:20px;font-weight:300;color:#94a3b8;display:flex;align-items:center;justify-content:center;flex:0 0 32px">+</div>
    <div class="calc-cell" style="background:#fef3c7"><div class="lbl" style="color:#92400e">② Beam</div><div class="val" style="color:#d97706">${fNum(parseFloat(bill.beamArea)||0)} Sq Ft</div><div class="fm">Qty × 2 × B</div></div>
    <div class="calc-cell" style="background:#fff;font-size:20px;font-weight:300;color:#94a3b8;display:flex;align-items:center;justify-content:center;flex:0 0 32px">−</div>
    <div class="calc-cell" style="background:#fee2e2"><div class="lbl" style="color:#991b1b">③ Open</div><div class="val" style="color:#dc2626">${fNum(open)} Sq Ft</div><div class="fm">L × B × Qty</div></div>
    <div class="calc-cell" style="background:#fff;font-size:20px;font-weight:300;color:#94a3b8;display:flex;align-items:center;justify-content:center;flex:0 0 32px">=</div>
    <div class="calc-cell" style="background:#f0fdf4"><div class="lbl" style="color:#065f46">Net Area</div><div class="val" style="color:#059669">${fNum(net)} Sq Ft</div><div class="fm">${fNum(gross)} − ${fNum(open)}</div></div>
  </div>
  <div class="footer">
    <div class="frow"><span class="flbl">Gross Area (Slab + Beam)</span><span class="fval">${fNum(gross)} Sq Ft</span></div>
    <div class="frow"><span class="flbl">Deductions (Open)</span><span class="fval">− ${fNum(open)} Sq Ft</span></div>
    <div class="frow"><span class="flbl">Net Area</span><span class="fval">${fNum(net)} Sq Ft</span></div>
    ${bill.ratePerSqFt ? `
    <div class="frow"><span class="flbl">Rate per Sq Ft</span><span class="fval">₹${fNum(bill.ratePerSqFt)}</span></div>
    <div class="frow"><span class="flbl">Grand Total</span><span class="fval fgrand">₹${fNum(bill.totalAmount)}</span></div>
    ` : ''}
  </div>
</div>
${forPrint ? '<script>window.print();window.onafterprint=()=>window.close();<\/script>' : ''}
</body></html>`;
  }

  function printBill(id) {
    const bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    const w = window.open('','_blank','width=900,height=700');
    if (!w) { alert('Please allow popups to print.'); return; }
    w.document.write(buildInvoiceHTML(bill, true));
    w.document.close();
  }

  function exportPDF(id) {
    const bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    const w = window.open('','_blank','width=900,height=700');
    if (!w) { alert('Please allow popups.'); return; }
    w.document.write(buildInvoiceHTML(bill, false));
    w.document.close();
    setTimeout(() => { try { w.print(); } catch(e){} }, 800);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXCEL EXPORT
  // ─────────────────────────────────────────────────────────────────────────
  function exportExcel() {
    const records = getFiltered();
    if (!records.length) { alert('No records to export.'); return; }
    const rows = [['#','Site Name','Contractor','Owner','Location','Lintel Date','Slab Area','Beam Area','Open (Deduct)','Gross Area','Net Area','Rate/Sq Ft','Total Amount','Created']];
    records.forEach((r,i) => rows.push([
      i+1, r.siteName||'', r.contractorName||'', r.ownerName||'', r.location||'', r.lintelDate||'',
      r.slabArea||0, r.beamArea||0, r.openArea||0, r.grossArea||r.totalArea||0, r.netArea||r.totalArea||0,
      r.ratePerSqFt||'', r.totalAmount||'', r.createdAt||''
    ]));
    rows.push([], ['--- MATERIAL DETAILS ---'], ['Bill #','Site','Type','Material','Length','Breadth','Qty','Area']);
    records.forEach((r,ri) => (r.items||[]).forEach(item => rows.push([ri+1,r.siteName||'',item.type||'Slab',item.materialName||'',item.length||0,item.breadth||0,item.quantity||0,item.area||0])));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `KSS_Billings_${window.localDateStr()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('Excel exported!', 'success');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────────────────────────────────
  function showToast(msg, type='success') {
    const e = document.getElementById('sb-toast');
    if (e) e.remove();
    const t = document.createElement('div');
    t.id = 'sb-toast';
    const c = {success:'#059669',info:'#2563eb',error:'#dc2626'};
    t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${c[type]||c.success};color:white;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,0.2);animation:sb-toast-in 0.3s cubic-bezier(0.175,0.885,0.32,1.275);max-width:320px`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(()=>t.remove(),300); }, 2500);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    render, init,
    onSearch, onSearchField, onFormChange,
    refreshTotals,
    goList, newBill, editBill, viewDetail, duplicateBill,
    addRow, removeRow, updateRowType, updateRowField,
    saveBill, deleteBill,
    printBill, exportPDF, exportExcel
  };
})();
