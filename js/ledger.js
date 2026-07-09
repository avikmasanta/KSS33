/* ============================================
   BuildMate Stock Ledger Page
   ============================================ */

var LedgerPage = {
  render() {
    const materials = Store.Materials.getAll();
    const defaultMaterial = materials[0]?.id || '';

    const today = new Date();
    const firstDay = localDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
    const todayStr = localDateStr();

    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Stock Ledger</h2>
          <p>View material stock ledger</p>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="toolbar">
            <div class="toolbar-left">
              <div class="form-group" style="margin-bottom:0">
                <label style="margin-bottom:4px">Material</label>
                <select class="filter-select" id="ledger-material" onchange="LedgerPage.refresh()" style="width:220px">
                  ${materials.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
              </div>
              <div class="date-range" style="align-items:flex-end">
                <div class="form-group" style="margin-bottom:0">
                  <label style="margin-bottom:4px">Date Range</label>
                  <div class="flex gap-2 items-center">
                    <input type="date" class="date-input" id="ledger-from" value="${firstDay}" onchange="LedgerPage.refresh()">
                    <span class="text-tertiary">to</span>
                    <input type="date" class="date-input" id="ledger-to" value="${todayStr}" onchange="LedgerPage.refresh()">
                  </div>
                </div>
              </div>
            </div>
            <div class="toolbar-right">
              <button class="btn btn-outline btn-sm" onclick="LedgerPage.exportCSV()">
                ${Icons.download} Export
              </button>
            </div>
          </div>
        </div>

        <div id="ledger-content">
          ${this.renderLedger(defaultMaterial)}
        </div>
      </div>
    `;
  },

  init() {},

  renderLedger(materialId) {
    const pid = materialId || document.getElementById('ledger-material')?.value;
    if (!pid) return '<div class="card-body"><p class="text-tertiary">Select a material to view ledger</p></div>';

    const material = Store.Materials.getById(pid);

    const today = new Date();
    const firstDay = localDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
    const todayStr = localDateStr();

    const dateFrom = document.getElementById('ledger-from')?.value || firstDay;
    const dateTo = document.getElementById('ledger-to')?.value || todayStr;

    const ledger = Store.Inventory.getLedger(pid, dateFrom, dateTo);

    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const formatNum = (v) => Number(v).toLocaleString('en-IN');

    return `
      <div class="card-body" style="padding-top:0">
        <!-- Opening Balance -->
        <div class="ledger-header">
          <span>Opening Balance (${formatDate(dateFrom)})</span>
          <span>${formatNum(ledger.openingBalance)} ${material ? material.unit : ''}</span>
        </div>

        <!-- Ledger Table -->
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference No</th>
                <th>From</th>
                <th>To</th>
                <th>Quantity</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${ledger.entries.length === 0 ? `
                <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-tertiary)">No transactions in this period</td></tr>
              ` : ledger.entries.map(entry => `
                <tr>
                  <td>${formatDate(entry.date)}</td>
                  <td><span class="badge ${entry.type === 'Incoming' ? 'badge-incoming' : 'badge-outgoing'}">${entry.type}</span></td>
                  <td class="secondary">${entry.referenceNo}</td>
                  <td class="secondary">${entry.from}</td>
                  <td class="secondary">${entry.to}</td>
                  <td>
                    <span style="color:${entry.type === 'Incoming' ? 'var(--success)' : 'var(--danger)'}">
                      ${entry.type === 'Incoming' ? '' : '-'}${formatNum(entry.quantity)}
                    </span>
                  </td>
                  <td><strong>${formatNum(entry.balance)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Closing Balance -->
        <div class="ledger-footer">
          <span>Closing Balance (${formatDate(dateTo)})</span>
          <span>${formatNum(ledger.closingBalance)} ${material ? material.unit : ''}</span>
        </div>
      </div>
    `;
  },

  refresh() {
    const materialId = document.getElementById('ledger-material')?.value;
    const content = document.getElementById('ledger-content');
    if (content) {
      content.innerHTML = this.renderLedger(materialId);
    }
  },

  exportCSV() {
    const materialId = document.getElementById('ledger-material')?.value;
    if (!materialId) return;

    const material = Store.Materials.getById(materialId);
    const dateFrom = document.getElementById('ledger-from')?.value || '';
    const dateTo = document.getElementById('ledger-to')?.value || '';
    const ledger = Store.Inventory.getLedger(materialId, dateFrom, dateTo);

    let csv = `Stock Ledger - ${material?.name || ''}\n`;
    csv += `Period: ${dateFrom} to ${dateTo}\n\n`;
    csv += `Opening Balance,${ledger.openingBalance}\n\n`;
    csv += 'Date,Type,Reference No,From,To,Quantity,Balance\n';
    ledger.entries.forEach(e => {
      csv += `${e.date},"${e.type}","${e.referenceNo}","${e.from}","${e.to}",${e.type === 'Incoming' ? e.quantity : -e.quantity},${e.balance}\n`;
    });
    csv += `\nClosing Balance,${ledger.closingBalance}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_ledger_${material?.name?.replace(/\s+/g, '_') || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};
