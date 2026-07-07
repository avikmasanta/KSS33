/* ============================================
   BuildMate Update Stock & Returns Page
   ============================================ */

var ReturnsPage = {
  render() {
    const materials = Store.Materials.getAll();
    const sites = Store.Sites.getAll().filter(s => s.status !== 'Archived');

    // Get current available for each material
    const overview = Store.Inventory.getOverview();
    const availableMap = {};
    overview.forEach(o => {
      availableMap[o.material.id] = o.warehouseStock;
    });

    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Update Stock & Returns</h2>
          <p>Add new stock or log returns from a site in one simple list</p>
        </div>
      </div>

      <div class="card" style="margin-bottom: 20px;">
        <div class="card-body" style="padding: 20px;">
          <div class="form-row">
            <div class="form-group" style="max-width: 400px;">
              <label>Select Site (For Returns)</label>
              <select class="form-control" id="stock-site-select" onchange="ReturnsPage.onSiteChange()">
                <option value="">-- Select a Site --</option>
                ${sites.map(s => `<option value="${s.id}">${s.name} (${s.customerName || 'Unknown'})</option>`).join('')}
              </select>
              <small class="text-tertiary" style="display:block; margin-top:5px;" id="site-selected-text">No site selected.</small>
            </div>
            <div class="form-group" style="max-width: 200px;">
              <label>Date</label>
              <input type="date" class="form-control" id="stock-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="table-container" style="max-height: 60vh; overflow-y: auto;">
          <table class="data-table">
            <thead style="position: sticky; top: 0; background: var(--bg-card); z-index: 10;">
              <tr>
                <th>Material</th>
                <th style="width: 15%;">Current Available</th>
                <th style="width: 18%; color: var(--success);">Add New Stock</th>
                <th style="width: 18%; color: var(--danger);">Return from Site</th>
                <th style="width: 15%;">New Available</th>
              </tr>
            </thead>
            <tbody>
              ${materials.map(m => {
                const currentStock = availableMap[m.id] || 0;
                return `
                  <tr data-mat-id="${m.id}" data-current="${currentStock}">
                    <td>
                      <div style="font-weight: 500;">${m.name}</div>
                      <div style="font-size: 0.75rem; color: var(--text-tertiary);">${m.sku || '-'}</div>
                    </td>
                    <td style="font-weight: 600; font-size: 1.05rem;">${currentStock.toLocaleString('en-IN')} ${m.unit}</td>
                    <td>
                      <input type="number" class="form-control new-stock-input" min="0" placeholder="0" oninput="ReturnsPage.calculateRow(this)">
                    </td>
                    <td>
                      <input type="number" class="form-control return-stock-input" min="0" placeholder="0" style="color: var(--danger); font-weight: 600;" oninput="ReturnsPage.calculateRow(this)">
                    </td>
                    <td class="new-available-cell" style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">
                      ${currentStock.toLocaleString('en-IN')} ${m.unit}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="card-footer" style="padding: 20px; display: flex; justify-content: flex-end; background: var(--bg-body); border-top: 1px solid var(--border-color);">
           <button class="btn btn-primary" onclick="ReturnsPage.saveAll()" style="font-size: 1.1rem; padding: 10px 24px;">
             ${Icons.save || Icons.check} Save Updates
           </button>
        </div>
      </div>
    `;
  },

  init() {
    this.onSiteChange();
  },

  refresh() {
    const container = document.getElementById('page-container');
    if (container && window.location.hash === '#site-returns') {
      container.innerHTML = this.render();
      this.init();
    }
  },

  onSiteChange() {
    const siteSelect = document.getElementById('stock-site-select');
    const textEl = document.getElementById('site-selected-text');
    if (siteSelect && siteSelect.value) {
      const siteName = siteSelect.options[siteSelect.selectedIndex].text;
      textEl.innerHTML = `<span style="color: var(--danger); font-weight: 500;">Returned from: ${siteName}</span>`;
    } else {
      textEl.innerHTML = `No site selected. Returns will be disabled.`;
    }
  },

  calculateRow(inputEl) {
    const tr = inputEl.closest('tr');
    const current = parseFloat(tr.getAttribute('data-current')) || 0;
    
    const newStock = parseFloat(tr.querySelector('.new-stock-input').value) || 0;
    const returnStock = parseFloat(tr.querySelector('.return-stock-input').value) || 0;
    
    const newAvailable = current + newStock + returnStock;
    
    const cell = tr.querySelector('.new-available-cell');
    const materialUnit = tr.querySelector('td:nth-child(2)').innerText.split(' ')[1] || '';
    
    cell.innerText = newAvailable.toLocaleString('en-IN') + ' ' + materialUnit;
    if (newStock > 0 || returnStock > 0) {
      cell.style.color = 'var(--success)';
    } else {
      cell.style.color = 'var(--text-primary)';
    }
  },

  saveAll() {
    const siteId = document.getElementById('stock-site-select').value;
    const date = document.getElementById('stock-date').value;
    
    const rows = document.querySelectorAll('tr[data-mat-id]');
    let newStockItems = [];
    let returnItems = [];
    
    rows.forEach(tr => {
      const matId = tr.getAttribute('data-mat-id');
      const newStock = parseFloat(tr.querySelector('.new-stock-input').value) || 0;
      const returnStock = parseFloat(tr.querySelector('.return-stock-input').value) || 0;
      
      if (newStock > 0) {
        newStockItems.push({ materialId: matId, quantity: newStock });
      }
      if (returnStock > 0) {
        returnItems.push({ materialId: matId, quantity: returnStock });
      }
    });
    
    if (newStockItems.length === 0 && returnItems.length === 0) {
      alert("Please enter at least one quantity to save.");
      return;
    }
    
    if (returnItems.length > 0 && !siteId) {
      alert("You have entered return quantities, but no site is selected. Please select a site.");
      return;
    }
    
    // Save New Stock
    if (newStockItems.length > 0) {
      Store.Incoming.add({
        date: date,
        supplier: 'User Input (Manual Add)',
        reference: 'Stock Update',
        destinationType: 'warehouse',
        destinationId: '',
        items: newStockItems,
        notes: 'Manually added from Update Stock page'
      });
    }
    
    // Save Returns
    if (returnItems.length > 0) {
      returnItems.forEach(item => {
        Store.SiteReturns.add({
          siteId: siteId,
          materialId: item.materialId,
          quantity: item.quantity,
          date: date
        });
      });
    }
    
    alert("Stock updated successfully!");
    
    // Clear inputs
    rows.forEach(tr => {
      tr.querySelector('.new-stock-input').value = '';
      tr.querySelector('.return-stock-input').value = '';
    });
    document.getElementById('stock-site-select').value = '';
    
    this.refresh();
  }
};
