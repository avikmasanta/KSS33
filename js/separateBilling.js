/* ============================================
   KSS Double Fin - Separate Billing Module
   Fully independent of Customer/Site/Inventory
   ============================================
   Material Types:
     Slab  -> Area = L x B x Qty  (positive)
     Beam  -> Area = Qty x 2 x B  (positive, 2 sides)
     Open  -> Area = L x B x Qty  (DEDUCTED from total)
   Final = Slab + Beam - Open = Net Area
   ============================================ */

var SeparateBillingPage = (function() {

  // State
  var state = {
    view: 'list',
    editId: null,
    searchTerm: '',
    searchField: 'all',
    formItems: [{ type: 'Slab', materialName: '', length: '', breadth: '', quantity: '', area: 0 }],
    formData: { siteName: '', contractorName: '', ownerName: '', location: '', lintelDate: '', ratePerSqFt: '' }
  };

  // Type config
  var TYPES = {
    Slab: { label: 'Slab', color: '#1d4ed8', bg: 'rgba(37,99,235,0.06)', badge: '#eff6ff', badgeText: '#1d4ed8', formula: 'L x B x Qty' },
    Beam: { label: 'Beam', color: '#d97706', bg: 'rgba(217,119,6,0.06)', badge: '#fef3c7', badgeText: '#92400e', formula: 'Qty x 2 x B' },
    Open: { label: 'Open', color: '#dc2626', bg: 'rgba(220,38,38,0.06)', badge: '#fee2e2', badgeText: '#991b1b', formula: 'L x B x Qty (-)' }
  };

  // Calc area per row
  function calcArea(item) {
    var l = parseFloat(item.length)   || 0;
    var b = parseFloat(item.breadth)  || 0;
    var q = parseFloat(item.quantity) || 0;
    if (item.type === 'Beam') return parseFloat((q * 2 * b).toFixed(3));
    return parseFloat((l * b * q).toFixed(3));
  }

  // Calc totals
  function calcTotals(items) {
    var src = items || state.formItems;
    var slabArea = 0, beamArea = 0, openArea = 0;
    src.forEach(function(i) {
      var a = parseFloat(i.area) || 0;
      if (i.type === 'Open')      openArea += a;
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
    html += '<div class="sb-calc-formula">L x B x Qty</div>';
    html += '</div>';
    html += '<div class="sb-calc-op">+</div>';
    html += '<div class="sb-calc-item sb-calc-beam">';
    html += '<div class="sb-calc-label">Beam Area</div>';
    html += '<div class="sb-calc-val">' + fNum(t.beamArea) + ' Sq Ft</div>';
    html += '<div class="sb-calc-formula">Qty x 2 x B</div>';
    html += '</div>';
    html += '<div class="sb-calc-op">-</div>';
    html += '<div class="sb-calc-item sb-calc-open">';
    html += '<div class="sb-calc-label">Open (deduct)</div>';
    html += '<div class="sb-calc-val">' + fNum(t.openArea) + ' Sq Ft</div>';
    html += '<div class="sb-calc-formula">L x B x Qty</div>';
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
    var formula = isBeam ? (q + ' x 2 x ' + b) : (l + ' x ' + b + ' x ' + q);
    var areaVal = item.area > 0 ? (isOpen ? '- ' : '') + fNum(item.area) + ' Sq Ft' : '-';
    var areaClass = isOpen ? 'sb-area-cell sb-area-deduct' : 'sb-area-cell';

    var lengthTd = isBeam
      ? '<td><span class="sb-na-cell">-</span></td>'
      : '<td><input type="number" class="sb-cell-input sb-cell-num" placeholder="0" min="0" step="0.01" value="' + l + '" oninput="SeparateBillingPage.updateRowField(' + idx + ',\'length\',this.value)"></td>';

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
    row += '<td><input type="text" class="sb-cell-input" placeholder="Material name" value="' + (item.materialName || '') + '" oninput="SeparateBillingPage.updateRowField(' + idx + ',\'materialName\',this.value)"></td>';
    row += lengthTd;
    row += '<td><input type="number" class="sb-cell-input sb-cell-num" placeholder="0" min="0" step="0.01" value="' + b + '" oninput="SeparateBillingPage.updateRowField(' + idx + ',\'breadth\',this.value)"></td>';
    row += '<td><input type="number" class="sb-cell-input sb-cell-num" placeholder="0" min="0" step="1" value="' + q + '" oninput="SeparateBillingPage.updateRowField(' + idx + ',\'quantity\',this.value)"></td>';
    row += '<td><span class="sb-formula-cell" id="sb-formula-' + idx + '" style="color:' + cfg.color + '">' + formula + '</span></td>';
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
    html += '<p class="sb-header-subtitle">Slab (LxBxQty) + Beam (Qtyx2xB) - Open deductions</p></div></div></div>';

    html += '<div class="sb-form-layout">';

    // Basic Info card
    html += '<div class="sb-card"><div class="sb-card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><h3>Basic Information</h3></div>';
    html += '<div class="sb-card-body"><div class="sb-form-grid">';
    html += '<div class="sb-form-group"><label class="sb-label">Site Name <span class="sb-required">*</span></label><input type="text" class="sb-input" id="sb-siteName" placeholder="Enter site name" value="' + state.formData.siteName + '" oninput="SeparateBillingPage.onFormChange(\'siteName\',this.value)"></div>';
    html += '<div class="sb-form-group"><label class="sb-label">Contractor Name <span class="sb-required">*</span></label><input type="text" class="sb-input" id="sb-contractorName" placeholder="Enter contractor name" value="' + state.formData.contractorName + '" oninput="SeparateBillingPage.onFormChange(\'contractorName\',this.value)"></div>';
    html += '<div class="sb-form-group"><label class="sb-label">Owner Name</label><input type="text" class="sb-input" id="sb-ownerName" placeholder="Enter owner name" value="' + state.formData.ownerName + '" oninput="SeparateBillingPage.onFormChange(\'ownerName\',this.value)"></div>';
    html += '<div class="sb-form-group"><label class="sb-label">Lintel Date</label><input type="date" class="sb-input" id="sb-lintelDate" value="' + state.formData.lintelDate + '" oninput="SeparateBillingPage.onFormChange(\'lintelDate\',this.value)"></div>';
    html += '<div class="sb-form-group sb-full-span"><label class="sb-label">Location</label><textarea class="sb-input sb-textarea" id="sb-location" placeholder="Enter location / address" rows="2" oninput="SeparateBillingPage.onFormChange(\'location\',this.value)">' + state.formData.location + '</textarea></div>';
    html += '</div></div></div>';

    // Materials card
    html += '<div class="sb-card">';
    html += '<div class="sb-card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><rect x="2" y="3" width="20" height="14" rx="2"/></svg><h3>Material Details</h3>';
    html += '<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button type="button" class="sb-btn sb-btn-type-slab sb-btn-sm" onclick="SeparateBillingPage.addRow(\'Slab\')">+ Slab</button>';
    html += '<button type="button" class="sb-btn sb-btn-type-beam sb-btn-sm" onclick="SeparateBillingPage.addRow(\'Beam\')">+ Beam</button>';
    html += '<button type="button" class="sb-btn sb-btn-type-open sb-btn-sm" onclick="SeparateBillingPage.addRow(\'Open\')">+ Open</button>';
    html += '</div></div>';
    html += '<div class="sb-card-body" style="padding:0"><div class="sb-material-table-wrap">';
    html += '<table class="sb-material-table"><thead><tr>';
    html += '<th style="width:38px">#</th><th style="width:80px">Type</th><th>Material Name</th><th style="width:90px">Length (ft)</th><th style="width:90px">Breadth (ft)</th><th style="width:80px">Qty</th><th style="width:120px">Formula</th><th style="width:120px">Area (Sq Ft)</th><th style="width:36px"></th>';
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

    var slabItems = (bill.items || []).filter(function(i) { return i.type !== 'Beam' && i.type !== 'Open'; });
    var beamItems = (bill.items || []).filter(function(i) { return i.type === 'Beam'; });
    var openItems = (bill.items || []).filter(function(i) { return i.type === 'Open'; });
    var gross = parseFloat(bill.grossArea || bill.totalArea) || 0;
    var openA = parseFloat(bill.openArea)  || 0;
    var net   = parseFloat(bill.netArea   || bill.totalArea) || 0;

    function sectionRows(items, type) {
      if (!items.length) return '';
      var cfg = TYPES[type] || TYPES.Slab;
      var s = '<tr><td colspan="6" style="background:' + cfg.badge + ';color:' + cfg.color + ';font-weight:700;font-size:0.78rem;text-transform:uppercase;padding:8px 14px">' + cfg.label + ' - ' + cfg.formula + '</td></tr>';
      items.forEach(function(item, i) {
        s += '<tr style="background:' + cfg.bg + '">';
        s += '<td><span class="sb-row-num" style="background:' + cfg.badge + ';color:' + cfg.color + '">' + (i+1) + '</span></td>';
        s += '<td><strong>' + (item.materialName || '-') + '</strong></td>';
        s += '<td>' + (type === 'Beam' ? '-' : fNum(item.length)) + '</td>';
        s += '<td>' + fNum(item.breadth) + '</td>';
        s += '<td>' + fNum(item.quantity) + '</td>';
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
    html += '<div class="sb-card"><div class="sb-card-header"><h3>Material Details</h3></div>';
    html += '<div class="sb-card-body" style="padding:0"><div class="sb-table-scroll">';
    html += '<table class="sb-table"><thead><tr><th>#</th><th>Material</th><th>Length (ft)</th><th>Breadth (ft)</th><th>Qty</th><th>Area</th></tr></thead>';
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

  function goList() {
    state.view   = 'list';
    state.editId = null;
    rerender();
  }

  function newBill() {
    state.view      = 'form';
    state.editId    = null;
    state.formData  = { siteName:'', contractorName:'', ownerName:'', location:'', lintelDate:'', ratePerSqFt:'' };
    state.formItems = [{ type:'Slab', materialName:'', length:'', breadth:'', quantity:'', area:0 }];
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
    state.formItems = (bill.items || []).map(function(i) { return Object.assign({}, i); });
    if (!state.formItems.length) state.formItems = [{ type:'Slab', materialName:'', length:'', breadth:'', quantity:'', area:0 }];
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
    state.formItems = (bill.items || []).map(function(i) { return Object.assign({}, i); });
    if (!state.formItems.length) state.formItems = [{ type:'Slab', materialName:'', length:'', breadth:'', quantity:'', area:0 }];
    rerender();
  }

  function addRow(type) {
    syncFormInputs();
    state.formItems.push({ type: type || 'Slab', materialName:'', length:'', breadth:'', quantity:'', area:0 });
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
    state.formItems[idx].area = calcArea(state.formItems[idx]);
    rerender();
  }

  function updateRowField(idx, field, value) {
    if (!state.formItems[idx]) return;
    state.formItems[idx][field] = value;
    state.formItems[idx].area   = calcArea(state.formItems[idx]);
    // Fast DOM update
    var areaEl = document.getElementById('sb-area-' + idx);
    if (areaEl) {
      var isOpen = state.formItems[idx].type === 'Open';
      var a      = state.formItems[idx].area;
      areaEl.textContent = a > 0 ? (isOpen ? '- ' : '') + fNum(a) + ' Sq Ft' : '-';
    }
    var fmlEl = document.getElementById('sb-formula-' + idx);
    if (fmlEl) {
      var it = state.formItems[idx];
      fmlEl.textContent = it.type === 'Beam'
        ? (it.quantity || 0) + ' x 2 x ' + (it.breadth || 0)
        : (it.length || 0) + ' x ' + (it.breadth || 0) + ' x ' + (it.quantity || 0);
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
      var nameEl = document.querySelector('#sb-row-' + idx + ' input[type=text]');
      if (nameEl) item.materialName = nameEl.value;
      var numEls = document.querySelectorAll('#sb-row-' + idx + ' input.sb-cell-num');
      var nums   = Array.prototype.slice.call(numEls);
      if (item.type === 'Beam') {
        if (nums[0]) item.breadth   = nums[0].value;
        if (nums[1]) item.quantity  = nums[1].value;
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
    if (!state.formData.siteName.trim())       { alert('Please enter a Site Name.');       return; }
    if (!state.formData.contractorName.trim()) { alert('Please enter a Contractor Name.'); return; }

    var items = state.formItems
      .filter(function(i) { return i.materialName || i.length || i.breadth || i.quantity; })
      .map(function(i) {
        return {
          type:         i.type         || 'Slab',
          materialName: i.materialName || '',
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
    var slabItems = items.filter(function(i) { return i.type !== 'Beam' && i.type !== 'Open'; });
    var beamItems = items.filter(function(i) { return i.type === 'Beam'; });
    var openItems = items.filter(function(i) { return i.type === 'Open'; });
    var gross = parseFloat(bill.grossArea || bill.totalArea) || 0;
    var openA = parseFloat(bill.openArea) || 0;
    var net   = parseFloat(bill.netArea  || bill.totalArea) || 0;

    function secRows(arr, type) {
      if (!arr.length) return '';
      var cfg = TYPES[type] || TYPES.Slab;
      var s = '<tr><td colspan="6" style="background:' + cfg.badge + ';color:' + cfg.color + ';font-weight:700;font-size:12px;text-transform:uppercase;padding:8px 12px">' + cfg.label + ' - ' + cfg.formula + '</td></tr>';
      arr.forEach(function(item, i) {
        s += '<tr>';
        s += '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;background:' + cfg.bg + '">' + (i+1) + '</td>';
        s += '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;background:' + cfg.bg + '">' + (item.materialName || '-') + '</td>';
        s += '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;background:' + cfg.bg + '">' + (type === 'Beam' ? '-' : item.length) + '</td>';
        s += '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;background:' + cfg.bg + '">' + item.breadth + '</td>';
        s += '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;background:' + cfg.bg + '">' + item.quantity + '</td>';
        s += '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;background:' + cfg.bg + ';color:' + cfg.color + '">' + (type === 'Open' ? '- ' : '') + fNum(item.area) + ' Sq Ft</td>';
        s += '</tr>';
      });
      return s;
    }

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>KSS Double Fin Invoice</title>';
    html += '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",Arial,sans-serif;background:#f8fafc;color:#1e293b}.wrap{max-width:820px;margin:0 auto;background:#fff;padding:48px;box-shadow:0 4px 24px rgba(0,0,0,0.08)}.hd{text-align:center;margin-bottom:32px;border-bottom:3px solid #2563eb;padding-bottom:24px}.hd-co{font-size:28px;font-weight:800;color:#0f172a}.hd-sub{font-size:14px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:1px}.hd-badge{display:inline-block;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:12px;font-weight:700;padding:3px 12px;border-radius:20px;margin-top:8px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px;background:#f8fafc;padding:18px;border-radius:10px}.meta-full{grid-column:1/-1}.meta label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px}.meta span{font-size:14px;color:#0f172a;font-weight:600}table{width:100%;border-collapse:collapse;margin-bottom:20px}thead th{background:#1e40af;color:white;padding:10px 12px;font-size:12px;font-weight:700;text-transform:uppercase;text-align:left}.calc-strip{display:flex;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:20px}.calc-cell{flex:1;padding:14px 16px;text-align:center;border-right:1px solid #e2e8f0}.calc-cell:last-child{border-right:none}.calc-op{flex:0 0 32px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#94a3b8;background:#f8fafc;border-right:1px solid #e2e8f0}.calc-lbl{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px}.calc-val{font-size:16px;font-weight:800}.calc-fm{font-size:11px;color:#94a3b8;margin-top:3px}.footer{background:#0f172a;color:white;border-radius:10px;padding:18px 24px}.frow{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08)}.frow:last-child{border-bottom:none}.flbl{font-size:13px;color:#94a3b8}.fval{font-size:15px;font-weight:700}.fgrand{font-size:22px!important;color:#60a5fa!important}@media print{body{background:white}.wrap{box-shadow:none;padding:20px}}</style>';
    html += '</head><body><div class="wrap">';
    html += '<div class="hd"><div class="hd-co">KSS Double Fin</div><div class="hd-sub">Separate Billing Invoice</div><div class="hd-badge">BILL #' + (bill.id ? bill.id.substring(0,8).toUpperCase() : 'DRAFT') + '</div></div>';
    html += '<div class="meta"><div><label>Site Name</label><span>' + (bill.siteName || '-') + '</span></div><div><label>Lintel Date</label><span>' + (bill.lintelDate || '-') + '</span></div><div><label>Contractor</label><span>' + (bill.contractorName || '-') + '</span></div><div><label>Owner</label><span>' + (bill.ownerName || '-') + '</span></div><div class="meta-full"><label>Location</label><span>' + (bill.location || '-') + '</span></div></div>';
    html += '<table><thead><tr><th>#</th><th>Material</th><th>Length (ft)</th><th>Breadth (ft)</th><th>Qty</th><th>Area (Sq Ft)</th></tr></thead><tbody>' + secRows(slabItems,'Slab') + secRows(beamItems,'Beam') + secRows(openItems,'Open') + '</tbody></table>';
    html += '<div class="calc-strip">';
    html += '<div class="calc-cell" style="background:#eff6ff"><div class="calc-lbl" style="color:#1d4ed8">Slab</div><div class="calc-val" style="color:#1d4ed8">' + fNum(parseFloat(bill.slabArea)||0) + ' Sq Ft</div><div class="calc-fm">L x B x Qty</div></div>';
    html += '<div class="calc-op">+</div>';
    html += '<div class="calc-cell" style="background:#fef3c7"><div class="calc-lbl" style="color:#92400e">Beam</div><div class="calc-val" style="color:#d97706">' + fNum(parseFloat(bill.beamArea)||0) + ' Sq Ft</div><div class="calc-fm">Qty x 2 x B</div></div>';
    html += '<div class="calc-op">-</div>';
    html += '<div class="calc-cell" style="background:#fee2e2"><div class="calc-lbl" style="color:#991b1b">Open</div><div class="calc-val" style="color:#dc2626">' + fNum(openA) + ' Sq Ft</div><div class="calc-fm">L x B x Qty</div></div>';
    html += '<div class="calc-op">=</div>';
    html += '<div class="calc-cell" style="background:#f0fdf4"><div class="calc-lbl" style="color:#065f46">Net Area</div><div class="calc-val" style="color:#059669">' + fNum(net) + ' Sq Ft</div><div class="calc-fm">' + fNum(gross) + ' - ' + fNum(openA) + '</div></div>';
    html += '</div>';
    html += '<div class="footer">';
    html += '<div class="frow"><span class="flbl">Gross Area (Slab + Beam)</span><span class="fval">' + fNum(gross) + ' Sq Ft</span></div>';
    html += '<div class="frow"><span class="flbl">Deductions (Open)</span><span class="fval">- ' + fNum(openA) + ' Sq Ft</span></div>';
    html += '<div class="frow"><span class="flbl">Net Area</span><span class="fval">' + fNum(net) + ' Sq Ft</span></div>';
    if (bill.ratePerSqFt) {
      html += '<div class="frow"><span class="flbl">Rate per Sq Ft</span><span class="fval">Rs.' + fNum(bill.ratePerSqFt) + '</span></div>';
      html += '<div class="frow"><span class="flbl">Grand Total</span><span class="fval fgrand">Rs.' + fNum(bill.totalAmount) + '</span></div>';
    }
    html += '</div></div>';
    if (forPrint) html += '<script>window.print();window.onafterprint=function(){window.close()};<\/script>';
    html += '</body></html>';
    return html;
  }

  function printBill(id) {
    var bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    var w = window.open('','_blank','width=900,height=700');
    if (!w) { alert('Please allow popups to print.'); return; }
    w.document.write(buildInvoiceHTML(bill, true));
    w.document.close();
  }

  function exportPDF(id) {
    var bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    var w = window.open('','_blank','width=900,height=700');
    if (!w) { alert('Please allow popups.'); return; }
    w.document.write(buildInvoiceHTML(bill, false));
    w.document.close();
    setTimeout(function() { try { w.print(); } catch(e){} }, 800);
  }

  // ---- EXCEL EXPORT ----
  function exportExcel() {
    var records = getFiltered();
    if (!records.length) { alert('No records to export.'); return; }
    var rows = [['#','Site Name','Contractor','Owner','Location','Lintel Date','Slab Area','Beam Area','Open (Deduct)','Gross Area','Net Area','Rate/Sq Ft','Total Amount','Created']];
    records.forEach(function(r, i) {
      rows.push([i+1, r.siteName||'', r.contractorName||'', r.ownerName||'', r.location||'', r.lintelDate||'',
        r.slabArea||0, r.beamArea||0, r.openArea||0, r.grossArea||r.totalArea||0, r.netArea||r.totalArea||0,
        r.ratePerSqFt||'', r.totalAmount||'', r.createdAt||'']);
    });
    rows.push([], ['--- MATERIAL DETAILS ---'], ['Bill #','Site','Type','Material','Length','Breadth','Qty','Area']);
    records.forEach(function(r, ri) {
      (r.items || []).forEach(function(item) {
        rows.push([ri+1, r.siteName||'', item.type||'Slab', item.materialName||'', item.length||0, item.breadth||0, item.quantity||0, item.area||0]);
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

  // ---- TOAST ----
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
    exportPDF:     exportPDF,
    exportExcel:   exportExcel
  };
})();
