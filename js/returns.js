/* ============================================
   BuildMate Warehouse Page
   ============================================ */

var ReturnsPage = {
  render() {
    const materials = Store.Materials.getAll();
    const sites = Store.Sites.getAll().filter(s => s.status !== 'Archived');
    const returns = Store.SiteReturns.getAll();

    // Group returns by Site
    const siteReturnsGrouped = {};
    returns.forEach(r => {
      const siteId = r.siteId;
      const site = Store.Sites.getById(siteId);
      if (!site || site.status === 'Archived') return;

      const mat = materials.find(m => m.id === r.materialId);
      if (!mat) return;

      if (!siteReturnsGrouped[siteId]) {
        siteReturnsGrouped[siteId] = {
          siteName: site.name,
          tokenNumber: site.tokenNumber,
          customerName: site.customerName,
          items: {}
        };
      }

      if (!siteReturnsGrouped[siteId].items[r.materialId]) {
        siteReturnsGrouped[siteId].items[r.materialId] = 0;
      }
      siteReturnsGrouped[siteId].items[r.materialId] += (parseFloat(r.quantity) || 0);
    });

    // Calculate sum totals across all sites for each material
    const materialSumTotals = {};
    materials.forEach(m => {
      materialSumTotals[m.id] = 0;
    });
    returns.forEach(r => {
      const site = Store.Sites.getById(r.siteId);
      if (!site || site.status === 'Archived') return;

      if (materialSumTotals[r.materialId] !== undefined) {
        materialSumTotals[r.materialId] += (parseFloat(r.quantity) || 0);
      }
    });

    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Warehouse</h2>
          <p>Manually record and view materials returned from customer sites</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="ReturnsPage.openModal()">
            ${Icons.plus} Log Return
          </button>
        </div>
      </div>

      <!-- Grouped by Site display -->
      <div style="margin-bottom: 30px;">
        <h3 style="margin-bottom: 15px; font-size: 1.15rem; color: var(--text-primary);">Returns by Site</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px;">
          ${Object.keys(siteReturnsGrouped).length === 0 ? `
            <div class="card" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-tertiary);">
              No returned materials recorded yet.
            </div>
          ` : Object.keys(siteReturnsGrouped).map(siteId => {
            const group = siteReturnsGrouped[siteId];
            return `
              <div class="card">
                <div class="card-header" style="padding: 16px 20px; border-bottom: 1px solid var(--border-color);">
                  <h4 style="margin: 0; color: var(--text-primary); font-size: 1.05rem;">${group.siteName}</h4>
                  <span class="text-xs text-tertiary">Token: ${group.tokenNumber || '-'} | Customer: ${group.customerName || '-'}</span>
                </div>
                <div class="card-body" style="padding: 16px 20px;">
                  <table class="inline-table w-100" style="margin: 0;">
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th style="text-align: right; width: 35%;">Returned Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${Object.keys(group.items).map(matId => {
                        const mat = materials.find(m => m.id === matId);
                        const qty = group.items[matId];
                        if (qty <= 0) return '';
                        return `
                          <tr>
                            <td>
                              <div style="font-weight: 500;">${mat ? mat.name : 'Unknown'}</div>
                              <div style="font-size: 0.75rem; color: var(--text-tertiary);">${mat ? mat.sku : ''}</div>
                            </td>
                            <td style="text-align: right; font-weight: 600; color: var(--danger);">${qty.toLocaleString('en-IN')} ${mat ? mat.unit : ''}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Sum total across all sites -->
      <div class="card" style="margin-top: 30px;">
        <div class="card-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
          <h3 style="margin: 0; color: var(--text-primary); font-size: 1.15rem;">Total Returned Materials (Across All Sites)</h3>
          <p class="text-sm text-tertiary" style="margin-top: 4px;">Sum total of all materials received back from all active sites</p>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Material Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th style="text-align: right; width: 30%;">Total Returned Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${materials.map((m, idx) => {
                const totalQty = materialSumTotals[m.id] || 0;
                return `
                  <tr>
                    <td class="secondary">${idx + 1}</td>
                    <td><strong>${m.name}</strong></td>
                    <td>${m.sku || '-'}</td>
                    <td><span class="badge badge-neutral">${m.category || '-'}</span></td>
                    <td style="text-align: right; font-weight: 700; font-size: 1rem; color: var(--danger);">${totalQty.toLocaleString('en-IN')} ${m.unit}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Log Site Return Modal -->
      <div class="modal-backdrop" id="manual-return-modal">
        <div class="modal" style="max-width: 560px;">
          <div class="modal-header">
            <h3>Log Return</h3>
            <button class="modal-close" onclick="ReturnsPage.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Select Site *</label>
                <select class="form-control" id="manual-return-site" required>
                  <option value="">Choose a site...</option>
                  ${sites.map(s => `<option value="${s.id}">${s.name} (${s.customerName || 'Unknown'})</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Date *</label>
                <input type="date" class="form-control" id="manual-return-date" value="${new Date().toISOString().split('T')[0]}" required>
              </div>
            </div>
            <div style="max-height: 300px; overflow-y: auto; margin-top: 15px; border: 1px solid var(--border-color); border-radius: 6px;">
              <table class="inline-table w-100">
                <thead>
                  <tr>
                    <th style="width: 65%;">Material</th>
                    <th style="width: 35%; color: var(--danger);">Qty Returned</th>
                  </tr>
                </thead>
                <tbody>
                  ${materials.map(m => `
                    <tr>
                      <td>
                        <div style="font-weight: 600; font-size: 0.9rem;">${m.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary);">${m.unit}${m.sku ? ' &bull; ' + m.sku : ''}</div>
                      </td>
                      <td>
                        <input
                          type="number"
                          class="form-control"
                          placeholder="0"
                          min="0"
                          step="1"
                          data-material-id="${m.id}"
                          oninput="this.value = this.value.replace(/[^0-9.]/g, '')"
                        >
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="ReturnsPage.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="ReturnsPage.save()">Save Return</button>
          </div>
        </div>
      </div>
    `;
  },

  init() {},

  refresh() {
    const container = document.getElementById('page-container');
    if (container && window.location.hash === '#site-returns') {
      container.innerHTML = this.render();
      this.init();
    }
  },

  openModal() {
    const modal = document.getElementById('manual-return-modal');
    if (modal) {
      modal.classList.add('active');
      document.getElementById('manual-return-site').value = '';
      modal.querySelectorAll('input[type="number"]').forEach(input => input.value = '');
    }
  },

  closeModal() {
    const modal = document.getElementById('manual-return-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  save() {
    const siteId = document.getElementById('manual-return-site').value;
    const date = document.getElementById('manual-return-date').value;

    if (!siteId) {
      alert('Please select a site.');
      return;
    }
    if (!date) {
      alert('Please select a date.');
      return;
    }

    const modal = document.getElementById('manual-return-modal');
    const inputs = modal.querySelectorAll('input[data-material-id]');
    let savedCount = 0;

    inputs.forEach(input => {
      const qty = parseFloat(input.value) || 0;
      if (qty > 0) {
        Store.SiteReturns.add({
          siteId: siteId,
          materialId: input.getAttribute('data-material-id'),
          quantity: qty,
          date: date
        });
        savedCount++;
      }
    });

    if (savedCount === 0) {
      alert('Please enter a quantity for at least one material.');
      return;
    }

    this.closeModal();
    this.refresh();
  }
};
