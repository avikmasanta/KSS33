/* ============================================
   KSS Double Fin - Separate Billing Module
   Fully independent of Customer/Site/Inventory
   Includes full Indian GST Tax Invoice support:
    - Dual copy issuance (Original for Recipient & Duplicate for Supplier)
    - Sequential Invoice Number & Date
    - Party details with GSTIN, State Name & Code, Place of Supply
    - Mandatory SAC Code (Services Accounting Code 995411)
    - Tax breakdown (CGST, SGST, IGST) & Grand Total in Words
    - Terms & Conditions and Reverse Charge Mechanism (RCM) declaration
    - Authorized Signatory block
   ============================================ */

var SeparateBillingPage = (function() {

  // Default Form Data Generator with GST Defaults
  function getDefaultFormData() {
    var count = 1;
    try {
      count = ((Store.SeparateBillings && Store.SeparateBillings.getAll) ? Store.SeparateBillings.getAll().length : 0) + 1;
    } catch(e) {}
    var invNo = 'TAX-INV-' + String(count).padStart(3, '0');
    var today = window.localDateStr ? window.localDateStr() : new Date().toISOString().slice(0,10);
    return {
      siteName: '',
      contractorName: '',
      ownerName: '',
      location: '',
      lintelDate: '',
      ratePerSqFt: '',
      receivedAmount: '',
      receivedDate: '',

      // GST & Tax Invoice fields
      taxInvoiceNo: invNo,
      taxInvoiceDate: today,
      supplierName: 'KSS Construction Materials',
      supplierAddress: 'Main Road, Kolkata, West Bengal 700001',
      supplierGstin: '19AAACK1234F1Z5',
      supplierState: 'West Bengal',
      supplierStateCode: '19',
      clientGstin: '',
      clientAddress: '',
      clientState: 'West Bengal',
      clientStateCode: '19',
      placeOfSupply: 'West Bengal (19)',
      sacCode: '995411',
      gstRate: '18',
      isInterstate: false,
      rcmApplicable: 'No',
      termsConditions: '1. Payment is due within 15 days of invoice date.\n2. Interest @ 18% p.a. charged on delayed payments.\n3. Goods/Services once rendered are non-refundable.\n4. All disputes subject to local jurisdiction.'
    };
  }

  // State
  var state = {
    view: 'list',
    editId: null,
    searchTerm: '',
    searchField: 'all',
    formItems: [{ type: 'Slab', length: '', breadth: '', quantity: '1', area: 0 }],
    payments: [{ date: '', amount: '', notes: '' }],
    formData: getDefaultFormData()
  };

  // Type config
  var TYPES = {
    Slab:       { label: 'Slab', color: '#1d4ed8', bg: 'rgba(37,99,235,0.06)', badge: '#eff6ff', badgeText: '#1d4ed8' },
    Beam:       { label: 'Beam', color: '#d97706', bg: 'rgba(217,119,6,0.06)', badge: '#fef3c7', badgeText: '#92400e' },
    Open:       { label: 'Open', color: '#dc2626', bg: 'rgba(220,38,38,0.06)', badge: '#fee2e2', badgeText: '#991b1b' },
    Misc:       { label: 'Misc (+)', color: '#7c3aed', bg: 'rgba(124,58,237,0.06)', badge: '#f3e8ff', badgeText: '#6b21a8' },
    MiscDeduct: { label: 'Misc (-)', color: '#c026d3', bg: 'rgba(192,38,211,0.06)', badge: '#fae8ff', badgeText: '#86198f' }
  };

  // Calc area per row based on formula rules
  function calcArea(item) {
    var l = parseFloat(item.length)   || 0;
    var b = parseFloat(item.breadth)  || 0;
    var q = parseFloat(item.quantity) || 0;
    
    if (item.type === 'Beam') {
      return parseFloat((l * b * q * 2).toFixed(3));
    }
    if (item.type === 'Misc' || item.type === 'MiscDeduct') {
      var mult = q > 0 ? q : 1;
      var calc = (l > 0 || b > 0) ? (l * b * mult) : (parseFloat(item.area) || 0);
      return parseFloat(calc.toFixed(3));
    }
    // Slab and Open are L x B
    return parseFloat((l * b).toFixed(3));
  }

  // Calc totals including GST breakdown
  function calcTotals(items, payments) {
    var src = items || state.formItems;
    var paySrc = payments || state.payments || [];
    var slabArea = 0, beamArea = 0, openArea = 0, miscAddArea = 0, miscDeductArea = 0;
    src.forEach(function(i) {
      var a = parseFloat(i.area) || 0;
      if (i.type === 'Open')           openArea += Math.abs(a);
      else if (i.type === 'Beam')      beamArea += a;
      else if (i.type === 'Misc')      miscAddArea += a;
      else if (i.type === 'MiscDeduct') miscDeductArea += Math.abs(a);
      else                             slabArea += a;
    });
    var grossArea = slabArea + beamArea + miscAddArea;
    var totalDeductions = openArea + miscDeductArea;
    var netArea   = parseFloat(Math.max(0, grossArea - totalDeductions).toFixed(3));
    var rate      = parseFloat(state.formData.ratePerSqFt) || 0;
    var totalAmount = rate > 0 ? parseFloat((netArea * rate).toFixed(2)) : null;
    
    var totalReceived = 0;
    paySrc.forEach(function(p) {
      totalReceived += (parseFloat(p.amount) || 0);
    });

    if (totalReceived === 0 && parseFloat(state.formData.receivedAmount) > 0) {
      totalReceived = parseFloat(state.formData.receivedAmount);
    }

    // GST Taxes calculation
    var baseVal = totalAmount || 0;
    var gstRate = parseFloat(state.formData.gstRate) || 18;
    var isInterstate = !!state.formData.isInterstate;
    var cgstRate = isInterstate ? 0 : (gstRate / 2);
    var sgstRate = isInterstate ? 0 : (gstRate / 2);
    var igstRate = isInterstate ? gstRate : 0;

    var cgstAmount = isInterstate ? 0 : parseFloat((baseVal * (cgstRate / 100)).toFixed(2));
    var sgstAmount = isInterstate ? 0 : parseFloat((baseVal * (sgstRate / 100)).toFixed(2));
    var igstAmount = isInterstate ? parseFloat((baseVal * (igstRate / 100)).toFixed(2)) : 0;
    var totalTax   = parseFloat((cgstAmount + sgstAmount + igstAmount).toFixed(2));
    var grandTotal = totalAmount !== null ? parseFloat((baseVal + totalTax).toFixed(2)) : null;

    var netPayable = grandTotal !== null ? Math.max(0, parseFloat((grandTotal - totalReceived).toFixed(2))) : null;

    return {
      slabArea:       parseFloat(slabArea.toFixed(3)),
      beamArea:       parseFloat(beamArea.toFixed(3)),
      openArea:       parseFloat(openArea.toFixed(3)),
      miscAddArea:    parseFloat(miscAddArea.toFixed(3)),
      miscDeductArea: parseFloat(miscDeductArea.toFixed(3)),
      grossArea:      parseFloat(grossArea.toFixed(3)),
      totalDeductions:parseFloat(totalDeductions.toFixed(3)),
      netArea:        netArea,
      totalAmount:    totalAmount,
      baseVal:        baseVal,
      gstRate:        gstRate,
      isInterstate:   isInterstate,
      cgstRate:       cgstRate,
      cgstAmount:     cgstAmount,
      sgstRate:       sgstRate,
      sgstAmount:     sgstAmount,
      igstRate:       igstRate,
      igstAmount:     igstAmount,
      totalTax:       totalTax,
      grandTotal:     grandTotal,
      totalReceived:  parseFloat(totalReceived.toFixed(2)),
      receivedAmount: parseFloat(totalReceived.toFixed(2)),
      netPayable:     netPayable
    };
  }

  // Format numbers for display
  function fNum(n) {
    if (n === null || n === undefined) return '-';
    return parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  // Convert numbers to Indian Currency Words
  function numToWords(n) {
    if (isNaN(n) || n <= 0) return 'Rupees Zero Only';
    n = Math.round(n);
    var a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    var b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function inWords(num) {
      if ((num = num.toString()).length > 9) return 'Overflow';
      var n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n) return '';
      var str = '';
      str += (n[1] != 0) ? (a[Number(n[1])] || (b[n[1][0]] + ' ' + a[n[1][1]])) + 'Crore ' : '';
      str += (n[2] != 0) ? (a[Number(n[2])] || (b[n[2][0]] + ' ' + a[n[2][1]])) + 'Lakh ' : '';
      str += (n[3] != 0) ? (a[Number(n[3])] || (b[n[3][0]] + ' ' + a[n[3][1]])) + 'Thousand ' : '';
      str += (n[4] != 0) ? (a[Number(n[4])] || (b[n[4][0]] + ' ' + a[n[4][1]])) + 'Hundred ' : '';
      str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || (b[n[5][0]] + ' ' + a[n[5][1]])) : '';
      return str.trim();
    }
    return 'Rupees ' + inWords(n) + ' Only';
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
        if (state.searchField === 'taxInvoiceNo')   return (r.taxInvoiceNo || '').toLowerCase().includes(st);
        if (state.searchField === 'date')           return (r.lintelDate || r.createdAt || '').includes(st);
        return (r.siteName || '').toLowerCase().includes(st) ||
               (r.contractorName || '').toLowerCase().includes(st) ||
               (r.ownerName || '').toLowerCase().includes(st) ||
               (r.taxInvoiceNo || '').toLowerCase().includes(st) ||
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
    html += '<div class="sb-calc-row" style="flex-wrap:wrap; gap:8px;">';
    
    html += '<div class="sb-calc-item sb-calc-slab">';
    html += '<div class="sb-calc-label">Slab Area</div>';
    html += '<div class="sb-calc-val">' + fNum(t.slabArea) + ' Sq Ft</div>';
    html += '</div>';

    html += '<div class="sb-calc-op">+</div>';
    html += '<div class="sb-calc-item sb-calc-beam">';
    html += '<div class="sb-calc-label">Beam Area</div>';
    html += '<div class="sb-calc-val">' + fNum(t.beamArea) + ' Sq Ft</div>';
    html += '</div>';

    if (t.miscAddArea > 0) {
      html += '<div class="sb-calc-op">+</div>';
      html += '<div class="sb-calc-item" style="background:rgba(124,58,237,0.06);border:1px solid #ddd6fe">';
      html += '<div class="sb-calc-label" style="color:#6b21a8">Misc (+) Area</div>';
      html += '<div class="sb-calc-val" style="color:#6b21a8">' + fNum(t.miscAddArea) + ' Sq Ft</div>';
      html += '</div>';
    }

    html += '<div class="sb-calc-op">-</div>';
    html += '<div class="sb-calc-item sb-calc-open">';
    html += '<div class="sb-calc-label">Open (Deduct)</div>';
    html += '<div class="sb-calc-val">' + fNum(t.openArea) + ' Sq Ft</div>';
    html += '</div>';

    if (t.miscDeductArea > 0) {
      html += '<div class="sb-calc-op">-</div>';
      html += '<div class="sb-calc-item" style="background:rgba(192,38,211,0.06);border:1px solid #f5d0fe">';
      html += '<div class="sb-calc-label" style="color:#86198f">Misc (-) Area</div>';
      html += '<div class="sb-calc-val" style="color:#86198f">' + fNum(t.miscDeductArea) + ' Sq Ft</div>';
      html += '</div>';
    }

    html += '<div class="sb-calc-op">=</div>';
    html += '<div class="sb-calc-item sb-calc-net">';
    html += '<div class="sb-calc-label">Net Area</div>';
    html += '<div class="sb-calc-val sb-calc-net-val" id="sb-net-area-calc">' + fNum(t.netArea) + ' Sq Ft</div>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // ---- Payment Row HTML ----
  function paymentRowHTML(item, idx) {
    var d = item.date || '';
    var a = item.amount || '';
    var n = item.notes || '';

    var delBtn = (state.payments.length > 1 || a !== '' || d !== '')
      ? '<button type="button" class="sb-icon-btn sb-icon-delete" onclick="SeparateBillingPage.removePaymentRow(' + idx + ')" title="Delete Payment" style="margin-top:16px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
      : '';

    var row = '<div style="display:flex; gap:12px; align-items:center; margin-bottom:10px; flex-wrap:wrap; background:#f0fdf4; padding:10px 14px; border-radius:8px; border:1px solid #bbf7d0;">';
    row += '<div style="font-weight:700; color:#059669; font-size:12px; min-width:24px;">#' + (idx + 1) + '</div>';
    row += '<div style="flex:1; min-width:140px;"><label class="sb-label" style="font-size:11px; color:#047857;">Payment Date</label><input type="date" class="sb-input" id="sb-pay-date-' + idx + '" value="' + d + '" oninput="SeparateBillingPage.updatePaymentField(' + idx + ',\'date\',this.value)"></div>';
    row += '<div style="flex:1; min-width:140px;"><label class="sb-label" style="font-size:11px; color:#047857;">Amount Received (₹)</label><div class="sb-rate-input-wrap"><span class="sb-rate-prefix">Rs.</span><input type="number" class="sb-input sb-rate-input" id="sb-pay-amount-' + idx + '" min="0" step="1" placeholder="Amount" value="' + a + '" oninput="SeparateBillingPage.updatePaymentField(' + idx + ',\'amount\',this.value)"></div></div>';
    row += '<div style="flex:1.5; min-width:180px;"><label class="sb-label" style="font-size:11px; color:#047857;">Payment Mode / Notes (Optional)</label><input type="text" class="sb-input" id="sb-pay-notes-' + idx + '" placeholder="e.g. Bank Transfer, Cash Advance" value="' + n + '" oninput="SeparateBillingPage.updatePaymentField(' + idx + ',\'notes\',this.value)"></div>';
    row += '<div>' + delBtn + '</div>';
    row += '</div>';
    return row;
  }

  // ---- Material Row HTML ----
  function materialRowHTML(item, idx) {
    var cfg          = TYPES[item.type] || TYPES.Slab;
    var isDeduct     = item.type === 'Open' || item.type === 'MiscDeduct';
    var isBeam       = item.type === 'Beam';
    var isMisc       = item.type === 'Misc' || item.type === 'MiscDeduct';
    var l            = item.length   || '';
    var b            = item.breadth  || '';
    var q            = item.quantity || (isMisc ? '1' : '');
    var matName      = item.materialName || '';
    var areaVal      = item.area > 0 ? (isDeduct ? '- ' : '') + fNum(item.area) + ' Sq Ft' : '-';
    var areaClass    = isDeduct ? 'sb-area-cell sb-area-deduct' : 'sb-area-cell';

    var nameTd = '<td><input type="text" class="sb-cell-input" id="sb-materialName-' + idx + '" placeholder="' + (isMisc ? 'e.g. Staircase, Lift Well' : 'Custom Name (Optional)') + '" value="' + matName + '" oninput="SeparateBillingPage.updateRowField(' + idx + ',\'materialName\',this.value)"></td>';
    var lengthTd = '<td><input type="number" class="sb-cell-input" id="sb-length-' + idx + '" placeholder="0" min="0" step="0.01" value="' + l + '" oninput="SeparateBillingPage.updateRowField(' + idx + ',\'length\',this.value)"></td>';
    var breadthTd = '<td><input type="number" class="sb-cell-input" id="sb-breadth-' + idx + '" placeholder="0" min="0" step="0.01" value="' + b + '" oninput="SeparateBillingPage.updateRowField(' + idx + ',\'breadth\',this.value)"></td>';

    var qtyTd = (isBeam || isMisc)
      ? '<td><input type="number" class="sb-cell-input" id="sb-quantity-' + idx + '" placeholder="1" min="0" step="1" value="' + q + '" oninput="SeparateBillingPage.updateRowField(' + idx + ',\'quantity\',this.value)"></td>'
      : '<td><span class="sb-na-cell">—</span></td>';

    var delTd = state.formItems.length > 1
      ? '<td><button class="sb-icon-btn sb-icon-delete" onclick="SeparateBillingPage.removeRow(' + idx + ')" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>'
      : '<td></td>';

    var slabSel       = item.type === 'Slab'       ? ' selected' : '';
    var beamSel       = item.type === 'Beam'       ? ' selected' : '';
    var openSel       = item.type === 'Open'       ? ' selected' : '';
    var miscSel       = item.type === 'Misc'       ? ' selected' : '';
    var miscDeductSel = item.type === 'MiscDeduct' ? ' selected' : '';

    var row = '<tr id="sb-row-' + idx + '" style="background:' + cfg.bg + '">';
    row += '<td class="sb-row-num-cell">' + (idx + 1) + '</td>';
    row += '<td><select class="sb-type-select" onchange="SeparateBillingPage.updateRowType(' + idx + ',this.value)" style="border-color:' + cfg.color + ';color:' + cfg.color + ';background:' + cfg.badge + '">';
    row += '<option value="Slab"' + slabSel + '>Slab</option>';
    row += '<option value="Beam"' + beamSel + '>Beam</option>';
    row += '<option value="Open"' + openSel + '>Open (Deduct)</option>';
    row += '<option value="Misc"' + miscSel + '>Misc (+)</option>';
    row += '<option value="MiscDeduct"' + miscDeductSel + '>Misc (-)</option>';
    row += '</select></td>';
    row += nameTd;
    row += lengthTd;
    row += breadthTd;
    row += qtyTd;
    row += '<td><span class="' + areaClass + '" id="sb-area-' + idx + '">' + areaVal + '</span></td>';
    row += delTd;
    row += '</tr>';
    return row;
  }

  // ---- LIST PAGE ----
  function renderListPage() {
    var records = getFiltered();
    var allBills = Store.SeparateBillings.getAll() || [];

    var totalGross = records.reduce(function(s, r) { return s + (parseFloat(r.grossArea || r.totalArea) || 0); }, 0);
    var totalNet   = records.reduce(function(s, r) { return s + (parseFloat(r.netArea   || r.totalArea) || 0); }, 0);
    var totalAmt   = records.reduce(function(s, r) { return s + (parseFloat(r.totalAmount) || 0); }, 0);
    var totalRec   = records.reduce(function(s, r) { return s + (parseFloat(r.receivedAmount) || 0); }, 0);

    var html = '<div class="sb-page">';

    // Header
    html += '<div class="sb-header"><div class="sb-header-left">';
    html += '<div class="sb-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>';
    html += '<div><h2 class="sb-header-title">Separate Billing & GST Tax Invoices</h2>';
    html += '<p class="sb-header-subtitle">Independent Site Measurement & GST Tax Invoice Management</p></div></div>';
    html += '<div class="sb-header-actions"><button class="sb-btn sb-btn-primary" onclick="SeparateBillingPage.newBill()">+ New Bill & Invoice</button></div></div>';

    // Stats
    html += '<div class="sb-stats-row">';
    html += '<div class="sb-stat-card"><div class="sb-stat-icon sb-stat-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div><div><div class="sb-stat-value">' + allBills.length + '</div><div class="sb-stat-label">Total Bills</div></div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-icon sb-stat-purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div><div><div class="sb-stat-value">' + fNum(totalNet) + ' <span style="font-size:0.75rem;font-weight:400">Sq Ft</span></div><div class="sb-stat-label">Total Net Area</div></div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-icon sb-stat-amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div><div class="sb-stat-value">Rs.' + fNum(totalAmt) + '</div><div class="sb-stat-label">Total Amount</div></div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-icon sb-stat-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div><div class="sb-stat-value">Rs.' + fNum(totalRec) + '</div><div class="sb-stat-label">Total Received</div></div></div>';
    html += '</div>';

    // Search bar
    html += '<div class="sb-search-row"><div class="sb-search-wrap">';
    html += '<svg class="sb-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    html += '<input type="text" class="sb-search-input" placeholder="Search by site, contractor, owner, invoice #..." value="' + state.searchTerm + '" oninput="SeparateBillingPage.onSearch(event)"></div>';
    html += '<select class="sb-select" onchange="SeparateBillingPage.onSearchField(event)">';
    html += '<option value="all"'            + (state.searchField === 'all'            ? ' selected' : '') + '>All Fields</option>';
    html += '<option value="siteName"'       + (state.searchField === 'siteName'       ? ' selected' : '') + '>Site Name</option>';
    html += '<option value="contractorName"' + (state.searchField === 'contractorName' ? ' selected' : '') + '>Contractor</option>';
    html += '<option value="ownerName"'      + (state.searchField === 'ownerName'      ? ' selected' : '') + '>Owner</option>';
    html += '<option value="taxInvoiceNo"'   + (state.searchField === 'taxInvoiceNo'   ? ' selected' : '') + '>Tax Invoice #</option>';
    html += '<option value="date"'           + (state.searchField === 'date'           ? ' selected' : '') + '>Date</option>';
    html += '</select></div>';

    // Table / Empty
    html += '<div class="sb-table-card">';
    if (!records.length) {
      html += '<div class="sb-empty">';
      html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:#94a3b8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
      html += '<h3>No billing records found</h3>';
      html += '<p>' + (state.searchTerm ? 'No results matching "' + state.searchTerm + '"' : 'Create your first separate bill to get started') + '</p>';
      if (!state.searchTerm) html += '<button class="sb-btn sb-btn-primary" onclick="SeparateBillingPage.newBill()" style="margin-top:16px">+ Create First Bill</button>';
      html += '</div>';
    } else {
      html += '<div class="sb-table-scroll"><table class="sb-table"><thead><tr>';
      html += '<th style="width:40px">#</th><th>Site Name</th><th>Tax Invoice #</th><th>Contractor</th><th>Owner</th><th>Lintel Date</th><th>Gross Area</th><th>Deduction</th><th>Net Area</th><th>Rate</th><th>Total Amount</th><th style="width:140px;text-align:center">Actions</th>';
      html += '</tr></thead><tbody>';
      records.forEach(function(r, idx) {
        var gross = parseFloat(r.grossArea || r.totalArea) || 0;
        var open  = parseFloat(r.openArea)  || 0;
        var net   = parseFloat(r.netArea   || r.totalArea) || 0;
        var taxNo = r.taxInvoiceNo || ("TAX-INV-" + (r.id || r._id || "001").slice(-6).toUpperCase());

        html += '<tr class="sb-table-row" onclick="SeparateBillingPage.viewDetail(\'' + r.id + '\')">';
        html += '<td><span class="sb-row-num">' + (idx+1) + '</span></td>';
        html += '<td><strong>' + (r.siteName || '-') + '</strong></td>';
        html += '<td><span style="font-weight:700; color:#0f3c7a; font-size:11px; background:#e0f2fe; padding:2px 8px; border-radius:4px;">' + taxNo + '</span></td>';
        html += '<td>' + (r.contractorName || '-') + '</td>';
        html += '<td>' + (r.ownerName || '-') + '</td>';
        html += '<td>' + (r.lintelDate || '-') + '</td>';
        html += '<td><span class="sb-area-badge">' + fNum(gross) + ' Sq Ft</span></td>';
        html += '<td>' + (open > 0 ? '<span class="sb-deduct-badge">- ' + fNum(open) + ' Sq Ft</span>' : '-') + '</td>';
        html += '<td><span class="sb-net-badge">' + fNum(net) + ' Sq Ft</span></td>';
        html += '<td>' + (r.ratePerSqFt ? 'Rs.' + fNum(r.ratePerSqFt) : '-') + '</td>';
        html += '<td>' + (r.totalAmount ? '<strong style="color:var(--success)">Rs.' + fNum(r.totalAmount) + '</strong>' : '-') + '</td>';
        html += '<td onclick="event.stopPropagation()"><div class="sb-action-row">';
        html += '<button class="sb-icon-btn sb-icon-view"   title="View Details"   onclick="SeparateBillingPage.viewDetail(\''  + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>';
        html += '<button class="sb-icon-btn sb-icon-edit"   title="Edit Bill"      onclick="SeparateBillingPage.editBill(\''    + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
        html += '<button class="sb-icon-btn sb-icon-copy"   title="Duplicate"      onclick="SeparateBillingPage.duplicateBill(\'' + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>';
        html += '<button class="sb-icon-btn sb-icon-tax"    title="Print GST Tax Invoice" onclick="SeparateBillingPage.showTaxInvoiceOptions(\'' + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="18" y2="12"/></svg></button>';
        html += '<button class="sb-icon-btn sb-icon-print"  title="Print Measurement Bill" onclick="SeparateBillingPage.printBill(\'' + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>';
        html += '<button class="sb-icon-btn sb-icon-delete" title="Delete"         onclick="SeparateBillingPage.deleteBill(\'' + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>';
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
    var isEdit = !!state.editId;
    var t      = calcTotals();
    var rows   = '';
    state.formItems.forEach(function(item, idx) { rows += materialRowHTML(item, idx); });

    var html = '<div class="sb-page">';

    // Header
    html += '<div class="sb-header"><div class="sb-header-left">';
    html += '<button class="sb-back-btn" onclick="SeparateBillingPage.goList()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px"><polyline points="15 18 9 12 15 6"/></svg></button>';
    html += '<div class="sb-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>';
    html += '<div><h2 class="sb-header-title">' + (isEdit ? 'Edit Billing & GST Invoice' : 'New Separate Bill & Tax Invoice') + '</h2>';
    html += '<p class="sb-header-subtitle">Standard material measurements & GST compliant Tax Invoice</p></div></div></div>';

    html += '<div class="sb-form-layout">';

    // Safe fallback loading of sites from localStorage
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
    html += '<div class="sb-form-group sb-full-span"><label class="sb-label">Location / Address</label><textarea class="sb-input sb-textarea" id="sb-location" placeholder="Enter site location / address" rows="2" oninput="SeparateBillingPage.onFormChange(\'location\',this.value)">' + state.formData.location + '</textarea></div>';
    html += '</div></div></div>';

    // GST & TAX INVOICE CARD
    html += '<div class="sb-card" style="border-top: 3px solid #0f3c7a;">';
    html += '<div class="sb-card-header" style="background: rgba(15,60,122,0.03);">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#0f3c7a"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="18" y2="12"/></svg>';
    html += '<h3 style="color:#0f3c7a">GST & Tax Invoice Configuration</h3>';
    html += '<span style="margin-left:auto; font-size:11px; font-weight:700; color:#0f3c7a; background:#e0f2fe; padding:3px 10px; border-radius:12px;">GST Compliance</span>';
    html += '</div>';
    html += '<div class="sb-card-body"><div class="sb-form-grid">';

    // Sequential Invoice No & Date
    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Sequential Invoice Number <span class="sb-required">*</span></label>';
    html += '<input type="text" class="sb-input" id="sb-taxInvoiceNo" placeholder="e.g. TAX-INV-2026-001" value="' + (state.formData.taxInvoiceNo || '') + '" oninput="SeparateBillingPage.onFormChange(\'taxInvoiceNo\',this.value)">';
    html += '</div>';
    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Tax Invoice Date</label>';
    html += '<input type="date" class="sb-input" id="sb-taxInvoiceDate" value="' + (state.formData.taxInvoiceDate || '') + '" oninput="SeparateBillingPage.onFormChange(\'taxInvoiceDate\',this.value)">';
    html += '</div>';

    // Supplier Header
    html += '<div class="sb-full-span" style="font-weight:700; font-size:12px; color:#0f3c7a; text-transform:uppercase; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-top:8px;">1. Supplier (Your Business) Details</div>';

    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Supplier Full Name</label>';
    html += '<input type="text" class="sb-input" id="sb-supplierName" placeholder="Business Name" value="' + (state.formData.supplierName || 'KSS Construction Materials') + '" oninput="SeparateBillingPage.onFormChange(\'supplierName\',this.value)">';
    html += '</div>';
    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Supplier GSTIN</label>';
    html += '<input type="text" class="sb-input" id="sb-supplierGstin" placeholder="15-digit GSTIN" value="' + (state.formData.supplierGstin || '19AAACK1234F1Z5') + '" oninput="SeparateBillingPage.onFormChange(\'supplierGstin\',this.value)">';
    html += '</div>';
    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Supplier State & Code</label>';
    html += '<div style="display:flex; gap:8px;">';
    html += '<input type="text" class="sb-input" id="sb-supplierState" placeholder="State" value="' + (state.formData.supplierState || 'West Bengal') + '" oninput="SeparateBillingPage.onFormChange(\'supplierState\',this.value)">';
    html += '<input type="text" class="sb-input" id="sb-supplierStateCode" placeholder="Code" style="width:75px;" value="' + (state.formData.supplierStateCode || '19') + '" oninput="SeparateBillingPage.onFormChange(\'supplierStateCode\',this.value)">';
    html += '</div></div>';
    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Supplier Address</label>';
    html += '<input type="text" class="sb-input" id="sb-supplierAddress" placeholder="Supplier Address" value="' + (state.formData.supplierAddress || 'Main Road, Kolkata, West Bengal 700001') + '" oninput="SeparateBillingPage.onFormChange(\'supplierAddress\',this.value)">';
    html += '</div>';

    // Client Header
    html += '<div class="sb-full-span" style="font-weight:700; font-size:12px; color:#0f3c7a; text-transform:uppercase; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-top:8px;">2. Client (Recipient) Details & Place of Supply</div>';

    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Client GSTIN (Optional for B2C)</label>';
    html += '<input type="text" class="sb-input" id="sb-clientGstin" placeholder="e.g. 19ABCDE1234F1Z5" value="' + (state.formData.clientGstin || '') + '" oninput="SeparateBillingPage.onFormChange(\'clientGstin\',this.value)">';
    html += '</div>';
    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Place of Supply (State & Code)</label>';
    html += '<input type="text" class="sb-input" id="sb-placeOfSupply" placeholder="e.g. West Bengal (19)" value="' + (state.formData.placeOfSupply || 'West Bengal (19)') + '" oninput="SeparateBillingPage.onFormChange(\'placeOfSupply\',this.value)">';
    html += '</div>';
    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Client State & Code</label>';
    html += '<div style="display:flex; gap:8px;">';
    html += '<input type="text" class="sb-input" id="sb-clientState" placeholder="State" value="' + (state.formData.clientState || 'West Bengal') + '" oninput="SeparateBillingPage.onFormChange(\'clientState\',this.value)">';
    html += '<input type="text" class="sb-input" id="sb-clientStateCode" placeholder="Code" style="width:75px;" value="' + (state.formData.clientStateCode || '19') + '" oninput="SeparateBillingPage.onFormChange(\'clientStateCode\',this.value)">';
    html += '</div></div>';
    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Client Billing Address</label>';
    html += '<input type="text" class="sb-input" id="sb-clientAddress" placeholder="Client Billing Address" value="' + (state.formData.clientAddress || '') + '" oninput="SeparateBillingPage.onFormChange(\'clientAddress\',this.value)">';
    html += '</div>';

    // SAC & Taxes Header
    html += '<div class="sb-full-span" style="font-weight:700; font-size:12px; color:#0f3c7a; text-transform:uppercase; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-top:8px;">3. Service SAC Code, Tax Rates & Reverse Charge (RCM)</div>';

    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Mandatory SAC Code</label>';
    html += '<input type="text" class="sb-input" id="sb-sacCode" placeholder="e.g. 995411" value="' + (state.formData.sacCode || '995411') + '" oninput="SeparateBillingPage.onFormChange(\'sacCode\',this.value)">';
    html += '<span style="font-size:10px; color:#64748b;">SAC 995411 for Construction & Shuttering Services</span>';
    html += '</div>';

    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">GST Tax Rate (%)</label>';
    html += '<select class="sb-select" id="sb-gstRate" style="width:100%;" onchange="SeparateBillingPage.onFormChange(\'gstRate\',this.value);SeparateBillingPage.refreshTotals()">';
    html += '<option value="18"' + (state.formData.gstRate == '18' ? ' selected' : '') + '>18% (CGST 9% + SGST 9%)</option>';
    html += '<option value="12"' + (state.formData.gstRate == '12' ? ' selected' : '') + '>12% (CGST 6% + SGST 6%)</option>';
    html += '<option value="5"'  + (state.formData.gstRate == '5'  ? ' selected' : '') + '>5% (CGST 2.5% + SGST 2.5%)</option>';
    html += '<option value="0"'  + (state.formData.gstRate == '0'  ? ' selected' : '') + '>0% (Exempt / Nil Rated)</option>';
    html += '</select></div>';

    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Supply Type</label>';
    html += '<select class="sb-select" id="sb-isInterstate" style="width:100%;" onchange="SeparateBillingPage.onFormChange(\'isInterstate\',this.value === \'true\');SeparateBillingPage.refreshTotals()">';
    html += '<option value="false"' + (!state.formData.isInterstate ? ' selected' : '') + '>Intra-State (CGST + SGST)</option>';
    html += '<option value="true"'  + (state.formData.isInterstate  ? ' selected' : '') + '>Inter-State (IGST)</option>';
    html += '</select></div>';

    html += '<div class="sb-form-group">';
    html += '<label class="sb-label">Reverse Charge Mechanism (RCM)</label>';
    html += '<select class="sb-select" id="sb-rcmApplicable" style="width:100%;" onchange="SeparateBillingPage.onFormChange(\'rcmApplicable\',this.value)">';
    html += '<option value="No"'  + (state.formData.rcmApplicable !== 'Yes' ? ' selected' : '') + '>No (Tax Payable by Supplier)</option>';
    html += '<option value="Yes"' + (state.formData.rcmApplicable === 'Yes' ? ' selected' : '') + '>Yes (Tax Payable by Recipient)</option>';
    html += '</select></div>';

    html += '<div class="sb-form-group sb-full-span">';
    html += '<label class="sb-label">Terms & Conditions</label>';
    html += '<textarea class="sb-input sb-textarea" id="sb-termsConditions" rows="3" placeholder="Enter Terms & Conditions" oninput="SeparateBillingPage.onFormChange(\'termsConditions\',this.value)">' + (state.formData.termsConditions || '1. Payment is due within 15 days of invoice date.\n2. Interest @ 18% p.a. charged on delayed payments.\n3. Goods/Services once rendered are non-refundable.\n4. All disputes subject to local jurisdiction.') + '</textarea>';
    html += '</div>';

    html += '</div></div></div>'; // Closes GST card

    // Materials card
    html += '<div class="sb-card">';
    html += '<div class="sb-card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><rect x="2" y="3" width="20" height="14" rx="2"/></svg><h3>Calculation Details</h3>';
    html += '<div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">';
    html += '<button type="button" class="sb-btn sb-btn-type-slab sb-btn-sm" onclick="SeparateBillingPage.addRow(\'Slab\')">+ Slab</button>';
    html += '<button type="button" class="sb-btn sb-btn-type-beam sb-btn-sm" onclick="SeparateBillingPage.addRow(\'Beam\')">+ Beam</button>';
    html += '<button type="button" class="sb-btn sb-btn-type-open sb-btn-sm" onclick="SeparateBillingPage.addRow(\'Open\')">+ Open</button>';
    html += '<button type="button" class="sb-btn sb-btn-sm" onclick="SeparateBillingPage.addRow(\'Misc\')" style="background:#f3e8ff;color:#6b21a8;border:1px solid #e9d5ff;font-weight:600;">+ Misc (+)</button>';
    html += '<button type="button" class="sb-btn sb-btn-sm" onclick="SeparateBillingPage.addRow(\'MiscDeduct\')" style="background:#fae8ff;color:#86198f;border:1px solid #f5d0fe;font-weight:600;">- Misc (-)</button>';
    html += '</div></div>';
    html += '<div class="sb-card-body" style="padding:0"><div class="sb-material-table-wrap">';
    html += '<table class="sb-material-table"><thead><tr>';
    html += '<th style="width:38px">#</th><th style="width:115px">Type</th><th style="width:170px">Name / Description (Optional)</th><th style="width:120px">Length (ft)</th><th style="width:120px">Breadth (ft)</th><th style="width:90px">Qty</th><th style="width:140px">Area (Sq Ft)</th><th style="width:36px"></th>';
    html += '</tr></thead><tbody id="sb-material-rows">' + rows + '</tbody></table>';
    html += '</div></div></div>';

    // Calculation Summary card
    html += '<div class="sb-card"><div class="sb-card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><h3>Calculation Summary</h3></div>';
    html += '<div class="sb-card-body"><div id="sb-calc-grid">' + calcGridHTML(t) + '</div></div></div>';

    // Pricing & Tax card
    html += '<div class="sb-card"><div class="sb-card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--primary-500)"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><h3>Pricing, Tax Breakdown & Money Received</h3></div>';
    html += '<div class="sb-card-body"><div class="sb-totals-row">';
    html += '<div class="sb-total-item"><div class="sb-total-label">Net Area</div><div class="sb-total-value sb-total-area" id="sb-net-area-display">' + fNum(t.netArea) + ' Sq Ft</div></div>';
    html += '<div class="sb-total-sep">x</div>';
    html += '<div class="sb-rate-group"><div class="sb-total-label">Rate / Sq Ft (Optional)</div><div class="sb-rate-input-wrap"><span class="sb-rate-prefix">Rs.</span><input type="number" class="sb-input sb-rate-input" id="sb-ratePerSqFt" min="0" step="0.01" placeholder="Rate" value="' + state.formData.ratePerSqFt + '" oninput="SeparateBillingPage.onFormChange(\'ratePerSqFt\',this.value);SeparateBillingPage.refreshTotals()"></div></div>';
    html += '<div class="sb-total-sep">=</div>';
    html += '<div class="sb-total-item"><div class="sb-total-label">Taxable Base Amount</div><div class="sb-total-value sb-total-amount" id="sb-total-amount">' + (t.totalAmount !== null ? 'Rs.' + fNum(t.totalAmount) : '-') + '</div></div>';
    html += '</div>';
    
    // Tax Breakdown Row
    html += '<div id="sb-tax-breakdown-display" style="margin-top:16px; background:#f8fafc; padding:12px 16px; border-radius:8px; border:1px solid #cbd5e1; font-size:12px;">';
    if (t.totalAmount > 0) {
      if (t.isInterstate) {
        html += '<div style="display:flex; justify-style:space-between; margin-bottom:4px;"><span>IGST (' + t.igstRate + '%):</span><strong>Rs. ' + fNum(t.igstAmount) + '</strong></div>';
      } else {
        html += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>CGST (' + t.cgstRate + '%):</span><strong>Rs. ' + fNum(t.cgstAmount) + '</strong></div>';
        html += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>SGST (' + t.sgstRate + '%):</span><strong>Rs. ' + fNum(t.sgstAmount) + '</strong></div>';
      }
      html += '<div style="display:flex; justify-content:space-between; border-top:1px solid #e2e8f0; padding-top:6px; font-size:13px; color:#0f3c7a;"><strong>INVOICE GRAND TOTAL (INCL. GST):</strong><strong>Rs. ' + fNum(t.grandTotal) + '</strong></div>';
    } else {
      html += '<span style="color:#64748b;">Enter a Rate / Sq Ft above to see automated GST tax calculations.</span>';
    }
    html += '</div>';

    // Payments section
    html += '<div style="margin-top:16px; border-top:1px dashed #cbd5e1; padding-top:16px;">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">';
    html += '<span style="font-size:12px; font-weight:700; color:#059669; text-transform:uppercase;">Payments / Advances Received</span>';
    html += '<button type="button" class="sb-btn sb-btn-outline sb-btn-sm" onclick="SeparateBillingPage.addPaymentRow()" style="color:#059669; border-color:#bbf7d0;">+ Add Payment</button>';
    html += '</div>';
    state.payments.forEach(function(p, pIdx) { html += paymentRowHTML(p, pIdx); });
    html += '</div>';

    // Grand Net Payable Banner
    html += '<div class="sb-totals-row" style="margin-top:16px; background:#f0fdf4; padding:12px 16px; border-radius:8px; border:1px solid #bbf7d0; align-items:center;">';
    html += '<div class="sb-total-item" style="flex:1;"><div class="sb-total-label" style="color:#047857; font-weight:700;">TOTAL PAYMENTS RECEIVED</div><div class="sb-total-value" id="sb-total-received-display" style="color:#047857;">Rs.' + fNum(t.totalReceived) + '</div></div>';
    html += '<div class="sb-total-item" style="flex:1;"><div class="sb-total-label" style="color:#0f3c7a; font-weight:700;">NET PAYABLE BALANCE</div><div class="sb-total-value sb-grand-total" id="sb-net-payable-display">' + (t.netPayable !== null ? 'Rs.' + fNum(t.netPayable) : '-') + '</div></div>';
    html += '</div>';

    html += '</div></div>';

    // Actions
    html += '<div class="sb-form-actions">';
    html += '<button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.goList()">Cancel</button>';
    html += '<button class="sb-btn sb-btn-primary sb-btn-lg" onclick="SeparateBillingPage.saveBill()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' + (isEdit ? 'Update Bill & Invoice' : 'Save Bill & Invoice') + '</button>';
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  // ---- DETAIL PAGE ----
  function renderDetailPage() {
    var bill = Store.SeparateBillings.getById(state.editId);
    if (!bill) { goList(); return '<div class="sb-page"></div>'; }

    var slabItems       = (bill.items || []).filter(function(i) { return i.type === 'Slab'; });
    var beamItems       = (bill.items || []).filter(function(i) { return i.type === 'Beam'; });
    var openItems       = (bill.items || []).filter(function(i) { return i.type === 'Open'; });
    var miscAddItems    = (bill.items || []).filter(function(i) { return i.type === 'Misc'; });
    var miscDeductItems = (bill.items || []).filter(function(i) { return i.type === 'MiscDeduct'; });
    var gross = parseFloat(bill.grossArea || bill.totalArea) || 0;
    var openA = parseFloat(bill.openArea)  || 0;
    var net   = parseFloat(bill.netArea   || bill.totalArea) || 0;

    function sectionRows(items, type) {
      if (!items.length) return '';
      var cfg = TYPES[type] || TYPES.Slab;
      var isDeduct = type === 'Open' || type === 'MiscDeduct';
      var s = '<tr><td colspan="6" style="background:' + cfg.badge + ';color:' + cfg.color + ';font-weight:700;font-size:0.78rem;text-transform:uppercase;padding:8px 14px">' + cfg.label + '</td></tr>';
      items.forEach(function(item, i) {
        var isBeam = type === 'Beam';
        var isMisc = type === 'Misc' || type === 'MiscDeduct';
        var qStr = (isBeam || isMisc) ? fNum(item.quantity || 1) : '—';
        var nameStr = item.materialName || cfg.label;

        s += '<tr style="background:' + cfg.bg + '">';
        s += '<td><span class="sb-row-num" style="background:' + cfg.badge + ';color:' + cfg.color + '">' + (i+1) + '</span></td>';
        s += '<td style="font-weight:600">' + nameStr + '</td>';
        s += '<td>' + fNum(item.length) + '</td>';
        s += '<td>' + fNum(item.breadth) + '</td>';
        s += '<td>' + qStr + '</td>';
        s += '<td><span class="' + (isDeduct ? 'sb-deduct-badge' : 'sb-area-badge') + '">' + (isDeduct ? '- ' : '') + fNum(item.area) + ' Sq Ft</span></td>';
        s += '</tr>';
      });
      return s;
    }

    var t2 = calcTotals(bill.items, bill.payments);
    var taxNo = bill.taxInvoiceNo || ("TAX-INV-" + (bill.id || bill._id || "001").slice(-6).toUpperCase());

    var html = '<div class="sb-page">';

    // Header
    html += '<div class="sb-header"><div class="sb-header-left">';
    html += '<button class="sb-back-btn" onclick="SeparateBillingPage.goList()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px"><polyline points="15 18 9 12 15 6"/></svg></button>';
    html += '<div class="sb-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>';
    html += '<div><h2 class="sb-header-title">' + (bill.siteName || 'Bill Detail') + '</h2>';
    html += '<p class="sb-header-subtitle">Invoice #: <strong>' + taxNo + '</strong> | Lintel: ' + (bill.lintelDate || '-') + '</p></div></div>';
    html += '<div class="sb-header-actions">';
    html += '<button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.editBill(\'' + bill.id + '\')">Edit</button>';
    html += '<button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.duplicateBill(\'' + bill.id + '\')">Duplicate</button>';
    html += '<button class="sb-btn sb-btn-outline" onclick="SeparateBillingPage.printBill(\'' + bill.id + '\')">Measurement Bill</button>';
    html += '<button class="sb-btn sb-btn-primary" onclick="SeparateBillingPage.showTaxInvoiceOptions(\'' + bill.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="18" y2="12"/></svg> Print GST Tax Invoice</button>';
    html += '</div></div>';

    // Info cards
    html += '<div class="sb-detail-layout">';
    html += '<div class="sb-card"><div class="sb-card-header"><h3>Bill & GST Information</h3></div><div class="sb-card-body">';
    html += '<div class="sb-info-grid">';
    html += '<div class="sb-info-item"><div class="sb-info-label">Tax Invoice No.</div><div class="sb-info-value" style="color:#0f3c7a; font-weight:800;">' + taxNo + '</div></div>';
    html += '<div class="sb-info-item"><div class="sb-info-label">Site Name</div><div class="sb-info-value">' + (bill.siteName || '-') + '</div></div>';
    html += '<div class="sb-info-item"><div class="sb-info-label">Contractor</div><div class="sb-info-value">' + (bill.contractorName || '-') + '</div></div>';
    html += '<div class="sb-info-item"><div class="sb-info-label">Owner</div><div class="sb-info-value">' + (bill.ownerName || '-') + '</div></div>';
    html += '<div class="sb-info-item"><div class="sb-info-label">Supplier GSTIN</div><div class="sb-info-value">' + (bill.supplierGstin || '19AAACK1234F1Z5') + '</div></div>';
    html += '<div class="sb-info-item"><div class="sb-info-label">Client GSTIN</div><div class="sb-info-value">' + (bill.clientGstin || 'Unregistered / B2C') + '</div></div>';
    html += '<div class="sb-info-item"><div class="sb-info-label">Place of Supply</div><div class="sb-info-value">' + (bill.placeOfSupply || 'West Bengal (19)') + '</div></div>';
    html += '<div class="sb-info-item"><div class="sb-info-label">SAC Code</div><div class="sb-info-value">' + (bill.sacCode || '995411') + '</div></div>';
    html += '<div class="sb-info-item"><div class="sb-info-label">Reverse Charge (RCM)</div><div class="sb-info-value">' + (bill.rcmApplicable || 'No') + '</div></div>';
    html += '<div class="sb-info-item sb-full-span"><div class="sb-info-label">Location / Address</div><div class="sb-info-value">' + (bill.location || '-') + '</div></div>';
    html += '</div></div></div>';

    // Materials
    html += '<div class="sb-card"><div class="sb-card-header"><h3>Measurement Details</h3></div>';
    html += '<div class="sb-card-body" style="padding:0"><div class="sb-table-scroll">';
    html += '<table class="sb-table"><thead><tr><th>#</th><th>Description / Item</th><th>Length (ft)</th><th>Breadth (ft)</th><th>Qty</th><th>Area</th></tr></thead>';
    html += '<tbody>' + sectionRows(slabItems, 'Slab') + sectionRows(beamItems, 'Beam') + sectionRows(miscAddItems, 'Misc') + sectionRows(openItems, 'Open') + sectionRows(miscDeductItems, 'MiscDeduct') + '</tbody></table>';
    html += '</div></div></div>';

    // Calculation breakdown
    html += '<div class="sb-card"><div class="sb-card-header"><h3>Calculation Breakdown</h3></div>';
    html += '<div class="sb-card-body">' + calcGridHTML(t2) + '</div></div>';

    // GST Pricing Breakdown
    html += '<div class="sb-card sb-summary-card"><div class="sb-card-header"><h3>GST Tax Invoice Pricing Summary</h3></div><div class="sb-card-body">';
    html += '<div class="sb-summary-row"><span>Net Taxable Area</span><span>' + fNum(net) + ' Sq Ft</span></div>';
    if (bill.ratePerSqFt) {
      html += '<div class="sb-summary-row"><span>Rate / Sq Ft</span><span>Rs. ' + fNum(bill.ratePerSqFt) + '</span></div>';
      html += '<div class="sb-summary-row bold-total"><span>Taxable Base Value</span><span>Rs. ' + fNum(t2.baseVal) + '</span></div>';
      
      if (t2.isInterstate) {
        html += '<div class="sb-summary-row"><span>IGST @ ' + t2.igstRate + '%</span><span>+ Rs. ' + fNum(t2.igstAmount) + '</span></div>';
      } else {
        html += '<div class="sb-summary-row"><span>CGST @ ' + t2.cgstRate + '%</span><span>+ Rs. ' + fNum(t2.cgstAmount) + '</span></div>';
        html += '<div class="sb-summary-row"><span>SGST @ ' + t2.sgstRate + '%</span><span>+ Rs. ' + fNum(t2.sgstAmount) + '</span></div>';
      }
      
      html += '<div class="sb-summary-row bold-net" style="color:#0f3c7a"><span>INVOICE GRAND TOTAL</span><span>Rs. ' + fNum(t2.grandTotal) + '</span></div>';
      
      if (t2.totalReceived > 0) {
        html += '<div class="sb-summary-row" style="color:#059669"><span>Total Money Received</span><span>- Rs. ' + fNum(t2.totalReceived) + '</span></div>';
      }
      
      html += '<div class="sb-summary-row bold-net" style="color:#059669"><span>NET PAYABLE BALANCE</span><span>Rs. ' + fNum(t2.netPayable) + '</span></div>';
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
    state.formData.clientAddress = site.address || '';
    if (site.gstNumber) {
      state.formData.clientGstin = site.gstNumber;
    }

    // Auto-fetch payments for this site
    var sId = site.id || site._id;
    var sitePayments = [];
    if (Store.SitePayments && Store.SitePayments.getBySite) {
      sitePayments = Store.SitePayments.getBySite(sId) || [];
    } else {
      try {
        var payments = JSON.parse(localStorage.getItem('bm_sitePayments')) || [];
        sitePayments = payments.filter(function(p) { return p.siteId === sId; });
      } catch(e) {}
    }

    if (sitePayments.length > 0) {
      state.payments = sitePayments.map(function(sp) {
        return {
          date: sp.date || '',
          amount: sp.amount || '',
          notes: sp.paymentMode ? sp.paymentMode : (sp.notes || 'Site Payment')
        };
      });
    } else {
      state.payments = [{ date: window.localDateStr ? window.localDateStr() : new Date().toISOString().slice(0,10), amount: '', notes: '' }];
    }

    rerender();
  }

  function rerender() {
    var c = document.getElementById('page-container');
    if (c) { c.innerHTML = render(); init(); }
  }

  function refreshTotals() {
    syncFormInputs();
    var t = calcTotals();
    var g = document.getElementById('sb-calc-grid');
    if (g) g.innerHTML = calcGridHTML(t);
    var nd = document.getElementById('sb-net-area-display');
    if (nd) nd.textContent = fNum(t.netArea) + ' Sq Ft';
    var ae = document.getElementById('sb-total-amount');
    if (ae) ae.textContent = t.totalAmount !== null ? 'Rs.' + fNum(t.totalAmount) : '-';
    
    var taxDisp = document.getElementById('sb-tax-breakdown-display');
    if (taxDisp) {
      if (t.totalAmount > 0) {
        var s = '';
        if (t.isInterstate) {
          s += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>IGST (' + t.igstRate + '%):</span><strong>Rs. ' + fNum(t.igstAmount) + '</strong></div>';
        } else {
          s += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>CGST (' + t.cgstRate + '%):</span><strong>Rs. ' + fNum(t.cgstAmount) + '</strong></div>';
          s += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>SGST (' + t.sgstRate + '%):</span><strong>Rs. ' + fNum(t.sgstAmount) + '</strong></div>';
        }
        s += '<div style="display:flex; justify-content:space-between; border-top:1px solid #cbd5e1; padding-top:6px; font-size:13px; color:#0f3c7a;"><strong>INVOICE GRAND TOTAL (INCL. GST):</strong><strong>Rs. ' + fNum(t.grandTotal) + '</strong></div>';
        taxDisp.innerHTML = s;
      } else {
        taxDisp.innerHTML = '<span style="color:#64748b;">Enter a Rate / Sq Ft above to see automated GST tax calculations.</span>';
      }
    }

    var tr = document.getElementById('sb-total-received-display');
    if (tr) tr.textContent = 'Rs.' + fNum(t.totalReceived);
    var np = document.getElementById('sb-net-payable-display');
    if (np) np.textContent = t.netPayable !== null ? 'Rs.' + fNum(t.netPayable) : '-';
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
    state.formData  = getDefaultFormData();
    state.formItems = [{ type:'Slab', length:'', breadth:'', quantity:'1', area:0 }];
    state.payments  = [{ date: window.localDateStr ? window.localDateStr() : new Date().toISOString().slice(0,10), amount: '', notes: '' }];
    rerender();
  }

  function editBill(id) {
    var bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    state.view   = 'form';
    state.editId = id;
    var defs = getDefaultFormData();
    state.formData = Object.assign({}, defs, bill, {
      siteName:       bill.siteName       || '',
      contractorName: bill.contractorName || '',
      ownerName:      bill.ownerName      || '',
      location:       bill.location       || '',
      lintelDate:     bill.lintelDate     || '',
      ratePerSqFt:    bill.ratePerSqFt    || '',
      receivedAmount: bill.receivedAmount || '',
      receivedDate:   bill.receivedDate   || ''
    });
    state.formItems = (bill.items || []).map(function(i) {
      return Object.assign({ type: 'Slab' }, i);
    });
    if (!state.formItems.length) state.formItems = [{ type:'Slab', length:'', breadth:'', quantity:'1', area:0 }];

    if (bill.payments && bill.payments.length > 0) {
      state.payments = bill.payments.map(function(p) { return Object.assign({}, p); });
    } else if (parseFloat(bill.receivedAmount) > 0) {
      state.payments = [{ date: bill.receivedDate || '', amount: bill.receivedAmount, notes: 'Received' }];
    } else {
      state.payments = [{ date: window.localDateStr ? window.localDateStr() : new Date().toISOString().slice(0,10), amount: '', notes: '' }];
    }

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
    var defs = getDefaultFormData();
    state.formData = Object.assign({}, defs, bill, {
      siteName:       bill.siteName       || '',
      contractorName: bill.contractorName || '',
      ownerName:      bill.ownerName      || '',
      location:       bill.location       || '',
      lintelDate:     '',
      taxInvoiceNo:   defs.taxInvoiceNo,
      taxInvoiceDate: defs.taxInvoiceDate,
      ratePerSqFt:    bill.ratePerSqFt    || '',
      receivedAmount: bill.receivedAmount || '',
      receivedDate:   bill.receivedDate   || ''
    });
    state.formItems = (bill.items || []).map(function(i) {
      return Object.assign({ type: 'Slab' }, i);
    });
    if (!state.formItems.length) state.formItems = [{ type:'Slab', length:'', breadth:'', quantity:'1', area:0 }];

    if (bill.payments && bill.payments.length > 0) {
      state.payments = bill.payments.map(function(p) { return Object.assign({}, p); });
    } else if (parseFloat(bill.receivedAmount) > 0) {
      state.payments = [{ date: '', amount: bill.receivedAmount, notes: 'Received' }];
    } else {
      state.payments = [{ date: '', amount: '', notes: '' }];
    }

    rerender();
  }

  function addRow(type) {
    syncFormInputs();
    var defaultQty = (type === 'Beam') ? '' : '1';
    var defaultName = type === 'Misc' ? 'Misc Addition' : (type === 'MiscDeduct' ? 'Misc Deduction' : '');
    state.formItems.push({ type: type || 'Slab', materialName: defaultName, length: '', breadth: '', quantity: defaultQty, area: 0 });
    rerender();
  }

  function removeRow(idx) {
    if (state.formItems.length <= 1) return;
    syncFormInputs();
    state.formItems.splice(idx, 1);
    rerender();
  }

  function addPaymentRow() {
    syncFormInputs();
    state.payments.push({ date: window.localDateStr ? window.localDateStr() : new Date().toISOString().slice(0,10), amount: '', notes: '' });
    rerender();
  }

  function removePaymentRow(idx) {
    syncFormInputs();
    state.payments.splice(idx, 1);
    if (!state.payments.length) {
      state.payments = [{ date: window.localDateStr ? window.localDateStr() : new Date().toISOString().slice(0,10), amount: '', notes: '' }];
    }
    rerender();
  }

  function updatePaymentField(idx, field, value) {
    if (!state.payments[idx]) return;
    state.payments[idx][field] = value;
    refreshTotals();
  }

  function updateRowType(idx, type) {
    if (!state.formItems[idx]) return;
    syncFormInputs();
    state.formItems[idx].type = type;
    state.formItems[idx].quantity = type === 'Beam' ? '' : '1';
    if (!state.formItems[idx].materialName) {
      state.formItems[idx].materialName = type === 'Misc' ? 'Misc Addition' : (type === 'MiscDeduct' ? 'Misc Deduction' : '');
    }
    state.formItems[idx].area = calcArea(state.formItems[idx]);
    rerender();
  }

  function updateRowField(idx, field, value) {
    if (!state.formItems[idx]) return;
    state.formItems[idx][field] = value;
    state.formItems[idx].area   = calcArea(state.formItems[idx]);
    
    var areaEl = document.getElementById('sb-area-' + idx);
    if (areaEl) {
      var isDeduct = state.formItems[idx].type === 'Open' || state.formItems[idx].type === 'MiscDeduct';
      var a        = state.formItems[idx].area;
      areaEl.textContent = a > 0 ? (isDeduct ? '- ' : '') + fNum(a) + ' Sq Ft' : '-';
    }
    refreshTotals();
  }

  function syncFormInputs() {
    var fields = [
      'siteName','contractorName','ownerName','location','lintelDate','ratePerSqFt',
      'taxInvoiceNo','taxInvoiceDate','supplierName','supplierAddress','supplierGstin',
      'supplierState','supplierStateCode','clientGstin','clientAddress','clientState',
      'clientStateCode','placeOfSupply','sacCode','gstRate','rcmApplicable','termsConditions'
    ];
    fields.forEach(function(f) {
      var el = document.getElementById('sb-' + f);
      if (el) state.formData[f] = el.value;
    });
    var interEl = document.getElementById('sb-isInterstate');
    if (interEl) state.formData.isInterstate = (interEl.value === 'true');

    state.payments.forEach(function(p, idx) {
      var amtEl  = document.getElementById('sb-pay-amount-' + idx);
      var dateEl = document.getElementById('sb-pay-date-' + idx);
      var noteEl = document.getElementById('sb-pay-notes-' + idx);

      if (amtEl)  p.amount = amtEl.value;
      if (dateEl) p.date   = dateEl.value;
      if (noteEl) p.notes  = noteEl.value;
    });
    state.formItems.forEach(function(item, idx) {
      var nameEl     = document.getElementById('sb-materialName-' + idx);
      var lengthEl   = document.getElementById('sb-length-' + idx);
      var breadthEl  = document.getElementById('sb-breadth-' + idx);
      var quantityEl = document.getElementById('sb-quantity-' + idx);
      
      if (nameEl)     item.materialName = nameEl.value;
      if (lengthEl)   item.length       = lengthEl.value;
      else            item.length       = '';
      
      if (breadthEl)  item.breadth      = breadthEl.value;
      else            item.breadth      = '';
      
      if (quantityEl) item.quantity     = quantityEl.value;
      else            item.quantity     = '';
      
      item.area = calcArea(item);
    });
  }

  function saveBill() {
    syncFormInputs();
    if (!state.formData.siteName.trim())       { alert('Please enter a Site Name.');       return; }
    if (!state.formData.contractorName.trim()) { alert('Please enter a Contractor Name.'); return; }

    var items = state.formItems
      .filter(function(i) { return i.length || i.breadth || i.quantity || i.area; })
      .map(function(i, idx) {
        var isMisc = i.type === 'Misc' || i.type === 'MiscDeduct';
        var formulaStr = 'L * B';
        if (i.type === 'Beam') formulaStr = 'L * B * Q * 2';
        else if (isMisc) formulaStr = 'L * B * Q';

        var typeCfg = TYPES[i.type] || TYPES.Slab;
        var defaultLabel = typeCfg.label || i.type;

        return {
          type:         i.type         || 'Slab',
          formula:      formulaStr,
          materialName: (i.materialName && i.materialName.trim()) ? i.materialName.trim() : (defaultLabel + ' ' + (idx + 1)),
          length:       parseFloat(i.length)   || 0,
          breadth:      parseFloat(i.breadth)  || 0,
          quantity:     (i.type === 'Beam' || isMisc) ? (parseFloat(i.quantity) || 1) : 1,
          area:         parseFloat(i.area)     || 0
        };
      });

    if (!items.length) { alert('Please add at least one material row with data.'); return; }

    var validPayments = state.payments
      .filter(function(p) { return parseFloat(p.amount) > 0 || p.date || (p.notes && p.notes.trim()); })
      .map(function(p) {
        return {
          date:   p.date || '',
          amount: parseFloat(p.amount) || 0,
          notes:  (p.notes || '').trim()
        };
      });

    var totalRec = validPayments.reduce(function(s, p) { return s + p.amount; }, 0);
    var lastDate = validPayments.length > 0 ? (validPayments[validPayments.length - 1].date || '') : '';

    var totals = calcTotals(items, validPayments);
    var rate   = parseFloat(state.formData.ratePerSqFt) || null;

    var record = {
      siteName:       state.formData.siteName.trim(),
      contractorName: state.formData.contractorName.trim(),
      ownerName:      state.formData.ownerName.trim(),
      location:       state.formData.location.trim(),
      lintelDate:     state.formData.lintelDate || '',
      ratePerSqFt:    rate,
      receivedAmount: totalRec,
      receivedDate:   lastDate,
      payments:       validPayments,
      items:          items,
      slabArea:       totals.slabArea,
      beamArea:       totals.beamArea,
      openArea:       totals.openArea,
      miscAddArea:    totals.miscAddArea,
      miscDeductArea: totals.miscDeductArea,
      grossArea:      totals.grossArea,
      netArea:        totals.netArea,
      totalArea:      totals.netArea,
      totalAmount:    totals.totalAmount,
      netPayable:     totals.netPayable,

      // Save GST & Tax Invoice fields
      taxInvoiceNo:    state.formData.taxInvoiceNo || '',
      taxInvoiceDate:  state.formData.taxInvoiceDate || '',
      supplierName:    state.formData.supplierName || 'KSS Construction Materials',
      supplierAddress: state.formData.supplierAddress || '',
      supplierGstin:   state.formData.supplierGstin || '',
      supplierState:   state.formData.supplierState || 'West Bengal',
      supplierStateCode: state.formData.supplierStateCode || '19',
      clientGstin:     state.formData.clientGstin || '',
      clientAddress:   state.formData.clientAddress || '',
      clientState:     state.formData.clientState || 'West Bengal',
      clientStateCode: state.formData.clientStateCode || '19',
      placeOfSupply:   state.formData.placeOfSupply || '',
      sacCode:         state.formData.sacCode || '995411',
      gstRate:         parseFloat(state.formData.gstRate) || 18,
      isInterstate:    !!state.formData.isInterstate,
      rcmApplicable:   state.formData.rcmApplicable || 'No',
      termsConditions: state.formData.termsConditions || '',

      createdAt:      state.editId
        ? (Store.SeparateBillings.getById(state.editId) || {}).createdAt || (window.localDateStr ? window.localDateStr() : new Date().toISOString().slice(0,10))
        : (window.localDateStr ? window.localDateStr() : new Date().toISOString().slice(0,10))
    };

    if (state.editId) {
      Store.SeparateBillings.update(state.editId, record);
      showToast('Bill & GST Tax Invoice updated successfully!', 'success');
    } else {
      Store.SeparateBillings.add(record);
      showToast('Bill & GST Tax Invoice saved successfully!', 'success');
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

  // ---- PRINT MEASUREMENT BILL HTML GENERATOR ----
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

    var invNum = "BILL-" + (bill.id || bill._id || "NEW").slice(-6).toUpperCase();
    var invDate = formatDate(bill.createdAt || new Date());
    var lintelDateFormatted = formatDate(bill.lintelDate);

    var rows = '';
    items.forEach(function(item, idx) {
      var lVal     = parseFloat(item.length)   || 0;
      var bVal     = parseFloat(item.breadth)  || 0;
      var qVal     = parseFloat(item.quantity) || 0;
      var areaVal  = parseFloat(item.area)     || 0;
      var isBeam   = item.type === 'Beam';
      var isMisc   = item.type === 'Misc' || item.type === 'MiscDeduct';
      var isDeduct = item.type === 'Open' || item.type === 'MiscDeduct';
      var cfg      = TYPES[item.type] || TYPES.Slab;
      var nameStr  = item.materialName || cfg.label || item.type;

      var lText = (isBeam && lVal === 0) ? '—' : (lVal > 0 ? lVal.toFixed(2) : '—');
      var bText = (isBeam && bVal === 0) ? '—' : (bVal > 0 ? bVal.toFixed(2) : '—');
      var qText = (isBeam || isMisc) ? (qVal > 0 ? qVal.toString() : '1') : '—';

      rows += '<tr>';
      rows += '<td style="text-align:center">' + (idx + 1) + '</td>';
      rows += '<td class="type-badge" style="color:' + cfg.color + '">' + (cfg.label || item.type) + '</td>';
      rows += '<td style="text-align:left; font-weight:600">' + nameStr + '</td>';
      rows += '<td style="text-align:center">' + lText + '</td>';
      rows += '<td style="text-align:center">' + bText + '</td>';
      rows += '<td style="text-align:center">' + qText + '</td>';
      rows += '<td style="font-weight: 700; text-align: right; color:' + (isDeduct ? '#dc2626' : '#0f172a') + '">' + (isDeduct ? '- ' : '') + areaVal.toFixed(2) + '</td>';
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
    html += '.grand-total-banner{background:#0f3c7a;color:#ffffff;padding:14px 18px;display:flex;justify-content:space-between;font-weight:900;font-size:16px;letter-spacing:0.5px}';
    html += '.signatures{display:flex;justify-content:space-between;margin-top:40px;padding-top:20px}';
    html += '.sig-box{text-align:center;width:200px}';
    html += '.sig-line{border-top:1px solid #cbd5e1;margin-bottom:8px}';
    html += '.sig-label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase}';
    html += '@media print{body{background:#ffffff;padding:0}.invoice-container{box-shadow:none;border:none;padding:0}}';
    html += '</style></head><body>';
    html += '<div class="invoice-container">';

    // Header
    html += '<div class="invoice-header">';
    html += '<div class="logo-container">';
    html += '<div><div class="logo-text-title">KSS</div><div class="logo-text-sub">Construction Materials</div></div>';
    html += '</div>';
    html += '<div class="bill-title-container">';
    html += '<div class="bill-title-main">MEASUREMENT BILL</div>';
    html += '<div class="bill-title-sub">Estimation Statement</div>';
    html += '</div>';
    html += '<div class="business-details">';
    html += '<div class="business-name">' + (bill.supplierName || 'KSS Construction Materials') + '</div>';
    html += '<div>Slab & Shuttering Services</div>';
    html += '<div>Phone: +91 98765 43210</div>';
    html += '</div>';
    html += '</div>';

    // Banner strip
    html += '<div class="banner-strip">';
    html += '<span>Bill No. : ' + invNum + '</span>';
    html += '<span>Bill Date : ' + invDate + '</span>';
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
    html += '<div class="info-row"><span class="info-label">Bill Date</span><span class="info-value">: ' + invDate + '</span></div>';
    html += '<div class="info-row"><span class="info-label">Prepared By</span><span class="info-value">: KSS Team</span></div>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // Table
    html += '<div class="section-title">Measurement Details</div>';
    html += '<table class="measurement-table">';
    html += '<thead><tr>';
    html += '<th style="width:40px">Sl.</th><th style="width:100px">Type</th><th>Description / Item</th><th style="width:90px">Length (ft)</th><th style="width:90px">Breadth (ft)</th><th style="width:60px">Qty</th><th style="text-align:right;width:130px">Area (Sq Ft)</th>';
    html += '</tr></thead>';
    html += '<tbody>' + rows + '</tbody>';
    html += '</table>';

    // Summary Box grid
    html += '<div class="summary-grid">';
    
    // Left Box
    var miscAddA    = parseFloat(bill.miscAddArea) || 0;
    var miscDeductA = parseFloat(bill.miscDeductArea) || 0;

    html += '<div class="summary-box">';
    html += '<div class="summary-box-header">Area Summary</div>';
    html += '<div class="summary-box-body">';
    html += '<div class="summary-row"><span>Slab Area</span><span>' + (parseFloat(bill.slabArea) || 0).toFixed(2) + ' Sq Ft</span></div>';
    html += '<div class="summary-row"><span>Beam Area</span><span>' + (parseFloat(bill.beamArea) || 0).toFixed(2) + ' Sq Ft</span></div>';
    if (miscAddA > 0) {
      html += '<div class="summary-row" style="color:#6b21a8"><span>Misc (+) Area</span><span>+ ' + miscAddA.toFixed(2) + ' Sq Ft</span></div>';
    }
    html += '<div class="summary-row bold-total"><span>Gross Area</span><span>' + gross.toFixed(2) + ' Sq Ft</span></div>';
    html += '<div class="summary-row" style="color:#dc2626"><span>Open Area (Deduction)</span><span>- ' + openA.toFixed(2) + ' Sq Ft</span></div>';
    if (miscDeductA > 0) {
      html += '<div class="summary-row" style="color:#86198f"><span>Misc (-) Area (Deduction)</span><span>- ' + miscDeductA.toFixed(2) + ' Sq Ft</span></div>';
    }
    html += '<div class="summary-row bold-net"><span>NET AREA</span><span>' + net.toFixed(2) + ' Sq Ft</span></div>';
    html += '</div>';
    html += '</div>';

    // Right Box
    var recVal = parseFloat(bill.receivedAmount) || 0;
    var payments = bill.payments && bill.payments.length > 0 ? bill.payments : (recVal > 0 ? [{ date: bill.receivedDate, amount: recVal, notes: 'Received' }] : []);
    var totalRec = payments.reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
    var netPay = amtVal > 0 ? Math.max(0, amtVal - totalRec) : 0;

    html += '<div class="summary-box">';
    html += '<div class="summary-box-header">Pricing Summary</div>';
    html += '<div class="summary-box-body" style="padding-bottom:0">';
    html += '<div class="summary-row"><span>Rate per Sq Ft</span><span>' + (rateVal > 0 ? '₹ ' + rateVal.toFixed(2) : '—') + '</span></div>';
    html += '<div class="summary-row bold-total"><span>Net Area</span><span>' + net.toFixed(2) + ' Sq Ft</span></div>';
    html += '<div class="summary-row"><span>Total Amount</span><span>' + (amtVal > 0 ? '₹ ' + amtVal.toFixed(2) : '—') + '</span></div>';

    if (payments.length > 0) {
      payments.forEach(function(p) {
        var pAmt = parseFloat(p.amount) || 0;
        if (pAmt > 0) {
          var recDateStr = p.date ? ' (on ' + formatDate(p.date) + ')' : '';
          var noteStr = p.notes ? ' - ' + p.notes : '';
          html += '<div class="summary-row" style="color:#059669; font-weight:600;"><span>Less: Money Received' + recDateStr + noteStr + '</span><span>- ₹ ' + pAmt.toFixed(2) + '</span></div>';
        }
      });
      if (payments.length > 1) {
        html += '<div class="summary-row" style="color:#047857; font-weight:700; border-top:1px dashed #cbd5e1; padding-top:4px;"><span>Total Money Received</span><span>- ₹ ' + totalRec.toFixed(2) + '</span></div>';
      }
    }
    html += '</div>';
    html += '<div class="grand-total-banner">';
    html += '<span>' + (totalRec > 0 ? 'NET PAYABLE' : 'GRAND TOTAL') + '</span>';
    html += '<span>' + (amtVal > 0 ? '₹ ' + netPay.toFixed(2) : '—') + '</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Signatures row
    html += '<div class="signatures-row" style="display:flex;justify-content:space-between;margin-top:40px;padding-top:20px">';
    html += '<div style="text-align:center;width:200px"><div style="border-top:1px solid #cbd5e1;margin-bottom:8px"></div><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Prepared By</div></div>';
    html += '<div style="text-align:center;width:200px"><div style="border-top:1px solid #cbd5e1;margin-bottom:8px"></div><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Customer Signature</div></div>';
    html += '<div style="text-align:center;width:200px"><div style="border-top:1px solid #cbd5e1;margin-bottom:8px"></div><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Authorized Signature</div></div>';
    html += '</div>';

    html += '</div></body></html>';
    return html;
  }

  // ---- GST TAX INVOICE PAGE GENERATOR (SINGLE PAGE) ----
  function buildSingleTaxInvoicePage(bill, copyLabel) {
    var items     = bill.items || [];
    var gross     = parseFloat(bill.grossArea || bill.totalArea) || 0;
    var openA     = parseFloat(bill.openArea) || 0;
    var net       = parseFloat(bill.netArea  || bill.totalArea) || 0;
    var rateVal   = parseFloat(bill.ratePerSqFt) || 0;
    var baseVal   = parseFloat(bill.totalAmount) || (net * rateVal) || 0;

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

    var invNum = bill.taxInvoiceNo || ("TAX-INV-" + (bill.id || bill._id || "001").slice(-6).toUpperCase());
    var invDate = formatDate(bill.taxInvoiceDate || bill.createdAt || new Date());
    var sacCode = bill.sacCode || "995411";
    var supplierName = bill.supplierName || "KSS Construction Materials";
    var supplierGstin = bill.supplierGstin || "19AAACK1234F1Z5";
    var supplierAddr = bill.supplierAddress || "Main Road, Kolkata, West Bengal 700001";
    var supplierState = (bill.supplierState || "West Bengal") + " (Code: " + (bill.supplierStateCode || "19") + ")";

    var clientName = bill.contractorName || bill.ownerName || bill.siteName || "Client";
    var clientGstin = bill.clientGstin || "Unregistered / B2C";
    var clientAddr = bill.clientAddress || bill.location || ("Site: " + (bill.siteName || "-"));
    var clientState = (bill.clientState || "West Bengal") + " (Code: " + (bill.clientStateCode || "19") + ")";
    var placeOfSupply = bill.placeOfSupply || ((bill.clientState || "West Bengal") + " (" + (bill.clientStateCode || "19") + ")");

    var gstRate = parseFloat(bill.gstRate) || 18;
    var isInterstate = bill.isInterstate || false;

    var cgstRate = isInterstate ? 0 : (gstRate / 2);
    var sgstRate = isInterstate ? 0 : (gstRate / 2);
    var igstRate = isInterstate ? gstRate : 0;

    var cgstAmt = isInterstate ? 0 : parseFloat((baseVal * (cgstRate / 100)).toFixed(2));
    var sgstAmt = isInterstate ? 0 : parseFloat((baseVal * (sgstRate / 100)).toFixed(2));
    var igstAmt = isInterstate ? parseFloat((baseVal * (igstRate / 100)).toFixed(2)) : 0;
    var totalTax = cgstAmt + sgstAmt + igstAmt;
    var grandTotal = parseFloat((baseVal + totalTax).toFixed(2));

    var recVal = parseFloat(bill.receivedAmount) || 0;
    var payments = bill.payments && bill.payments.length > 0 ? bill.payments : (recVal > 0 ? [{ date: bill.receivedDate, amount: recVal, notes: 'Received' }] : []);
    var totalRec = payments.reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
    var netPayable = Math.max(0, parseFloat((grandTotal - totalRec).toFixed(2)));

    // Service line item row
    var serviceRows = '';
    serviceRows += '<tr>';
    serviceRows += '<td style="text-align:center;">1</td>';
    serviceRows += '<td style="text-align:left;">';
    serviceRows += '<strong>Shuttering & Construction Material Measurement Services</strong>';
    serviceRows += '<div style="font-size:10px; color:#475569; margin-top:2px;">Site: ' + (bill.siteName || '-') + ' | Lintel Date: ' + formatDate(bill.lintelDate) + '</div>';
    serviceRows += '<div style="font-size:10px; color:#64748b;">(Gross Area: ' + gross.toFixed(2) + ' Sq Ft, Open Deduction: ' + openA.toFixed(2) + ' Sq Ft)</div>';
    serviceRows += '</td>';
    serviceRows += '<td style="text-align:center; font-weight:700;">' + sacCode + '</td>';
    serviceRows += '<td style="text-align:center;">' + net.toFixed(2) + ' Sq Ft</td>';
    serviceRows += '<td style="text-align:right;">' + (rateVal > 0 ? '₹ ' + rateVal.toFixed(2) : '—') + '</td>';
    serviceRows += '<td style="text-align:right; font-weight:700;">₹ ' + baseVal.toFixed(2) + '</td>';
    serviceRows += '</tr>';

    var termsList = (bill.termsConditions || "1. Payment is due within 15 days of invoice date.\n2. All disputes subject to local jurisdiction.")
      .split('\n')
      .filter(function(l) { return l.trim().length > 0; })
      .map(function(l) { return '<li>' + l.trim() + '</li>'; })
      .join('');

    var rcmText = (bill.rcmApplicable === "Yes") ? "YES (Tax payable by Recipient)" : "NO (Tax payable by Supplier)";

    var pageHtml = '';
    pageHtml += '<div class="tax-invoice-wrapper">';
    
    // Top Bar & Copy Badge
    pageHtml += '<div class="ti-header">';
    pageHtml += '<div>';
    pageHtml += '<div class="ti-company-title">' + supplierName + '</div>';
    pageHtml += '<div class="ti-company-sub">' + supplierAddr + '</div>';
    pageHtml += '<div style="font-size:11px; font-weight:700; color:#0f3c7a; margin-top:3px;">GSTIN: ' + supplierGstin + ' | State: ' + supplierState + '</div>';
    pageHtml += '</div>';
    pageHtml += '<div class="ti-title-badge-wrap">';
    pageHtml += '<div class="ti-main-title">TAX INVOICE</div>';
    pageHtml += '<div class="ti-copy-badge">' + copyLabel + '</div>';
    pageHtml += '</div>';
    pageHtml += '</div>';

    // Invoice Metadata Bar
    pageHtml += '<div class="ti-meta-grid">';
    pageHtml += '<div>';
    pageHtml += '<div class="ti-meta-item"><span class="ti-meta-label">Invoice Number:</span><span class="ti-meta-val" style="color:#0f3c7a;">' + invNum + '</span></div>';
    pageHtml += '<div class="ti-meta-item"><span class="ti-meta-label">Invoice Date:</span><span class="ti-meta-val">' + invDate + '</span></div>';
    pageHtml += '</div>';
    pageHtml += '<div>';
    pageHtml += '<div class="ti-meta-item"><span class="ti-meta-label">Place of Supply:</span><span class="ti-meta-val" style="color:#059669;">' + placeOfSupply + '</span></div>';
    pageHtml += '<div class="ti-meta-item"><span class="ti-meta-label">Reverse Charge (RCM):</span><span class="ti-meta-val">' + (bill.rcmApplicable === "Yes" ? "YES" : "NO") + '</span></div>';
    pageHtml += '</div>';
    pageHtml += '</div>';

    // Parties Grid (Details of Supplier & Details of Recipient)
    pageHtml += '<div class="ti-parties-grid">';
    
    // Left: Supplier
    pageHtml += '<div class="ti-party-card">';
    pageHtml += '<div class="ti-party-header">Details of Supplier / Billed By</div>';
    pageHtml += '<div class="ti-party-body">';
    pageHtml += '<div class="ti-party-name">' + supplierName + '</div>';
    pageHtml += '<div>' + supplierAddr + '</div>';
    pageHtml += '<div class="ti-party-row"><span class="ti-party-lbl">GSTIN: </span><strong>' + supplierGstin + '</strong></div>';
    pageHtml += '<div class="ti-party-row"><span class="ti-party-lbl">State & Code: </span>' + supplierState + '</div>';
    pageHtml += '</div>';
    pageHtml += '</div>';

    // Right: Recipient / Client
    pageHtml += '<div class="ti-party-card">';
    pageHtml += '<div class="ti-party-header">Details of Recipient / Billed To</div>';
    pageHtml += '<div class="ti-party-body">';
    pageHtml += '<div class="ti-party-name">' + clientName + (bill.siteName ? ' (' + bill.siteName + ')' : '') + '</div>';
    pageHtml += '<div>' + clientAddr + '</div>';
    pageHtml += '<div class="ti-party-row"><span class="ti-party-lbl">GSTIN: </span><strong>' + clientGstin + '</strong></div>';
    pageHtml += '<div class="ti-party-row"><span class="ti-party-lbl">State & Code: </span>' + clientState + '</div>';
    pageHtml += '</div>';
    pageHtml += '</div>';

    pageHtml += '</div>'; // closes ti-parties-grid

    // Service Line Items Table
    pageHtml += '<table class="ti-table">';
    pageHtml += '<thead><tr>';
    pageHtml += '<th style="width:40px">Sl.</th><th>Service Description</th><th style="width:90px">SAC Code</th><th style="width:110px">Quantity/Area</th><th style="width:100px">Rate (₹)</th><th style="width:120px">Taxable Value (₹)</th>';
    pageHtml += '</tr></thead>';
    pageHtml += '<tbody>' + serviceRows + '</tbody>';
    pageHtml += '</table>';

    // Financials & Taxes Summary
    pageHtml += '<div class="ti-financial-grid">';
    
    // Words box & Notes
    pageHtml += '<div class="ti-words-box">';
    pageHtml += '<div>';
    pageHtml += '<div class="ti-words-title">Total Invoice Amount in Words</div>';
    pageHtml += '<div class="ti-words-val">' + numToWords(grandTotal) + '</div>';
    pageHtml += '</div>';
    pageHtml += '<div class="ti-rcm-badge-box">';
    pageHtml += '<div>Reverse Charge Mechanism (RCM): <strong>' + rcmText + '</strong></div>';
    pageHtml += '</div>';
    pageHtml += '</div>';

    // Tax Table
    pageHtml += '<table class="ti-tax-table">';
    pageHtml += '<tr><td class="ti-tax-lbl">Taxable Subtotal Value</td><td class="ti-tax-val">₹ ' + baseVal.toFixed(2) + '</td></tr>';
    
    if (isInterstate) {
      pageHtml += '<tr><td class="ti-tax-lbl">IGST @ ' + igstRate + '%</td><td class="ti-tax-val">₹ ' + igstAmt.toFixed(2) + '</td></tr>';
    } else {
      pageHtml += '<tr><td class="ti-tax-lbl">CGST @ ' + cgstRate + '%</td><td class="ti-tax-val">₹ ' + cgstAmt.toFixed(2) + '</td></tr>';
      pageHtml += '<tr><td class="ti-tax-lbl">SGST @ ' + sgstRate + '%</td><td class="ti-tax-val">₹ ' + sgstAmt.toFixed(2) + '</td></tr>';
    }
    
    pageHtml += '<tr style="background:#f1f5f9;"><td class="ti-tax-lbl" style="font-weight:800;">Total Tax Amount</td><td class="ti-tax-val" style="color:#0f3c7a;">₹ ' + totalTax.toFixed(2) + '</td></tr>';
    pageHtml += '<tr class="ti-tax-total-row"><td>GRAND TOTAL (INCL. TAX)</td><td style="text-align:right;">₹ ' + grandTotal.toFixed(2) + '</td></tr>';
    
    if (totalRec > 0) {
      pageHtml += '<tr><td class="ti-tax-lbl" style="color:#059669;">Less: Advance / Money Received</td><td class="ti-tax-val" style="color:#059669;">- ₹ ' + totalRec.toFixed(2) + '</td></tr>';
      pageHtml += '<tr style="background:#ecfdf5;"><td class="ti-tax-lbl" style="font-weight:800; color:#047857;">NET PAYABLE BALANCE</td><td class="ti-tax-val" style="font-weight:800; color:#047857; font-size:14px;">₹ ' + netPayable.toFixed(2) + '</td></tr>';
    }

    pageHtml += '</table>';
    pageHtml += '</div>'; // closes ti-financial-grid

    // Terms & Conditions & Signatures
    pageHtml += '<div class="ti-bottom-grid">';
    
    pageHtml += '<div class="ti-terms-box">';
    pageHtml += '<div class="ti-terms-title">Terms & Conditions</div>';
    pageHtml += '<ol class="ti-terms-list">' + termsList + '</ol>';
    pageHtml += '</div>';

    pageHtml += '<div class="ti-sign-box">';
    pageHtml += '<div class="ti-sign-for">For ' + supplierName + '</div>';
    pageHtml += '<div class="ti-sign-line"></div>';
    pageHtml += '<div class="ti-sign-lbl">Authorized Signatory</div>';
    pageHtml += '</div>';

    pageHtml += '</div>'; // closes ti-bottom-grid

    pageHtml += '</div>'; // closes tax-invoice-wrapper
    return pageHtml;
  }

  // ---- FULL GST TAX INVOICE HTML WRAPPER ----
  function buildTaxInvoiceHTML(bill, copyType) {
    copyType = copyType || 'both'; // 'both', 'original', 'duplicate'
    
    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Tax Invoice - ' + (bill.siteName || 'KSS') + '</title>';
    html += '<style>';
    html += '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap");';
    html += '*{box-sizing:border-box;margin:0;padding:0}';
    html += 'body{font-family:"Inter",sans-serif;background:#f8fafc;color:#0f172a;padding:20px;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}';
    html += '.tax-invoice-wrapper{max-width:850px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:30px;box-shadow:0 10px 25px rgba(0,0,0,0.05);margin-bottom:30px}';
    html += '.ti-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f3c7a;padding-bottom:15px;margin-bottom:15px}';
    html += '.ti-company-title{font-size:22px;font-weight:900;color:#0f3c7a;text-transform:uppercase;letter-spacing:0.5px}';
    html += '.ti-company-sub{font-size:11px;font-weight:600;color:#475569}';
    html += '.ti-title-badge-wrap{text-align:right}';
    html += '.ti-main-title{font-size:26px;font-weight:900;color:#0f3c7a;letter-spacing:1px;text-transform:uppercase}';
    html += '.ti-copy-badge{display:inline-block;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;font-size:10px;font-weight:800;text-transform:uppercase;padding:3px 10px;border-radius:4px;margin-top:4px;letter-spacing:0.5px}';
    html += '.ti-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;background:#f1f5f9;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:20px;font-size:12px}';
    html += '.ti-meta-item{display:flex;gap:6px}';
    html += '.ti-meta-label{font-weight:700;color:#475569;width:140px}';
    html += '.ti-meta-val{font-weight:600;color:#0f172a}';
    html += '.ti-parties-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px}';
    html += '.ti-party-card{border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#fff}';
    html += '.ti-party-header{background:#0f3c7a;color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;padding:6px 12px;letter-spacing:0.5px}';
    html += '.ti-party-body{padding:12px;font-size:12px;line-height:1.5;color:#334155}';
    html += '.ti-party-name{font-weight:800;font-size:13px;color:#0f172a;margin-bottom:4px}';
    html += '.ti-party-row{margin-top:3px;font-size:11px}';
    html += '.ti-party-lbl{font-weight:700;color:#475569}';
    html += '.ti-table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px;border:1px solid #cbd5e1}';
    html += '.ti-table th{background:#0f3c7a;color:#ffffff;padding:8px 6px;text-transform:uppercase;font-weight:700;font-size:10px;border:1px solid #0f3c7a;text-align:center}';
    html += '.ti-table td{padding:8px 6px;border:1px solid #cbd5e1;text-align:center;color:#334155;font-weight:500}';
    html += '.ti-table tr:nth-child(even){background:#f8fafc}';
    html += '.ti-financial-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:15px;margin-bottom:20px}';
    html += '.ti-words-box{border:1px solid #cbd5e1;border-radius:8px;padding:12px;background:#f8fafc;font-size:11px;display:flex;flex-direction:column;justify-content:space-between}';
    html += '.ti-words-title{font-weight:800;color:#0f3c7a;text-transform:uppercase;margin-bottom:6px}';
    html += '.ti-words-val{font-weight:700;color:#0f172a;font-style:italic;background:#fff;padding:8px;border-radius:6px;border:1px solid #e2e8f0}';
    html += '.ti-tax-table{width:100%;border-collapse:collapse;font-size:12px;border:1px solid #cbd5e1}';
    html += '.ti-tax-table td{padding:6px 10px;border-bottom:1px solid #e2e8f0}';
    html += '.ti-tax-lbl{font-weight:600;color:#475569}';
    html += '.ti-tax-val{font-weight:700;text-align:right;color:#0f172a}';
    html += '.ti-tax-total-row{background:#0f3c7a;color:#fff}';
    html += '.ti-tax-total-row td{font-weight:900;font-size:13px;color:#fff}';
    html += '.ti-bottom-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:15px;margin-bottom:25px}';
    html += '.ti-terms-box{border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;background:#fff;font-size:10px}';
    html += '.ti-terms-title{font-weight:800;color:#0f3c7a;text-transform:uppercase;margin-bottom:4px;font-size:11px}';
    html += '.ti-terms-list{padding-left:14px;color:#475569;line-height:1.4}';
    html += '.ti-rcm-badge-box{background:#fff7ed;border:1px solid #ffedd5;border-radius:6px;padding:8px 10px;margin-top:8px;font-size:11px;font-weight:700;color:#c2410c}';
    html += '.ti-sign-box{border:1px solid #cbd5e1;border-radius:8px;padding:12px;text-align:center;display:flex;flex-direction:column;justify-content:space-between;height:120px}';
    html += '.ti-sign-for{font-size:11px;font-weight:800;color:#0f3c7a}';
    html += '.ti-sign-line{border-top:1px dashed #94a3b8;margin:0 20px}';
    html += '.ti-sign-lbl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase}';
    html += '@media print{body{background:#fff;padding:0}.tax-invoice-wrapper{box-shadow:none;border:none;padding:15px;width:100%;max-width:100%;margin-bottom:0}.page-break{page-break-after:always;break-after:page;height:0;margin:0}}';
    html += '</style></head><body>';

    if (copyType === 'original' || copyType === 'both') {
      html += buildSingleTaxInvoicePage(bill, 'ORIGINAL FOR RECIPIENT');
    }

    if (copyType === 'both') {
      html += '<div class="page-break"></div>';
    }

    if (copyType === 'duplicate' || copyType === 'both') {
      html += buildSingleTaxInvoicePage(bill, 'DUPLICATE FOR SUPPLIER');
    }

    html += '</body></html>';
    return html;
  }

  // ---- PRINT MEASUREMENT BILL ----
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

  // ---- PRINT GST TAX INVOICE ----
  function printTaxInvoice(id, copyType) {
    var bill = Store.SeparateBillings.getById(id);
    if (!bill) return;
    copyType = copyType || 'both';
    var printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Please allow popups to print.'); return; }
    printWindow.document.write(buildTaxInvoiceHTML(bill, copyType));
    printWindow.document.close();
    printWindow.onload = function() {
      printWindow.print();
    };
    setTimeout(function() {
      try { printWindow.print(); } catch(e){}
    }, 500);
  }

  // Modal to select print copy format
  function showTaxInvoiceOptions(id) {
    var bill = Store.SeparateBillings.getById(id);
    if (!bill) return;

    var old = document.getElementById('sb-tax-modal');
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.id = 'sb-tax-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:999999;padding:20px;';
    
    var card = '<div style="background:#ffffff;border-radius:16px;max-width:440px;width:100%;padding:24px;box-shadow:0 20px 40px rgba(0,0,0,0.2);font-family:Inter,sans-serif;">';
    card += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">';
    card += '<div style="width:40px;height:40px;border-radius:10px;background:#eff6ff;color:#1d4ed8;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="18" y2="12"/></svg></div>';
    card += '<div><h3 style="margin:0;font-size:1.1rem;font-weight:800;color:#0f172a">Print GST Tax Invoice</h3><p style="margin:2px 0 0;font-size:0.8rem;color:#64748b">' + (bill.siteName || 'Bill') + ' • SAC ' + (bill.sacCode || '995411') + '</p></div>';
    card += '</div>';

    card += '<p style="font-size:0.85rem;color:#475569;margin-bottom:16px">Select the tax invoice copy format to print:</p>';
    
    card += '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">';
    card += '<button type="button" onclick="SeparateBillingPage.printTaxInvoice(\'' + id + '\',\'both\');document.getElementById(\'sb-tax-modal\').remove();" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:10px;border:2px solid #2563eb;background:#eff6ff;color:#1e40af;font-weight:700;font-size:0.9rem;cursor:pointer;"><span>📑 Both Copies (Duplicate Set)</span><span style="font-size:0.75rem;background:#2563eb;color:#fff;padding:2px 8px;border-radius:10px;">Recommended</span></button>';
    card += '<button type="button" onclick="SeparateBillingPage.printTaxInvoice(\'' + id + '\',\'original\');document.getElementById(\'sb-tax-modal\').remove();" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font-weight:600;font-size:0.88rem;cursor:pointer;"><span>👤 Original for Recipient Only</span><span style="font-size:0.75rem;color:#64748b;">Copy 1</span></button>';
    card += '<button type="button" onclick="SeparateBillingPage.printTaxInvoice(\'' + id + '\',\'duplicate\');document.getElementById(\'sb-tax-modal\').remove();" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font-weight:600;font-size:0.88rem;cursor:pointer;"><span>🏢 Duplicate for Supplier Only</span><span style="font-size:0.75rem;color:#64748b;">Copy 2</span></button>';
    card += '</div>';

    card += '<div style="text-align:right;"><button type="button" onclick="document.getElementById(\'sb-tax-modal\').remove()" style="padding:8px 16px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;cursor:pointer;font-size:0.85rem;">Cancel</button></div>';
    card += '</div>';

    modal.innerHTML = card;
    document.body.appendChild(modal);
  }

  // EXCEL EXPORT
  function exportExcel() {
    var records = getFiltered();
    if (!records.length) { alert('No records to export.'); return; }
    var rows = [['#','Site Name','Tax Invoice #','Tax Invoice Date','Contractor','Owner','Location','Lintel Date','Supplier GSTIN','Client GSTIN','SAC Code','Slab Area','Beam Area','Open (Deduct)','Gross Area','Net Area','Rate/Sq Ft','Taxable Value','GST Rate %','Total Tax','Grand Total','Money Received','Payment Date','Created']];
    records.forEach(function(r, i) {
      var t = calcTotals(r.items, r.payments);
      rows.push([
        i+1, r.siteName||'', r.taxInvoiceNo||'', r.taxInvoiceDate||'', r.contractorName||'', r.ownerName||'', r.location||'', r.lintelDate||'',
        r.supplierGstin||'', r.clientGstin||'', r.sacCode||'995411',
        r.slabArea||0, r.beamArea||0, r.openArea||0, r.grossArea||r.totalArea||0, r.netArea||r.totalArea||0,
        r.ratePerSqFt||'', t.baseVal||0, t.gstRate||18, t.totalTax||0, t.grandTotal||0, r.receivedAmount||0, r.receivedDate||'', r.createdAt||''
      ]);
    });
    rows.push([], ['--- MATERIAL DETAILS ---'], ['Bill #','Tax Invoice #','Site','Type','Length','Breadth','Qty','Area']);
    records.forEach(function(r, ri) {
      (r.items || []).forEach(function(item) {
        rows.push([ri+1, r.taxInvoiceNo||'', r.siteName||'', item.type||'Slab', item.length||0, item.breadth||0, item.quantity||0, item.area||0]);
      });
    });
    var csv = rows.map(function(r) { return r.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'KSS_GST_Tax_Invoices.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('Excel exported successfully!', 'success');
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
    onSearch:              onSearch,
    onSearchField:         onSearchField,
    onFormChange:          onFormChange,
    onSelectExistingSite:  onSelectExistingSite,
    refreshTotals:         refreshTotals,
    goList:                goList,
    newBill:               newBill,
    editBill:              editBill,
    viewDetail:            viewDetail,
    duplicateBill:         duplicateBill,
    addRow:                addRow,
    removeRow:             removeRow,
    addPaymentRow:         addPaymentRow,
    removePaymentRow:      removePaymentRow,
    updatePaymentField:    updatePaymentField,
    updateRowType:         updateRowType,
    updateRowField:        updateRowField,
    saveBill:              saveBill,
    deleteBill:            deleteBill,
    printBill:             printBill,
    printTaxInvoice:       printTaxInvoice,
    showTaxInvoiceOptions: showTaxInvoiceOptions,
    exportPDF:             printTaxInvoice,
    exportExcel:           exportExcel
  };
})();
