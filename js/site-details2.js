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
    const totalCollected = Store.SitePayments.getTotalBySite(site.id);
    const remainingBudget = (site.budget || 0) - totalCollected;

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
          <p style="margin-top: 4px; color: var(--text-secondary);">Site ID: <strong style="color:var(--primary); font-family: monospace;">${site.id}</strong> | Customer: <strong>${site.customerName || '-'}</strong> | Location: ${site.address || '-'}</p>
        </div>
        <div class="page-header-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${site.status !== 'Completed'
        ? `<button class="btn btn-secondary" onclick="SiteDetailsPage.openDispatchModal()">${Icons.arrowUpCircle} Log Dispatch</button>
               <button class="btn btn-primary" onclick="SiteDetailsPage.openReturnModal()">${Icons.arrowDownCircle} Log Return</button>
               <button class="btn btn-success" onclick="SiteDetailsPage.markCompleted()">${Icons.check} Mark Completed</button>`
        : `<button class="btn btn-warning" onclick="SiteDetailsPage.markActive()">${Icons.refreshCw} Reopen Site</button>`}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 24px;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border-radius: 16px; padding: 30px; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3); position: relative; overflow: hidden; transition: transform 0.2s; cursor: pointer;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'" onclick="SiteDetailsPage.openCollectModal()">
          <div style="position: absolute; right: 10px; top: 10px; opacity: 0.15; transform: scale(4); pointer-events: none; font-size: 32px; font-weight: 800;">
            ₹
          </div>
          <h3 style="margin:0 0 15px 0; font-size: 1.1rem; font-weight: 600; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
            <div style="width: 20px; height: 20px; font-weight: bold; font-size: 1.2rem; text-align: center; display: flex; align-items: center; justify-content: center;">₹</div> Payments
          </h3>
          <div style="background: rgba(0,0,0,0.15); border-radius: 10px; padding: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <span style="font-size: 0.85rem; color: rgba(255,255,255,0.9); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Site Budget</span>
            <span style="font-size: 1.25rem; font-weight: 800; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">₹${(site.budget || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; padding: 0 4px;">
            <div>
              <div style="font-size: 0.8rem; color: rgba(255,255,255,0.75); margin-bottom: 4px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Collected</div>
              <div style="font-size: 1.8rem; font-weight: 800; letter-spacing: -1px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); line-height: 1;">
                ₹${totalCollected.toLocaleString('en-IN')}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.8rem; color: rgba(255,255,255,0.75); margin-bottom: 4px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Remaining</div>
              <div style="font-size: 1.8rem; font-weight: 700; color: ${remainingBudget < 0 ? '#ffb3b3' : 'white'}; line-height: 1;">
                ₹${remainingBudget.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
          <div style="font-size: 0.95rem; font-weight: 500; color: rgba(255,255,255,0.9); display: flex; align-items: center; gap: 6px; padding: 0 4px;">
            <span style="background: rgba(255,255,255,0.25); padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">+ COLLECT</span>
            <span style="font-size: 0.85rem; opacity: 0.9;">Click to record payment</span>
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

      <!-- Current Site Stock Card -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
          <h3 style="font-size: 1.1rem; color: #0f172a; margin: 0;">Current Site Stock</h3>
        </div>
        <div>
          ${this.renderSiteInventory(site)}
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="padding: 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <h3 style="font-size: 1.1rem; color: #0f172a; margin: 0;">Stock Movements</h3>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-outline" onclick="SiteDetailsPage.exportExcel()" style="display: inline-flex; align-items: center; gap: 6px;">
              ${Icons.download} Excel
            </button>
            <button class="btn btn-sm btn-outline" onclick="SiteDetailsPage.exportPDF()" style="display: inline-flex; align-items: center; gap: 6px;">
              ${Icons.fileText} PDF
            </button>
          </div>
        </div>
        <div>
          ${this.renderStockMovements(site)}
        </div>
      </div>

      <!-- Payments History Card -->
      <div class="card" style="margin-top: 24px;">
        <div class="card-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
          <h3 style="font-size: 1.1rem; color: #0f172a; margin: 0;">Payment Collection History</h3>
        </div>
        <div>
          ${this.renderPaymentsLedger(site)}
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
          return `<option value="${m.id}">${m.name}</option>`;
        }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Quantity Dispatched</label>
              <input type="number" class="form-control" id="site-dispatch-qty" placeholder="Quantity" min="1">
            </div>
             <div class="form-group">
               <label>Ticket Number</label>
               <input type="text" class="form-control" id="site-dispatch-ticket" placeholder="e.g. TKT-1001">
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

      <!-- Collect Money Modal -->
      <div class="modal-backdrop" id="site-collect-modal">
        <div class="modal" style="max-width: 500px;">
          <form onsubmit="event.preventDefault(); SiteDetailsPage.savePayment();">
            <div class="modal-header">
              <h3>Collect Money (Payment)</h3>
              <button type="button" class="modal-close" onclick="SiteDetailsPage.closeCollectModal()">${Icons.x}</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Amount Collected (₹) *</label>
                <input type="number" class="form-control" id="site-collect-amount" placeholder="e.g. 5000" min="1" step="0.01" required>
              </div>
              <div class="form-group">
                <label>Date Collected *</label>
                <input type="date" class="form-control" id="site-collect-date" value="${new Date().toISOString().split('T')[0]}" required>
              </div>
              <div class="form-group">
                <label>Reference No / Mode (Optional)</label>
                <input type="text" class="form-control" id="site-collect-ref" placeholder="e.g. Cash, Bank Transfer, Invoice #">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline" onclick="SiteDetailsPage.closeCollectModal()">Cancel</button>
              <button type="submit" class="btn btn-success">Save Collection</button>
            </div>
          </form>
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

    const rows = [];
    let totalDispatched = 0;
    let totalReturned = 0;

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

    // Inject the totals into the DOM after a short tick
    setTimeout(() => {
      const elDisp = document.getElementById('site-total-dispatched');
      const elRet = document.getElementById('site-total-returned');
      if (elDisp) elDisp.innerText = Number(totalDispatched).toLocaleString('en-IN');
      if (elRet) elRet.innerText = Number(totalReturned).toLocaleString('en-IN');

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
      document.getElementById('site-dispatch-ticket').value = '';
    }
  },

  saveDispatch() {
    const materialId = document.getElementById('site-dispatch-material').value;
    const qty = parseFloat(document.getElementById('site-dispatch-qty').value) || 0;
    const date = document.getElementById('site-dispatch-date').value;
    const ticketNo = document.getElementById('site-dispatch-ticket').value.trim();

    if (!materialId || qty <= 0 || !date) {
      alert('Please select a material, specify a valid quantity, and choose a date.');
      return;
    }


    Store.Outgoing.add({
      siteId: this.siteId,
      date: date,
      referenceNo: ticketNo || ('DISP-' + Date.now().toString().slice(-6)),
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

  exportExcel() {
    const site = Store.Sites.getById(this.siteId);
    if (!site) return;
    
    const materials = Store.Materials.getAll();
    const allOutgoing = Store.Outgoing.getAll().filter(r => r.siteId === site.id);
    const allIncomingDirect = Store.Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id);
    const siteReturns = Store.SiteReturns.getAll().filter(r => r.siteId === site.id);

    const rows = [];
    allOutgoing.forEach(record => {
      record.items.forEach(item => {
        const mat = materials.find(m => m.id === item.materialId);
        rows.push({ date: record.date, type: 'Received', material: mat ? mat.name : '-', qty: parseFloat(item.quantity) || 0, unit: mat ? mat.unit : '', ref: record.referenceNo || '-', note: record.notes || '-' });
      });
    });
    allIncomingDirect.forEach(record => {
      record.items.forEach(item => {
        const mat = materials.find(m => m.id === item.materialId);
        rows.push({ date: record.date, type: 'Received (Direct)', material: mat ? mat.name : '-', qty: parseFloat(item.quantity) || 0, unit: mat ? mat.unit : '', ref: record.referenceNo || '-', note: record.notes || '-' });
      });
    });
    siteReturns.forEach(record => {
      const mat = materials.find(m => m.id === record.materialId);
      rows.push({ date: record.date, type: 'Returned', material: mat ? mat.name : '-', qty: parseFloat(record.quantity) || 0, unit: mat ? mat.unit : '', ref: 'SITE-RETURN', note: 'Returned from site' });
    });

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    let csv = `Site Report - ${site.name}\n`;
    csv += `Site ID,${site.id}\n`;
    csv += `Customer,${site.customerName || '-'}\n`;
    csv += `Location,${site.address || '-'}\n`;
    csv += `Budget,${site.budget || 0}\n\n`;
    
    csv += 'Date,Type,Material,Quantity,Unit,Reference,Notes\n';
    rows.forEach(r => {
      csv += `${r.date},"${r.type}","${r.material}",${r.qty},"${r.unit}","${r.ref}","${r.note}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `site_report_${site.name.replace(/\s+/g, '_')}.csv`);
    a.click();
  },

  exportPDF() {
    const site = Store.Sites.getById(this.siteId);
    if (!site) return;

    const materials = Store.Materials.getAll();
    const allOutgoing = Store.Outgoing.getAll().filter(r => r.siteId === site.id);
    const allIncomingDirect = Store.Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id);
    const siteReturns = Store.SiteReturns.getAll().filter(r => r.siteId === site.id);

    const rows = [];
    let totalReceived = 0;
    let totalReturned = 0;

    allOutgoing.forEach(record => {
      record.items.forEach(item => {
        const mat = materials.find(m => m.id === item.materialId);
        const qty = parseFloat(item.quantity) || 0;
        totalReceived += qty;
        rows.push({ date: record.date, type: 'Received', material: mat ? mat.name : '-', qty, unit: mat ? mat.unit : '', ref: record.referenceNo || '-', note: record.notes || '-' });
      });
    });
    allIncomingDirect.forEach(record => {
      record.items.forEach(item => {
        const mat = materials.find(m => m.id === item.materialId);
        const qty = parseFloat(item.quantity) || 0;
        totalReceived += qty;
        rows.push({ date: record.date, type: 'Received (Direct)', material: mat ? mat.name : '-', qty, unit: mat ? mat.unit : '', ref: record.referenceNo || '-', note: record.notes || '-' });
      });
    });
    siteReturns.forEach(record => {
      const mat = materials.find(m => m.id === record.materialId);
      const qty = parseFloat(record.quantity) || 0;
      totalReturned += qty;
      rows.push({ date: record.date, type: 'Returned', material: mat ? mat.name : '-', qty, unit: mat ? mat.unit : '', ref: 'SITE-RETURN', note: 'Returned from site' });
    });

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>Site Report - ${site.name}</title>
        <style>
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
          .meta { font-size: 14px; color: #64748b; margin-top: 5px; }
          .meta strong { color: #334155; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 35px; }
          .stat-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; background: #f8fafc; }
          .stat-title { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 5px; }
          .stat-value { font-size: 20px; font-weight: 700; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f1f5f9; text-align: left; padding: 12px 10px; font-size: 13px; font-weight: 600; color: #475569; border-bottom: 2px solid #cbd5e1; }
          td { padding: 12px 10px; font-size: 13px; border-bottom: 1px solid #e2e8f0; color: #334155; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
          .badge-received { background: #dcfce7; color: #15803d; }
          .badge-returned { background: #fee2e2; color: #b91c1c; }
          .badge-used { background: #fef3c7; color: #b45309; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">SITE REPORT: ${site.name}</div>
            <div class="meta">
              Site ID: <strong>${site.id}</strong> | 
              Customer: <strong>${site.customerName || '-'}</strong> | 
              Location: <strong>${site.address || '-'}</strong> |
              Status: <strong>${site.status}</strong>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; color: #64748b;">Generated on</div>
            <div style="font-weight: 600; font-size: 14px;">${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-title">Allocated Budget</div>
            <div class="stat-value">₹${(site.budget || 0).toLocaleString('en-IN')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Total Received</div>
            <div class="stat-value">${totalReceived.toLocaleString('en-IN')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Total Used</div>
            <div class="stat-value">${totalUsed.toLocaleString('en-IN')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Total Returned</div>
            <div class="stat-value">${totalReturned.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <h3>Stock Movement Ledger</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Material</th>
              <th>Quantity</th>
              <th>Reference No</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const badgeClass = r.type === 'Returned' ? 'badge-returned' : r.type === 'Used' ? 'badge-used' : 'badge-received';
              return `
                <tr>
                  <td>${new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td><span class="badge \${badgeClass}">${r.type}</span></td>
                  <td><strong>${r.material}</strong></td>
                  <td>${r.qty.toLocaleString('en-IN')} ${r.unit}</td>
                  <td>${r.ref}</td>
                  <td>${r.note}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  },

  renderSiteInventory(site) {
    const materials = Store.Materials.getAll();
    const rows = [];

    materials.forEach(m => {
      const sent = Store.Inventory.getSiteTotalSent(m.id, site.id);
      const returned = Store.Inventory.getSiteReturns(m.id, site.id);
      const remaining = Store.Inventory.getSiteCurrentBalance(m.id, site.id);

      if (sent > 0 || returned > 0 || remaining > 0) {
        rows.push({
          material: m.name,
          unit: m.unit,
          sent,
          returned,
          remaining
        });
      }
    });

    if (rows.length === 0) {
      return `
        <div class="empty-state" style="padding: 40px 20px; text-align: center;">
          <p class="text-sm text-tertiary">No materials dispatched to this site yet.</p>
        </div>
      `;
    }

    return `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Total Sent</th>
              <th style="color: var(--danger)">Returned</th>
              <th style="color: var(--success); font-weight: 700;">Remaining Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${r.material}</strong></td>
                <td>${r.sent.toLocaleString('en-IN')} ${r.unit}</td>
                <td style="color: var(--danger); font-weight: 500;">${r.returned > 0 ? r.returned.toLocaleString('en-IN') : '-'} ${r.returned > 0 ? r.unit : ''}</td>
                <td><strong style="color: var(--success); font-size: 1.05rem;">${r.remaining.toLocaleString('en-IN')}</strong> ${r.unit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  openCollectModal() {
    const modal = document.getElementById('site-collect-modal');
    if (modal) modal.classList.add('active');
  },

  closeCollectModal() {
    const modal = document.getElementById('site-collect-modal');
    if (modal) {
      modal.classList.remove('active');
      document.getElementById('site-collect-amount').value = '';
      document.getElementById('site-collect-ref').value = '';
    }
  },

  savePayment() {
    const amount = parseFloat(document.getElementById('site-collect-amount').value) || 0;
    const date = document.getElementById('site-collect-date').value;
    const reference = document.getElementById('site-collect-ref').value.trim();

    if (amount <= 0 || !date) {
      alert('Please enter a valid amount and date.');
      return;
    }

    Store.SitePayments.add({
      siteId: this.siteId,
      amount: amount,
      date: date,
      reference: reference || 'Cash'
    });

    this.closeCollectModal();
    this.refresh();
  },

  deletePayment(id) {
    if (confirm('Are you sure you want to delete this payment record?')) {
      Store.SitePayments.remove(id);
      this.refresh();
    }
  },

  renderPaymentsLedger(site) {
    const payments = Store.SitePayments.getAll().filter(p => p.siteId === site.id);
    payments.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (payments.length === 0) {
      return `
        <div class="empty-state" style="padding: 40px 20px; text-align: center;">
          <p class="text-sm text-tertiary">No payments collected from client yet.</p>
        </div>
      `;
    }

    return `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount Collected</th>
              <th>Mode / Reference</th>
              <th style="width: 10%; text-align: center;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td><strong>${new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></td>
                <td style="color: var(--success); font-weight: 700;">₹${Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td><span class="badge badge-neutral">${p.reference || 'Cash'}</span></td>
                <td style="text-align: center;">
                  <button class="btn btn-icon btn-ghost" title="Delete Payment" onclick="SiteDetailsPage.deletePayment('${p.id}')">
                    ${Icons.trash}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
};
