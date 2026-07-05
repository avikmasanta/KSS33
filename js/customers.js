/* ============================================
   BuildMate Customers Page
   ============================================ */

var CustomersPage = {
  searchTerm: '',
  currentPage: 1,
  perPage: 8,

  render() {
    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Customers</h2>
          <p>Manage all customers</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="CustomersPage.openModal()">
            ${Icons.plus} Add Customer
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-body" style="padding-bottom:0">
          <div class="toolbar">
            <div class="toolbar-left">
              <div class="search-input">
                ${Icons.search}
                <input type="text" placeholder="Search customers..." id="customer-search" oninput="CustomersPage.onSearch(this.value)">
              </div>
            </div>
          </div>
        </div>
        <div class="table-container" id="customers-table-container">
          ${this.renderTable()}
        </div>
      </div>

      <!-- Modal -->
      <div class="modal-backdrop" id="customer-modal">
        <div class="modal">
          <div class="modal-header">
            <h3 id="customer-modal-title">Add Customer</h3>
            <button class="modal-close" onclick="CustomersPage.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <form id="customer-form">
              <input type="hidden" id="cust-id">
              <div class="form-row">
                <div class="form-group">
                  <label>Customer Name *</label>
                  <input type="text" class="form-control" id="cust-name" required placeholder="Enter customer name">
                </div>
                <div class="form-group">
                  <label>Contact Person</label>
                  <input type="text" class="form-control" id="cust-contact" placeholder="Contact person name">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Phone</label>
                  <input type="text" class="form-control" id="cust-phone" placeholder="Phone number">
                </div>
                <div class="form-group">
                  <label>Email</label>
                  <input type="email" class="form-control" id="cust-email" placeholder="Email address">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>GST / Tax ID</label>
                  <input type="text" class="form-control" id="cust-gst" placeholder="GST number">
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select class="form-control" id="cust-status">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label>Address</label>
                <input type="text" class="form-control" id="cust-address" placeholder="Full address">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="CustomersPage.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="CustomersPage.save()">Save Customer</button>
          </div>
        </div>
      </div>
    `;
  },

  init() {},

  renderTable() {
    const allCustomers = Store.Customers.getAll();
    const filtered = allCustomers.filter(c =>
      !this.searchTerm || 
      c.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      (c.contactPerson || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      (c.phone || '').includes(this.searchTerm) ||
      (c.gstNo || '').toLowerCase().includes(this.searchTerm.toLowerCase())
    );

    const total = filtered.length;
    const totalPages = Math.ceil(total / this.perPage);
    if (this.currentPage > totalPages) this.currentPage = Math.max(1, totalPages);
    const start = (this.currentPage - 1) * this.perPage;
    const pageItems = filtered.slice(start, start + this.perPage);

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Customer Name</th>
            <th>Contact Person</th>
            <th>Phone</th>
            <th>GST / Tax ID</th>
            <th>Address</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageItems.length === 0 ? `
            <tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-tertiary)">No customers found</td></tr>
          ` : pageItems.map((c, i) => `
            <tr>
              <td class="secondary">${start + i + 1}</td>
              <td><strong>${c.name}</strong></td>
              <td>${c.contactPerson || '-'}</td>
              <td>${c.phone || '-'}</td>
              <td class="secondary">${c.gstNo || '-'}</td>
              <td class="secondary">${c.address || '-'}</td>
              <td><span class="badge badge-success">${c.status || 'Active'}</span></td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-icon btn-ghost" title="Edit" onclick="CustomersPage.edit('${c.id}')">${Icons.edit}</button>
                  <button class="btn btn-icon btn-ghost" title="Delete" onclick="CustomersPage.delete('${c.id}')">${Icons.trash}</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="pagination-bar">
        <div class="pagination-info">Showing ${total === 0 ? 0 : start + 1} to ${Math.min(start + this.perPage, total)} of ${total} customers</div>
        <div class="pagination-buttons">
          <button ${this.currentPage <= 1 ? 'disabled' : ''} onclick="CustomersPage.goPage(${this.currentPage - 1})">&laquo;</button>
          ${Array.from({length: totalPages}, (_, i) => `
            <button class="${i + 1 === this.currentPage ? 'active' : ''}" onclick="CustomersPage.goPage(${i + 1})">${i + 1}</button>
          `).join('')}
          <button ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="CustomersPage.goPage(${this.currentPage + 1})">&raquo;</button>
        </div>
      </div>
    `;
  },

  refresh() {
    const container = document.getElementById('customers-table-container');
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
    document.getElementById('customer-modal').classList.add('active');
    document.getElementById('customer-modal-title').textContent = editId ? 'Edit Customer' : 'Add Customer';
    if (!editId) {
      document.getElementById('customer-form').reset();
      document.getElementById('cust-id').value = '';
    }
  },

  closeModal() {
    document.getElementById('customer-modal').classList.remove('active');
  },

  edit(id) {
    const c = Store.Customers.getById(id);
    if (!c) return;
    document.getElementById('cust-id').value = c.id;
    document.getElementById('cust-name').value = c.name || '';
    document.getElementById('cust-contact').value = c.contactPerson || '';
    document.getElementById('cust-phone').value = c.phone || '';
    document.getElementById('cust-email').value = c.email || '';
    document.getElementById('cust-gst').value = c.gstNo || '';
    document.getElementById('cust-address').value = c.address || '';
    document.getElementById('cust-status').value = c.status || 'Active';
    this.openModal(id);
  },

  save() {
    const id = document.getElementById('cust-id').value;
    const data = {
      name: document.getElementById('cust-name').value.trim(),
      contactPerson: document.getElementById('cust-contact').value.trim(),
      phone: document.getElementById('cust-phone').value.trim(),
      email: document.getElementById('cust-email').value.trim(),
      gstNo: document.getElementById('cust-gst').value.trim(),
      address: document.getElementById('cust-address').value.trim(),
      status: document.getElementById('cust-status').value
    };

    if (!data.name) { alert('Customer name is required'); return; }

    if (id) {
      Store.Customers.update(id, data);
    } else {
      Store.Customers.add(data);
    }

    this.closeModal();
    this.refresh();
  },

  delete(id) {
    if (confirm('Are you sure you want to delete this customer?')) {
      Store.Customers.remove(id);
      this.refresh();
    }
  }
};
