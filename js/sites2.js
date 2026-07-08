/* ============================================
   BuildMate Sites Page
   ============================================ */

var SitesPage = {
  searchTerm: '',
  currentPage: 1,
  perPage: 8,
  initItems: [],

  render() {
    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Sites</h2>
          <p>Manage customer sites</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-outline" onclick="SitesPage.exportAllPDF()" style="display:inline-flex;align-items:center;gap:6px;">
            ${Icons.fileText} Export All Sites PDF
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
                  <input type="text" class="form-control" id="site-contact" placeholder="Contact Number">
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
                <div class="form-group">
                  <label>Site Budget / Cost (₹)</label>
                  <input type="number" class="form-control" id="site-budget" placeholder="0.00" min="0" step="1">
                </div>
              </div>
              <div class="form-group">
                <label>Location / Address</label>
                <input type="text" class="form-control" id="site-address" placeholder="Site address or location">
              </div>
              <div class="form-group" id="site-initial-materials-container" style="display: none;">
                <hr style="margin: 15px 0;">
                <label style="margin-bottom:10px;">Initial Material Dispatch (Optional)</label>
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
        // Pre-populate ALL materials — user only types quantities
        const allMaterials = Store.Materials.getAll();
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

    const materials = Store.Materials.getAll();

    if (this.initItems.length === 0) {
      list.innerHTML = '<p class="text-sm text-tertiary">No materials found. Add materials in the Products page first.</p>';
      return;
    }

    let html = `
      <table class="inline-table w-100 mb-2">
        <thead>
          <tr>
            <th style="width:45%">Material</th>
            <th style="width:22%; color: var(--success)">Received at Site</th>
            <th style="width:22%; color: var(--danger)">Returned from Site</th>
          </tr>
        </thead>
        <tbody>
    `;

    this.initItems.forEach((item, idx) => {
      const mat = materials.find(m => m.id === item.materialId);
      if (!mat) return;
      html += `
        <tr>
          <td>
            <div style="font-weight: 600; font-size: 0.95rem;">${mat.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 2px;">${mat.unit}${mat.sku ? ' &bull; ' + mat.sku : ''}</div>
          </td>
          <td>
            <input
              type="number"
              class="form-control"
              placeholder="0"
              min="0"
              step="1"
              data-material-id="${mat.id}"
              data-field="quantity"
              value="${item.quantity || ''}"
              oninput="this.value = this.value.replace(/[^0-9.]/g, ''); SitesPage.onInitNumInput(${idx}, 'quantity', this.value)"
            >
          </td>
          <td>
            <input
              type="number"
              class="form-control"
              placeholder="0"
              min="0"
              step="1"
              data-material-id="${mat.id}"
              data-field="returned"
              value="${item.returned || ''}"
              oninput="this.value = this.value.replace(/[^0-9.]/g, ''); SitesPage.onInitNumInput(${idx}, 'returned', this.value)"
            >
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    list.innerHTML = html;
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
    document.getElementById('site-budget').value = s.budget || '';
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
        budget: parseFloat(document.getElementById('site-budget').value) || 0
      };

      if (!data.name || !data.customerName) { alert('Site name and Customer name are required'); return; }

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

      // Sync DOM state for initial materials — read from data attributes (no dropdowns)
      const initRows = document.querySelectorAll('#site-initial-materials-list tbody tr');
      if (initRows.length > 0) {
        this.initItems = Array.from(initRows).map(row => {
          const qtyInput = row.querySelector('input[data-field="quantity"]');
          const retInput = row.querySelector('input[data-field="returned"]');
          const matId = qtyInput ? qtyInput.getAttribute('data-material-id') : '';
          return {
            materialId: matId,
            quantity: qtyInput ? qtyInput.value : '',
            returned: retInput ? retInput.value : ''
          };
        });
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
          date: data.startDate || new Date().toISOString().split('T')[0],
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

  exportAllPDF() {
    const allSites = Store.Sites.getAll().filter(s => s.status !== 'Archived');
    if (allSites.length === 0) { alert('No sites to export.'); return; }

    const materials = Store.Materials.getAll();
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const buildSitePage = (site) => {
      // Build cross-tab maps
      const dispatchMap = {};
      const returnMap   = {};
      const dispatchedMatIds = new Set();
      const returnedMatIds   = new Set();

      Store.Outgoing.getAll().filter(r => r.siteId === site.id).forEach(record => {
        (record.items || []).forEach(item => {
          const matId = typeof item.materialId === 'object' ? String(item.materialId._id || item.materialId.id || '') : String(item.materialId || '');
          if (!matId || !Store.Materials.getById(matId)) return;
          dispatchedMatIds.add(matId);
          dispatchMap[record.date] = dispatchMap[record.date] || {};
          dispatchMap[record.date][matId] = (dispatchMap[record.date][matId] || 0) + (parseFloat(item.quantity) || 0);
        });
      });

      Store.Incoming.getAll().filter(r => r.destinationType === 'site' && r.destinationSiteId === site.id).forEach(record => {
        (record.items || []).forEach(item => {
          const matId = typeof item.materialId === 'object' ? String(item.materialId._id || item.materialId.id || '') : String(item.materialId || '');
          if (!matId || !Store.Materials.getById(matId)) return;
          dispatchedMatIds.add(matId);
          dispatchMap[record.date] = dispatchMap[record.date] || {};
          dispatchMap[record.date][matId] = (dispatchMap[record.date][matId] || 0) + (parseFloat(item.quantity) || 0);
        });
      });

      Store.SiteReturns.getAll().filter(r => r.siteId === site.id).forEach(record => {
        const matId = typeof record.materialId === 'object' ? String(record.materialId._id || record.materialId.id || '') : String(record.materialId || '');
        if (!matId || !Store.Materials.getById(matId)) return;
        returnedMatIds.add(matId);
        returnMap[record.date] = returnMap[record.date] || {};
        returnMap[record.date][matId] = (returnMap[record.date][matId] || 0) + (parseFloat(record.quantity) || 0);
      });

      const dispatchMats  = [...dispatchedMatIds].map(id => Store.Materials.getById(id)).filter(Boolean);
      const returnMats    = [...returnedMatIds].map(id => Store.Materials.getById(id)).filter(Boolean);
      const dispatchDates = Object.keys(dispatchMap).sort();
      const returnDates   = Object.keys(returnMap).sort();

      const hdr = cols => cols.map(m =>
        `<th style="border:1px solid #333;padding:4px 3px;font-size:10px;text-align:center;background:#e8edf2;min-width:44px;word-break:break-word;">${m.name}<br><span style="font-weight:400;font-size:9px;color:#555;">${m.unit}</span></th>`
      ).join('');

      const rows = (dates, cols, map) => {
        if (!dates.length) return `<tr><td colspan="99" style="text-align:center;padding:8px;color:#888;font-style:italic;font-size:11px;">No records</td></tr>`;
        return dates.map(date => {
          const d = map[date] || {};
          return `<tr>
            <td style="border:1px solid #333;padding:4px 5px;font-size:11px;white-space:nowrap;">${fmtDate(date)}</td>
            ${cols.map(m => { const q = d[m.id] || 0; return `<td style="border:1px solid #333;padding:4px 3px;font-size:11px;text-align:center;">${q > 0 ? q : ''}</td>`; }).join('')}
            <td style="border:1px solid #333;padding:4px;width:50px;"></td>
          </tr>`;
        }).join('');
      };

      const filler = (n, cols) => n <= 0 ? '' : Array.from({length: n}, () =>
        `<tr>${'<td style="border:1px solid #333;height:20px;"></td>'.repeat(cols + 2)}</tr>`
      ).join('');

      const table = (cols, dates, map, label) => `
        <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #333;padding-bottom:2px;margin:10px 0 4px;">${label}</div>
        ${!cols.length
          ? '<p style="color:#888;font-size:11px;font-style:italic;padding:4px 0;">No records.</p>'
          : `<table style="width:100%;border-collapse:collapse;">
              <thead><tr>
                <th style="border:1px solid #333;padding:4px 5px;text-align:left;background:#e8edf2;min-width:75px;font-size:10px;">Date</th>
                ${hdr(cols)}
                <th style="border:1px solid #333;padding:4px;width:50px;background:#e8edf2;font-size:10px;">Sign.</th>
              </tr></thead>
              <tbody>
                ${rows(dates, cols, map)}
                ${filler(Math.max(0, 4 - dates.length), cols.length)}
              </tbody>
            </table>`
        }`;

      const headerHtml = `
        <div style="text-align:center;font-size:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">KSS — Material Delivery Challan</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
          <span>No. <span style="border-bottom:1px solid #333;display:inline-block;min-width:120px;padding:0 3px;">${site.tokenNumber || '-'}</span></span>
          <span>Dated <span style="border-bottom:1px solid #333;display:inline-block;min-width:100px;padding:0 3px;">${today}</span></span>
        </div>
        <div style="font-size:12px;margin-bottom:3px;">To Owner / Contractor <span style="border-bottom:1px solid #333;display:inline-block;min-width:220px;padding:0 3px;">${site.customerName || '-'}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
          <span>Site <span style="border-bottom:1px solid #333;display:inline-block;min-width:180px;padding:0 3px;">${site.name}${site.address ? ', ' + site.address : ''}</span></span>
          <span>Driver <span style="border-bottom:1px solid #333;display:inline-block;min-width:130px;"></span></span>
        </div>`;

      return `
        <div class="site-page page-break">
          ${headerHtml}
          ${table(dispatchMats, dispatchDates, dispatchMap, 'Material Received at Site')}
          <div style="text-align:center;font-size:12px;font-weight:bold;margin-top:12px;border-top:2px solid #333;padding-top:6px;letter-spacing:2px;">CHALLAN (IN)</div>
        </div>
        <div class="site-page page-break">
          ${headerHtml}
          ${table(returnMats, returnDates, returnMap, 'Material Returned from Site')}
          <div style="text-align:center;font-size:12px;font-weight:bold;margin-top:12px;border-top:2px solid #333;padding-top:6px;letter-spacing:2px;">CHALLAN (IN)</div>
        </div>`;
    };

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
      <html><head>
        <title>All Sites Report - ${new Date().toLocaleDateString('en-IN')}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
          .site-page { width: 100%; padding-bottom: 8px; }
          .page-break { page-break-after: always; }
          @media print { button { display: none; } }
        </style>
      </head><body>
        ${allSites.map(site => buildSitePage(site)).join('')}
        <script>window.onload = function(){ window.print(); };<\/script>
      </body></html>`);
    printWindow.document.close();
  }
};
