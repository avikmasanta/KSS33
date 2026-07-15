/* ============================================
   KSS Double Fin - Separate Billing Module
   Fully independent of Customer/Site/Inventory
   ============================================
   Material Types:
     Slab  -> Area = L x B
     Beam  -> Area = L x B x Qty x 2
     Open  -> Area = L x B (Deducted)
   ============================================ */

var SeparateBillingPage = (function() {

  // State
  var state = {
    view: 'list',
    editId: null,
    searchTerm: '',
    searchField: 'all',
    formItems: [{ type: 'Slab', length: '', breadth: '', quantity: '1', area: 0 }],
    formData: { siteName: '', contractorName: '', ownerName: '', location: '', lintelDate: '', ratePerSqFt: '' }
  };

  // Type config
  var TYPES = {
    Slab: { label: 'Slab', color: '#1d4ed8', bg: 'rgba(37,99,235,0.06)', badge: '#eff6ff', badgeText: '#1d4ed8' },
    Beam: { label: 'Beam', color: '#d97706', bg: 'rgba(217,119,6,0.06)', badge: '#fef3c7', badgeText: '#92400e' },
    Open: { label: 'Open', color: '#dc2626', bg: 'rgba(220,38,38,0.06)', badge: '#fee2e2', badgeText: '#991b1b' }
  };

  // Calc area per row based on simplified formula rules
  function calcArea(item) {
    var l = parseFloat(item.length)   || 0;
    var b = parseFloat(item.breadth)  || 0;
    var q = parseFloat(item.quantity) || 0;
    
    if (item.type === 'Beam') {
      return parseFloat((l * b * q * 2).toFixed(3));
    }
    // Slab and Open are L x B
    return parseFloat((l * b).toFixed(3));
  }

  // Calc totals
  function calcTotals(items) {
    var src = items || state.formItems;
    var slabArea = 0, beamArea = 0, openArea = 0;
    src.forEach(function(i) {
      var a = parseFloat(i.area) || 0;
      if (i.type === 'Open')      openArea += Math.abs(a);
      else if (i.type === 'Beam') beamArea += a;
      else                        slabArea += a;
    });
    var grossArea = slabArea + beamArea;
    var netArea   = parseFloat(Math.max(0, grossArea - openArea).toFixed(3));
    var rate      = parseFloat(state.formData.ratePerSqFt) || 0;
    var totalAmount = rate > 0 ? parseFloat((netArea * rate).toFixed(2)) : null;
    return {
      slabArea:  parseFloat(slabArea.toFixed(3)),
      beamArea:  parseFloat(beamArea.toFixed(3)),
      openArea:  parseFloat(openArea.toFixed(3)),
      grossArea: parseFloat(grossArea.toFixed(3)),
      netArea:   netArea,
      totalAmount: totalAmount
    };
  }

  // Format numbers
  function fNum(n) {
    if (n === null || n === undefined) return '-';
    return parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  // Filtered list
  function getFiltered() {
    var records = (Store.SeparateBillings.getAll() || []).sort(function(a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    if (state.searchTerm) {
      var st = state.searchTerm.toLowerCase();
      records = records.filter(function(r) {
        if (state.searchField === 'siteName')       return (r.siteName || '').toLowerCase().includes(st);
        if (state.searchField === 'contractorName') return (r.contractorName || '').toLowerCase().includes(st);
        if (state.searchField === 'ownerName')      return (r.ownerName || '').toLowerCase().includes(st);
        if (state.searchField === 'date')           return (r.lintelDate || r.createdAt || '').includes(st);
        return (r.siteName || '').toLowerCase().includes(st) ||
               (r.contractorName || '').toLowerCase().includes(st) ||
               (r.ownerName || '').toLowerCase().includes(st) ||
               (r.lintelDate || '').includes(st);
      });
    }
    return records;
  }

  // ---- RENDER ----
  function render() {
    if (state.view === 'form')   return renderFormPage();
    if (state.view === 'detail') return renderDetailPage();
    return renderListPage();
  }

  // ---- Calc Grid HTML (formula breakdown) ----
  function calcGridHTML(t) {
    var html = '';
    html += '<div class="sb-calc-row">';
    html += '<div class="sb-calc-item sb-calc-slab">';
    html += '<div class="sb-calc-label">Slab Area</div>';
    html += '<div class="sb-calc-val">' + fNum(t.slabArea) + ' Sq Ft</div>';
    html += '<div class="sb-calc-formula">Slabs total</div>';
    html += '</div>';
    html += '<div class="sb-calc-op">+</div>';
    html += '<div class="sb-calc-item sb-calc-beam">';
    html += '<div class="sb-calc-label">Beam Area</div>';
    html += '<div class="sb-calc-val">' + fNum(t.beamArea) + ' Sq Ft</div>';
    html += '<div class="sb-calc-formula">Beams total</div>';
    html += '</div>';
    html += '<div class="sb-calc-op">-</div>';
    html += '<div class="sb-calc-item sb-calc-open">';
    html += '<div class="sb-calc-label">Open (deduct)</div>';
    html += '<div class="sb-calc-val">' + fNum(t.openArea) + ' Sq Ft</div>';
    html += '<div class="sb-calc-formula">Deductions total</div>';
    html += '</div>';
    html += '<div class="sb-calc-op">=</div>';
    html += '<div class="sb-calc-item sb-calc-net">';
    html += '<div class="sb-calc-label">Net Area</div>';
    html += '<div class="sb-calc-val sb-calc-net-val" id="sb-net-area-calc">' + fNum(t.netArea) + ' Sq Ft</div>';
    html += '<div class="sb-calc-formula">' + fNum(t.grossArea) + ' - ' + fNum(t.openArea) + '</div>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // ---- Material Row HTML ----
  function materialRowHTML(item, idx) {
    var cfg     = TYPES[item.type] || TYPES.Slab;
    var isOpen  = item.type === 'Open';
    var isBeam  = item.type === 'Beam';
    var l       = item.length   || '';
    var b       = item.breadth  || '';
    var q       = item.quantity || '';
    var areaVal = item.area > 0 ? (isOpen ? '- ' : '') + fNum(item.area) + ' Sq Ft' : '-';
    var areaClass = isOpen ? 'sb-area-cell sb-area-deduct' : 'sb-area-cell';

    // Length input: editable for all types
    var lengthTd = '<td><input type="number" class="sb-cell-input" id="sb-length-' + idx + '" placeholder="0" min="0" step="0.01" value="' + l + '" oninput="SeparateBillingPage.updateRowField(' + idx + ',\'length\',this.value)"></td>';

    // Quantity input: only editable for Beam
    var qtyTd = isBeam
      ? '<td><input type="number" class="sb-cell-input" id="sb-quantity-' + idx + '" placeholder="0" min="0" step="1" value="' + q + '" oninput="SeparateBillingPage.updateRowField(' + idx + ',\'quantity\',this.value)"></td>'
      : '<td><span class="sb-na-cell">—</span></td>';

    var delTd = state.formItems.length > 1
      ? '<td><button class="sb-icon-btn sb-icon-delete" onclick="SeparateBillingPage.removeRow(' + idx + ')" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>'
      : '<td></td>';

    var slabSel = item.type === 'Slab' ? ' selected' : '';
    var beamSel = item.type === 'Beam' ? ' selected' : '';
    var openSel = item.type === 'Open' ? ' selected' : '';

    var row = '<tr id="sb-row-' + idx + '" style="background:' + cfg.bg + '">';
    row += '<td class="sb-row-num-cell">' + (idx + 1) + '</td>';
    row += '<td><select class="sb-type-select" onchange="SeparateBillingPage.updateRowType(' + idx + ',this.value)" style="border-color:' + cfg.color + ';color:' + cfg.color + ';background:' + cfg.badge + '">';
    row += '<option value="Slab"' + slabSel + '>Slab</option>';
    row += '<option value="Beam"' + beamSel + '>Beam</option>';
    row += '<option value="Open"' + openSel + '>Open</option>';
    row += '</select></td>';
    row += lengthTd;
    row += '<td><input type="number" class="sb-cell-input" id="sb-breadth-' + idx + '" placeholder="0" min="0" step="0.01" value="' + b + '" oninput="SeparateBillingPage.updateRowField(' + idx + ',\'breadth\',this.value)"></td>';
    row += qtyTd;
    row += '<td><span class="' + areaClass + '" id="sb-area-' + idx + '">' + areaVal + '</span></td>';
    row += delTd;
    row += '</tr>';
    return row;
  }

  // ---- LIST PAGE ----
  function renderListPage() {
    var records  = getFiltered();
    var allBills = Store.SeparateBillings.getAll();
    var totalNet    = allBills.reduce(function(s, r) { return s + (parseFloat(r.netArea || r.totalArea) || 0); }, 0);
    var totalAmt    = allBills.reduce(function(s, r) { return s + (parseFloat(r.totalAmount) || 0); }, 0);
    var contractors = new Set(allBills.map(function(r) { return r.contractorName; }).filter(Boolean)).size;
    var allSel = state.searchField === 'all'             ? ' selected' : '';
    var siteS  = state.searchField === 'siteName'        ? ' selected' : '';
    var conS   = state.searchField === 'contractorName'  ? ' selected' : '';
    var ownS   = state.searchField === 'ownerName'       ? ' selected' : '';
    var datS   = state.searchField === 'date'            ? ' selected' : '';

    var html = '<div class="sb-page">';

    // Header
    html += '<div class="sb-header">';
    html += '<div class="sb-header-left">';
    html += '<div class="sb-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>';
    html += '<div><h2 class="sb-header-title">Separate Billing</h2><p class="sb-header-subtitle">Independent billing records - no site or customer required</p></div>';
    html += '</div>';
    html += '<div class="sb-header-actions"><button class="sb-btn sb-btn-primary" onclick="SeparateBillingPage.newBill()">+ New Bill</button></div>';
    html += '</div>';

    // Stats
    html += '<div class="sb-stats-row">';
    html += '<div class="sb-stat-card"><div class="sb-stat-icon sb-stat-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div class="sb-stat-value">' + allBills.length + '</div><div class="sb-stat-label">Total Bills</div></div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-icon sb-stat-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div><div><div class="sb-stat-value">' + fNum(totalNet) + ' Sq Ft</div><div class="sb-stat-label">Total Net Area</div></div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-icon sb-stat-amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div><div class="sb-stat-value">Rs.' + fNum(totalAmt) + '</div><div class="sb-stat-label">Total Amount</div></div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-icon sb-stat-purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div><div class="sb-stat-value">' + contractors + '</div><div class="sb-stat-label">Contractors</div></div></div>';
    html += '</div>';

    // Search
    html += '<div class="sb-search-row">';
    html += '<div class="sb-search-wrap"><svg class="sb-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    html += '<input type="text" class="sb-search-input" placeholder="Search bills..." value="' + state.searchTerm + '" oninput="SeparateBillingPage.onSearch(event)"></div>';
    html += '<select class="sb-select" onchange="SeparateBillingPage.onSearchField(event)">';
    html += '<option value="all"' + allSel + '>All Fields</option>';
    html += '<option value="siteName"' + siteS + '>Site Name</option>';
    html += '<option value="contractorName"' + conS + '>Contractor</option>';
    html += '<option value="ownerName"' + ownS + '>Owner</option>';
    html += '<option value="date"' + datS + '>Date</option>';
    html += '</select></div>';

    // Table
    html += '<div class="sb-table-card">';
    if (records.length === 0) {
      html += '<div class="sb-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:56px;height:56px;opacity:0.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
      html += '<h3>No bills found</h3><p>' + (state.searchTerm ? 'Try adjusting your search.' : 'Click "New Bill" to create your first billing record.') + '</p>';
      if (!state.searchTerm) html += '<button class="sb-btn sb-btn-primary" onclick="SeparateBillingPage.newBill()" style="margin-top:16px">Create First Bill</button>';
      html += '</div>';
    } else {
      html += '<div class="sb-table-scroll"><table class="sb-table"><thead><tr>';
      html += '<th>#</th><th>Site Name</th><th>Contractor</th><th>Owner</th><th>Date</th><th>Gross Area</th><th>Deductions</th><th>Net Area</th><th>Rate</th><th>Amount</th><th>Actions</th>';
      html += '</tr></thead><tbody>';
      records.forEach(function(r, idx) {
        var gross = parseFloat(r.grossArea || r.totalArea) || 0;
        var open  = parseFloat(r.openArea)  || 0;
        var net   = parseFloat(r.netArea   || r.totalArea) || 0;
        html += '<tr class="sb-table-row" onclick="SeparateBillingPage.viewDetail(\'' + r.id + '\')">';
        html += '<td><span class="sb-row-num">' + (idx+1) + '</span></td>';
        html += '<td><strong>' + (r.siteName || '-') + '</strong></td>';
        html += '<td>' + (r.contractorName || '-') + '</td>';
        html += '<td>' + (r.ownerName || '-') + '</td>';
        html += '<td>' + (r.lintelDate || '-') + '</td>';
        html += '<td><span class="sb-area-badge">' + fNum(gross) + ' Sq Ft</span></td>';
        html += '<td>' + (open > 0 ? '<span class="sb-deduct-badge">- ' + fNum(open) + ' Sq Ft</span>' : '-') + '</td>';
        html += '<td><span class="sb-net-badge">' + fNum(net) + ' Sq Ft</span></td>';
        html += '<td>' + (r.ratePerSqFt ? 'Rs.' + fNum(r.ratePerSqFt) : '-') + '</td>';
        html += '<td>' + (r.totalAmount ? '<strong style="color:var(--success)">Rs.' + fNum(r.totalAmount) + '</strong>' : '-') + '</td>';
        html += '<td onclick="event.stopPropagation()"><div class="sb-action-row">';
        html += '<button class="sb-icon-btn sb-icon-view"   title="View"      onclick="SeparateBillingPage.viewDetail(\''  + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>';
        html += '<button class="sb-icon-btn sb-icon-edit"   title="Edit"      onclick="SeparateBillingPage.editBill(\''    + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
        html += '<button class="sb-icon-btn sb-icon-copy"   title="Duplicate" onclick="SeparateBillingPage.duplicateBill(\'' + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>';
        html += '<button class="sb-icon-btn sb-icon-print"  title="Print"     onclick="SeparateBillingPage.printBill(\''   + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>';
        html += '<button class="sb-icon-btn sb-icon-delete" title="Delete"    onclick="SeparateBillingPage.deleteBill(\'' + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>';
        html += '</div></td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="sb-table-footer">Showing ' + records.length + ' of ' + allBills.length + ' records';
      html += '<button class="sb-btn sb-btn-outline sb-btn-sm" onclick="SeparateBillingPage.exportExcel()">Export Excel</button></div>';
    }
    html += '</div></div>';
    return html;
  }

  // ---- FORM PAGE ----
  function renderFormPage() {
    var t      = calcTotals();
    var isEdit = !!state.editId;
    var rows   = '';
    state.formItems.forEach(function(item, idx) { rows += materialRowHTML(item, idx); });

    var html = '<div class="sb-page">';

    // Header
    html += '<div class="sb-header"><div class="sb-header-left">';
    html += '<button class="sb-back-btn" onclick="SeparateBillingPage.goList()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px"><polyline points="15 18 9 12 15 6"/></svg></button>';
    html += '<div class="sb-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>';
    html += '<div><h2 class="sb-header-title">' + (isEdit ? 'Edit Billing' : 'New Separate Bill') + '</h2>';
    html += '<p class="sb-header-subtitle">Standard material measurements (Slab, Beam, Open)</p></div></div></div>';

    html += '<div class="sb-form-layout">';

    // Safe fallback loading of sites from localStorage if Store is temporarily empty
    var allSites = [];
    if (Store.Sites && Store.Sites.getAll && Store.Sites.getAll().length > 0) {
      allSites = Store.Sites.getAll();
    } else {
      try {
        allSites = JSON.parse(localStorage.getItem('bm_sites')) || [];
      } catch(e) {}
    }
    var activeSites = allSites.filter(function(s) {
      return s.status !== 'Archived';
    });
    var siteOptions = '<option value="">-- Select a Site to Auto-Fill details --</option>';
    activeSites.forEach(function(s) {
      var sId = s.id || s._id;
      siteOptions += '<option value="' + sId + '">' + s.name + ' (' + (s.customerName || 'No Owner') + ')</option>';
    });

    // Basic Info card
    html += '<div class="sb-card"><div class="sb-card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><h3>Basic Information</h3></div>';
    html += '<div class="sb-card-body"><div class="sb-form-grid">';
    html += '<div class="sb-form-group sb-full-span"><label class="sb-label">Select Site Details from Existing Sites (Optional)</label><select class="sb-select" style="width:100%" onchange="SeparateBillingPage.onSelectExistingSite(this.value)">' + siteOptions + '</select></div>';
    html += '<div class="sb-form-group"><label class="sb-label">Site Name <span class="sb-required">*</span></label><input type="text" class="sb-input" id="sb-siteName" placeholder="Enter site name" value="' + state.formData.siteName + '" oninput="SeparateBillingPage.onFormChange(\'siteName\',this.value)"></div>';
    html += '<div class="sb-form-group"><label class="sb-label">Contractor Name <span class="sb-required">*</span></label><input type="text" class="sb-input" id="sb-contractorName" placeholder="Enter contractor name" value="' + state.formData.contractorName + '" oninput="SeparateBillingPage.onFormChange(\'contractorName\',this.value)"></div>';
    html += '<div class="sb-form-group"><label class="sb-label">Owner Name</label><input type="text" class="sb-input" id="sb-ownerName" placeholder="Enter owner name" value="' + state.formData.ownerName + '" oninput="SeparateBillingPage.onFormChange(\'ownerName\',this.value)"></div>';
    html += '<div class="sb-form-group"><label class="sb-label">Lintel Date</label><input type="date" class="sb-input" id="sb-lintelDate" value="' + state.formData.lintelDate + '" oninput="SeparateBillingPage.onFormChange(\'lintelDate\',this.value)"></div>';
    html += '<div class="sb-form-group sb-full-span"><label class="sb-label">Location</label><textarea class="sb-input sb-textarea" id="sb-location" placeholder="Enter location / address" rows="2" oninput="SeparateBillingPage.onFormChange(\'location\',this.value)">' + state.formData.location + '</textarea></div>';
    html += '</div></div></div>';

    // Materials card
    html += '<div class="sb-card">';
    html += '<div class="sb-card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><rect x="2" y="3" width="20" height="14" rx="2"/></svg><h3>Calculation Details</h3>';
    html += '<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button type="button" class="sb-btn sb-btn-type-slab sb-btn-sm" onclick="SeparateBillingPage.addRow(\'Slab\')">+ Slab</button>';
    html += '<button type="button" class="sb-btn sb-btn-type-beam sb-btn-sm" onclick="SeparateBillingPage.addRow(\'Beam\')">+ Beam</button>';
    html += '<button type="button" class="sb-btn sb-btn-type-open sb-btn-sm" onclick="SeparateBillingPage.addRow(\'Open\')">+ Open</button>';
    html += '</div></div>';
    html += '<div class="sb-card-body" style="padding:0"><div class="sb-material-table-wrap">';
    html += '<table class="sb-material-table"><thead><tr>';
    html += '<th style="width:38px">#</th><th style="width:115px">Type</th><th style="width:140px">Length (ft)</th><th style="width:140px">Breadth (ft)</th><th style="width:110px">Qty</th><th style="width:160px">Area (Sq Ft)</th><th style="width:36px"></th>';
    html += '</tr></thead><tbody id="sb-material-rows">' + rows + '</tbody></table>';
    html += '</div></div></div>';

    // Calculation Summary card
    html += '<div class="sb-card"><div class="sb-card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><h3>Calculation Summary</h3></div>';
    html += '<div class="sb-card-body"><div id="sb-calc-grid">' + calcGridHTML(t) + '</div></div></div>';

    // Pricing card
    html += '<div class="sb-card"><div class="sb-card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><h3>Pricing</h3></div>';
    html += '<div class="sb-card-body"><div class="sb-totals-row">';
    html += '<div class="sb-total-item"><div class="sb-total-label">Net Area</div><div class="sb-total-value sb-total-area" id="sb-net-area-display">' + fNum(t.netArea) + ' Sq Ft</div></div>';
    html += '<div class="sb-total-sep">x</div>';
    html += '<div class="sb-rate-group"><div class="sb-total-label">Rate per Sq Ft (Optional)</div><div class="sb-rate-input-wrap"><span class="sb-rate-prefix">Rs.</span><input type="number" class="sb-input sb-rate-input" id="sb-ratePerSqFt" min="0" step="0.01" placeholder="Enter rate (optional)" value="' + state.formData.ratePerSqFt + '" oninput="SeparateBillingPage.onFormChange(\'ratePerSqFt\',this.value);SeparateBillingPage.refreshTotals()"></div></div>';
    html += '<div class="sb-total-sep">=</div>';
    html += '<div class="sb-total-item"><div class="sb-total-label">Total Amount</div><div class="sb-total-value sb-total-amount" id="sb-total-amount">' + (t.totalAmount !== null ? 'Rs.' + fNum(t.totalAmount) : '-') + '</div></div>';
    html += '</div></div></div>';

    // Actions
    html += '<div class="sb-form-actions">';
    html += '<button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.goList()">Cancel</button>';
    html += '<button class="sb-btn sb-btn-primary sb-btn-lg" onclick="SeparateBillingPage.saveBill()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' + (isEdit ? 'Update Bill' : 'Save Bill') + '</button>';
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  // ---- DETAIL PAGE ----
  function renderDetailPage() {
    var bill = Store.SeparateBillings.getById(state.editId);
    if (!bill) { goList(); return '<div class="sb-page"></div>'; }

    var slabItems = (bill.items || []).filter(function(i) { return i.type === 'Slab'; });
    var beamItems = (bill.items || []).filter(function(i) { return i.type === 'Beam'; });
    var openItems = (bill.items || []).filter(function(i) { return i.type === 'Open'; });
    var gross = parseFloat(bill.grossArea || bill.totalArea) || 0;
    var openA = parseFloat(bill.openArea)  || 0;
    var net   = parseFloat(bill.netArea   || bill.totalArea) || 0;

    function sectionRows(items, type) {
      if (!items.length) return '';
      var cfg = TYPES[type] || TYPES.Slab;
      var s = '<tr><td colspan="5" style="background:' + cfg.badge + ';color:' + cfg.color + ';font-weight:700;font-size:0.78rem;text-transform:uppercase;padding:8px 14px">' + cfg.label + '</td></tr>';
      items.forEach(function(item, i) {
        s += '<tr style="background:' + cfg.bg + '">';
        s += '<td><span class="sb-row-num" style="background:' + cfg.badge + ';color:' + cfg.color + '">' + (i+1) + '</span></td>';
        s += '<td>' + fNum(item.length) + '</td>';
        s += '<td>' + fNum(item.breadth) + '</td>';
        s += '<td>' + (type !== 'Beam' ? '—' : fNum(item.quantity)) + '</td>';
        s += '<td><span class="' + (type === 'Open' ? 'sb-deduct-badge' : 'sb-area-badge') + '">' + (type === 'Open' ? '- ' : '') + fNum(item.area) + ' Sq Ft</span></td>';
        s += '</tr>';
      });
      return s;
    }

    var t2 = {
      slabArea:  parseFloat(bill.slabArea) || 0,
      beamArea:  parseFloat(bill.beamArea) || 0,
      openArea:  openA,
      grossArea: gross,
      netArea:   net
    };

    var html = '<div class="sb-page">';

    // Header
    html += '<div class="sb-header"><div class="sb-header-left">';
    html += '<button class="sb-back-btn" onclick="SeparateBillingPage.goList()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px"><polyline points="15 18 9 12 15 6"/></svg></button>';
    html += '<div class="sb-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>';
    html += '<div><h2 class="sb-header-title">' + (bill.siteName || 'Bill Detail') + '</h2>';
    html += '<p class="sb-header-subtitle">Lintel: ' + (bill.lintelDate || '-') + '</p></div></div>';
    html += '<div class="sb-header-actions">';
    html += '<button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.editBill(\'' + bill.id + '\')">Edit</button>';
    html += '<button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.duplicateBill(\'' + bill.id + '\')">Duplicate</button>';
    html += '<button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.exportPDF(\'' + bill.id + '\')">Download PDF</button>';
    html += '<button class="sb-btn sb-btn-primary" onclick="SeparateBillingPage.printBill(\'' + bill.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print Invoice</button>';
    html += '</div></div>';

    // Info card
    html += '<div class="sb-detail-layout">';
    html += '<div class="sb-card"><div class="sb-card-header"><h3>Bill Information</h3></div><div class="sb-card-body">';
    html += '<div class="sb-info-grid">';
    html += '<div class="sb-info-item"><div class="sb-info-label">Site Name</div><div class="sb-info-value">' + (bill.siteName || '-') + '</div></div>';
    html += '<div class="sb-info-item"><div class="sb-info-label">Contractor</div><div class="sb-info-value">' + (bill.contractorName || '-') + '</div></div>';
    html += '<div class="sb-info-item"><div class="sb-info-label">Owner</div><div class="sb-info-value">' + (bill.ownerName || '-') + '</div></div>';
    html += '<div class="sb-info-item"><div class="sb-info-label">Lintel Date</div><div class="sb-info-value">' + (bill.lintelDate || '-') + '</div></div>';
    html += '<div class="sb-info-item sb-full-span"><div class="sb-info-label">Location</div><div class="sb-info-value">' + (bill.location || '-') + '</div></div>';
    html += '</div></div></div>';

    // Materials
    html += '<div class="sb-card"><div class="sb-card-header"><h3>Measurement Details</h3></div>';
    html += '<div class="sb-card-body" style="padding:0"><div class="sb-table-scroll">';
    html += '<table class="sb-table"><thead><tr><th>#</th><th>Length (ft)</th><th>Breadth (ft)</th><th>Qty</th><th>Area</th></tr></thead>';
    html += '<tbody>' + sectionRows(slabItems, 'Slab') + sectionRows(beamItems, 'Beam') + sectionRows(openItems, 'Open') + '</tbody></table>';
    html += '</div></div></div>';

    // Calculation breakdown
    html += '<div class="sb-card"><div class="sb-card-header"><h3>Calculation Breakdown</h3></div>';
    html += '<div class="sb-card-body">' + calcGridHTML(t2) + '</div></div>';

    // Grand total
    html += '<div class="sb-card sb-summary-card"><div class="sb-summary-row">';
    html += '<div class="sb-summary-item"><div class="sb-summary-label">Net Area</div><div class="sb-summary-value">' + fNum(net) + ' Sq Ft</div></div>';
    if (bill.ratePerSqFt) {
      html += '<div class="sb-summary-sep">x</div>';
      html += '<div class="sb-summary-item"><div class="sb-summary-label">Rate / Sq Ft</div><div class="sb-summary-value">Rs.' + fNum(bill.ratePerSqFt) + '</div></div>';
      html += '<div class="sb-summary-sep">=</div>';
      html += '<div class="sb-summary-item"><div class="sb-summary-label">Grand Total</div><div class="sb-summary-value sb-grand-total">Rs.' + fNum(bill.totalAmount) + '</div></div>';
    }
    html += '</div></div>';
    html += '</div></div>';
    return html;
  }

  // ---- EVENT HANDLERS ----
  function init() {}
  function onSearch(e)      { state.searchTerm  = e.target.value; rerender(); }
  function onSearchField(e) { state.searchField = e.target.value; rerender(); }
  function onFormChange(field, value) { state.formData[field] = value; }

  function onSelectExistingSite(siteId) {
    if (!siteId) return;
    
    var site = null;
    if (Store.Sites && Store.Sites.getById) {
      site = Store.Sites.getById(siteId);
    }
    if (!site) {
      try {
        var list = JSON.parse(localStorage.getItem('bm_sites')) || [];
        site = list.find(function(s) { return (s.id || s._id) === siteId; }) || null;
      } catch(e) {}
    }
    
    if (!site) return;
    state.formData.siteName = site.name || '';
    state.formData.ownerName = site.customerName || '';
    state.formData.location = site.address || '';

    var siteNameEl = document.getElementById('sb-siteName');
    if (siteNameEl) siteNameEl.value = site.name || '';
    var ownerNameEl = document.getElementById('sb-ownerName');
    if (ownerNameEl) ownerNameEl.value = site.customerName || '';
    var locationEl = document.getElementById('sb-location');
    if (locationEl) locationEl.value = site.address || '';
  }

  function rerender() {
    var c = document.getElementById('page-container');
    if (c) { c.innerHTML = render(); init(); }
  }

  function refreshTotals() {
    var rateEl = document.getElementById('sb-ratePerSqFt');
    if (rateEl) state.formData.ratePerSqFt = rateEl.value;
    var t = calcTotals();
    var g = document.getElementById('sb-calc-grid');
    if (g) g.innerHTML = calcGridHTML(t);
    var nd = document.getElementById('sb-net-area-display');
    if (nd) nd.textContent = fNum(t.netArea) + ' Sq Ft';
    var ae = document.getElementById('sb-total-amount');
    if (ae) ae.textContent = t.totalAmount !== null ? 'Rs.' + fNum(t.totalAmount) : '-';
  }

  // Navigation & CRUD
  function goList() {
    state.view   = 'list';
    state.editId = null;
    rerender();
  }

  function newBill() {
    state.view      = 'form';
    state.editId    = null;
    state.formData  = { siteName:'', contractorName:'', ownerName:'', location:'', lintelDate:'', ratePerSqFt:'' };
    state.formItems = [{ type:'Slab', length:'', breadth:'', quantity:'1', area:0 }];
    rerender();
  }

  function editBill(id) {
    var bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    state.view   = 'form';
    state.editId = id;
    state.formData = {
      siteName:       bill.siteName       || '',
      contractorName: bill.contractorName || '',
      ownerName:      bill.ownerName      || '',
      location:       bill.location       || '',
      lintelDate:     bill.lintelDate     || '',
      ratePerSqFt:    bill.ratePerSqFt    || ''
    };
    state.formItems = (bill.items || []).map(function(i) {
      return Object.assign({ type: 'Slab' }, i);
    });
    if (!state.formItems.length) state.formItems = [{ type:'Slab', length:'', breadth:'', quantity:'1', area:0 }];
    rerender();
  }

  function viewDetail(id) {
    state.view   = 'detail';
    state.editId = id;
    rerender();
  }

  function duplicateBill(id) {
    var bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    state.view   = 'form';
    state.editId = null;
    state.formData = {
      siteName:       bill.siteName       || '',
      contractorName: bill.contractorName || '',
      ownerName:      bill.ownerName      || '',
      location:       bill.location       || '',
      lintelDate:     '',
      ratePerSqFt:    bill.ratePerSqFt    || ''
    };
    state.formItems = (bill.items || []).map(function(i) {
      return Object.assign({ type: 'Slab' }, i);
    });
    if (!state.formItems.length) state.formItems = [{ type:'Slab', length:'', breadth:'', quantity:'1', area:0 }];
    rerender();
  }

  function addRow(type) {
    syncFormInputs();
    var defaultQty = (type === 'Slab' || type === 'Open') ? '1' : '';
    state.formItems.push({ type: type || 'Slab', length: '', breadth: '', quantity: defaultQty, area: 0 });
    rerender();
  }

  function removeRow(idx) {
    if (state.formItems.length <= 1) return;
    syncFormInputs();
    state.formItems.splice(idx, 1);
    rerender();
  }

  function updateRowType(idx, type) {
    if (!state.formItems[idx]) return;
    syncFormInputs();
    state.formItems[idx].type = type;
    state.formItems[idx].quantity = type === 'Beam' ? '' : '1';
    state.formItems[idx].length = '';
    state.formItems[idx].area = calcArea(state.formItems[idx]);
    rerender();
  }

  function updateRowField(idx, field, value) {
    if (!state.formItems[idx]) return;
    state.formItems[idx][field] = value;
    state.formItems[idx].area   = calcArea(state.formItems[idx]);
    
    var areaEl = document.getElementById('sb-area-' + idx);
    if (areaEl) {
      var isOpen = state.formItems[idx].type === 'Open';
      var a      = state.formItems[idx].area;
      areaEl.textContent = a > 0 ? (isOpen ? '- ' : '') + fNum(a) + ' Sq Ft' : '-';
    }
    refreshTotals();
  }

  function syncFormInputs() {
    var fields = ['siteName','contractorName','ownerName','location','lintelDate','ratePerSqFt'];
    fields.forEach(function(f) {
      var el = document.getElementById('sb-' + f);
      if (el) state.formData[f] = el.value;
    });
    state.formItems.forEach(function(item, idx) {
      var lengthEl   = document.getElementById('sb-length-' + idx);
      var breadthEl  = document.getElementById('sb-breadth-' + idx);
      var quantityEl = document.getElementById('sb-quantity-' + idx);
      
      if (lengthEl)   item.length   = lengthEl.value;
      else            item.length   = '';
      
      if (breadthEl)  item.breadth  = breadthEl.value;
      else            item.breadth  = '';
      
      if (quantityEl) item.quantity = quantityEl.value;
      else            item.quantity = '';
      
      item.area = calcArea(item);
    });
  }

  function saveBill() {
    syncFormInputs();
    if (!state.formData.siteName.trim())       { alert('Please enter a Site Name.');       return; }
    if (!state.formData.contractorName.trim()) { alert('Please enter a Contractor Name.'); return; }

    var items = state.formItems
      .filter(function(i) { return i.length || i.breadth || i.quantity; })
      .map(function(i, idx) {
        return {
          type:         i.type         || 'Slab',
          formula:      i.type === 'Beam' ? 'L * B * Q * 2' : 'L * B',
          materialName: 'Item ' + (idx + 1),
          length:       parseFloat(i.length)   || 0,
          breadth:      parseFloat(i.breadth)  || 0,
          quantity:     parseFloat(i.quantity) || 0,
          area:         calcArea(i)
        };
      });

    if (!items.length) { alert('Please add at least one material row with data.'); return; }

    var t    = calcTotals(items);
    var rate = parseFloat(state.formData.ratePerSqFt) || null;

    var record = {
      siteName:       state.formData.siteName.trim(),
      contractorName: state.formData.contractorName.trim(),
      ownerName:      state.formData.ownerName.trim(),
      location:       state.formData.location.trim(),
      lintelDate:     state.formData.lintelDate || '',
      ratePerSqFt:    rate,
      items:          items,
      slabArea:       t.slabArea,
      beamArea:       t.beamArea,
      openArea:       t.openArea,
      grossArea:      t.grossArea,
      netArea:        t.netArea,
      totalArea:      t.netArea,
      totalAmount:    rate ? parseFloat((t.netArea * rate).toFixed(2)) : null,
      createdAt:      state.editId
        ? (Store.SeparateBillings.getById(state.editId) || {}).createdAt || (window.localDateStr ? window.localDateStr() : new Date().toISOString().slice(0,10))
        : (window.localDateStr ? window.localDateStr() : new Date().toISOString().slice(0,10))
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
    var bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    if (!confirm('Delete bill for "' + bill.siteName + '"? This cannot be undone.')) return;
    Store.SeparateBillings.remove(id);
    if (state.editId === id) { state.editId = null; state.view = 'list'; }
    showToast('Bill deleted.', 'info');
    rerender();
  }

  // ---- PRINT / PDF ----
  function buildInvoiceHTML(bill, forPrint) {
    var items     = bill.items || [];
    var gross     = parseFloat(bill.grossArea || bill.totalArea) || 0;
    var openA     = parseFloat(bill.openArea) || 0;
    var net       = parseFloat(bill.netArea  || bill.totalArea) || 0;
    var rateVal   = parseFloat(bill.ratePerSqFt) || 0;
    var amtVal    = parseFloat(bill.totalAmount) || 0;

    function formatDate(dStr) {
      if (!dStr) return '-';
      try {
        var d = new Date(dStr);
        if (isNaN(d.getTime())) return dStr;
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return d.getDate().toString().padStart(2, '0') + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
      } catch(e) {
        return dStr;
      }
    }

    var invNum = "INV-" + (bill.id || bill._id || "NEW").slice(-6).toUpperCase();
    var invDate = formatDate(bill.createdAt || new Date());
    var lintelDateFormatted = formatDate(bill.lintelDate);

    var rows = '';
    items.forEach(function(item, idx) {
      var lVal = parseFloat(item.length) || 0;
      var bVal = parseFloat(item.breadth) || 0;
      var qVal = parseFloat(item.quantity) || 0;
      var areaVal = parseFloat(item.area) || 0;
      var isBeam = item.type === 'Beam';
      var isOpen = item.type === 'Open';

      var lText = (isBeam && lVal === 0) ? '—' : lVal.toFixed(2);
      var bText = (isBeam && bVal === 0) ? '—' : bVal.toFixed(2);
      var qText = isBeam ? qVal.toString() : '—';
      
      var fmlText = '—';
      if (lVal > 0 || bVal > 0 || qVal > 0) {
        if (isBeam) {
          fmlText = lVal + ' × ' + bVal + ' × ' + qVal + ' × 2';
        } else {
          fmlText = lVal + ' × ' + bVal;
        }
      }

      rows += '<tr>';
      rows += '<td style="text-align:center">' + (idx + 1) + '</td>';
      rows += '<td class="type-badge" style="color:' + (TYPES[item.type] ? TYPES[item.type].color : '#0f172a') + '">' + (item.type || 'Slab') + '</td>';
      rows += '<td style="text-align:center">' + lText + '</td>';
      rows += '<td style="text-align:center">' + bText + '</td>';
      rows += '<td style="text-align:center">' + qText + '</td>';
      rows += '<td style="font-family: monospace; font-weight: 600; text-align:center">' + fmlText + '</td>';
      rows += '<td style="font-weight: 700; text-align: right; color:' + (isOpen ? '#dc2626' : '#0f172a') + '">' + (isOpen ? '- ' : '') + areaVal.toFixed(2) + '</td>';
      rows += '</tr>';
    });

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>KSS Measurement & Estimation Bill</title>';
    html += '<style>';
    html += '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap");';
    html += '*{box-sizing:border-box;margin:0;padding:0}';
    html += 'body{font-family:"Inter",sans-serif;background:#f1f5f9;color:#0f172a;padding:30px 20px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}';
    html += '.invoice-container{max-width:850px;margin:0 auto;background:#ffffff;padding:40px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.04);border:1px solid #e2e8f0}';
    html += '.invoice-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:25px}';
    html += '.logo-container{display:flex;align-items:center;gap:15px}';
    html += '.logo-text-title{font-size:32px;font-weight:900;color:#0f3c7a;line-height:0.95;letter-spacing:2px}';
    html += '.logo-text-sub{font-size:11px;font-weight:700;color:#1e40af;letter-spacing:3.5px;text-transform:uppercase;margin-top:5px}';
    html += '.bill-title-container{text-align:center}';
    html += '.bill-title-main{font-size:26px;font-weight:900;color:#0f3c7a;letter-spacing:1px;text-transform:uppercase}';
    html += '.bill-title-sub{font-size:10px;font-weight:600;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-top:3px;position:relative}';
    html += '.bill-title-sub::after{content:"";display:block;width:120px;height:2px;background:#cbd5e1;margin:8px auto 0}';
    html += '.business-details{text-align:right;font-size:11px;color:#475569;line-height:1.5}';
    html += '.business-name{font-size:13px;font-weight:800;color:#0f172a;margin-bottom:2px}';
    html += '.banner-strip{background:#0f3c7a;color:#ffffff;padding:10px 20px;border-radius:8px;display:flex;justify-content:space-between;font-weight:600;font-size:13px;margin-bottom:25px}';
    html += '.info-card{border:1px solid #cbd5e1;border-radius:10px;padding:20px;margin-bottom:25px;background:#f8fafc}';
    html += '.info-card-title{font-size:12px;font-weight:800;color:#0f3c7a;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}';
    html += '.info-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:10px 20px}';
    html += '.info-row{display:flex;font-size:12px;line-height:1.4}';
    html += '.info-label{width:115px;font-weight:700;color:#475569}';
    html += '.info-value{flex:1;color:#0f172a;font-weight:600}';
    html += '.section-title{font-size:13px;font-weight:800;color:#0f3c7a;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px}';
    html += '.measurement-table{width:100%;border-collapse:collapse;margin-bottom:25px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden}';
    html += '.measurement-table th{background:#0f3c7a;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;padding:10px;text-align:center;border:1px solid #0f3c7a}';
    html += '.measurement-table td{padding:10px;font-size:12px;text-align:center;border:1px solid #cbd5e1;font-weight:500;color:#334155}';
    html += '.measurement-table tr:nth-child(even){background:#f8fafc}';
    html += '.measurement-table td.type-badge{font-weight:700;text-transform:uppercase;font-size:11px;text-align:center}';
    html += '.summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:25px;margin-bottom:25px}';
    html += '.summary-box{border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;display:flex;flex-direction:column}';
    html += '.summary-box-header{background:#f8fafc;border-bottom:1px solid #cbd5e1;padding:12px 18px;font-size:12px;font-weight:800;color:#0f3c7a;letter-spacing:0.5px;text-transform:uppercase}';
    html += '.summary-box-body{padding:16px 18px;flex:1;display:flex;flex-direction:column;gap:10px}';
    html += '.summary-row{display:flex;justify-content:space-between;font-size:12px;font-weight:500;color:#475569}';
    html += '.summary-row.bold-total{font-weight:700;color:#0f172a;border-top:1px solid #cbd5e1;padding-top:8px}';
    html += '.summary-row.bold-net{font-weight:800;font-size:14px;color:#16a34a;border-top:1px solid #cbd5e1;padding-top:8px}';
    html += '.grand-total-banner{background:#0f3c7a;color:#ffffff;padding:12px 18px;display:flex;justify-content:space-between;font-size:14px;font-weight:800}';
    html += '.notes-scan-container{display:flex;justify-content:space-between;align-items:center;border:1px solid #cbd5e1;border-radius:10px;padding:16px 20px;background:#f8fafc;margin-bottom:40px}';
    html += '.notes-box{flex:1}';
    html += '.notes-title{font-size:11px;font-weight:800;color:#0f3c7a;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:6px}';
    html += '.notes-list{list-style-type:none;padding-left:0}';
    html += '.notes-list li{font-size:11px;color:#475569;margin-bottom:4px;position:relative;padding-left:12px}';
    html += '.notes-list li::before{content:"•";position:absolute;left:0;color:#0f3c7a}';
    html += '.scan-verify-box{text-align:center;border-left:1px solid #cbd5e1;padding-left:20px;margin-left:20px}';
    html += '.scan-verify-text{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px}';
    html += '.signatures-row{display:flex;justify-content:space-between;margin-bottom:30px;padding:0 10px}';
    html += '.signature-item{text-align:center;width:180px}';
    html += '.signature-label{font-size:11px;font-weight:700;color:#475569;margin-bottom:40px}';
    html += '.signature-line{border-bottom:1px solid #cbd5e1;width:100%;margin-bottom:6px}';
    html += '.signature-name{font-size:10px;font-weight:600;color:#64748b}';
    html += '.invoice-footer{display:flex;align-items:center;justify-content:center;gap:15px;font-size:11px;font-weight:700;color:#0f3c7a;letter-spacing:1px;text-transform:uppercase;margin-top:20px}';
    html += '.invoice-footer-line{flex:1;height:1px;background:#e2e8f0}';
    html += '@media print{';
    html += 'body{background:#ffffff;padding:0;margin:0}';
    html += '.invoice-container{border:none;box-shadow:none;padding:0}';
    html += '}';
    html += '</style>';
    html += '</head><body>';
    html += '<div class="invoice-container">';

    // Top Header
    html += '<div class="invoice-header">';
    html += '<div class="logo-container">';
    html += '<svg viewBox="0 0 100 80" class="logo-graphic">';
    html += '<polygon points="10,60 50,20 60,60" fill="#0f3c7a" />';
    html += '<polygon points="40,60 75,10 90,60" fill="#1e40af" />';
    html += '<rect x="5" y="65" width="90" height="4" fill="#0f3c7a" rx="2" />';
    html += '</svg>';
    html += '<div>';
    html += '<div class="logo-text-title">KSS</div>';
    html += '<div class="logo-text-sub">Double Fin</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="bill-title-container">';
    html += '<div class="bill-title-main">KSS DOUBLE FIN</div>';
    html += '<div class="bill-title-sub">Estimation & Measurement Bill</div>';
    html += '</div>';

    html += '<div class="business-details">';
    html += '<div class="business-name">KSS Double Fin Pvt. Ltd.</div>';
    html += '<div>Construction Material & Lintel Solutions</div>';
    html += '<div>📍 Durgapur, West Bengal</div>';
    html += '<div>📞 +91 1234567890</div>';
    html += '<div>✉️ info@kssdoublefin.com</div>';
    html += '<div>GSTIN : 19ABCDE1234F1Z5</div>';
    html += '</div>';
    html += '</div>';

    // Banner strip
    html += '<div class="banner-strip">';
    html += '<span>Invoice No. : ' + invNum + '</span>';
    html += '<span>Invoice Date : ' + invDate + '</span>';
    html += '</div>';

    // Project Info card
    html += '<div class="info-card">';
    html += '<div class="info-card-title">Project Information</div>';
    html += '<div class="info-grid">';
    
    html += '<div class="info-grid-col">';
    html += '<div class="info-row"><span class="info-label">Site Name</span><span class="info-value">: ' + (bill.siteName || '-') + '</span></div>';
    html += '<div class="info-row"><span class="info-label">Contractor</span><span class="info-value">: ' + (bill.contractorName || '-') + '</span></div>';
    html += '<div class="info-row"><span class="info-label">Owner</span><span class="info-value">: ' + (bill.ownerName || '-') + '</span></div>';
    html += '<div class="info-row"><span class="info-label">Location</span><span class="info-value">: ' + (bill.location || '-') + '</span></div>';
    html += '</div>';

    html += '<div class="info-grid-col">';
    html += '<div class="info-row"><span class="info-label">Lintel Date</span><span class="info-value">: ' + lintelDateFormatted + '</span></div>';
    html += '<div class="info-row"><span class="info-label">Invoice Date</span><span class="info-value">: ' + invDate + '</span></div>';
    html += '<div class="info-row"><span class="info-label">Prepared By</span><span class="info-value">: KSS Team</span></div>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // Table
    html += '<div class="section-title">Measurement Details</div>';
    html += '<table class="measurement-table">';
    html += '<thead><tr>';
    html += '<th style="width:50px">Sl.</th><th style="width:120px">Type</th><th>Length (ft)</th><th>Breadth (ft)</th><th>Qty</th><th>Formula</th><th style="text-align:right;width:150px">Area (Sq Ft)</th>';
    html += '</tr></thead>';
    html += '<tbody>' + rows + '</tbody>';
    html += '</table>';

    // Summary Box grid
    html += '<div class="summary-grid">';
    
    // Left Box
    html += '<div class="summary-box">';
    html += '<div class="summary-box-header">Area Summary</div>';
    html += '<div class="summary-box-body">';
    html += '<div class="summary-row"><span>Slab Area</span><span>' + (parseFloat(bill.slabArea) || 0).toFixed(2) + ' Sq Ft</span></div>';
    html += '<div class="summary-row"><span>Beam Area</span><span>' + (parseFloat(bill.beamArea) || 0).toFixed(2) + ' Sq Ft</span></div>';
    html += '<div class="summary-row bold-total"><span>Gross Area (Slab + Beam)</span><span>' + gross.toFixed(2) + ' Sq Ft</span></div>';
    html += '<div class="summary-row" style="color:#dc2626"><span>Open Area (Deductions)</span><span>- ' + openA.toFixed(2) + ' Sq Ft</span></div>';
    html += '<div class="summary-row bold-net"><span>NET AREA</span><span>' + net.toFixed(2) + ' Sq Ft</span></div>';
    html += '</div>';
    html += '</div>';

    // Right Box
    html += '<div class="summary-box">';
    html += '<div class="summary-box-header">Pricing Summary</div>';
    html += '<div class="summary-box-body" style="padding-bottom:0">';
    html += '<div class="summary-row"><span>Rate per Sq Ft</span><span>' + (rateVal > 0 ? '₹ ' + rateVal.toFixed(2) : '—') + '</span></div>';
    html += '<div class="summary-row bold-total"><span>Net Area</span><span>' + net.toFixed(2) + ' Sq Ft</span></div>';
    html += '<div class="summary-row"><span>Total Amount</span><span>' + (amtVal > 0 ? '₹ ' + amtVal.toFixed(2) : '—') + '</span></div>';
    html += '<div class="summary-row"><span>GST (0%)</span><span>₹ 0.00</span></div>';
    html += '</div>';
    html += '<div class="grand-total-banner">';
    html += '<span>GRAND TOTAL</span>';
    html += '<span>' + (amtVal > 0 ? '₹ ' + amtVal.toFixed(2) : '—') + '</span>';
    html += '</div>';
    html += '</div>';

    html += '</div>';

    // Notes and Scan Verify container
    html += '<div class="notes-scan-container">';
    html += '<div class="notes-box">';
    html += '<div class="notes-title">Notes</div>';
    html += '<ul class="notes-list">';
    html += '<li>Measurement verified at site.</li>';
    html += '<li>Rates are as agreed.</li>';
    html += '<li>Subject to final verification.</li>';
    html += '</ul>';
    html += '</div>';

    html += '<div class="scan-verify-box">';
    html += '<svg width="50" height="50" viewBox="0 0 29 29" style="display:block;margin:0 auto 4px">';
    html += '<path d="M0,0 h7 v7 h-7 z M1,1 v5 h5 v-5 z M2,2 h3 v3 h-3 z" fill="#0f172a" />';
    html += '<path d="M22,0 h7 v7 h-7 z M23,1 v5 h5 v-5 z M24,2 h3 v3 h-3 z" fill="#0f172a" />';
    html += '<path d="M0,22 h7 v7 h-7 z M1,23 v5 h5 v-5 z M2,24 h3 v3 h-3 z" fill="#0f172a" />';
    html += '<path d="M9,0 h2 v2 h-2 z M13,1 h1 v1 h-1 z M17,0 h3 v1 h-3 z M10,3 h3 v1 h-3 z M16,4 h2 v2 h-2 z M20,3 h1 v2 h-1 z M8,6 h2 v1 h-2 z M12,8 h2 v2 h-2 z M15,9 h3 v1 h-3 z M9,11 h1 v3 h-1 z M13,14 h3 v1 h-3 z M19,12 h2 v2 h-2 z M25,9 h2 v2 h-2 z M23,13 h3 v1 h-3 z M8,17 h4 v1 h-4 z M14,19 h2 v2 h-2 z M18,17 h3 v1 h-3 z M24,18 h2 v2 h-2 z M9,23 h3 v1 h-3 z M15,24 h2 v2 h-2 z M19,23 h3 v1 h-3 z M23,25 h4 v1 h-4 z" fill="#0f172a" />';
    html += '</svg>';
    html += '<div class="scan-verify-text">Scan to Verify</div>';
    html += '</div>';
    html += '</div>';

    // Signatures row
    html += '<div class="signatures-row">';
    html += '<div class="signature-item">';
    html += '<div class="signature-label">Prepared By</div>';
    html += '<div class="signature-line"></div>';
    html += '<div class="signature-name">(KSS Team)</div>';
    html += '</div>';
    html += '<div class="signature-item">';
    html += '<div class="signature-label">Customer Signature</div>';
    html += '<div class="signature-line"></div>';
    html += '<div class="signature-name">(____________________)</div>';
    html += '</div>';
    html += '<div class="signature-item">';
    html += '<div class="signature-label">Authorized Signature</div>';
    html += '<div class="signature-line"></div>';
    html += '<div class="signature-name">(____________________)</div>';
    html += '</div>';
    html += '</div>';

    // Footer lines
    html += '<div class="invoice-footer">';
    html += '<div class="invoice-footer-line"></div>';
    html += '<span>Thank you for your business!</span>';
    html += '<div class="invoice-footer-line"></div>';
    html += '</div>';

    html += '</div>';
    html += '</body></html>';
    return html;
  }

  function printBill(id) {
    var bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    var printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Please allow popups to print.'); return; }
    printWindow.document.write(buildInvoiceHTML(bill, false));
    printWindow.document.close();
    printWindow.onload = function() {
      printWindow.print();
    };
    setTimeout(function() {
      try { printWindow.print(); } catch(e){}
    }, 500);
  }

  // EXCEL EXPORT
  function exportExcel() {
    var records = getFiltered();
    if (!records.length) { alert('No records to export.'); return; }
    var rows = [['#','Site Name','Contractor','Owner','Location','Lintel Date','Slab Area','Beam Area','Open (Deduct)','Gross Area','Net Area','Rate/Sq Ft','Total Amount','Created']];
    records.forEach(function(r, i) {
      rows.push([i+1, r.siteName||'', r.contractorName||'', r.ownerName||'', r.location||'', r.lintelDate||'',
        r.slabArea||0, r.beamArea||0, r.openArea||0, r.grossArea||r.totalArea||0, r.netArea||r.totalArea||0,
        r.ratePerSqFt||'', r.totalAmount||'', r.createdAt||'']);
    });
    rows.push([], ['--- MATERIAL DETAILS ---'], ['Bill #','Site','Type','Length','Breadth','Qty','Area']);
    records.forEach(function(r, ri) {
      (r.items || []).forEach(function(item) {
        rows.push([ri+1, r.siteName||'', item.type||'Slab', item.length||0, item.breadth||0, item.quantity||0, item.area||0]);
      });
    });
    var csv = rows.map(function(r) { return r.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'KSS_Billings.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('Excel exported!', 'success');
  }

  // TOAST
  function showToast(msg, type) {
    var e = document.getElementById('sb-toast');
    if (e) e.remove();
    var t = document.createElement('div');
    t.id = 'sb-toast';
    var colors = { success:'#059669', info:'#2563eb', error:'#dc2626' };
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:' + (colors[type] || colors.success) + ';color:white;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,0.2);max-width:320px';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(function(){ t.remove(); }, 300); }, 2500);
  }

  // ---- PUBLIC API ----
  return {
    render: render,
    init:   init,
    onSearch:      onSearch,
    onSearchField: onSearchField,
    onFormChange:  onFormChange,
    onSelectExistingSite: onSelectExistingSite,
    refreshTotals: refreshTotals,
    goList:        goList,
    newBill:       newBill,
    editBill:      editBill,
    viewDetail:    viewDetail,
    duplicateBill: duplicateBill,
    addRow:        addRow,
    removeRow:     removeRow,
    updateRowType: updateRowType,
    updateRowField:updateRowField,
    saveBill:      saveBill,
    deleteBill:    deleteBill,
    printBill:     printBill,
    exportPDF:     printBill,
    exportExcel:   exportExcel
  };
})();
