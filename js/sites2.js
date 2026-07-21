/* ============================================
   BuildMate Sites Page
   ============================================ */

var SitesPage = {
  searchTerm: '',
  currentPage: 1,
  perPage: 8,
  initItems: [],

  render() {
    const activeSites = Store.Sites.getAll().filter(s => s.status !== 'Archived');
    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Sites</h2>
          <p>Manage customer sites</p>
        </div>
        <div class="page-header-actions" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <select id="site-export-select" class="filter-select" style="min-width: 180px; height: 38px; border-radius: 6px; padding: 0 12px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); font-weight: 500;">
            <option value="ALL">Export All Sites</option>
            ${activeSites.map(s => `
              <option value="${s.id}">${s.name}</option>
            `).join('')}
          </select>
          <button class="btn btn-outline" onclick="SitesPage.handlePDFExport()" style="display:inline-flex;align-items:center;gap:6px;">
            ${Icons.fileText} Export PDF
          </button>
          <button class="btn btn-primary" onclick="SitesPage.openModal()">
            ${Icons.plus} Add Site
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-body" style="padding-bottom:0">
          <div class="toolbar">
            <div class="toolbar-left">
              <div class="search-input">
                ${Icons.search}
                <input type="text" placeholder="Search sites..." id="site-search" oninput="SitesPage.onSearch(this.value)">
              </div>
              <select class="filter-select" id="site-status-filter" onchange="SitesPage.onSearch(document.getElementById('site-search').value)">
                <option value="">Active & Completed (All)</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Suspended">Suspended</option>
                <option value="Archived">Archived (Deleted)</option>
              </select>
            </div>
          </div>
        </div>
        <div class="table-container" id="sites-table-container">
          ${this.renderTable()}
        </div>
      </div>

      <!-- Modal -->
      <div class="modal-backdrop" id="site-modal">
        <div class="modal">
          <div class="modal-header">
            <h3 id="site-modal-title">Add Site</h3>
            <button class="modal-close" onclick="SitesPage.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <form id="site-form">
              <input type="hidden" id="site-id">
              <div class="form-row">
                <div class="form-group">
                  <label>Site Name *</label>
                  <input type="text" class="form-control" id="site-name" required placeholder="Site name">
                </div>
                <div class="form-group">
                  <label>Customer Name *</label>
                  <input type="text" class="form-control" id="site-customer-name" required placeholder="Customer Name">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>GST Number</label>
                  <input type="text" class="form-control" id="site-gst" placeholder="GST Number">
                </div>
                <div class="form-group">
                  <label>Contact Number</label>
                  <input type="tel" class="form-control" id="site-contact" placeholder="10-digit Contact Number" maxlength="10" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0,10)">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Status</label>
                  <select class="form-control" id="site-status">
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Start Date</label>
                  <input type="date" class="form-control" id="site-start-date">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Token Number</label>
                  <input type="text" class="form-control" id="site-token" placeholder="Token Number">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Lintel Date / Day</label>
                  <input type="date" class="form-control" id="site-lintel-date">
                </div>
                <div class="form-group">
                  <label>Rate per Sq Ft (₹/sq ft)</label>
                  <input type="number" class="form-control" id="site-rate-sqft" placeholder="e.g. 12" min="0" step="0.01">
                </div>
              </div>
              <div class="form-group">
                <label>Location / Address</label>
                <input type="text" class="form-control" id="site-address" placeholder="Site address or location">
              </div>
              <div class="form-group">
                <label>Notes</label>
                <textarea class="form-control" id="site-notes" placeholder="Any remarks, instructions or special notes about this site..." rows="3" style="resize: vertical; min-height: 80px;"></textarea>
              </div>
              <div class="form-group" id="site-initial-materials-container" style="display: none;">
                <hr style="margin: 15px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                  <label style="margin:0;">Initial Material Dispatch (Optional)</label>
                  <div class="search-input" style="max-width:200px; margin:0; height:34px;">
                    ${Icons.search}
                    <input type="text" placeholder="Search material..." id="site-init-mat-search" style="padding:6px 12px 6px 30px; font-size:0.85rem;" oninput="SitesPage.onInitMatSearch(this.value)">
                  </div>
                </div>
                <p class="text-sm text-tertiary mb-2">Enter quantities to dispatch materials to this site immediately upon creation.</p>
                <div id="site-initial-materials-list"></div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="SitesPage.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="SitesPage.save()">Save Site</button>
          </div>
        </div>
      </div>
    `;
  },

  init() {},

  renderTable() {
    const allSites = Store.Sites.getAll();
    const statusFilter = document.getElementById('site-status-filter')?.value || '';

    const filtered = allSites.filter(s => {
      const st = this.searchTerm.toLowerCase();
      const matchSearch = !st ||
        (s.name || '').toLowerCase().includes(st) ||
        (s.customerName || '').toLowerCase().includes(st) ||
        (s.tokenNumber || '').toLowerCase().includes(st) ||
        (s.gstNumber || '').toLowerCase().includes(st) ||
        (s.contactNumber || '').toLowerCase().includes(st) ||
        (s.address || '').toLowerCase().includes(st);
      
      const matchStatus = !statusFilter ? (s.status !== 'Archived') : (s.status === statusFilter);
      return matchSearch && matchStatus;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / this.perPage);
    if (this.currentPage > totalPages) this.currentPage = Math.max(1, totalPages);
    const start = (this.currentPage - 1) * this.perPage;
    const pageItems = filtered.slice(start, start + this.perPage);

    const formatDate = (d) => {
      if (!d) return '-';
      return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const statusBadge = (status) => {
      const map = { 'Active': 'badge-success', 'Completed': 'badge-info', 'Suspended': 'badge-warning', 'Archived': 'badge-error' };
      return `<span class="badge ${map[status] || 'badge-neutral'}">${status}</span>`;
    };

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Site Name</th>
            <th>Customer Info</th>
            <th>Location</th>
            <th>Start Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageItems.length === 0 ? `
            <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-tertiary)">No sites found</td></tr>
          ` : pageItems.map((s, i) => {
            return `
              <tr>
                <td class="secondary">${start + i + 1}</td>
                <td>
                  <strong>${s.name}</strong>
                  <div style="font-size:0.75rem; color:var(--text-tertiary); font-family:monospace; margin-top:2px;">ID: ${s.id}</div>
                </td>
                <td>
                  <div><strong>${s.customerName || '-'}</strong></div>
                  <div class="text-sm text-tertiary">Ph: ${s.contactNumber || '-'}</div>
                  <div class="text-sm text-tertiary">GST: ${s.gstNumber || '-'}</div>
                  <div class="text-sm text-tertiary">Token: <strong style="color:var(--text-primary)">${s.tokenNumber || '-'}</strong></div>
                </td>
                <td class="secondary">${s.address || '-'}</td>
                <td class="secondary">${formatDate(s.startDate)}</td>
                <td>${statusBadge(s.status)}</td>
                <td>
                  <div class="table-actions">
                    ${s.status === 'Archived' ? `
                      <button class="btn btn-sm btn-outline" style="color:var(--success);border-color:var(--success);" title="Restore Site" onclick="SitesPage.restoreSite('${s.id}')">${Icons.refreshCw} Restore</button>
                      <button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger);" title="Permanent Delete" onclick="SitesPage.permanentDeleteSite('${s.id}')">${Icons.trash} Permanent Delete</button>
                    ` : `
                      <button class="btn btn-sm btn-outline" title="View Details" onclick="SitesPage.viewDetails('${s.id}')">${Icons.box} Dashboard</button>
                      <button class="btn btn-icon btn-ghost" title="Edit" onclick="SitesPage.edit('${s.id}')">${Icons.edit}</button>
                      <button class="btn btn-icon btn-ghost" title="Delete" style="color:var(--danger)" onclick="SitesPage.deleteSite('${s.id}')">${Icons.trash}</button>
                    `}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <div class="pagination-bar">
        <div class="pagination-info">Showing ${total === 0 ? 0 : start + 1} to ${Math.min(start + this.perPage, total)} of ${total} sites</div>
        <div class="pagination-buttons">
          <button ${this.currentPage <= 1 ? 'disabled' : ''} onclick="SitesPage.goPage(${this.currentPage - 1})">&laquo;</button>
          ${Array.from({length: totalPages}, (_, i) => `
            <button class="${i + 1 === this.currentPage ? 'active' : ''}" onclick="SitesPage.goPage(${i + 1})">${i + 1}</button>
          `).join('')}
          <button ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="SitesPage.goPage(${this.currentPage + 1})">&raquo;</button>
        </div>
      </div>
    `;
  },

  refresh() {
    const container = document.getElementById('sites-table-container');
    if (container) container.innerHTML = this.renderTable();
  },

  onSearch(val) {
    this.searchTerm = val;
    this.currentPage = 1;
    this.refresh();
  },

  goPage(page) {
    this.currentPage = page;
    this.refresh();
  },

  openModal(editId) {
    document.getElementById('site-modal').classList.add('active');
    document.getElementById('site-modal-title').textContent = editId ? 'Edit Site' : 'Add Site';

    const matContainer = document.getElementById('site-initial-materials-container');

    if (!editId) {
      document.getElementById('site-form').reset();
      document.getElementById('site-id').value = '';

      if (matContainer) {
        matContainer.style.display = 'block';
        this.initMatSearchTerm = '';
        const searchInput = document.getElementById('site-init-mat-search');
        if (searchInput) searchInput.value = '';
        // Pre-populate ALL materials sorted (plates first) — user only types quantities
        const allMaterials = Store.Materials.getSorted ? Store.Materials.getSorted() : Store.Materials.getAll();
        this.initItems = allMaterials.map(m => ({ materialId: m.id, quantity: '', returned: '' }));
        this.renderInitItems();
      }
    } else {
      if (matContainer) matContainer.style.display = 'none';
    }
  },

  renderInitItems() {
    const list = document.getElementById('site-initial-materials-list');
    if (!list) return;

    const materials = Store.Materials.getSorted ? Store.Materials.getSorted() : Store.Materials.getAll();

    if (this.initItems.length === 0) {
      list.innerHTML = '<p class="text-sm text-tertiary">No materials found. Add materials in the Products page first.</p>';
      return;
    }

    const searchStr = (this.initMatSearchTerm || '').toLowerCase().trim();

    let html = `
      <table class="inline-table w-100 mb-2" style="border-collapse:collapse;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border-color);">
            <th style="width:44%; padding: 10px 8px; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-tertiary); font-weight:600;">Material</th>
            <th style="width:19%; padding: 10px 8px; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#16a34a; font-weight:600; text-align:center;">Received</th>
            <th style="width:19%; padding: 10px 8px; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#dc2626; font-weight:600; text-align:center;">Returned</th>
            <th style="width:18%; padding: 10px 8px; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#15803d; font-weight:600; text-align:center;">Sq Ft</th>
          </tr>
        </thead>
        <tbody>
    `;

    let matchedCount = 0;
    this.initItems.forEach((item, idx) => {
      const mat = materials.find(m => m.id === item.materialId);
      if (!mat) return;

      const matchName = mat.name.toLowerCase().includes(searchStr);
      const matchSku = (mat.sku || '').toLowerCase().includes(searchStr);
      if (searchStr && !matchName && !matchSku) return;

      matchedCount++;
      const sqFtPer = Store.Materials.getSqFtPerUnit ? Store.Materials.getSqFtPerUnit(mat.id) : 0;
      const isPlate = sqFtPer > 0;
      const qty = parseFloat(item.quantity) || 0;
      const totalSqFt = qty * sqFtPer;
      html += `
        <tr id="init-row-${idx}" style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 10px 8px;">
            <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${mat.name}</div>
            <div style="font-size: 0.72rem; color: var(--text-tertiary); margin-top: 1px;">${mat.unit}${mat.sku ? ' · ' + mat.sku : ''}</div>
          </td>
          <td style="padding: 8px 6px; text-align:center;">
            <input
              type="number"
              class="form-control"
              placeholder="0"
              min="0"
              step="1"
              data-material-id="${mat.id}"
              data-sqft-per="${sqFtPer}"
              data-idx="${idx}"
              data-field="quantity"
              value="${item.quantity || ''}"
              style="text-align:center; padding: 6px 4px;"
              oninput="this.value = this.value.replace(/[^0-9.]/g, ''); SitesPage.onInitNumInput(${idx}, 'quantity', this.value); SitesPage.updateSqFtDisplay(${idx});"
            >
          </td>
          <td style="padding: 8px 6px; text-align:center;">
            <input
              type="number"
              class="form-control"
              placeholder="0"
              min="0"
              step="1"
              data-material-id="${mat.id}"
              data-field="returned"
              value="${item.returned || ''}"
              style="text-align:center; padding: 6px 4px;"
              oninput="this.value = this.value.replace(/[^0-9.]/g, ''); SitesPage.onInitNumInput(${idx}, 'returned', this.value)"
            >
          </td>
          <td id="sqft-display-${idx}" style="padding: 8px 6px; text-align:center; vertical-align:middle;">
            ${isPlate
              ? (totalSqFt > 0
                  ? `<span style="background:#dcfce7;color:#15803d;border-radius:6px;padding:3px 8px;font-size:0.78rem;font-weight:700;white-space:nowrap;">${totalSqFt % 1 === 0 ? totalSqFt : totalSqFt.toFixed(2)} sq ft</span>`
                  : `<span style="color:var(--text-tertiary);font-size:0.75rem;">${sqFtPer}/unit</span>`)
              : `<span style="color:var(--border-color);">—</span>`}
          </td>
        </tr>
      `;
    });

    if (matchedCount === 0) {
      html += `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:0.9rem;">No matching materials found</td></tr>`;
    }

    html += `
        </tbody>
      </table>
    `;

    list.innerHTML = html;
  },

  onInitMatSearch(val) {
    this.initMatSearchTerm = val;
    this.renderInitItems();
  },

  updateSqFtDisplay(idx) {
    const input = document.querySelector(`input[data-idx="${idx}"][data-field="quantity"]`);
    const display = document.getElementById(`sqft-display-${idx}`);
    if (!input || !display) return;
    const sqFtPer = parseFloat(input.getAttribute('data-sqft-per')) || 0;
    if (sqFtPer <= 0) return;
    const qty = parseFloat(input.value) || 0;
    const total = qty * sqFtPer;
    if (qty > 0) {
      const formatted = total % 1 === 0 ? total.toLocaleString('en-IN') : total.toFixed(2);
      display.innerHTML = `<span style="background:#dcfce7;color:#15803d;border-radius:6px;padding:3px 8px;font-size:0.78rem;font-weight:700;white-space:nowrap;">${formatted} sq ft</span>`;
    } else {
      display.innerHTML = `<span style="color:var(--text-tertiary);font-size:0.75rem;">${sqFtPer}/unit</span>`;
    }
  },

  onInitNumInput(idx, field, value) {
    // Allow only valid non-negative numbers
    const num = parseFloat(value);
    if (this.initItems[idx]) {
      this.initItems[idx][field] = isNaN(num) || num < 0 ? '' : value;
    }
  },

  closeModal() {
    document.getElementById('site-modal').classList.remove('active');
  },

  edit(id) {
    const s = Store.Sites.getById(id);
    if (!s) return;
    document.getElementById('site-id').value = s.id;
    document.getElementById('site-name').value = s.name || '';
    document.getElementById('site-customer-name').value = s.customerName || '';
    document.getElementById('site-gst').value = s.gstNumber || '';
    document.getElementById('site-contact').value = s.contactNumber || '';
    document.getElementById('site-status').value = s.status || 'Active';
    document.getElementById('site-start-date').value = s.startDate || '';
    document.getElementById('site-address').value = s.address || '';
    document.getElementById('site-token').value = s.tokenNumber || '';
    document.getElementById('site-lintel-date').value = s.lintelDate || '';
    document.getElementById('site-rate-sqft').value = s.ratePerSqFt || '';
    document.getElementById('site-notes').value = s.notes || '';
    this.openModal(id);
  },

  async save() {
    try {
      const id = document.getElementById('site-id').value;
      const data = {
        name: document.getElementById('site-name').value.trim(),
        customerName: document.getElementById('site-customer-name').value.trim(),
        gstNumber: document.getElementById('site-gst').value.trim(),
        contactNumber: document.getElementById('site-contact').value.trim(),
        status: document.getElementById('site-status').value,
        startDate: document.getElementById('site-start-date').value,
        address: document.getElementById('site-address').value.trim(),
        tokenNumber: document.getElementById('site-token').value.trim(),
        budget: 0, // Budget removed — determined by measurement billing
        lintelDate: document.getElementById('site-lintel-date').value,
        ratePerSqFt: parseFloat(document.getElementById('site-rate-sqft').value) || 0,
        notes: document.getElementById('site-notes').value.trim()
      };

      if (!data.name || !data.customerName) { alert('Site name and Customer name are required'); return; }

      // Phone validation — must be exactly 10 digits if provided
      if (data.contactNumber && !/^[0-9]{10}$/.test(data.contactNumber)) {
        alert('Contact Number must be exactly 10 digits (numbers only, no spaces or special characters)');
        document.getElementById('site-contact').focus();
        return;
      }

      if (id) {
        Store.Sites.update(id, data);
      } else {
        let newSite;
        // Bulletproof Fallback: if browser cached old store.js, do manual async fetch
        if (typeof Store.Sites.addAsync === 'function') {
          newSite = await Store.Sites.addAsync(data);
        } else {
          const tempId = 'id_' + Date.now();
          const newItem = { ...data, id: tempId };
          Store.Sites.getAll().push(newItem);
          const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api';
          try {
            const res = await fetch(`${API_URL}/sites`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newItem)
            });
            if (res.ok) {
              newSite = await res.json();
              const idx = Store.Sites.getAll().findIndex(s => s.id === tempId);
              if (idx > -1) Store.Sites.getAll()[idx] = newSite;
            } else {
              newSite = newItem;
            }
          } catch(e) {
            newSite = newItem;
          }
          try { localStorage.setItem('bm_sites', JSON.stringify(Store.Sites.getAll())); } catch(e) {}
        }


      // Process initial materials
      let items = [];
      this.initItems.forEach(item => {
        const qty = parseFloat(item.quantity) || 0;
        if (item.materialId && qty > 0) {
          const material = Store.Materials.getById(item.materialId);
          if (material) {
            items.push({
              materialId: material.id,
              quantity: qty,
              rate: material.unitPrice,
              amount: qty * material.unitPrice
            });
          }
        }
      });

      if (items.length > 0) {
        Store.Outgoing.add({
          siteId: newSite.id,
          date: data.startDate || localDateStr(),
          referenceNo: 'INIT-DISPATCH',
          notes: 'Initial material dispatch on site creation',
          items: items
        });
      }

      // Mark returned quantities immediately (independent of dispatch items)
      const returnedDate = new Date().toISOString();
      this.initItems.forEach(item => {
        const returnedQty = parseFloat(item.returned) || 0;
        if (item.materialId && returnedQty > 0) {
          Store.SiteReturns.add({ siteId: newSite.id, materialId: item.materialId, quantity: returnedQty, date: returnedDate });
        }
      });
      }

      this.closeModal();
      this.refresh();
    } catch (error) {
      alert('Error saving site: ' + error.message);
      console.error(error);
    }
  },

  async permanentDeleteSite(id) {
    if(confirm('Are you sure you want to PERMANENTLY delete this site? This action cannot be undone and will delete all associated data.')) {
      try {
        await Store.Sites.hardDelete(id);
        this.refresh();
      } catch (err) {
        alert("Delete failed: " + err.message);
      }
    }
  },

  deleteSite(id) {
    const s = Store.Sites.getById(id);
    if (!s) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop active';
    overlay.style.zIndex = '9999';
    overlay.innerHTML = `
      <div class="modal" style="max-width: 400px;">
        <div class="modal-header">
          <h3>Delete Site</h3>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete (archive) the site "<strong>${s.name}</strong>"?<br><br><span style="font-size:0.9em;color:var(--text-tertiary)">This will move it to the Archived tab. You can restore it later.</span></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="btn-cancel-del">Cancel</button>
          <button class="btn btn-primary" style="background-color: #ef4444; border-color: #ef4444;" id="btn-confirm-del">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('btn-cancel-del').onclick = () => {
      document.body.removeChild(overlay);
    };

    document.getElementById('btn-confirm-del').onclick = () => {
      Store.Sites.remove(id);
      Store.Sites.update(id, { status: 'Archived' });
      this.refresh();
      document.body.removeChild(overlay);
    };
  },

  restoreSite(id) {
    Store.Sites.update(id, { status: 'Active' });
    this.refresh();
  },

  viewDetails(siteId) {
    SiteDetailsPage.siteId = siteId;
    App.navigate('site-details');
  },

  handlePDFExport() {
    const selectEl = document.getElementById('site-export-select');
    if (!selectEl) return;
    const value = selectEl.value;
    if (value === 'ALL') {
      this.exportAllPDF();
    } else {
      SiteDetailsPage.siteId = value;
      SiteDetailsPage.exportPDF();
    }
  },

  exportAllPDF() {
    const allSites = Store.Sites.getAll().filter(s => s.status !== 'Archived');
    if (allSites.length === 0) { alert('No sites to export.'); return; }

    const materials = Store.Materials.getAll();
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const fmtDate = d => {
      if (!d) return '-';
      const parts = d.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const _resolveMatId = (matRef) => {
      if (!matRef) return '';
      if (typeof matRef === 'object') return String(matRef._id || matRef.id || '');
      return String(matRef);
    };

    const buildSitePages = (site) => {
      const allOutgoing = Store.Outgoing.getAll().filter(r => r.siteId === site.id);
      const allIncomingDirect = Store.Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id);
      const siteReturns = Store.SiteReturns.getAll().filter(r => r.siteId === site.id);

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

      // Inventory summary for site
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

      // Labour summary for site if LabourLogs available
      let siteLabourHtml = '';
      if (Store.LabourLogs) {
        const logs = Store.LabourLogs.getAll().filter(l => String(l.siteId) === String(site.id));
        if (logs.length > 0) {
          let p = 0, h = 0, a = 0, otH = 0, otP = 0, mg = 0;
          logs.forEach(l => {
            if (l.attendance === 'Present') p++;
            else if (l.attendance === 'Half Day') h++;
            else if (l.attendance === 'Absent') a++;
            const oH = parseFloat(l.overtimeHours) || 0;
            const dw = parseFloat(l.dailyWage) || 0;
            otH += oH;
            otP += oH > 0 ? (dw / 8) * oH : (parseFloat(l.overtime) || 0);
            mg += parseFloat(l.moneyGiven) || 0;
          });
          siteLabourHtml = `
            <div style="margin-top:15px;border:1px solid #333;padding:10px;background:#f8fafc;font-size:11px;">
              <strong>👷 Site Labour Log Summary:</strong> ${p} Present, ${h} Half Day, ${a} Absent | Overtime: ${otH} hrs (₹${otP.toLocaleString('en-IN')}) | Total Disbursed: ₹${mg.toLocaleString('en-IN')}
            </div>
          `;
        }
      }

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
              ${fmtDate(rowData.date)}${refText}
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

      return `
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
            <span>Lintel Date <span class="ul" style="min-width:120px;">${site.lintelDate ? fmtDate(site.lintelDate) : '&nbsp;'}</span></span>
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
            <span>Lintel Date <span class="ul" style="min-width:120px;">${site.lintelDate ? fmtDate(site.lintelDate) : '&nbsp;'}</span></span>
            <span>Driver <span class="ul" style="min-width:120px;">&nbsp;</span></span>
          </div>
          <div class="section-label">Material Returned from Site</div>
          ${challanTable(returnMats, returnRowKeys, returnMap)}
          <div class="footer">CHALLAN (RETURN)</div>
        </div>

        <!-- PAGE 3: SUMMARY / NET BALANCE -->
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
            <span>Lintel Date <span class="ul" style="min-width:120px;">${site.lintelDate ? fmtDate(site.lintelDate) : '&nbsp;'}</span></span>
            <span style="opacity:0; pointer-events:none;">Driver <span class="ul" style="min-width:120px;">&nbsp;</span></span>
          </div>
          <div class="section-label">Material Inventory Summary (Net Balance at Site)</div>
          ${summaryTableHtml}
          ${siteLabourHtml}
          <div class="footer">INVENTORY SUMMARY</div>
        </div>
      `;
    };

    // Overall summary page HTML
    const buildFinalSummaryPage = () => {
      let totalIssued = 0, totalReturned = 0;
      const matTotals = {};
      allSites.forEach(s => {
        materials.forEach(m => {
          const sent = Store.Inventory.getSiteTotalSent(m.id, s.id);
          const returned = Store.Inventory.getSiteReturns(m.id, s.id);
          if (sent > 0 || returned > 0) {
            if (!matTotals[m.id]) {
              matTotals[m.id] = { name: m.name, unit: m.unit, sent: 0, returned: 0 };
            }
            matTotals[m.id].sent += sent;
            matTotals[m.id].returned += returned;
            totalIssued += sent;
            totalReturned += returned;
          }
        });
      });

      let totalLabourPresent = 0, totalLabourHalf = 0, totalLabourAbsent = 0;
      let totalLabourOtHours = 0, totalLabourOtPay = 0, totalLabourPaid = 0;

      if (Store.LabourLogs) {
        Store.LabourLogs.getAll().forEach(l => {
          if (l.attendance === 'Present') totalLabourPresent++;
          else if (l.attendance === 'Half Day') totalLabourHalf++;
          else if (l.attendance === 'Absent') totalLabourAbsent++;
          const otH = parseFloat(l.overtimeHours) || 0;
          const dw = parseFloat(l.dailyWage) || 0;
          totalLabourOtHours += otH;
          totalLabourOtPay += otH > 0 ? (dw / 8) * otH : (parseFloat(l.overtime) || 0);
          totalLabourPaid += parseFloat(l.moneyGiven) || 0;
        });
      }

      const rowsHtml = Object.values(matTotals).map(m => `
        <tr>
          <td style="border:1px solid #333;padding:8px 10px;font-size:12px;font-weight:bold;">${m.name}</td>
          <td style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:12px;">${m.sent.toLocaleString('en-IN')} ${m.unit}</td>
          <td style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:12px;color:red;">${m.returned > 0 ? '-' + m.returned.toLocaleString('en-IN') : '0'} ${m.unit}</td>
          <td style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:13px;font-weight:bold;background:#f0fdf4;color:#166534;">
            ${(m.sent - m.returned).toLocaleString('en-IN')} ${m.unit}
          </td>
        </tr>
      `).join('');

      return `
        <div class="page">
          <div class="company">KSS — Consolidated Report Summary</div>
          <div class="info-row">
            <span>Report Type: <span class="ul" style="min-width:200px;">All Sites Combined Summary</span></span>
            <span>Dated <span class="ul">${today}</span></span>
          </div>
          <div class="section-label">Overall Material Inventory Summary Across All Sites</div>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <thead>
              <tr style="background:#e8edf2;">
                <th style="border:1px solid #333;padding:8px 10px;text-align:left;font-size:12px;">Material Name</th>
                <th style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:12px;width:150px;">Total Issued Across Sites</th>
                <th style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:12px;width:150px;">Total Returned Across Sites</th>
                <th style="border:1px solid #333;padding:8px 10px;text-align:right;font-size:13px;font-weight:bold;background:#dcfce7;color:#15803d;">Net Balance at All Sites</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4" style="border:1px solid #333;text-align:center;padding:15px;color:#888;font-style:italic;">No records found.</td></tr>'}
            </tbody>
          </table>

          <div class="section-label" style="margin-top:20px;">Overall Labour Attendance & Payroll Summary</div>
          <div style="border:1px solid #333;padding:12px;background:#f8fafc;font-size:12px;line-height:1.6;">
            <div><strong>Total Labour Log Entries:</strong> ${totalLabourPresent + totalLabourHalf + totalLabourAbsent}</div>
            <div><strong>Attendance Breakdown:</strong> ${totalLabourPresent} Present | ${totalLabourHalf} Half Day | ${totalLabourAbsent} Absent</div>
            <div><strong>Total Overtime Worked:</strong> ${totalLabourOtHours} hrs (Total OT Value: ₹${totalLabourOtPay.toLocaleString('en-IN')})</div>
            <div><strong>Total Payments Disbursed to Labour:</strong> <strong style="color:#15803d;font-size:13px;">₹${totalLabourPaid.toLocaleString('en-IN')}</strong></div>
          </div>

          <div class="footer">ALL SITES OVERALL SUMMARY</div>
        </div>
      `;
    };

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
      <html><head>
        <title>All Sites Report - ${new Date().toLocaleDateString('en-IN')}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
          .company { text-align:center; font-size:15px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:6px; }
          .info-row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px; font-size:13px; }
          .ul { border-bottom:1px solid #333; display:inline-block; padding:0 4px; min-width:140px; }
          .section-label { font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #333; padding-bottom:2px; margin:14px 0 4px; }
          .footer { text-align:center; font-size:14px; font-weight:bold; margin-top:16px; border-top:2px solid #333; padding-top:8px; letter-spacing:3px; }
          .page { width: 100%; }
          .page-break { page-break-after: always; }
          @media print { button { display: none; } }
        </style>
      </head><body>
        ${allSites.map(site => buildSitePages(site)).join('')}
        ${buildFinalSummaryPage()}
        <script>window.onload = function(){ window.print(); };<\/script>
      </body></html>`);
    printWindow.document.close();
  }
};
