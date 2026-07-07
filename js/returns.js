/* ============================================
   BuildMate Update Stock & Returns Page
   ============================================ */

var ReturnsPage = {
  render() {
    const materials = Store.Materials.getAll();

    // Get current available and total returns for each material
    const overview = Store.Inventory.getOverview();
    const availableMap = {};
    overview.forEach(o => {
      availableMap[o.material.id] = o.warehouseStock;
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
            <h2 style="margin: 0; font-size: 1.5rem; color: var(--text-primary);">Add New Stock</h2>
            <p style="margin: 4px 0 0 0; color: var(--text-tertiary);">Record incoming materials from suppliers</p>
          </div>
        </div>
        <div>
          <button class="btn btn-outline" onclick="ReturnsPage.exportPDF()" style="display:inline-flex;align-items:center;gap:6px;">
            ${Icons.fileText || ''} Export PDF
          </button>
        </div>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-body" style="padding: 20px;">
          <div class="form-row">
            <div class="form-group" style="max-width: 250px; margin: 0;">
              <label style="font-weight: 600; color: var(--text-secondary);">Date of Receipt</label>
              <input type="date" class="form-control" id="stock-date" value="${new Date().toISOString().split('T')[0]}" style="background: var(--bg-body);">
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
                <th style="padding: 16px; font-weight: 600; color: var(--success); border-bottom: 2px solid var(--border-color); width: 20%;">ADD NEW STOCK</th>
                <th style="padding: 16px; font-weight: 600; color: var(--danger); border-bottom: 2px solid var(--border-color); width: 20%;">RETURNED FROM SITES</th>
                <th style="padding: 16px; font-weight: 600; color: var(--text-primary); border-bottom: 2px solid var(--border-color); width: 20%;">AVAILABLE STOCK</th>
              </tr>
            </thead>
            <tbody>
               ${materials.map(m => {
                const totalReturned = returnsMap[m.id] || 0;
                const currentStock = availableMap[m.id] || 0;
                return `
                  <tr data-mat-id="${m.id}" data-returned="${totalReturned}" data-current-stock="${currentStock}" style="border-bottom: 1px solid var(--border-color); transition: background-color 0.2s;">
                    <td style="padding: 16px;">
                      <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">${m.name}</div>
                      <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">${m.sku || '-'}</div>
                    </td>
                    <td style="padding: 16px;">
                      <input type="number" class="form-control new-stock-input" min="0" placeholder="0" oninput="ReturnsPage.calculateRow(this)" style="max-width: 150px; font-weight: 600; font-size: 1.05rem; background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.2); color: var(--success);">
                    </td>
                    <td style="padding: 16px;">
                      <div style="font-weight: 600; font-size: 1.05rem; color: var(--danger); display: flex; align-items: center; gap: 8px;">
                        ${totalReturned > 0 ? Icons.arrowDownCircle : ''}
                        ${totalReturned.toLocaleString('en-IN')} <span style="font-size: 0.85rem; opacity: 0.8;">${m.unit}</span>
                      </div>
                    </td>
                    <td style="padding: 16px;">
                      <div class="new-available-cell" style="font-weight: 700; font-size: 1.15rem; color: var(--text-primary); background: var(--bg-body); padding: 8px 12px; border-radius: 8px; display: inline-block; min-width: 100px; text-align: center;">
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
             ${Icons.save || Icons.check} Save New Stock
           </button>
        </div>
      </div>
    `;
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

  calculateRow(inputEl) {
    const tr = inputEl.closest('tr');
    const currentStock = parseFloat(tr.getAttribute('data-current-stock')) || 0;
    const newStock = parseFloat(inputEl.value) || 0;
    
    const newAvailable = currentStock + newStock;
    const materialUnit = tr.querySelector('.new-available-cell span').innerText || '';
    
    const cell = tr.querySelector('.new-available-cell');
    
    cell.innerHTML = `${newAvailable.toLocaleString('en-IN')} <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-tertiary);">${materialUnit}</span>`;
    
    if (newStock > 0) {
      cell.style.background = 'rgba(16, 185, 129, 0.1)';
      cell.style.color = 'var(--success)';
    } else {
      cell.style.background = 'var(--bg-body)';
      cell.style.color = 'var(--text-primary)';
    }
  },

  saveAll() {
    const date = document.getElementById('stock-date').value;
    const rows = document.querySelectorAll('tr[data-mat-id]');
    let newStockItems = [];
    
    rows.forEach(tr => {
      const matId = tr.getAttribute('data-mat-id');
      const newStock = parseFloat(tr.querySelector('.new-stock-input').value) || 0;
      
      if (newStock > 0) {
        newStockItems.push({ materialId: matId, quantity: newStock });
      }
    });
    
    if (newStockItems.length === 0) {
      alert("Please enter at least one quantity to save new stock.");
      return;
    }
    
    Store.Incoming.add({
      date: date,
      vendorName: 'User Input (Manual Add)',
      referenceNo: 'Stock Update',
      destinationType: 'warehouse',
      destinationSiteId: '',
      items: newStockItems,
      notes: 'Manually added from Update Stock page'
    });
    
    alert("New stock added successfully!");
    this.refresh();
  },

  exportPDF() {
    const materials = Store.Materials.getAll();
    const allReturns = Store.SiteReturns.getAll();
    const returnsMap = {};
    allReturns.forEach(r => {
      if (!returnsMap[r.materialId]) returnsMap[r.materialId] = 0;
      returnsMap[r.materialId] += parseFloat(r.quantity || 0);
    });
    
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    
    const rows = materials.map(m => {
      const totalReturned = returnsMap[m.id] || 0;
      return `
        <tr>
          <td style="border:1px solid #333;padding:8px;">${m.name}<br><span style="font-size:10px;color:#555;">${m.sku || ''}</span></td>
          <td style="border:1px solid #333;padding:8px;text-align:center;">${m.unit}</td>
          <td style="border:1px solid #333;padding:8px;text-align:right;">${totalReturned.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
      <html><head>
        <title>New Stock Entry & Returns - ${today}</title>
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
        <h2 style="margin-bottom: 5px;">Warehouse Material Returns & Entry</h2>
        <p style="font-size: 14px; color: #555;">Generated on: ${today}</p>
        
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th style="text-align:center;">Unit</th>
              <th style="text-align:right;">Total Returned From Sites</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? rows : '<tr><td colspan="3" style="text-align:center;padding:20px;font-style:italic;">No materials found.</td></tr>'}
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
