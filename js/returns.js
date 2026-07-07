/* ============================================
   BuildMate Update Stock & Returns Page
   ============================================ */

var ReturnsPage = {
  render() {
    const materials = Store.Materials.getAll();
    const selectedDate = this.selectedDate || new Date().toISOString().split('T')[0];

    // Get historical warehouse stock for each material as of selected date
    const availableMap = {};
    materials.forEach(m => {
      availableMap[m.id] = Store.Inventory.getWarehouseBalanceOn(m.id, selectedDate);
    });

    const allReturns = Store.SiteReturns.getAll();
    const returnsMap = {};
    allReturns.forEach(r => {
      if (!returnsMap[r.materialId]) returnsMap[r.materialId] = 0;
      returnsMap[r.materialId] += parseFloat(r.quantity || 0);
    });

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
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-danger" onclick="ReturnsPage.resetStock()" style="display:inline-flex;align-items:center;gap:6px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">
            ${Icons.trash || ''} Reset Stock
          </button>
          <button class="btn btn-outline" onclick="ReturnsPage.exportPDF()" style="display:inline-flex;align-items:center;gap:6px;">
            ${Icons.fileText || ''} Export PDF
          </button>
        </div>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-body" style="padding: 20px;">
          <div class="form-row">
            <div class="form-group" style="max-width: 250px; margin: 0;">
              <label style="font-weight: 600; color: var(--text-secondary);">Date of Adjustment</label>
              <input type="date" class="form-control" id="stock-date" value="${selectedDate}" onchange="ReturnsPage.onDateChange(this.value)" style="background: var(--bg-body);">
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); overflow: hidden;">
        <div class="table-container" style="max-height: 65vh; overflow-y: auto;">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead style="position: sticky; top: 0; background: var(--bg-card); z-index: 10; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <tr>
                <th style="padding: 16px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid var(--border-color);">MATERIAL</th>
                <th style="padding: 16px; font-weight: 600; color: var(--success); border-bottom: 2px solid var(--border-color); width: 35%;">ADJUST STOCK</th>
                <th style="padding: 16px; font-weight: 600; color: var(--text-primary); border-bottom: 2px solid var(--border-color); width: 25%;">AVAILABLE STOCK</th>
              </tr>
            </thead>
            <tbody>
               ${materials.map(m => {
                const currentStock = availableMap[m.id] || 0;
                return `
                  <tr data-mat-id="${m.id}" data-current-stock="${currentStock}" style="border-bottom: 1px solid var(--border-color); transition: background-color 0.2s;">
                    <td style="padding: 16px;">
                      <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">${m.name}</div>
                      <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">${m.sku || '-'}</div>
                    </td>
                    <td style="padding: 16px;">
                      <div style="display: flex; gap: 8px; align-items: center;">
                        <select class="form-control adj-action-select" onchange="ReturnsPage.calculateRow(this)" style="max-width: 110px; font-weight: 600; background: var(--bg-body); height: 38px;">
                          <option value="add" style="color: var(--success);">Add (+)</option>
                          <option value="deduct" style="color: var(--danger);">Deduct (-)</option>
                        </select>
                        <input type="number" class="form-control new-stock-input" min="0" placeholder="0" oninput="ReturnsPage.calculateRow(this)" style="max-width: 110px; font-weight: 600; background: var(--bg-body); height: 38px;">
                      </div>
                    </td>
                    <td style="padding: 16px;">
                      <div class="new-available-cell" data-unit="${m.unit}" style="font-weight: 700; font-size: 1.15rem; color: var(--text-primary); background: var(--bg-body); padding: 8px 12px; border-radius: 8px; display: inline-block; min-width: 100px; text-align: center;">
                        ${currentStock.toLocaleString('en-IN')} <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-tertiary);">${m.unit}</span>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="card-footer" style="padding: 20px; display: flex; justify-content: flex-end; background: var(--bg-card); border-top: 1px solid var(--border-color);">
            <button class="btn btn-primary" onclick="ReturnsPage.saveAll()" style="font-size: 1.1rem; padding: 12px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">
              ${Icons.save || Icons.check} Save Stock Changes
            </button>
        </div>
      </div>
    `;
  },

  onDateChange(val) {
    this.selectedDate = val;
    this.refresh();
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
    const currentStock = parseFloat(tr.getAttribute('data-current-stock')) || 0;
    const action = tr.querySelector('.adj-action-select').value;
    const inputVal = parseFloat(tr.querySelector('.new-stock-input').value) || 0;
    
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
    const rows = document.querySelectorAll('tr[data-mat-id]');
    
    let hasError = false;
    let updates = [];
    
    rows.forEach(tr => {
      const matId = tr.getAttribute('data-mat-id');
      const action = tr.querySelector('.adj-action-select').value;
      const qty = parseFloat(tr.querySelector('.new-stock-input').value) || 0;
      const currentStock = parseFloat(tr.getAttribute('data-current-stock')) || 0;
      
      if (qty <= 0) return;
      
      if (action === 'deduct' && qty > currentStock) {
        alert(`Cannot deduct more than available stock for ${tr.querySelector('strong').innerText}`);
        hasError = true;
        return;
      }
      
      updates.push({ matId, action, qty });
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
      const material = Store.Materials.getById(u.matId);
      const isDeduct = u.action === 'deduct';
      const actualQty = isDeduct ? -u.qty : u.qty;
      
      Store.Incoming.add({
        date: date,
        vendorName: isDeduct ? 'Manual Stock Deduction' : 'User Input (Manual Add)',
        referenceNo: 'Stock Update',
        destinationType: 'warehouse',
        destinationSiteId: '',
        items: [{
          materialId: u.matId,
          quantity: actualQty,
          rate: material ? material.unitPrice : 0,
          amount: actualQty * (material ? material.unitPrice : 0)
        }],
        notes: isDeduct ? 'Deducted manually from Update Stock page' : 'Manually added from Update Stock page'
      });
      
      Store.logTransaction(u.matId, u.qty, isDeduct ? 'Deduct' : 'Add');
    });
    
    alert("Stock updated successfully!");
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
  }
};
