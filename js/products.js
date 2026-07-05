/* ============================================
   BuildMate Materials Page
   ============================================ */

var MaterialsPage = {
  searchTerm: '',
  categoryFilter: '',
  currentPage: 1,
  perPage: 10,

  render() {
    const categories = [...new Set(Store.Materials.getAll().map(p => p.category))].sort();

    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Materials</h2>
          <p>Manage all materials</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-outline">${Icons.filter} Filter</button>
          <button class="btn btn-primary" onclick="MaterialsPage.openModal()">
            ${Icons.plus} Add Material
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-body" style="padding-bottom:0">
          <div class="toolbar">
            <div class="toolbar-left">
              <div class="search-input">
                ${Icons.search}
                <input type="text" placeholder="Search materials..." id="material-search" oninput="MaterialsPage.onSearch(this.value)">
              </div>
              <select class="filter-select" id="material-cat-filter" onchange="MaterialsPage.onCategoryChange(this.value)">
                <option value="">All Categories</option>
                ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
            <div class="toolbar-right">
              <span class="text-sm text-tertiary" id="material-count-label"></span>
            </div>
          </div>
        </div>
        <div class="table-container" id="materials-table-container">
          ${this.renderTable()}
        </div>
      </div>

      <!-- Modal -->
      <div class="modal-backdrop" id="material-modal">
        <div class="modal">
          <div class="modal-header">
            <h3 id="material-modal-title">Add Material</h3>
            <button class="modal-close" onclick="MaterialsPage.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <form id="material-form">
              <input type="hidden" id="prod-id">
              <div class="form-row">
                <div class="form-group">
                  <label>Material Name *</label>
                  <input type="text" class="form-control" id="prod-name" required placeholder="Material name">
                </div>
                <div class="form-group">
                  <label>SKU / Code *</label>
                  <input type="text" class="form-control" id="prod-sku" required placeholder="e.g., CEM001">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Category</label>
                  <select class="form-control" id="prod-category">
                    <option value="Cement">Cement</option>
                    <option value="Sand">Sand</option>
                    <option value="Steel">Steel</option>
                    <option value="Bricks">Bricks</option>
                    <option value="Aggregate">Aggregate</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Unit</label>
                  <select class="form-control" id="prod-unit">
                    <option value="Bag">Bag</option>
                    <option value="Kg">Kg</option>
                    <option value="Ton">Ton</option>
                    <option value="Piece">Piece</option>
                    <option value="Cft">Cft</option>
                    <option value="Sqft">Sqft</option>
                    <option value="Litre">Litre</option>
                    <option value="Nos">Nos</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Asset Price (₹)</label>
                  <input type="number" class="form-control" id="prod-price" placeholder="0.00" step="0.01">
                </div>
                <div class="form-group">
                  <label>Rental Rate / Day (₹)</label>
                  <input type="number" class="form-control" id="prod-rental" placeholder="0.00" step="0.01">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Reorder Level</label>
                  <input type="number" class="form-control" id="prod-reorder" placeholder="50">
                </div>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="prod-status">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="MaterialsPage.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="MaterialsPage.save()">Save Material</button>
          </div>
        </div>
      </div>

      <!-- Adjust Stock Modal -->
      <div class="modal-backdrop" id="mat-adjust-modal">
        <div class="modal">
          <div class="modal-header">
            <h3>Adjust Warehouse Stock: <span id="mat-adj-name"></span></h3>
            <button class="modal-close" onclick="MaterialsPage.closeAdjustModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <form id="mat-adjust-form">
              <input type="hidden" id="mat-adj-id">
              <input type="hidden" id="mat-adj-curr-stock">
              <p>Current Warehouse Stock: <strong id="mat-adj-curr-display">0</strong></p>
              <div class="form-group">
                <label>New Warehouse Stock *</label>
                <input type="number" class="form-control" id="mat-adj-new-stock" placeholder="0" required>
              </div>
              <div class="form-group">
                <label>Reason / Note</label>
                <input type="text" class="form-control" id="mat-adj-reason" placeholder="e.g. Opening Balance, Correction..." required>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="MaterialsPage.closeAdjustModal()">Cancel</button>
            <button class="btn btn-primary" onclick="MaterialsPage.saveAdjustment()">Save Adjustment</button>
          </div>
        </div>
      </div>
    `;
  },

  init() {},

  renderTable() {
    const allMaterials = Store.Materials.getAll();
    const overview = Store.Inventory.getOverview();

    const filtered = allMaterials.filter(p => {
      const matchSearch = !this.searchTerm || 
        p.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchCat = !this.categoryFilter || p.category === this.categoryFilter;
      return matchSearch && matchCat;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / this.perPage);
    if (this.currentPage > totalPages) this.currentPage = Math.max(1, totalPages);
    const start = (this.currentPage - 1) * this.perPage;
    const pageItems = filtered.slice(start, start + this.perPage);

    const formatPrice = (v) => '₹ ' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    // Update count label if exists
    setTimeout(() => {
      const label = document.getElementById('material-count-label');
      if (label) label.textContent = `${total} materials`;
    }, 0);

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Material Name</th>
            <th>SKU / Code</th>
            <th>Category</th>
            <th>Unit</th>
            <th>Stock (Total)</th>
            <th>Asset Price</th>
            <th>Rental/Day</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageItems.length === 0 ? `
            <tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-tertiary)">No materials found</td></tr>
          ` : pageItems.map((p, i) => `
            <tr>
              <td class="secondary">${start + i + 1}</td>
              <td><strong>${p.name}</strong></td>
              <td>${p.sku || '-'}</td>
              <td><span class="badge badge-neutral">${p.category || '-'}</span></td>
              <td>${p.unit || '-'}</td>
              <td><strong>${(overview.find(o => o.material.id === p.id)?.totalStock || 0).toLocaleString('en-IN')}</strong></td>
              <td>${formatPrice(p.unitPrice)}</td>
              <td>${formatPrice(p.rentalRate)}</td>
              <td><span class="badge ${p.status === 'Active' ? 'badge-success' : 'badge-warning'}">${p.status || 'Active'}</span></td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-icon btn-ghost" title="Adjust Stock" onclick="MaterialsPage.openAdjustModal('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${overview.find(o => o.material.id === p.id)?.warehouseStock || 0})">${Icons.activity}</button>
                  <button class="btn btn-icon btn-ghost" title="Edit" onclick="MaterialsPage.edit('${p.id}')">${Icons.edit}</button>
                  <button class="btn btn-icon btn-ghost" title="Delete" onclick="MaterialsPage.delete('${p.id}')">${Icons.trash}</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="pagination-bar">
        <div class="pagination-info">Showing ${total === 0 ? 0 : start + 1} to ${Math.min(start + this.perPage, total)} of ${total} materials</div>
        <div class="pagination-buttons">
          <button ${this.currentPage <= 1 ? 'disabled' : ''} onclick="MaterialsPage.goPage(${this.currentPage - 1})">&laquo;</button>
          ${Array.from({length: totalPages}, (_, i) => `
            <button class="${i + 1 === this.currentPage ? 'active' : ''}" onclick="MaterialsPage.goPage(${i + 1})">${i + 1}</button>
          `).join('')}
          <button ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="MaterialsPage.goPage(${this.currentPage + 1})">&raquo;</button>
        </div>
      </div>
    `;
  },

  refresh() {
    const container = document.getElementById('materials-table-container');
    if (container) container.innerHTML = this.renderTable();
  },

  onSearch(val) {
    this.searchTerm = val;
    this.currentPage = 1;
    this.refresh();
  },

  onCategoryChange(val) {
    this.categoryFilter = val;
    this.currentPage = 1;
    this.refresh();
  },

  goPage(page) {
    this.currentPage = page;
    this.refresh();
  },

  openModal(editId) {
    document.getElementById('material-modal').classList.add('active');
    document.getElementById('material-modal-title').textContent = editId ? 'Edit Material' : 'Add Material';
    if (!editId) {
      document.getElementById('material-form').reset();
      document.getElementById('prod-id').value = '';
    }
  },

  closeModal() {
    document.getElementById('material-modal').classList.remove('active');
  },

  edit(id) {
    const p = Store.Materials.getById(id);
    if (!p) return;
    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name || '';
    document.getElementById('prod-sku').value = p.sku || '';
    document.getElementById('prod-category').value = p.category || 'Other';
    document.getElementById('prod-unit').value = p.unit || 'Bag';
    document.getElementById('prod-price').value = p.unitPrice || '';
    document.getElementById('prod-rental').value = p.rentalRate || '';
    document.getElementById('prod-reorder').value = p.reorderLevel || '';
    document.getElementById('prod-status').value = p.status || 'Active';
    this.openModal(id);
  },

  save() {
    const id = document.getElementById('prod-id').value;
    const data = {
      name: document.getElementById('prod-name').value.trim(),
      sku: document.getElementById('prod-sku').value.trim(),
      category: document.getElementById('prod-category').value,
      unit: document.getElementById('prod-unit').value,
      unitPrice: parseFloat(document.getElementById('prod-price').value) || 0,
      rentalRate: parseFloat(document.getElementById('prod-rental').value) || 0,
      reorderLevel: parseInt(document.getElementById('prod-reorder').value) || 50,
      status: document.getElementById('prod-status').value
    };

    if (!data.name || !data.sku) { alert('Material name and SKU are required'); return; }

    if (id) {
      Store.Materials.update(id, data);
    } else {
      Store.Materials.add(data);
    }

    this.closeModal();
    this.refresh();
  },

  delete(id) {
    if (confirm('Are you sure you want to delete this material?')) {
      Store.Materials.remove(id);
      this.refresh();
    }
  },

  openAdjustModal(matId, matName, currStock) {
    document.getElementById('mat-adjust-modal').classList.add('active');
    document.getElementById('mat-adj-name').textContent = matName;
    document.getElementById('mat-adj-id').value = matId;
    document.getElementById('mat-adj-curr-stock').value = currStock;
    document.getElementById('mat-adj-curr-display').textContent = currStock.toLocaleString('en-IN');
    document.getElementById('mat-adjust-form').reset();
  },

  closeAdjustModal() {
    document.getElementById('mat-adjust-modal').classList.remove('active');
  },

  saveAdjustment() {
    const matId = document.getElementById('mat-adj-id').value;
    const currStock = parseFloat(document.getElementById('mat-adj-curr-stock').value) || 0;
    const newStock = parseFloat(document.getElementById('mat-adj-new-stock').value);
    const reason = document.getElementById('mat-adj-reason').value.trim() || 'Stock Adjustment';

    if (isNaN(newStock)) {
      alert('Please enter a valid number for the new stock.');
      return;
    }

    const diff = newStock - currStock;
    if (diff === 0) {
      this.closeAdjustModal();
      return;
    }

    // Create an incoming transaction for the difference
    const material = Store.Materials.getById(matId);
    Store.Incoming.add({
      date: new Date().toISOString().split('T')[0],
      referenceNo: 'ADJ-' + Date.now().toString().slice(-6),
      supplier: reason,
      destinationType: 'warehouse',
      notes: reason,
      items: [{
        materialId: matId,
        quantity: diff,
        rate: material ? material.unitPrice : 0,
        amount: diff * (material ? material.unitPrice : 0)
      }]
    });

    this.closeAdjustModal();
    this.refresh(); // Refresh Materials table
  }
};
