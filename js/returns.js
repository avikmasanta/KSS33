/* ============================================
   BuildMate Update Stock & Returns Page
   ============================================ */

var ReturnsPage = {
  searchTerm: '',
  adjustments: {},
  lastHash: '',

  render() {
    if (this.lastHash !== window.location.hash) {
      this.lastHash = window.location.hash;
      this.searchTerm = '';
      this.adjustments = {};
    }
    const selectedDate = this.selectedDate || new Date().toISOString().split('T')[0];

    return `
      <div class="page-header" style="background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-body) 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center;">
        <div class="page-header-title" style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 48px; height: 48px; background: rgba(16, 185, 129, 0.1); color: var(--success); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            ${Icons.plusCircle || Icons.box}
          </div>
          <div>
            <h2 style="margin: 0; font-size: 1.5rem; color: var(--text-primary);">Update Stock</h2>
            <p style="margin: 4px 0 0 0; color: var(--text-tertiary);">Add or deduct warehouse material stock</p>
          </div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-outline" onclick="ReturnsPage.shareStock('whatsapp')" style="display:inline-flex;align-items:center;gap:6px;border-color:#22c55e;color:#22c55e;">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.005 5.319 5.324.0 11.83.0c3.15.0 6.11 1.227 8.337 3.454a11.75 11.75 0 0 1 3.451 8.351c-.005 6.515-5.324 11.834-11.83 11.834-2.008-.002-3.982-.51-5.751-1.474L0 24zm5.835-3.666c1.67.991 3.486 1.514 5.334 1.515 5.56.0 10.083-4.524 10.088-10.086.002-2.695-1.047-5.229-2.952-7.136C16.45 2.72 13.916 1.67 11.218 1.67c-5.566.0-10.088 4.52-10.093 10.082-.001 1.93.504 3.812 1.464 5.483L1.581 22.04l4.311-1.706z"/></svg> WhatsApp
          </button>
          <button class="btn btn-outline" onclick="ReturnsPage.shareStock('sms')" style="display:inline-flex;align-items:center;gap:6px;border-color:#0284c7;color:#0284c7;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> SMS
          </button>
          <button class="btn btn-outline" onclick="ReturnsPage.exportPDF()" style="display:inline-flex;align-items:center;gap:6px;">
            ${Icons.fileText || ''} PDF
          </button>
          <button class="btn btn-danger" onclick="ReturnsPage.resetStock()" style="display:inline-flex;align-items:center;gap:6px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">
            ${Icons.trash || ''} Reset
          </button>
        </div>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-body" style="padding: 20px;">
          <div class="form-row" style="display:flex; gap:20px; align-items:flex-end; flex-wrap:wrap;">
            <div class="form-group" style="max-width: 250px; margin: 0; flex: 1; min-width: 150px;">
              <label style="font-weight: 600; color: var(--text-secondary);">Date of Adjustment</label>
              <input type="date" class="form-control" id="stock-date" value="${selectedDate}" onchange="ReturnsPage.onDateChange(this.value)" style="background: var(--bg-body);">
            </div>
            <div class="form-group" style="max-width: 300px; margin: 0; flex: 1; min-width: 200px;">
              <label style="font-weight: 600; color: var(--text-secondary);">Search Material</label>
              <div class="search-input" style="margin: 0; height: 38px; position:relative;">
                ${Icons.search}
                <input type="text" placeholder="Search materials..." id="returns-search" value="${this.searchTerm || ''}" oninput="ReturnsPage.onSearch(this.value)" style="background: var(--bg-body); padding-left: 35px;">
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); overflow: hidden;">
        <div class="table-container" id="returns-table-container" style="max-height: 65vh; overflow-y: auto;">
          ${this.renderTableOnly()}
        </div>
        <div class="card-footer" style="padding: 20px; display: flex; justify-content: flex-end; background: var(--bg-card); border-top: 1px solid var(--border-color);">
            <button class="btn btn-primary" onclick="ReturnsPage.saveAll()" style="font-size: 1.1rem; padding: 12px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">
              ${Icons.save || Icons.check} Save Stock Changes
            </button>
        </div>
      </div>
    `;
  },

  renderTableOnly() {
    const materials = Store.Materials.getSorted ? Store.Materials.getSorted() : Store.Materials.getAll();
    const selectedDate = this.selectedDate || new Date().toISOString().split('T')[0];

    const availableMap = {};
    materials.forEach(m => {
      availableMap[m.id] = Store.Inventory.getWarehouseBalanceOn(m.id, selectedDate);
    });

    const term = (this.searchTerm || '').toLowerCase().trim();
    const filtered = materials.filter(m => {
      if (!term) return true;
      return m.name.toLowerCase().includes(term) || (m.sku || '').toLowerCase().includes(term);
    });

    return `
      <table class="data-table" style="width: 100%; border-collapse: collapse;">
        <thead style="position: sticky; top: 0; background: var(--bg-card); z-index: 10; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <tr>
            <th style="padding: 16px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid var(--border-color);">MATERIAL</th>
            <th style="padding: 16px; font-weight: 600; color: var(--success); border-bottom: 2px solid var(--border-color); width: 35%;">ADJUST STOCK</th>
            <th style="padding: 16px; font-weight: 600; color: var(--text-primary); border-bottom: 2px solid var(--border-color); width: 25%;">AVAILABLE STOCK</th>
          </tr>
        </thead>
        <tbody>
           ${filtered.map(m => {
            const currentStock = availableMap[m.id] || 0;
            const adj = this.adjustments[m.id] || { action: 'add', qty: '' };
            const adjQty = parseFloat(adj.qty) || 0;
            const netStock = adj.action === 'add' ? (currentStock + adjQty) : (currentStock - adjQty);
            let cellBg = 'var(--bg-body)';
            let cellColor = 'var(--text-primary)';
            if (adj.action === 'deduct' && adjQty > currentStock) {
              cellBg = 'rgba(239, 68, 68, 0.1)';
              cellColor = 'var(--danger)';
            } else if (adjQty > 0) {
              cellBg = adj.action === 'add' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)';
              cellColor = adj.action === 'add' ? 'var(--success)' : 'var(--warning)';
            }
            return `
              <tr data-mat-id="${m.id}" data-current-stock="${currentStock}" style="border-bottom: 1px solid var(--border-color); transition: background-color 0.2s;">
                <td style="padding: 16px;">
                  <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">${m.name}</div>
                  <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">${m.sku || '-'}</div>
                </td>
                <td style="padding: 16px;">
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <select class="form-control adj-action-select" onchange="ReturnsPage.calculateRow(this)" style="max-width: 110px; font-weight: 600; background: var(--bg-body); height: 38px;">
                      <option value="add" style="color: var(--success);" ${adj.action === 'add' ? 'selected' : ''}>Add (+)</option>
                      <option value="deduct" style="color: var(--danger);" ${adj.action === 'deduct' ? 'selected' : ''}>Deduct (-)</option>
                    </select>
                    <input type="number" class="form-control new-stock-input" min="0" placeholder="0" value="${adj.qty || ''}" oninput="ReturnsPage.calculateRow(this)" style="max-width: 110px; font-weight: 600; background: var(--bg-body); height: 38px;">
                  </div>
                </td>
                <td style="padding: 16px;">
                  <div class="new-available-cell" data-unit="${m.unit}" style="font-weight: 700; font-size: 1.15rem; color: ${cellColor}; background: ${cellBg}; padding: 8px 12px; border-radius: 8px; display: inline-block; min-width: 100px; text-align: center;">
                    ${netStock.toLocaleString('en-IN')} <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-tertiary);">${m.unit}</span>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
          ${filtered.length === 0 ? '<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--text-tertiary)">No matching materials found</td></tr>' : ''}
        </tbody>
      </table>
    `;
  },

  onDateChange(val) {
    this.selectedDate = val;
    this.adjustments = {};
    this.refresh();
  },

  onSearch(val) {
    this.searchTerm = val;
    const container = document.getElementById('returns-table-container');
    if (container) {
      container.innerHTML = this.renderTableOnly();
    }
  },

  init() {
    // Add hover effect to rows
    const rows = document.querySelectorAll('tr[data-mat-id]');
    rows.forEach(row => {
      row.addEventListener('mouseenter', () => row.style.backgroundColor = 'var(--bg-body)');
      row.addEventListener('mouseleave', () => row.style.backgroundColor = 'transparent');
    });
  },

  refresh() {
    const container = document.getElementById('page-container');
    if (container && window.location.hash === '#site-returns') {
      container.innerHTML = this.render();
      this.init();
    }
  },

  calculateRow(element) {
    const tr = element.closest('tr');
    const matId = tr.getAttribute('data-mat-id');
    const currentStock = parseFloat(tr.getAttribute('data-current-stock')) || 0;
    const action = tr.querySelector('.adj-action-select').value;
    const inputVal = parseFloat(tr.querySelector('.new-stock-input').value) || 0;
    
    // Update in-memory state
    if (!this.adjustments) this.adjustments = {};
    if (inputVal > 0) {
      this.adjustments[matId] = { action, qty: inputVal };
    } else {
      delete this.adjustments[matId];
    }
    
    let newAvailable = currentStock;
    if (action === 'add') {
      newAvailable = currentStock + inputVal;
    } else {
      newAvailable = currentStock - inputVal;
    }
    
    const cell = tr.querySelector('.new-available-cell');
    const materialUnit = cell.getAttribute('data-unit') || '';
    
    cell.innerHTML = `${newAvailable.toLocaleString('en-IN')} <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-tertiary);">${materialUnit}</span>`;
    
    if (action === 'deduct' && inputVal > currentStock) {
      cell.style.background = 'rgba(239, 68, 68, 0.1)';
      cell.style.color = 'var(--danger)';
    } else if (inputVal > 0) {
      cell.style.background = 'rgba(16, 185, 129, 0.1)';
      cell.style.color = action === 'add' ? 'var(--success)' : 'var(--warning)';
    } else {
      cell.style.background = 'var(--bg-body)';
      cell.style.color = 'var(--text-primary)';
    }
  },

  async resetStock() {
    if (confirm("Are you absolutely sure you want to reset all stock levels to 0?\nThis will permanently delete all dispatches, returns, and transaction history!")) {
      const btn = document.querySelector('button[onclick="ReturnsPage.resetStock()"]');
      if (btn) btn.disabled = true;
      try {
        const res = await Store.resetStock();
        if (res.success) {
          alert("Stock reset completed successfully!");
          window.location.reload();
        } else {
          alert("Failed to reset stock: " + res.error);
        }
      } catch (err) {
        alert("An error occurred during reset: " + err.message);
      } finally {
        if (btn) btn.disabled = false;
      }
    }
  },

  saveAll() {
    const date = document.getElementById('stock-date').value;
    
    if (!this.adjustments || Object.keys(this.adjustments).length === 0) {
      alert("Please enter at least one quantity to save.");
      return;
    }
    
    let hasError = false;
    let updates = [];
    const materials = Store.Materials.getAll();
    
    Object.keys(this.adjustments).forEach(matId => {
      const adj = this.adjustments[matId];
      const material = materials.find(m => m.id === matId);
      if (!material) return;
      
      const currentStock = Store.Inventory.getWarehouseBalanceOn(matId, date);
      
      if (adj.action === 'deduct' && adj.qty > currentStock) {
        alert(`Cannot deduct more than available stock for ${material.name}`);
        hasError = true;
        return;
      }
      
      updates.push({ matId, action: adj.action, qty: adj.qty, material });
    });
    
    if (hasError) return;
    if (updates.length === 0) {
      alert("Please enter at least one quantity to save.");
      return;
    }
    
    const hasDeduct = updates.some(u => u.action === 'deduct');
    if (hasDeduct) {
      if (!confirm("Are you sure you want to deduct stock from the warehouse?")) {
        return;
      }
    }
    
    updates.forEach(u => {
      const actualQty = u.action === 'deduct' ? -u.qty : u.qty;
      
      Store.Incoming.add({
        date: date,
        vendorName: u.action === 'deduct' ? 'Manual Stock Deduction' : 'User Input (Manual Add)',
        referenceNo: 'Stock Update',
        destinationType: 'warehouse',
        destinationSiteId: '',
        items: [{
          materialId: u.matId,
          quantity: actualQty,
          rate: u.material ? u.material.unitPrice : 0,
          amount: actualQty * (u.material ? u.material.unitPrice : 0)
        }],
        notes: u.action === 'deduct' ? 'Deducted manually from Update Stock page' : 'Manually added from Update Stock page'
      });
      
      Store.logTransaction(u.matId, u.qty, u.action === 'deduct' ? 'Deduct' : 'Add');
    });
    
    alert("Stock updated successfully!");
    this.adjustments = {};
    this.refresh();
  },

  exportPDF() {
    const overview = Store.Inventory.getOverview();
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    
    const rows = overview.map(o => {
      return `
        <tr>
          <td style="border:1px solid #333;padding:8px;">${o.material.name}<br><span style="font-size:10px;color:#555;">${o.material.sku || ''}</span></td>
          <td style="border:1px solid #333;padding:8px;text-align:center;">${o.material.unit}</td>
          <td style="border:1px solid #333;padding:8px;text-align:right;font-weight:bold;">${o.warehouseStock.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
      <html><head>
        <title>Warehouse Available Stock - ${today}</title>
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
        <h2 style="margin-bottom: 5px;">Warehouse Available Stock Report</h2>
        <p style="font-size: 14px; color: #555;">Generated on: ${today}</p>
        
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th style="text-align:center;">Unit</th>
              <th style="text-align:right;">Available Stock</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? rows : '<tr><td colspan="3" style="text-align:center;padding:20px;font-style:italic;">No stock data available.</td></tr>'}
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
  },

  shareStock(method) {
    const overview = Store.Inventory.getOverview();
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    
    let text = `*KSS Warehouse Stock Report (${today})*\n\n`;
    let count = 0;
    overview.forEach(o => {
      if (o.warehouseStock !== 0) {
        text += `• ${o.material.name}: ${o.warehouseStock.toLocaleString('en-IN')} ${o.material.unit}\n`;
        count++;
      }
    });
    if (count === 0) {
      text += "All warehouse stocks are currently 0.\n";
    }
    
    const encoded = encodeURIComponent(text);
    if (method === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    } else if (method === 'sms') {
      window.open(`sms:?body=${encoded}`, '_blank');
    }
  }
};

