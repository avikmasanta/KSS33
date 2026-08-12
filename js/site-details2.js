/* ============================================
   KSS33 Site Details Page
   ============================================ */

function _resolveMatId(id) {
  if (!id) return '';
  if (typeof id === 'object') return String(id._id || id.id || '');
  return String(id);
}

function safeFormatDate(dateStr) {
  if (!dateStr) return '';
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.toString().padStart(2, '0')} ${months[m]} ${y}`;
  }
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getMaterialName(item, materials) {
  var matId = _resolveMatId(item.materialId);
  var mat = materials.find(function(m) { return _resolveMatId(m.id) === matId; });
  if (mat) return mat.name;
  if (typeof item.materialId === 'object' && item.materialId.name) return item.materialId.name;
  return null; // null means deleted/unknown - caller should skip
}

function getMaterialUnit(item, materials) {
  var matId = _resolveMatId(item.materialId);
  var mat = materials.find(function(m) { return _resolveMatId(m.id) === matId; });
  if (mat) return mat.unit;
  if (typeof item.materialId === 'object' && item.materialId.unit) return item.materialId.unit;
  return '';
}

var SiteDetailsPage = {
  siteId: null,

  render() {
    if (!this.siteId) {
      try { this.siteId = sessionStorage.getItem('selectedSiteId'); } catch(e){}
    }
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
    const materials = Store.Materials.getSorted().filter(m => m.status !== 'Archived');
    const totalCollected = Store.SitePayments.getTotalBySite(site.id);
    const remainingBudget = (site.budget || 0) - totalCollected;

    let totalDispatched = 0;
    let totalReturned = 0;
    materials.forEach(m => {
      totalDispatched += Store.Inventory.getSiteTotalSent(m.id, site.id);
      totalReturned += Store.Inventory.getSiteReturns(m.id, site.id);
    });

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
          <p style="margin-top: 4px; color: var(--text-secondary);">Site ID: <strong style="color:var(--primary); font-family: monospace;">${site.id}</strong> | Token: <strong>${site.tokenNumber || '-'}</strong> | Customer: <strong>${site.customerName || '-'}</strong> | Lintel Date: <strong style="color:var(--success);">${site.lintelDate ? safeFormatDate(site.lintelDate) : '-'}</strong>${site.ratePerSqFt > 0 ? ` | <span style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);color:#166634;border-radius:8px;padding:2px 10px;font-weight:700;font-size:0.82rem;border:1px solid #bbf7d0;">&#9633; ₹${site.ratePerSqFt}/sq ft</span>` : ''} | Location: ${site.address || '-'}</p>
          ${site.notes ? `<div style="margin-top:8px;display:inline-flex;align-items:flex-start;gap:8px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fcd34d;border-radius:10px;padding:8px 14px;max-width:100%;"><span style="font-size:1rem;">📝</span><span style="font-size:0.85rem;color:#92400e;font-weight:500;line-height:1.4;">${site.notes}</span></div>` : ''}
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
        <!-- Money Received Card — always active, no budget required -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border-radius: 16px; padding: 30px; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3); position: relative; overflow: hidden; cursor: pointer; transition: transform 0.2s;"
             onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'"
             onclick="SiteDetailsPage.openCollectModal()">
          <div style="position: absolute; right: 10px; top: 10px; opacity: 0.15; transform: scale(4); pointer-events: none; font-size: 32px; font-weight: 800;">₹</div>
          <h3 style="margin:0 0 15px 0; font-size: 1.1rem; font-weight: 600; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
            <div style="width: 20px; height: 20px; font-weight: bold; font-size: 1.2rem; text-align: center; display: flex; align-items: center; justify-content: center;">₹</div> Money Received
          </h3>
          <div style="font-size: 3.2rem; font-weight: 800; letter-spacing: -2px; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); line-height: 1;">
            ₹${totalCollected.toLocaleString('en-IN')}
          </div>
          <div style="font-size: 0.95rem; font-weight: 500; color: rgba(255,255,255,0.9); display: flex; align-items: center; gap: 6px;">
            <span style="background: rgba(255,255,255,0.25); padding: 3px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">+ COLLECT</span>
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
            ${totalDispatched}
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
            ${totalReturned}
          </div>
          <div style="font-size: 0.95rem; font-weight: 500; color: rgba(255,255,255,0.85); display: flex; align-items: center; gap: 6px;">
            <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">OUTGOING</span>
            Total material returned from this site
          </div>
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
        <div class="modal" style="max-width: 560px;">
          <div class="modal-header">
            <h3>Log Material Dispatch</h3>
            <button class="modal-close" onclick="SiteDetailsPage.closeDispatchModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Ticket Number</label>
                <input type="text" class="form-control" id="site-dispatch-ticket" placeholder="e.g. TKT-1001">
              </div>
              <div class="form-group">
                <label>Date</label>
                <input type="date" class="form-control" id="site-dispatch-date" value="${localDateStr()}">
              </div>
            </div>
            <div id="site-dispatch-items-container" style="margin-top: 8px;"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="SiteDetailsPage.closeDispatchModal()">Cancel</button>
            <button class="btn btn-secondary" onclick="SiteDetailsPage.saveDispatch()">Save Dispatch</button>
          </div>
        </div>
      </div>

      <!-- Return Material Modal -->
      <div class="modal-backdrop" id="site-return-modal">
        <div class="modal" style="max-width: 560px;">
          <div class="modal-header">
            <h3>Log Material Return</h3>
            <button class="modal-close" onclick="SiteDetailsPage.closeReturnModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Date</label>
              <input type="date" class="form-control" id="site-return-date" value="${localDateStr()}">
            </div>
            <div id="site-return-items-container" style="margin-top: 8px;"></div>
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
                <input type="date" class="form-control" id="site-collect-date" value="${localDateStr()}" required>
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
    let totalSqFtIssued = 0;
    let totalSqFtReturned = 0;

    // Helper: get sq ft for a materialId
    function getSqFt(materialId, qty) {
      return (Store.Materials.getSqFtPerUnit ? Store.Materials.getSqFtPerUnit(materialId) : 0) * qty;
    }

    // Outgoing from warehouse to site (Dispatched)
    allOutgoing.forEach(record => {
      record.items.forEach(item => {
        const matName = getMaterialName(item, materials);
        if (!matName) return; // skip deleted materials
        const qty = parseFloat(item.quantity) || 0;
        const sqFt = getSqFt(typeof item.materialId === 'object' ? (item.materialId._id || item.materialId.id) : item.materialId, qty);
        totalDispatched += qty;
        totalSqFtIssued += sqFt;
        rows.push({
          date: record.date,
          type: 'Incoming',
          material: matName,
          unit: getMaterialUnit(item, materials),
          qty: qty,
          sqFt: sqFt,
          ref: record.referenceNo || '-',
          note: record.notes || '-'
        });
      });
    });

    // Incoming direct to site (Dispatched)
    allIncomingDirect.forEach(record => {
      record.items.forEach(item => {
        const matName = getMaterialName(item, materials);
        if (!matName) return; // skip deleted materials
        const qty = parseFloat(item.quantity) || 0;
        const sqFt = getSqFt(typeof item.materialId === 'object' ? (item.materialId._id || item.materialId.id) : item.materialId, qty);
        totalDispatched += qty;
        totalSqFtIssued += sqFt;
        rows.push({
          date: record.date,
          type: 'Incoming',
          material: matName,
          unit: getMaterialUnit(item, materials),
          qty: qty,
          sqFt: sqFt,
          ref: record.referenceNo || record.invoiceNo || '-',
          note: record.notes || 'Direct from supplier'
        });
      });
    });

    // Site Returns (Returned)
    siteReturns.forEach(record => {
      const matName = getMaterialName(record, materials);
      if (!matName) return; // skip deleted materials
      const qty = parseFloat(record.quantity) || 0;
      const sqFt = getSqFt(typeof record.materialId === 'object' ? (record.materialId._id || record.materialId.id) : record.materialId, qty);
      totalReturned += qty;
      totalSqFtReturned += sqFt;
      rows.push({
        returnId: record.id,
        date: record.date,
        type: 'Outgoing',
        material: matName,
        unit: getMaterialUnit(record, materials),
        qty: qty,
        sqFt: sqFt,
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

    let html = `<div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 16px;">`;

    rows.forEach(r => {
      const isReturn = r.type === 'Outgoing';
      const color     = isReturn ? '#dc2626' : '#16a34a';
      const bgLight   = isReturn ? '#fef2f2' : '#f0fdf4';
      const borderClr = isReturn ? '#fca5a5' : '#86efac';
      const sign      = isReturn ? '−' : '+';
      const label     = isReturn ? 'Returned' : 'Received';
      const sqFtFmt   = r.sqFt > 0 ? (r.sqFt % 1 === 0 ? r.sqFt.toLocaleString('en-IN') : r.sqFt.toFixed(2)) : null;

      html += `
        <div style="
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-left: 4px solid ${color};
          border-radius: 10px;
          gap: 12px;
          transition: background 0.15s;
        " onmouseover="this.style.background='var(--surface-hover,rgba(0,0,0,0.03))'" onmouseout="this.style.background='var(--surface)'">

          <!-- Left: info -->
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:0.92rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.material}</div>
            <div style="display:flex; gap:6px; align-items:center; margin-top:4px; flex-wrap:wrap;">
              <span style="background:${bgLight}; color:${color}; border:1px solid ${borderClr}; border-radius:4px; padding:1px 7px; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px;">${label}</span>
              <span style="color:var(--text-tertiary); font-size:0.75rem;">Ref: ${r.ref}</span>
              ${sqFtFmt ? `<span style="background:#dcfce7; color:#15803d; border-radius:4px; padding:1px 7px; font-size:0.7rem; font-weight:700;">${sqFtFmt} sq ft</span>` : ''}
            </div>
          </div>

          <!-- Right: qty + date + action -->
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="text-align:right; flex-shrink:0;">
              <div style="font-weight:800; font-size:1.1rem; color:${color}; white-space:nowrap;">
                ${sign}${r.qty.toLocaleString('en-IN')} <span style="font-size:0.78rem; font-weight:500; color:var(--text-secondary);">${r.unit}</span>
              </div>
              <div style="font-size:0.72rem; color:var(--text-tertiary); margin-top:3px;">${safeFormatDate(r.date)}</div>
            </div>
            ${r.returnId ? `
              <button class="btn btn-sm btn-ghost" onclick="SiteDetailsPage.deleteReturn('${r.returnId}')" title="Delete Return Record" style="color:var(--danger); padding:4px;">
                ${Icons.trash}
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });

    // Sq Ft Summary Footer
    if (totalSqFtIssued > 0 || totalSqFtReturned > 0) {
      const net = totalSqFtIssued - totalSqFtReturned;
      const fmtNum = n => n % 1 === 0 ? n.toLocaleString('en-IN') : n.toFixed(2);
      html += `
        <div style="
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          gap: 8px; margin-top: 10px; padding-top: 4px;
        ">
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px 14px; text-align:center;">
            <div style="font-size:0.65rem; color:#166534; text-transform:uppercase; font-weight:700; letter-spacing:0.6px; margin-bottom:4px;">Sq Ft Issued</div>
            <div style="font-size:1.4rem; font-weight:800; color:#15803d; line-height:1;">${fmtNum(totalSqFtIssued)}</div>
            <div style="font-size:0.7rem; color:#16a34a; margin-top:2px;">sq ft</div>
          </div>
          <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:12px 14px; text-align:center;">
            <div style="font-size:0.65rem; color:#9a3412; text-transform:uppercase; font-weight:700; letter-spacing:0.6px; margin-bottom:4px;">Sq Ft Returned</div>
            <div style="font-size:1.4rem; font-weight:800; color:#ea580c; line-height:1;">${fmtNum(totalSqFtReturned)}</div>
            <div style="font-size:0.7rem; color:#f97316; margin-top:2px;">sq ft</div>
          </div>
          <div style="background:${net >= 0 ? '#f0fdf4' : '#fef2f2'}; border:1px solid ${net >= 0 ? '#86efac' : '#fca5a5'}; border-radius:10px; padding:12px 14px; text-align:center;">
            <div style="font-size:0.65rem; color:${net >= 0 ? '#166534' : '#991b1b'}; text-transform:uppercase; font-weight:700; letter-spacing:0.6px; margin-bottom:4px;">Net at Site</div>
            <div style="font-size:1.4rem; font-weight:800; color:${net >= 0 ? '#15803d' : '#dc2626'}; line-height:1;">${fmtNum(net)}</div>
            <div style="font-size:0.7rem; color:${net >= 0 ? '#16a34a' : '#ef4444'}; margin-top:2px;">sq ft</div>
          </div>
        </div>
      `;
    }

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
    this.dispatchItems = [{ materialId: '', quantity: '', searchQuery: '' }];
    const modal = document.getElementById('site-dispatch-modal');
    if (modal) {
      modal.classList.add('active');
      const ticket = modal.querySelector('#site-dispatch-ticket');
      if (ticket) ticket.value = '';
    }
    this.renderDispatchItems();
  },

  closeDispatchModal() {
    const modal = document.getElementById('site-dispatch-modal');
    if (modal) {
      modal.classList.remove('active');
      this.dispatchItems = [];
    }
  },

  renderDispatchItems() {
    const container = document.getElementById('site-dispatch-items-container');
    if (!container) return;

    const materials = (Store.Materials.getSorted ? Store.Materials.getSorted() : Store.Materials.getAll())
      .filter(m => m.status !== 'Archived');

    if (materials.length === 0) {
      container.innerHTML = '<p class="text-sm text-tertiary" style="padding:12px 0;">No materials available in catalog.</p>';
      return;
    }

  renderDispatchItems() {
    const container = document.getElementById('site-dispatch-items-container');
    if (!container) return;

    const materials = (Store.Materials.getSorted ? Store.Materials.getSorted() : Store.Materials.getAll())
      .filter(m => m.status !== 'Archived');

    if (materials.length === 0) {
      container.innerHTML = '<p class="text-sm text-tertiary" style="padding:12px 0;">No materials available in catalog.</p>';
      return;
    }

    let html = `
      <table class="inline-table w-100" style="overflow:visible;">
        <thead>
          <tr>
            <th style="width:60%">Material</th>
            <th style="width:30%; color: var(--success)">Qty Dispatched</th>
            <th style="width:10%"></th>
          </tr>
        </thead>
        <tbody>
    `;

    (this.dispatchItems || []).forEach((item, idx) => {
      const mat = item.materialId ? Store.Materials.getById(item.materialId) : null;
      const displayVal = mat ? `${mat.name} (${mat.unit || 'Pcs'})` : (item.searchQuery || '');

      html += `
        <tr>
          <td style="position:relative;">
            <div class="searchable-combobox-wrapper" style="position:relative; width:100%;">
              <div style="position:relative; width:100%; display:flex; align-items:center;">
                <span style="position:absolute; left:12px; pointer-events:none; color:#64748b; font-size:14px; display:flex; align-items:center;">
                  ${Icons.search}
                </span>
                <input
                  type="text"
                  class="form-control"
                  id="mat-input-dispatch-${idx}"
                  placeholder="Search material by name, SKU..."
                  value="${displayVal.replace(/"/g, '&quot;')}"
                  autocomplete="off"
                  style="padding-left:36px; padding-right:28px; font-weight:500;"
                  onfocus="SiteDetailsPage.openMatSuggestions('dispatch', ${idx})"
                  oninput="SiteDetailsPage.filterMatSuggestions('dispatch', ${idx}, this.value)"
                >
                <span style="position:absolute; right:12px; pointer-events:none; color:#64748b; font-size:9px;">▼</span>
              </div>
              <div id="mat-suggestions-dispatch-${idx}" class="mat-suggestions-menu" style="display:none; position:absolute; top:calc(100% + 4px); left:0; min-width:340px; width:100%; max-height:250px; overflow-y:auto; background:#1e293b; border:1px solid rgba(255,255,255,0.12); border-radius:10px; z-index:9999; box-shadow:0 16px 36px rgba(0,0,0,0.6); padding:0 0 4px 0;">
              </div>
            </div>
          </td>
          <td>
            <input
              type="number"
              class="form-control"
              placeholder="0"
              min="0"
              step="any"
              value="${item.quantity || ''}"
              oninput="SiteDetailsPage.onDispatchItemChange(${idx}, 'quantity', this.value)"
              onfocus="if(this.value==='0') this.value=''; this.select()"
            >
          </td>
          <td style="text-align:center;">
            ${(this.dispatchItems || []).length > 1 ? `
              <button class="btn btn-icon btn-ghost" onclick="SiteDetailsPage.removeDispatchItem(${idx})" title="Remove">
                ${Icons.x}
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
      <div style="margin-top:12px;">
        <a class="add-row-link" style="cursor:pointer; color:var(--primary); font-weight:600; display:inline-flex; align-items:center; gap:6px; font-size:0.88rem; padding:6px 12px; background:rgba(59,130,246,0.1); border-radius:6px; border:1px solid rgba(59,130,246,0.2);" onclick="SiteDetailsPage.addDispatchItem()">
          ${Icons.plus} Add Material Row
        </a>
      </div>
    `;

    container.innerHTML = html;
  },

  addDispatchItem() {
    if (!this.dispatchItems) this.dispatchItems = [];
    this.dispatchItems.push({ materialId: '', quantity: '', searchQuery: '' });
    this.renderDispatchItems();
  },

  removeDispatchItem(idx) {
    if (this.dispatchItems && this.dispatchItems.length > 1) {
      this.dispatchItems.splice(idx, 1);
      this.renderDispatchItems();
    }
  },

  onDispatchItemChange(idx, field, value) {
    if (this.dispatchItems && this.dispatchItems[idx]) {
      this.dispatchItems[idx][field] = value;
    }
  },

  openMatSuggestions(type, idx) {
    document.querySelectorAll('.mat-suggestions-menu').forEach(el => el.style.display = 'none');
    const input = document.getElementById(`mat-input-${type}-${idx}`);
    if (input) {
      input.select();
      this.filterMatSuggestions(type, idx, input.value || '');
    }
  },

  filterMatSuggestions(type, idx, query) {
    const suggestionsEl = document.getElementById(`mat-suggestions-${type}-${idx}`);
    if (!suggestionsEl) return;

    const materials = (Store.Materials.getSorted ? Store.Materials.getSorted() : Store.Materials.getAll())
      .filter(m => m.status !== 'Archived');
    const site = Store.Sites.getById(this.siteId);

    const q = (query || '').toLowerCase().trim();

    const itemsArray = type === 'dispatch' ? this.dispatchItems : this.returnItems;
    if (itemsArray && itemsArray[idx]) {
      itemsArray[idx].searchQuery = query;
      const curMat = Store.Materials.getById(itemsArray[idx].materialId);
      if (curMat) {
        const fullName = `${curMat.name} (${curMat.unit || 'Pcs'})`.toLowerCase();
        if (!fullName.includes(q) && !curMat.name.toLowerCase().includes(q)) {
          itemsArray[idx].materialId = '';
        }
      }
    }

    let filtered = [];

    if (!q) {
      if (type === 'return') {
        // Sort: materials currently at site first, then remaining
        filtered = [...materials].sort((a, b) => {
          const sentA = Store.Inventory.getSiteTotalSent(a.id, site ? site.id : null);
          const retA  = Store.Inventory.getSiteReturns(a.id, site ? site.id : null);
          const sentB = Store.Inventory.getSiteTotalSent(b.id, site ? site.id : null);
          const retB  = Store.Inventory.getSiteReturns(b.id, site ? site.id : null);
          return (sentB - retB) - (sentA - retA);
        });
      } else {
        // Show all materials when search query is empty
        filtered = [...materials];
      }
    } else {
      filtered = materials.filter(m => {
        const nameMatch = (m.name || '').toLowerCase().includes(q);
        const skuMatch  = (m.sku || '').toLowerCase().includes(q);
        const unitMatch = (m.unit || '').toLowerCase().includes(q);
        const catMatch  = (m.category || '').toLowerCase().includes(q);
        return nameMatch || skuMatch || unitMatch || catMatch;
      });
    }

    if (filtered.length === 0) {
      suggestionsEl.innerHTML = `<div style="padding:14px; font-size:0.85rem; color:#94a3b8; text-align:center;">No matching materials found</div>`;
      suggestionsEl.style.display = 'block';
      return;
    }

    let html = '';
    const categories = [...new Set(filtered.map(m => m.category || 'General'))].sort();

    categories.forEach(cat => {
      const catMats = filtered.filter(m => (m.category || 'General') === cat);
      if (catMats.length === 0) return;

      html += `
        <div style="padding:6px 12px 4px; font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#60a5fa; background:rgba(15, 23, 42, 0.7); border-bottom:1px solid rgba(255,255,255,0.06); position:sticky; top:0; z-index:2;">
          ${cat}
        </div>
      `;

      catMats.forEach(m => {
        let balanceText = '';
        if (type === 'return') {
          const totalSent     = Store.Inventory.getSiteTotalSent(m.id, site ? site.id : null);
          const totalReturned = Store.Inventory.getSiteReturns(m.id, site ? site.id : null);
          const remaining     = totalSent - totalReturned;
          balanceText = totalSent > 0 ? `
            <span style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); font-weight:600; font-size:0.72rem; padding:2px 8px; border-radius:12px; white-space:nowrap;">
              On Site: ${remaining}
            </span>
          ` : '';
        }

        html += `
          <div
            class="mat-suggestion-item"
            style="padding:10px 14px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.04); transition:all 0.15s ease;"
            onmouseenter="this.style.background='rgba(59,130,246,0.15)'; this.style.borderLeft='3px solid #3b82f6';"
            onmouseleave="this.style.background='transparent'; this.style.borderLeft='0';"
            onmousedown="SiteDetailsPage.selectMatOption('${type}', ${idx}, '${m.id}')"
          >
            <div>
              <div style="font-weight:600; font-size:0.88rem; color:#f8fafc; margin-bottom:2px;">${m.name}</div>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="background:rgba(255,255,255,0.08); color:#94a3b8; font-weight:500; font-size:0.7rem; padding:1px 6px; border-radius:4px;">${m.unit || 'Pcs'}</span>
                ${m.sku ? `<span style="font-size:0.7rem; color:#64748b; font-family:monospace;">• ${m.sku}</span>` : ''}
              </div>
            </div>
            ${balanceText}
          </div>
        `;
      });
    });

    suggestionsEl.innerHTML = html;
    suggestionsEl.style.display = 'block';
  },

  selectMatOption(type, idx, materialId) {
    const itemsArray = type === 'dispatch' ? this.dispatchItems : this.returnItems;
    const material = Store.Materials.getById(materialId);
    if (itemsArray && itemsArray[idx] && material) {
      itemsArray[idx].materialId = material.id;
      itemsArray[idx].searchQuery = `${material.name} (${material.unit || 'Pcs'})`;

      const input = document.getElementById(`mat-input-${type}-${idx}`);
      if (input) input.value = itemsArray[idx].searchQuery;
    }

    const suggestionsEl = document.getElementById(`mat-suggestions-${type}-${idx}`);
    if (suggestionsEl) suggestionsEl.style.display = 'none';
  },

  saveDispatch() {
    const date = document.getElementById('site-dispatch-date').value;
    const ticketNo = document.getElementById('site-dispatch-ticket').value.trim();

    if (!date) { alert('Please choose a date.'); return; }

    const items = [];
    (this.dispatchItems || []).forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      if (item.materialId && qty > 0) {
        const material = Store.Materials.getById(item.materialId);
        items.push({
          materialId: item.materialId,
          quantity: qty,
          rate: material?.unitPrice || 0,
          amount: qty * (material?.unitPrice || 0)
        });
      }
    });

    if (items.length === 0) {
      alert('Please select at least one material and enter a valid quantity.');
      return;
    }

    Store.Outgoing.add({
      siteId: this.siteId,
      date,
      referenceNo: ticketNo || ('DISP-' + Date.now().toString().slice(-6)),
      notes: 'Dispatched from site dashboard',
      items
    });

    // Log transactions
    items.forEach(i => {
      Store.logTransaction(i.materialId, i.quantity, 'Dispatch', this.siteId);
    });

    this.closeDispatchModal();
    this.refresh();
  },

  openReturnModal() {
    this.returnItems = [{ materialId: '', quantity: '', searchQuery: '' }];
    const modal = document.getElementById('site-return-modal');
    if (modal) modal.classList.add('active');
    this.renderReturnItems();
  },

  closeReturnModal() {
    const modal = document.getElementById('site-return-modal');
    if (modal) {
      modal.classList.remove('active');
      this.returnItems = [];
    }
  },

  renderReturnItems() {
    const container = document.getElementById('site-return-items-container');
    if (!container) return;

    const materials = (Store.Materials.getSorted ? Store.Materials.getSorted() : Store.Materials.getAll())
      .filter(m => m.status !== 'Archived');

    if (materials.length === 0) {
      container.innerHTML = '<p class="text-sm text-tertiary" style="padding:12px 0;">No materials available in catalog.</p>';
      return;
    }

    let html = `
      <table class="inline-table w-100" style="overflow:visible;">
        <thead>
          <tr>
            <th style="width:60%">Material</th>
            <th style="width:30%; color: var(--danger)">Qty Returned</th>
            <th style="width:10%"></th>
          </tr>
        </thead>
        <tbody>
    `;

    (this.returnItems || []).forEach((item, idx) => {
      const mat = item.materialId ? Store.Materials.getById(item.materialId) : null;
      const displayVal = mat ? `${mat.name} (${mat.unit || 'Pcs'})` : (item.searchQuery || '');

      html += `
        <tr>
          <td style="position:relative;">
            <div class="searchable-combobox-wrapper" style="position:relative; width:100%;">
              <div style="position:relative; width:100%; display:flex; align-items:center;">
                <span style="position:absolute; left:12px; pointer-events:none; color:#64748b; font-size:14px; display:flex; align-items:center;">
                  ${Icons.search}
                </span>
                <input
                  type="text"
                  class="form-control"
                  id="mat-input-return-${idx}"
                  placeholder="Search material by name, SKU..."
                  value="${displayVal.replace(/"/g, '&quot;')}"
                  autocomplete="off"
                  style="padding-left:36px; padding-right:28px; font-weight:500;"
                  onfocus="SiteDetailsPage.openMatSuggestions('return', ${idx})"
                  oninput="SiteDetailsPage.filterMatSuggestions('return', ${idx}, this.value)"
                >
                <span style="position:absolute; right:12px; pointer-events:none; color:#64748b; font-size:9px;">▼</span>
              </div>
              <div id="mat-suggestions-return-${idx}" class="mat-suggestions-menu" style="display:none; position:absolute; top:calc(100% + 4px); left:0; min-width:340px; width:100%; max-height:250px; overflow-y:auto; background:#1e293b; border:1px solid rgba(255,255,255,0.12); border-radius:10px; z-index:9999; box-shadow:0 16px 36px rgba(0,0,0,0.6); padding:0 0 4px 0;">
              </div>
            </div>
          </td>
          <td>
            <input
              type="number"
              class="form-control"
              placeholder="0"
              min="0"
              step="any"
              value="${item.quantity || ''}"
              oninput="SiteDetailsPage.onReturnItemChange(${idx}, 'quantity', this.value)"
              onfocus="if(this.value==='0') this.value=''; this.select()"
            >
          </td>
          <td style="text-align:center;">
            ${(this.returnItems || []).length > 1 ? `
              <button class="btn btn-icon btn-ghost" onclick="SiteDetailsPage.removeReturnItem(${idx})" title="Remove">
                ${Icons.x}
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
      <div style="margin-top:12px;">
        <a class="add-row-link" style="cursor:pointer; color:var(--primary); font-weight:600; display:inline-flex; align-items:center; gap:6px; font-size:0.88rem; padding:6px 12px; background:rgba(59,130,246,0.1); border-radius:6px; border:1px solid rgba(59,130,246,0.2);" onclick="SiteDetailsPage.addReturnItem()">
          ${Icons.plus} Add Material Row
        </a>
      </div>
    `;

    container.innerHTML = html;
  },

  addReturnItem() {
    if (!this.returnItems) this.returnItems = [];
    this.returnItems.push({ materialId: '', quantity: '', searchQuery: '' });
    this.renderReturnItems();
  },

  removeReturnItem(idx) {
    if (this.returnItems && this.returnItems.length > 1) {
      this.returnItems.splice(idx, 1);
      this.renderReturnItems();
    }
  },

  onReturnItemChange(idx, field, value) {
    if (this.returnItems && this.returnItems[idx]) {
      this.returnItems[idx][field] = value;
    }
  },

  saveReturn() {
    const date = document.getElementById('site-return-date').value;
    if (!date) { alert('Please choose a date.'); return; }

    let saved = 0;
    (this.returnItems || []).forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      if (item.materialId && qty > 0) {
        Store.SiteReturns.add({
          siteId: this.siteId,
          materialId: item.materialId,
          quantity: qty,
          date
        });
        Store.logTransaction(item.materialId, qty, 'Return', this.siteId);
        saved++;
      }
    });

    if (saved === 0) {
      alert('Please select at least one material and enter a valid quantity.');
      return;
    }

    this.closeReturnModal();
    this.refresh();
  },

  deleteReturn(returnId) {
    if (confirm('Are you sure you want to delete this material return entry?')) {
      Store.SiteReturns.delete(returnId);
      this.refresh();
    }
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
        rows.push({ date: record.date, type: 'Received', material: getMaterialName(item, materials), qty: parseFloat(item.quantity) || 0, unit: getMaterialUnit(item, materials), ref: record.referenceNo || '-', note: record.notes || '-' });
      });
    });
    allIncomingDirect.forEach(record => {
      record.items.forEach(item => {
        
        rows.push({ date: record.date, type: 'Received (Direct)', material: getMaterialName(item, materials), qty: parseFloat(item.quantity) || 0, unit: getMaterialUnit(item, materials), ref: record.referenceNo || '-', note: record.notes || '-' });
      });
    });
    siteReturns.forEach(record => {
      
      rows.push({ date: record.date, type: 'Returned', material: getMaterialName(record, materials), qty: parseFloat(record.quantity) || 0, unit: getMaterialUnit(record, materials), ref: 'SITE-RETURN', note: 'Returned from site' });
    });

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    let csv = `Site Report - ${site.name}\n`;
    csv += `Site ID,${site.id}\n`;
    csv += `Token Number,${site.tokenNumber || '-'}\n`;
    csv += `Customer,${site.customerName || '-'}\n`;
    csv += `Location,${site.address || '-'}\n`;
    csv += `Budget,${site.budget || 0}\n\n`;
    
    csv += 'Date,Type,Material,Quantity,Unit,Reference,Notes\n';
    rows.forEach(r => {
      csv += `${r.date},"${r.type}","${r.material}",${r.qty},"${r.unit}","${r.ref}","${r.note.replace(/\n/g, ' ')}"\n`;
    });

    const payments = Store.SitePayments.getAll().filter(p => p.siteId === site.id);
    if (payments.length > 0) {
      csv += '\n\nPAYMENT HISTORY\n';
      csv += 'Date,Amount,Payment Mode,Reference,Notes\n';
      payments.forEach(p => {
        csv += `${p.date},${p.amount},"${p.paymentMode}","${(p.reference || '-').replace(/\n/g, ' ')}","${(p.notes || '-').replace(/\n/g, ' ')}"\n`;
      });
    }

    let hasStock = false;
    let stockCsv = '\n\nCURRENT INVENTORY AT SITE\n';
    stockCsv += 'Material,Category,Unit,Total Received,Total Returned,Current Balance\n';
    materials.forEach(m => {
      const balance = Store.Inventory.getSiteCurrentBalance(m.id, site.id);
      if (balance > 0) {
        hasStock = true;
        const totalReceived = Store.Inventory.getSiteTotalSent(m.id, site.id);
        const totalReturned = Store.Inventory.getSiteReturns(m.id, site.id);
        stockCsv += `"${m.name}","${m.category}","${m.unit}",${totalReceived},${totalReturned},${balance}\n`;
      }
    });
    if (hasStock) csv += stockCsv;

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

    // Build cross-tab maps: rowKey -> materialId -> qty
    const dispatchMap = {};
    const returnMap = {};
    const dispatchedMatIds = new Set();
    const returnedMatIds = new Set();

    allOutgoing.forEach((record, index) => {
      (record.items || []).forEach(item => {
        const matId = _resolveMatId(item.materialId);
        if (!matId || !Store.Materials.getById(matId)) return;
        dispatchedMatIds.add(matId);
        const rowKey = record.id || (record.date + '-out-' + index);
        dispatchMap[rowKey] = dispatchMap[rowKey] || { date: record.date, ref: record.referenceNo || '-' };
        dispatchMap[rowKey][matId] = (dispatchMap[rowKey][matId] || 0) + (parseFloat(item.quantity) || 0);
      });
    });

    allIncomingDirect.forEach((record, index) => {
      (record.items || []).forEach(item => {
        const matId = _resolveMatId(item.materialId);
        if (!matId || !Store.Materials.getById(matId)) return;
        dispatchedMatIds.add(matId);
        const rowKey = record.id || (record.date + '-inc-' + index);
        dispatchMap[rowKey] = dispatchMap[rowKey] || { date: record.date, ref: record.referenceNo || record.invoiceNo || 'Direct' };
        dispatchMap[rowKey][matId] = (dispatchMap[rowKey][matId] || 0) + (parseFloat(item.quantity) || 0);
      });
    });

    siteReturns.forEach((record, index) => {
      const matId = _resolveMatId(record.materialId);
      if (!matId || !Store.Materials.getById(matId)) return;
      returnedMatIds.add(matId);
      const rowKey = record.id || (record.date + '-ret-' + index);
      returnMap[rowKey] = returnMap[rowKey] || { date: record.date, ref: 'SITE-RETURN' };
      returnMap[rowKey][matId] = (returnMap[rowKey][matId] || 0) + (parseFloat(record.quantity) || 0);
    });

    const dispatchMats = [...dispatchedMatIds].map(id => Store.Materials.getById(id)).filter(Boolean);
    const returnMats   = [...returnedMatIds].map(id => Store.Materials.getById(id)).filter(Boolean);

    const dispatchRowKeys = Object.keys(dispatchMap).sort((a, b) => new Date(dispatchMap[a].date) - new Date(dispatchMap[b].date));
    const returnRowKeys = Object.keys(returnMap).sort((a, b) => new Date(returnMap[a].date) - new Date(returnMap[b].date));

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });

    // Build the inventory summary table (Page 3)
    const summaryMats = materials.filter(m => {
      const sent = Store.Inventory.getSiteTotalSent(m.id, site.id);
      const returned = Store.Inventory.getSiteReturns(m.id, site.id);
      return sent > 0 || returned > 0;
    });

    const summaryTableHtml = `
      <table style="width:100%;border-collapse:collapse;margin-top:10px;">
        <thead>
          <tr style="background:#e8edf2;">
            <th style="border:1px solid #333;padding:8px 10px;text-align:left;font-size:12px;">Material Name</th>
            <th style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:12px;width:150px;">Total Received (In)</th>
            <th style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:12px;width:150px;">Total Returned (Out)</th>
            <th style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:12px;width:180px;font-weight:bold;background:#dcfce7;color:#15803d;">Net Balance at Site</th>
          </tr>
        </thead>
        <tbody>
          ${summaryMats.map(m => {
            const sent = Store.Inventory.getSiteTotalSent(m.id, site.id);
            const returned = Store.Inventory.getSiteReturns(m.id, site.id);
            const net = sent - returned;
            return `
              <tr>
                <td style="border:1px solid #333;padding:8px 10px;font-size:12px;font-weight:bold;">${m.name}</td>
                <td style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:12px;">${sent.toLocaleString('en-IN')} ${m.unit}</td>
                <td style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:12px;color:red;">${returned > 0 ? '-' + returned.toLocaleString('en-IN') : '0'} ${m.unit}</td>
                <td style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:13px;font-weight:bold;background:#f0fdf4;color:#166534;">
                  ${net.toLocaleString('en-IN')} ${m.unit}
                </td>
              </tr>
            `;
          }).join('')}
          ${summaryMats.length === 0 ? `<tr><td colspan="4" style="border:1px solid #333;text-align:center;padding:15px;color:#888;font-style:italic;">No material transaction records found.</td></tr>` : ''}
        </tbody>
      </table>
    `;

    const buildHeader = matList => matList.map(m =>
      `<th style="border:1px solid #333;padding:5px 3px;font-size:10px;text-align:center;background:#e8edf2;min-width:46px;max-width:70px;word-break:break-word;">${m.name}<br><span style="font-weight:400;font-size:9px;color:#555;">${m.unit}</span></th>`
    ).join('');

    const buildRows = (rowKeys, matList, dataMap) => {
      if (!rowKeys.length) return `<tr><td colspan="99" style="text-align:center;padding:12px;color:#888;font-style:italic;">No records</td></tr>`;
      return rowKeys.map(key => {
        const rowData = dataMap[key] || {};
        const cells = matList.map(m => {
          const qty = rowData[m.id] || 0;
          return `<td style="text-align:center;border:1px solid #333;padding:5px 3px;font-size:12px;">${qty > 0 ? qty : ''}</td>`;
        }).join('');
        const refText = rowData.ref && rowData.ref !== '-' ? `<br><span style="font-size:10px;color:#666;">Ref: ${rowData.ref}</span>` : '';
        return `<tr>
          <td style="border:1px solid #333;padding:5px 6px;font-size:12px;white-space:nowrap;">
            ${safeFormatDate(rowData.date)}${refText}
          </td>
          ${cells}
          <td style="border:1px solid #333;padding:5px;width:55px;"></td>
        </tr>`;
      }).join('');
    };

    const fillerRows = (n, cols) => n <= 0 ? '' : Array.from({length: n}, () =>
      `<tr>${'<td style="border:1px solid #333;height:24px;"></td>'.repeat(cols + 2)}</tr>`
    ).join('');

    const challanTable = (matList, rowKeys, dataMap) => {
      if (!matList.length) return '<p style="color:#888;font-style:italic;font-size:12px;padding:6px 0;">No records.</p>';
      return `
        <table style="width:100%;border-collapse:collapse;margin-top:6px;">
          <thead>
            <tr>
              <th style="border:1px solid #333;padding:5px 6px;text-align:left;background:#e8edf2;min-width:80px;font-size:11px;">Date / Ref</th>
              ${buildHeader(matList)}
              <th style="border:1px solid #333;padding:5px;width:55px;background:#e8edf2;font-size:11px;">Sign.</th>
            </tr>
          </thead>
          <tbody>
            ${buildRows(rowKeys, matList, dataMap)}
            ${fillerRows(Math.max(0, 5 - rowKeys.length), matList.length)}
          </tbody>
        </table>`;
    };

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
      <html><head>
        <title>Challan - ${site.name}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
          .company { text-align:center; font-size:15px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:6px; }
          .info-row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px; font-size:13px; }
          .ul { border-bottom:1px solid #333; display:inline-block; padding:0 4px; min-width:140px; }
          .section-label { font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #333; padding-bottom:2px; margin:14px 0 4px; }
          .footer { text-align:center; font-size:14px; font-weight:bold; margin-top:16px; border-top:2px solid #333; padding-top:8px; letter-spacing:3px; }
          .page { width:100%; }
          .page-break { page-break-after: always; }
          @media print { button { display:none; } }
        </style>
      </head>
      <body>
        <!-- PAGE 1: RECEIVED -->
        <div class="page page-break">
          <div class="company">KSS — Material Delivery Challan</div>
          <div class="info-row">
            <span>No. <span class="ul">${site.tokenNumber || '-'}</span></span>
            <span>Dated <span class="ul">${today}</span></span>
          </div>
          <div class="info-row">
            <span>To Owner / Contractor <span class="ul" style="min-width:240px;">${site.customerName || '-'}</span></span>
          </div>
          <div class="info-row">
            <span>Site <span class="ul" style="min-width:200px;">${site.name}${site.address ? ', ' + site.address : ''}</span></span>
            <span>Lintel Date <span class="ul" style="min-width:120px;">${site.lintelDate ? safeFormatDate(site.lintelDate) : '&nbsp;'}</span></span>
            <span>Driver <span class="ul" style="min-width:120px;">&nbsp;</span></span>
          </div>
          <div class="section-label">Material Received at Site</div>
          ${challanTable(dispatchMats, dispatchRowKeys, dispatchMap)}
          <div class="footer">CHALLAN (IN)</div>
        </div>

        <!-- PAGE 2: RETURNED -->
        <div class="page page-break">
          <div class="company">KSS — Material Delivery Challan</div>
          <div class="info-row">
            <span>No. <span class="ul">${site.tokenNumber || '-'}</span></span>
            <span>Dated <span class="ul">${today}</span></span>
          </div>
          <div class="info-row">
            <span>To Owner / Contractor <span class="ul" style="min-width:240px;">${site.customerName || '-'}</span></span>
          </div>
          <div class="info-row">
            <span>Site <span class="ul" style="min-width:200px;">${site.name}${site.address ? ', ' + site.address : ''}</span></span>
            <span>Lintel Date <span class="ul" style="min-width:120px;">${site.lintelDate ? safeFormatDate(site.lintelDate) : '&nbsp;'}</span></span>
            <span>Driver <span class="ul" style="min-width:120px;">&nbsp;</span></span>
          </div>
          <div class="section-label">Material Returned from Site</div>
          ${challanTable(returnMats, returnRowKeys, returnMap)}
          <div class="footer">CHALLAN (RETURN)</div>
        </div>

        <!-- PAGE 3: SUMMARY / NET BALANCE -->
        <div class="page">
          <div class="company">KSS — Material Delivery Challan</div>
          <div class="info-row">
            <span>No. <span class="ul">${site.tokenNumber || '-'}</span></span>
            <span>Dated <span class="ul">${today}</span></span>
          </div>
          <div class="info-row">
            <span>To Owner / Contractor <span class="ul" style="min-width:240px;">${site.customerName || '-'}</span></span>
          </div>
          <div class="info-row">
            <span>Site <span class="ul" style="min-width:200px;">${site.name}${site.address ? ', ' + site.address : ''}</span></span>
            <span>Lintel Date <span class="ul" style="min-width:120px;">${site.lintelDate ? safeFormatDate(site.lintelDate) : '&nbsp;'}</span></span>
            <span style="opacity:0; pointer-events:none;">Driver <span class="ul" style="min-width:120px;">&nbsp;</span></span>
          </div>
          <div class="section-label">Material Inventory Summary (Net Balance at Site)</div>
          ${summaryTableHtml}
          <div class="footer">INVENTORY SUMMARY</div>
        </div>

        <script>window.onload = function(){ window.print(); };<\/script>
      </body></html>`);
    printWindow.document.close();
  },



  renderSiteInventory(site) {
    const materials = Store.Materials.getAll();
    const rows = [];
    
    // Find all material IDs that have any history at this site (including deleted ones)
    const activeMatIds = new Set();
    Store.Outgoing.getAll().filter(r => r.siteId === site.id).forEach(r => (r.items||[]).forEach(i => activeMatIds.add(i.materialId)));
    Store.Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id).forEach(r => (r.items||[]).forEach(i => activeMatIds.add(i.materialId)));
    Store.SiteReturns.getAll().filter(r => r.siteId === site.id).forEach(r => activeMatIds.add(r.materialId));
    Store.SiteUsage.getAll().filter(r => r.siteId === site.id).forEach(r => activeMatIds.add(r.materialId));
    Store.SiteDamaged.getAll().filter(r => r.siteId === site.id).forEach(r => activeMatIds.add(r.materialId));

    // Also include all current active materials
    materials.forEach(m => activeMatIds.add(m.id));

    activeMatIds.forEach(mId => {
      const m = Store.Materials.getById(mId);
      if (!m) return; // Skip deleted materials completely

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

document.addEventListener('click', (e) => {
  if (!e.target.closest('.searchable-combobox-wrapper')) {
    document.querySelectorAll('.mat-suggestions-menu').forEach(el => el.style.display = 'none');
  }
});
