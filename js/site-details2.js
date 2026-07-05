/* ============================================
   KSS33 Site Details Page
   ============================================ */

var SiteDetailsPage = {
  siteId: null,

  render() {
    if (!this.siteId) {
      return `
        <div class="empty-state">
          <h3>No Site Selected</h3>
          <p>Please select a site from the Sites page.</p>
          <button class="btn btn-primary mt-2" onclick="App.navigate('sites')">Go to Sites</button>
        </div>
      `;
    }

    const site = Store.Sites.getById(this.siteId);
    if (!site) {
      return `
        <div class="empty-state">
          <h3>Site Not Found</h3>
          <p>The selected site does not exist or has been deleted.</p>
          <button class="btn btn-primary mt-2" onclick="App.navigate('sites')">Go to Sites</button>
        </div>
      `;
    }

    // For the return material dropdown, get materials currently at site
    const materials = Store.Materials.getAll();

    return `
      <div class="page-header" style="margin-bottom: 24px;">
        <div class="page-header-title">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <button class="btn btn-icon btn-ghost" onclick="App.navigate('sites')" title="Back to Sites" style="margin-left: -10px;">
              ${Icons.arrowLeft}
            </button>
            <h2 style="margin: 0;">${site.name}</h2>
            <span class="badge ${site.status === 'Active' ? 'badge-success' : site.status === 'Completed' ? 'badge-info' : 'badge-warning'}">${site.status}</span>
          </div>
          <p style="margin-top: 4px; color: var(--text-secondary);">Customer: <strong>${site.customerName || '-'}</strong> | Location: ${site.address || '-'}</p>
        </div>
        <div class="page-header-actions" style="display: flex; gap: 10px;">
          ${site.status !== 'Completed'
        ? `<button class="btn btn-secondary" onclick="SiteDetailsPage.openDispatchModal()">${Icons.arrowUpCircle} Log Dispatch</button>
               <button class="btn btn-primary" onclick="SiteDetailsPage.openReturnModal()">${Icons.arrowDownCircle} Log Return</button>
               <button class="btn btn-warning" onclick="SiteDetailsPage.openUsageModal()">${Icons.activity} Log Usage</button>
               <button class="btn btn-success" onclick="SiteDetailsPage.markCompleted()">${Icons.check} Mark Completed</button>`
        : `<button class="btn btn-warning" onclick="SiteDetailsPage.markActive()">${Icons.refreshCw} Reopen Site</button>`}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 24px;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border-radius: 16px; padding: 30px; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3); position: relative; overflow: hidden; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
          <div style="position: absolute; right: 10px; top: 10px; opacity: 0.15; transform: scale(4); pointer-events: none; font-size: 32px; font-weight: 800;">
            ₹
          </div>
          <h3 style="margin:0 0 10px 0; font-size: 1.1rem; font-weight: 600; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
            <div style="width: 20px; height: 20px; font-weight: bold; font-size: 1.2rem; text-align: center; display: flex; align-items: center; justify-content: center;">₹</div> Site Budget
          </h3>
          <div style="font-size: 3.5rem; font-weight: 800; letter-spacing: -1px; margin-bottom: 5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);" id="site-total-budget">
            ₹${(site.budget || 0).toLocaleString('en-IN')}
          </div>
          <div style="font-size: 0.95rem; font-weight: 500; color: rgba(255,255,255,0.85); display: flex; align-items: center; gap: 6px;">
            <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">FINANCE</span>
            Allocated budget for this site
          </div>
        </div>

        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border-radius: 16px; padding: 30px; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3); position: relative; overflow: hidden; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
          <div style="position: absolute; right: -10px; top: 10px; opacity: 0.15; transform: scale(4); pointer-events: none;">
            ${Icons.arrowDownCircle}
          </div>
          <h3 style="margin:0 0 10px 0; font-size: 1.1rem; font-weight: 600; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
            <div style="width: 20px; height: 20px;">${Icons.arrowDownCircle}</div> Total Received
          </h3>
          <div style="font-size: 3.5rem; font-weight: 800; letter-spacing: -2px; margin-bottom: 5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);" id="site-total-dispatched">
            0
          </div>
          <div style="font-size: 0.95rem; font-weight: 500; color: rgba(255,255,255,0.85); display: flex; align-items: center; gap: 6px;">
            <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">INCOMING</span>
            Total material received at this site
          </div>
        </div>

        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border-radius: 16px; padding: 30px; box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.3); position: relative; overflow: hidden; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
          <div style="position: absolute; right: -10px; top: 10px; opacity: 0.15; transform: scale(4); pointer-events: none;">
            ${Icons.arrowUpCircle}
          </div>
          <h3 style="margin:0 0 10px 0; font-size: 1.1rem; font-weight: 600; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
            <div style="width: 20px; height: 20px;">${Icons.arrowUpCircle}</div> Total Returned
          </h3>
          <div style="font-size: 3.5rem; font-weight: 800; letter-spacing: -2px; margin-bottom: 5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);" id="site-total-returned">
            0
          </div>
          <div style="font-size: 0.95rem; font-weight: 500; color: rgba(255,255,255,0.85); display: flex; align-items: center; gap: 6px;">
            <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">OUTGOING</span>
            Total material returned from this site
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
          <h3 style="font-size: 1.1rem; color: #0f172a;">Stock Movements</h3>
        </div>
        <div>
          ${this.renderStockMovements(site)}
        </div>
      </div>
      
      <!-- Dispatch Material Modal -->
      <div class="modal-backdrop" id="site-dispatch-modal">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Log Material Dispatch</h3>
            <button class="modal-close" onclick="SiteDetailsPage.closeDispatchModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Material</label>
              <select class="form-control" id="site-dispatch-material">
                <option value="">Select material to dispatch...</option>
                ${materials.map(m => {
          const warehouseStock = Store.Inventory.getWarehouseCurrentBalance(m.id);
          return `<option value="${m.id}">${m.name} (Warehouse: ${warehouseStock})</option>`;
        }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Quantity Dispatched</label>
              <input type="number" class="form-control" id="site-dispatch-qty" placeholder="Quantity" min="1">
            </div>
            <div class="form-group">
              <label>Date</label>
              <input type="date" class="form-control" id="site-dispatch-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="SiteDetailsPage.closeDispatchModal()">Cancel</button>
            <button class="btn btn-secondary" onclick="SiteDetailsPage.saveDispatch()">Save Dispatch</button>
          </div>
        </div>
      </div>

      <!-- Return Material Modal -->
      <div class="modal-backdrop" id="site-return-modal">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Log Material Return</h3>
            <button class="modal-close" onclick="SiteDetailsPage.closeReturnModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Material</label>
              <select class="form-control" id="site-return-material">
                <option value="">Select material to return...</option>
                ${materials.map(m => {
          const siteStock = Store.Inventory.getSiteCurrentBalance(m.id, site.id);
          if (siteStock > 0) {
            const totalSent = Store.Inventory.getSiteTotalSent(m.id, site.id);
            return `<option value="${m.id}">${m.name} (At site: ${siteStock} | Total Dispatched: ${totalSent})</option>`;
          }
          return '';
        }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Quantity Returned</label>
              <input type="number" class="form-control" id="site-return-qty" placeholder="Quantity" min="1">
            </div>
            <div class="form-group">
              <label>Date</label>
              <input type="date" class="form-control" id="site-return-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="SiteDetailsPage.closeReturnModal()">Cancel</button>
            <button class="btn btn-primary" onclick="SiteDetailsPage.saveReturn()">Save Return</button>
          </div>
        </div>
      </div>

      <!-- Usage Material Modal -->
      <div class="modal-backdrop" id="site-usage-modal">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Log Material Usage</h3>
            <button class="modal-close" onclick="SiteDetailsPage.closeUsageModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Material</label>
              <select class="form-control" id="site-usage-material">
                <option value="">Select material used...</option>
                ${materials.map(m => {
          const siteStock = Store.Inventory.getSiteCurrentBalance(m.id, site.id);
          if (siteStock > 0) {
            return `<option value="${m.id}">${m.name} (At site: ${siteStock})</option>`;
          }
          return '';
        }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Quantity Used</label>
              <input type="number" class="form-control" id="site-usage-qty" placeholder="Quantity" min="1">
            </div>
            <div class="form-group">
              <label>Date</label>
              <input type="date" class="form-control" id="site-usage-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label>Notes (Optional)</label>
              <input type="text" class="form-control" id="site-usage-notes" placeholder="Where was this used?">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="SiteDetailsPage.closeUsageModal()">Cancel</button>
            <button class="btn btn-warning" onclick="SiteDetailsPage.saveUsage()">Save Usage</button>
          </div>
        </div>
      </div>
    `;
  },

  init() { },

  renderStockMovements(site) {
    const materials = Store.Materials.getAll();
    const allOutgoing = Store.Outgoing.getAll().filter(r => r.siteId === site.id);
    const allIncomingDirect = Store.Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id);
    const siteReturns = Store.SiteReturns.getAll().filter(r => r.siteId === site.id);
    const siteUsage = Store.SiteUsage.getAll().filter(r => r.siteId === site.id);

    const rows = [];
    let totalDispatched = 0;
    let totalReturned = 0;
    let totalUsed = 0;

    // Outgoing from warehouse to site (Dispatched)
    allOutgoing.forEach(record => {
      record.items.forEach(item => {
        const mat = materials.find(m => m.id === item.materialId);
        const qty = parseFloat(item.quantity) || 0;
        totalDispatched += qty;
        rows.push({
          date: record.date,
          type: 'Incoming',
          material: mat ? mat.name : '-',
          unit: mat ? mat.unit : '',
          qty: qty,
          ref: record.referenceNo || '-',
          note: record.notes || '-'
        });
      });
    });

    // Incoming direct to site (Dispatched)
    allIncomingDirect.forEach(record => {
      record.items.forEach(item => {
        const mat = materials.find(m => m.id === item.materialId);
        const qty = parseFloat(item.quantity) || 0;
        totalDispatched += qty;
        rows.push({
          date: record.date,
          type: 'Incoming',
          material: mat ? mat.name : '-',
          unit: mat ? mat.unit : '',
          qty: qty,
          ref: record.referenceNo || record.invoiceNo || '-',
          note: record.notes || 'Direct from supplier'
        });
      });
    });

    // Site Returns (Returned)
    siteReturns.forEach(record => {
      const mat = materials.find(m => m.id === record.materialId);
      const qty = parseFloat(record.quantity) || 0;
      totalReturned += qty;
      rows.push({
        date: record.date,
        type: 'Outgoing',
        material: mat ? mat.name : '-',
        unit: mat ? mat.unit : '',
        qty: qty,
        ref: 'SITE-RETURN',
        note: 'Returned from site'
      });
    });

    // Site Usage (Consumed)
    siteUsage.forEach(record => {
      const mat = materials.find(m => m.id === record.materialId);
      const qty = parseFloat(record.quantity) || 0;
      totalUsed += qty;
      rows.push({
        date: record.date,
        type: 'Usage',
        material: mat ? mat.name : '-',
        unit: mat ? mat.unit : '',
        qty: qty,
        ref: 'SITE-USAGE',
        note: record.notes || 'Consumed at site'
      });
    });

    // Inject the totals into the DOM after a short tick
    setTimeout(() => {
      const elDisp = document.getElementById('site-total-dispatched');
      const elRet = document.getElementById('site-total-returned');
      const elUsed = document.getElementById('site-total-used');
      if (elDisp) elDisp.innerText = Number(totalDispatched).toLocaleString('en-IN');
      if (elRet) elRet.innerText = Number(totalReturned).toLocaleString('en-IN');
      if (elUsed) elUsed.innerText = Number(totalUsed).toLocaleString('en-IN');
    }, 10);

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (rows.length === 0) {
      return `
        <div class="empty-state" style="padding: 60px 20px; text-align: center; background: var(--surface); border-radius: 12px; border: 1px dashed var(--border);">
          <div style="color: var(--text-tertiary); margin-bottom: 16px; display: flex; justify-content: center;">
            <div style="width: 48px; height: 48px;">${Icons.box}</div>
          </div>
          <h4 style="color: var(--text-secondary); margin-bottom: 8px; font-size: 1.1rem;">No Movements Yet</h4>
          <p class="text-sm text-tertiary" style="max-width: 300px; margin: 0 auto;">There are no stock movements recorded for this site yet. Dispatch some materials to see them here.</p>
        </div>
      `;
    }

    let html = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 15px;">
    `;

    rows.forEach(r => {
      let color, bgColor, icon, sign, label;

      if (r.type === 'Outgoing') {
        color = 'var(--danger)'; bgColor = '#fee2e2'; icon = Icons.arrowUpCircle; sign = '-'; label = 'Returned from Site';
      } else if (r.type === 'Usage') {
        color = '#d97706'; bgColor = '#fef3c7'; icon = Icons.activity; sign = '-'; label = 'Used at Site';
      } else {
        color = 'var(--success)'; bgColor = '#dcfce7'; icon = Icons.arrowDownCircle; sign = '+'; label = 'Received at Site';
      }

      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: transform 0.2s; cursor: default;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background-color: ${bgColor}; color: ${color}; flex-shrink:0;">
              ${icon}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 4px;">${r.material}</div>
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <span class="badge" style="background-color: ${bgColor}; color: ${color}; font-size: 0.75rem;">${label}</span>
                <span class="text-sm text-tertiary">Ref: ${r.ref}</span>
              </div>
            </div>
          </div>
          <div style="text-align: right; min-width: 100px;">
            <div style="font-weight: 800; font-size: 1.25rem; color: ${color};">
              ${sign}${r.qty.toLocaleString('en-IN')} <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-secondary);">${r.unit}</span>
            </div>
            <div class="text-sm text-tertiary" style="margin-top: 4px; display: flex; align-items: center; gap: 4px; justify-content: flex-end;">
              ${Icons.calendar} ${new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      `;
    });

    html += `
      <!-- Site Status Confirm Modal -->
      <div class="modal-backdrop" id="site-status-confirm-modal">
        <div class="modal" style="max-width: 400px; padding: 24px; margin: auto;">
          <h3 id="site-status-confirm-title" style="margin-top: 0; margin-bottom: 16px; color: var(--text-primary); font-size: 1.25rem;">Confirm Action</h3>
          <p id="site-status-confirm-msg" style="margin-bottom: 24px; color: var(--text-secondary); line-height: 1.5;"></p>
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button class="btn btn-outline" onclick="SiteDetailsPage.closeStatusModal()">Cancel</button>
            <button class="btn btn-primary" onclick="SiteDetailsPage.confirmStatusChange()">Confirm</button>
          </div>
        </div>
      </div>
    </div>`;
    return html;
  },

  refresh() {
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = this.render();
      this.init();
    }
  },

  markCompleted() {
    SiteDetailsPage.pendingAction = 'complete';
    const modal = document.getElementById('site-status-confirm-modal');
    document.getElementById('site-status-confirm-title').textContent = 'Mark Site Completed';
    document.getElementById('site-status-confirm-msg').textContent = 'Are you sure you want to mark this site as Done?';
    modal.classList.add('active');
  },

  markActive() {
    SiteDetailsPage.pendingAction = 'active';
    const modal = document.getElementById('site-status-confirm-modal');
    document.getElementById('site-status-confirm-title').textContent = 'Reopen Site';
    document.getElementById('site-status-confirm-msg').textContent = 'Are you sure you want to reopen this site as Active?';
    modal.classList.add('active');
  },

  confirmStatusChange() {
    if (SiteDetailsPage.pendingAction === 'complete') {
      Store.Sites.update(this.siteId, { status: 'Completed' });
    } else if (SiteDetailsPage.pendingAction === 'active') {
      Store.Sites.update(this.siteId, { status: 'Active' });
    }
    this.closeStatusModal();
    this.refresh();
  },

  closeStatusModal() {
    document.getElementById('site-status-confirm-modal').classList.remove('active');
    SiteDetailsPage.pendingAction = null;
  },

  openDispatchModal() {
    const modal = document.getElementById('site-dispatch-modal');
    if (modal) modal.classList.add('active');
  },

  closeDispatchModal() {
    const modal = document.getElementById('site-dispatch-modal');
    if (modal) {
      modal.classList.remove('active');
      document.getElementById('site-dispatch-material').value = '';
      document.getElementById('site-dispatch-qty').value = '';
    }
  },

  saveDispatch() {
    const materialId = document.getElementById('site-dispatch-material').value;
    const qty = parseFloat(document.getElementById('site-dispatch-qty').value) || 0;
    const date = document.getElementById('site-dispatch-date').value;

    if (!materialId || qty <= 0 || !date) {
      alert('Please select a material, specify a valid quantity, and choose a date.');
      return;
    }

    const warehouseStock = Store.Inventory.getWarehouseCurrentBalance(materialId);
    if (qty > warehouseStock) {
      alert(`You cannot dispatch more than what is currently in the warehouse (${warehouseStock}).`);
      return;
    }

    Store.Outgoing.add({
      siteId: this.siteId,
      date: date,
      referenceNo: 'SITE-DISPATCH',
      notes: 'Dispatched from site dashboard',
      items: [{
        materialId: materialId,
        quantity: qty,
        rate: Store.Materials.getById(materialId)?.unitPrice || 0,
        amount: qty * (Store.Materials.getById(materialId)?.unitPrice || 0)
      }]
    });

    this.closeDispatchModal();
    this.refresh();
  },

  openReturnModal() {
    const modal = document.getElementById('site-return-modal');
    if (modal) modal.classList.add('active');
  },

  closeReturnModal() {
    const modal = document.getElementById('site-return-modal');
    if (modal) {
      modal.classList.remove('active');
      document.getElementById('site-return-material').value = '';
      document.getElementById('site-return-qty').value = '';
    }
  },

  saveReturn() {
    const materialId = document.getElementById('site-return-material').value;
    const qty = parseFloat(document.getElementById('site-return-qty').value) || 0;
    const date = document.getElementById('site-return-date').value;

    if (!materialId || qty <= 0 || !date) {
      alert('Please select a material, specify a valid quantity, and choose a date.');
      return;
    }

    const currentSiteBalance = Store.Inventory.getSiteCurrentBalance(materialId, this.siteId);
    if (qty > currentSiteBalance) {
      alert(`You cannot return more than what is currently at the site (${currentSiteBalance}).`);
      return;
    }

    Store.SiteReturns.add({
      siteId: this.siteId,
      materialId: materialId,
      quantity: qty,
      date: date
    });

    this.closeReturnModal();
    this.refresh();
  },

  openUsageModal() {
    const modal = document.getElementById('site-usage-modal');
    if (modal) modal.classList.add('active');
  },

  closeUsageModal() {
    const modal = document.getElementById('site-usage-modal');
    if (modal) {
      modal.classList.remove('active');
      document.getElementById('site-usage-material').value = '';
      document.getElementById('site-usage-qty').value = '';
      document.getElementById('site-usage-notes').value = '';
    }
  },

  saveUsage() {
    const materialId = document.getElementById('site-usage-material').value;
    const qty = parseFloat(document.getElementById('site-usage-qty').value) || 0;
    const date = document.getElementById('site-usage-date').value;
    const notes = document.getElementById('site-usage-notes').value.trim();

    if (!materialId || qty <= 0 || !date) {
      alert('Please select a material, specify a valid quantity, and choose a date.');
      return;
    }

    const currentSiteBalance = Store.Inventory.getSiteCurrentBalance(materialId, this.siteId);
    if (qty > currentSiteBalance) {
      alert(`You cannot use more than what is currently at the site (${currentSiteBalance}).`);
      return;
    }

    Store.SiteUsage.add({
      siteId: this.siteId,
      materialId: materialId,
      quantity: qty,
      date: date,
      notes: notes
    });

    this.closeUsageModal();
    this.refresh();
  }
};
