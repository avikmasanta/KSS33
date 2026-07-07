/* ============================================
   BuildMate Inventory Overview Page
   ============================================ */

var InventoryPage = {
  searchTerm: '',

  render() {
    const overview = Store.Inventory.getOverview();
    const sites = Store.Sites.getAll();

    // Summary stats
    let totalWarehouseValue = 0;
    let totalSiteValue = 0;
    let lowStockCount = 0;
    overview.forEach(o => {
      totalWarehouseValue += o.warehouseStock * (o.material.unitPrice || 0);
      totalSiteValue += o.totalSiteStock * (o.material.unitPrice || 0);
      if (o.warehouseStock < o.reorderLevel) lowStockCount++;
    });
    const totalValue = totalWarehouseValue + totalSiteValue;

    const formatCurrency = (v) => '₹ ' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatNum = (v) => Number(v).toLocaleString('en-IN');

    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Inventory Overview</h2>
          <p>Current stock levels</p>
        </div>
        <div class="page-header-actions" style="display: flex; gap: 12px;">
          <button class="btn btn-outline" onclick="InventoryPage.exportPDF()" style="display:inline-flex;align-items:center;gap:6px;">
            ${Icons.fileText || ''} PDF
          </button>
          <button class="btn btn-outline" onclick="InventoryPage.exportCSV()">
            ${Icons.download} Export
          </button>
        </div>
      </div>

      <!-- Split Layout -->
      <div class="split-layout">
          <div class="toolbar">
            <div class="toolbar-left">
              <div class="search-input">
                ${Icons.search}
                <input type="text" placeholder="Search materials..." id="inv-search" value="${this.searchTerm}" oninput="InventoryPage.onSearch(this.value)">
              </div>
            </div>
            <div class="toolbar-right">
              <span class="text-sm text-tertiary">${overview.length} materials</span>
            </div>
          </div>
        </div>
        <div class="table-container" id="inv-table-container">
          ${this.renderTable(overview, sites)}
        </div>
      </div>

      <!-- Adjust Stock Modal -->
      <div class="modal-backdrop" id="adjust-modal">
        <div class="modal">
          <div class="modal-header">
            <h3>Adjust Warehouse Stock: <span id="adj-mat-name"></span></h3>
            <button class="modal-close" onclick="InventoryPage.closeAdjustModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <form id="adjust-form">
              <input type="hidden" id="adj-mat-id">
              <input type="hidden" id="adj-curr-stock">
              <p>Current Warehouse Stock: <strong id="adj-curr-display">0</strong></p>
              <div class="form-group">
                <label>New Warehouse Stock *</label>
                <input type="number" class="form-control" id="adj-new-stock" placeholder="0" required>
              </div>
              <div class="form-group">
                <label>Reason / Note</label>
                <input type="text" class="form-control" id="adj-reason" placeholder="e.g. Opening Balance, Correction..." required>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="InventoryPage.closeAdjustModal()">Cancel</button>
            <button class="btn btn-primary" onclick="InventoryPage.saveAdjustment()">Save Adjustment</button>
          </div>
        </div>
      </div>
    `;
  },

  init() {},

  renderTable(overviewData, sites) {
    const overview = overviewData || Store.Inventory.getOverview();
    const allSites = sites || Store.Sites.getAll();

    const filtered = overview.filter(o => {
      if (!this.searchTerm) return true;
      return o.material.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (o.material.sku || '').toLowerCase().includes(this.searchTerm.toLowerCase());
    });

    const formatNum = (v) => Number(v).toLocaleString('en-IN');

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Material</th>
            <th>Unit</th>
            <th style="color: var(--text-secondary);">User Input</th>
            <th style="color: var(--danger);">Returns</th>
            <th style="color: var(--warning);">Sent Out</th>
            <th style="color: var(--success);">Available (Warehouse)</th>
            <th>At Sites</th>
            <th>Total Owned</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((o, i) => {
            const isLow = o.warehouseStock < o.reorderLevel;
            return `
              <tr>
                <td class="secondary">${i + 1}</td>
                <td>
                  <strong>${o.material.name}</strong>
                  ${isLow ? '<br><span style="font-size: 10px; color: var(--danger);">Low Stock</span>' : ''}
                </td>
                <td>${o.material.unit}</td>
                <td style="color: var(--text-secondary); font-weight: 500;">${formatNum(o.totalPurchased || 0)}</td>
                <td style="color: var(--danger); font-weight: 500;">+${formatNum(o.totalReturned || 0)}</td>
                <td style="color: var(--warning); font-weight: 500;">-${formatNum(o.totalSent || 0)}</td>
                <td style="color: var(--success); font-weight: 700;">${formatNum(o.warehouseStock)}</td>
                <td>${formatNum(o.totalSiteStock)}</td>
                <td><strong>${formatNum(o.totalStock)}</strong></td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-sm btn-primary" style="padding: 4px 8px; font-size: 12px; margin-right: 5px;" onclick="InventoryPage.openAdjustModal('${o.material.id}', '${o.material.name.replace(/'/g, "\\'")}', ${o.warehouseStock})">
                      ${Icons.edit} Adjust
                    </button>
                    <button class="btn btn-sm btn-outline" style="padding: 4px 8px; font-size: 12px;" onclick="App.navigate('ledger');setTimeout(()=>{const sel=document.getElementById('ledger-material');if(sel){sel.value='${o.material.id}';LedgerPage.refresh();}},100)">
                      ${Icons.eye} Ledger
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
          ${filtered.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-tertiary)">No materials found</td></tr>' : ''}
        </tbody>
      </table>
    `;
  },

  onSearch(val) {
    this.searchTerm = val;
    const container = document.getElementById('inv-table-container');
    if (container) container.innerHTML = this.renderTable();
  },

  refresh() {
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = this.render();
      this.init();
    }
  },

  openAdjustModal(matId, matName, currStock) {
    document.getElementById('adjust-modal').classList.add('active');
    document.getElementById('adj-mat-name').textContent = matName;
    document.getElementById('adj-mat-id').value = matId;
    document.getElementById('adj-curr-stock').value = currStock;
    document.getElementById('adj-curr-display').textContent = currStock.toLocaleString('en-IN');
    document.getElementById('adjust-form').reset();
  },

  closeAdjustModal() {
    document.getElementById('adjust-modal').classList.remove('active');
  },

  saveAdjustment() {
    const matId = document.getElementById('adj-mat-id').value;
    const currStock = parseFloat(document.getElementById('adj-curr-stock').value) || 0;
    const newStock = parseFloat(document.getElementById('adj-new-stock').value);
    const reason = document.getElementById('adj-reason').value.trim() || 'Stock Adjustment';

    if (isNaN(newStock)) {
      alert('Please enter a valid number for the new stock.');
      return;
    }

    const diff = newStock - currStock;
    if (diff === 0) {
      this.closeAdjustModal();
      return;
    }

    // Create an incoming transaction for the difference (can be negative)
    const material = Store.Materials.getById(matId);
    Store.Incoming.add({
      date: new Date().toISOString().split('T')[0],
      referenceNo: 'ADJ-' + Date.now().toString().slice(-6),
      supplier: reason,
      destinationType: 'warehouse',
      notes: reason,
      items: [{
        materialId: matId,
        quantity: diff,
        rate: material ? material.unitPrice : 0,
        amount: diff * (material ? material.unitPrice : 0)
      }]
    });

    this.closeAdjustModal();
    this.refresh();
  },

  exportCSV() {
    const overview = Store.Inventory.getOverview();
    const sites = Store.Sites.getAll();

    let csv = 'Material,SKU,Unit,Warehouse Stock,Total Site Stock,Total Stock,Reorder Level,Status\n';
    overview.forEach(o => {
      const isLow = o.warehouseStock < o.reorderLevel ? 'Low Stock' : 'OK';
      csv += `"${o.material.name}","${o.material.sku}","${o.material.unit}",${o.warehouseStock},${o.totalSiteStock},${o.totalStock},${o.reorderLevel},"${isLow}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_overview.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  exportPDF() {
    const overview = Store.Inventory.getOverview();
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const rows = overview.map(o => {
      const isLow = o.warehouseStock < o.reorderLevel;
      return `
        <tr>
          <td style="border:1px solid #333;padding:8px;">${o.material.name}<br><span style="font-size:10px;color:#555;">${o.material.sku || ''}</span></td>
          <td style="border:1px solid #333;padding:8px;text-align:center;">${o.material.unit}</td>
          <td style="border:1px solid #333;padding:8px;text-align:right;font-weight:bold;${isLow ? 'color:#d32f2f;' : ''}">${o.warehouseStock.toLocaleString('en-IN')}</td>
          <td style="border:1px solid #333;padding:8px;text-align:right;">${o.totalSiteStock.toLocaleString('en-IN')}</td>
          <td style="border:1px solid #333;padding:8px;text-align:right;">${o.totalStock.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
      <html><head>
        <title>Warehouse Inventory - ${today}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; color: #111; background: #fff; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { border: 1px solid #333; padding: 10px; background: #e8edf2; text-align: left; font-size: 13px; }
          td { font-size: 12px; }
        </style>
      </head>
      <body>
        <h2 style="margin-bottom: 5px;">Warehouse Inventory Overview</h2>
        <p style="font-size: 14px; color: #555;">Generated on: ${today}</p>
        
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th style="text-align:center;">Unit</th>
              <th style="text-align:right;">Warehouse Stock</th>
              <th style="text-align:right;">Stock at Sites</th>
              <th style="text-align:right;">Total System Stock</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? rows : '<tr><td colspan="5" style="text-align:center;padding:20px;font-style:italic;">No inventory data available.</td></tr>'}
          </tbody>
        </table>
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          }
        </script>
      </body></html>
    `);
    printWindow.document.close();
  }
};
