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
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Suspended">Suspended</option>
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
                  </select>
                </div>
                <div class="form-group">
                  <label>Start Date</label>
                  <input type="date" class="form-control" id="site-start-date">
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
        (s.gstNumber || '').toLowerCase().includes(st) ||
        (s.contactNumber || '').toLowerCase().includes(st) ||
        (s.address || '').toLowerCase().includes(st);
      const matchStatus = !statusFilter || s.status === statusFilter;
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
      const map = { 'Active': 'badge-success', 'Completed': 'badge-info', 'Suspended': 'badge-warning' };
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
                <td><strong>${s.name}</strong></td>
                <td>
                  <div><strong>${s.customerName || '-'}</strong></div>
                  <div class="text-sm text-tertiary">Ph: ${s.contactNumber || '-'}</div>
                  <div class="text-sm text-tertiary">GST: ${s.gstNumber || '-'}</div>
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
                      <button class="btn btn-icon btn-ghost" title="Delete" onclick="SitesPage.deleteSite('${s.id}')">${Icons.trash}</button>
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
        this.initItems = [{ materialId: '', quantity: '', returned: '' }];
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
    const overview = Store.Inventory.getOverview();

    let html = `
      <table class="inline-table w-100 mb-2">
        <thead>
          <tr>
            <th>Material</th>
            <th style="width:22%">Qty Sent</th>
            <th style="width:22%">Qty Returned</th>
            <th style="width:10%"></th>
          </tr>
        </thead>
        <tbody>
    `;
    
    this.initItems.forEach((item, idx) => {
      const stock = item.materialId ? (overview.find(o => o.material.id === item.materialId)?.warehouseStock || 0) : '-';
      html += `
        <tr>
          <td>
            <select class="form-control searchable-select" onchange="SitesPage.onInitItemChange(${idx}, 'materialId', this.value)">
              <option value="">Select Material...</option>
              ${Object.keys(materials.reduce((acc, m) => {
                acc[m.category] = acc[m.category] || [];
                acc[m.category].push(m);
                return acc;
              }, {})).map(cat => `
                <optgroup label="${cat}">
                  ${materials.filter(m => m.category === cat).map(m => `<option value="${m.id}" ${item.materialId === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
                </optgroup>
              `).join('')}
            </select>
          </td>
          <td>
            <input type="number" class="form-control" placeholder="Sent" min="1" value="${item.quantity}" onchange="SitesPage.onInitItemChange(${idx}, 'quantity', this.value)">
          </td>
          <td>
            <input type="number" class="form-control" placeholder="Returned" min="0" value="${item.returned || ''}" onchange="SitesPage.onInitItemChange(${idx}, 'returned', this.value)">
          </td>
          <td>
            ${this.initItems.length > 1 ? `<button type="button" class="btn btn-icon btn-ghost" onclick="SitesPage.removeInitItem(${idx})">${Icons.x}</button>` : ''}
          </td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
      <a class="add-row-link" style="cursor:pointer; color:var(--primary); font-size: 0.9rem;" onclick="SitesPage.addInitItem()">${Icons.plus} Add Material</a>
    `;
    
    list.innerHTML = html;
  },

  onInitItemChange(idx, field, value) {
    if (this.initItems[idx]) {
      this.initItems[idx][field] = value;
      this.renderInitItems();
    }
  },

  addInitItem() {
    this.initItems.push({ materialId: '', quantity: '', returned: '' });
    this.renderInitItems();
  },

  removeInitItem(idx) {
    this.initItems.splice(idx, 1);
    this.renderInitItems();
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
    this.openModal(id);
  },

  save() {
    const id = document.getElementById('site-id').value;
    const data = {
      name: document.getElementById('site-name').value.trim(),
      customerName: document.getElementById('site-customer-name').value.trim(),
      gstNumber: document.getElementById('site-gst').value.trim(),
      contactNumber: document.getElementById('site-contact').value.trim(),
      status: document.getElementById('site-status').value,
      startDate: document.getElementById('site-start-date').value,
      address: document.getElementById('site-address').value.trim()
    };

    if (!data.name || !data.customerName) { alert('Site name and Customer name are required'); return; }

    if (id) {
      Store.Sites.update(id, data);
    } else {
      const newSite = Store.Sites.add(data);
      
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

        // Mark returned quantities immediately
        const returnedDate = new Date().toISOString();
        this.initItems.forEach(item => {
          const returnedQty = parseFloat(item.returned) || 0;
          if (item.materialId && returnedQty > 0) {
            Store.SiteReturns.add({ siteId: newSite.id, materialId: item.materialId, quantity: returnedQty, date: returnedDate });
          }
        });
      }
    }

    this.closeModal();
    this.refresh();
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
          <p>Are you sure you want to delete the site "<strong>${s.name}</strong>"?</p>
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
      this.refresh();
      document.body.removeChild(overlay);
    };
  },

  viewDetails(siteId) {
    SiteDetailsPage.siteId = siteId;
    App.navigate('site-details');
  }
};
