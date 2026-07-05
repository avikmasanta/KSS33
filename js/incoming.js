/* ============================================
   BuildMate Incoming Stock Page
   ============================================ */

var IncomingPage = {
  selectedId: null,
  searchTerm: '',
  formItems: [{ materialId: '', quantity: '', rate: '', amount: 0 }],

  render() {
    let records = Store.Incoming.getAll().sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (this.searchTerm) {
      const st = this.searchTerm.toLowerCase();
      records = records.filter(r => {
        let siteStr = '';
        if (r.destinationType === 'site' && r.destinationSiteId) {
          const site = sites.find(s => s.id === r.destinationSiteId);
          if (site) siteStr = (site.name + ' ' + (site.customerName || '')).toLowerCase();
        }
        return (r.supplier || '').toLowerCase().includes(st) ||
               (r.invoiceNo || '').toLowerCase().includes(st) ||
               (r.referenceNo || '').toLowerCase().includes(st) ||
               siteStr.includes(st) ||
               (r.date || '').includes(st);
      });
    }

    const materials = Store.Materials.getAll();
    const sites = Store.Sites.getAll();

    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Incoming Stock</h2>
          <p>Record new incoming stock</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="IncomingPage.newRecord()">
            ${Icons.plus} New Incoming
          </button>
        </div>
      </div>

      <div class="split-layout">
        <!-- Left: List -->
        <div class="card side-list">
          <div class="card-header">
            <h3>Records</h3>
            <div style="margin-top: 10px;">
              <input type="text" class="form-control" placeholder="Search supplier, invoice..." 
                     value="${this.searchTerm}" onkeyup="IncomingPage.onSearch(event)">
            </div>
          </div>
          <div id="incoming-list">
            ${records.map(r => {
              const totalAmt = r.items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
              let destStr = 'Warehouse';
              if (r.destinationType === 'site' && r.destinationSiteId) {
                const site = sites.find(s => s.id === r.destinationSiteId);
                if (site) destStr = `Site: ${site.name} (${site.customerName || 'Unknown'})`;
              }
              return `
                <div class="list-item ${this.selectedId === r.id ? 'active' : ''}" onclick="IncomingPage.selectRecord('${r.id}')">
                  <div class="flex items-center justify-between">
                    <div class="item-title">${r.supplier || 'Unknown Supplier'}</div>
                    <span class="badge badge-incoming">Incoming</span>
                  </div>
                  <div class="item-sub">${r.invoiceNo || r.referenceNo || '-'} • ${destStr} • ${new Date(r.date).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</div>
                  <div class="item-sub" style="font-weight:600;color:var(--text-primary)">₹ ${totalAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
                </div>
              `;
            }).join('')}
            ${records.length === 0 ? '<div style="padding:30px;text-align:center;color:var(--text-tertiary)">No records yet</div>' : ''}
          </div>
        </div>

        <!-- Right: Form / Detail -->
        <div class="card detail-panel">
          <div class="card-header">
            <h3>Incoming Stock Details</h3>
          </div>
          <div class="card-body" id="incoming-form-area">
            ${this.renderForm()}
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const records = Store.Incoming.getAll();
    if (records.length > 0 && !this.selectedId && !this.searchTerm) {
      this.selectedId = records[records.length - 1].id;
    }
  },

  onSearch(e) {
    this.searchTerm = e.target.value;
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = this.render();
      const searchInput = container.querySelector('.side-list input[type="text"]');
      if (searchInput) {
        searchInput.focus();
        searchInput.setSelectionRange(this.searchTerm.length, this.searchTerm.length);
      }
      this.init();
    }
  },

  renderForm() {
    const materials = Store.Materials.getAll();
    const sites = Store.Sites.getAll();
    const record = this.selectedId ? Store.Incoming.getById(this.selectedId) : null;

    const items = record ? record.items : this.formItems;
    const totalAmount = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);

    return `
      <form id="incoming-stock-form" onsubmit="event.preventDefault()">
        <div class="form-row">
          <div class="form-group">
            <label>Supplier / Source *</label>
            <input type="text" class="form-control" id="inc-supplier" placeholder="Supplier name" value="${record ? record.supplier || '' : ''}">
          </div>
          <div class="form-group">
            <label>Invoice No</label>
            <input type="text" class="form-control" id="inc-invoice" placeholder="Invoice number" value="${record ? record.invoiceNo || '' : ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date *</label>
            <input type="date" class="form-control" id="inc-date" value="${record ? record.date : new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label>Reference No</label>
            <input type="text" class="form-control" id="inc-ref" placeholder="Reference" value="${record ? record.referenceNo || '' : ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Destination Type *</label>
            <select class="form-control" id="inc-dest-type" onchange="IncomingPage.onDestTypeChange()">
              <option value="warehouse" ${record && record.destinationType === 'warehouse' ? 'selected' : ''}>Warehouse</option>
              <option value="site" ${record && record.destinationType === 'site' ? 'selected' : ''}>Direct to Site</option>
            </select>
          </div>
          <div class="form-group" id="inc-site-group" style="display:${record && record.destinationType === 'site' ? 'block' : 'none'}">
            <label>Destination Site</label>
            <select class="form-control" id="inc-dest-site">
              <option value="">Select Site</option>
              ${sites.map(s => `<option value="${s.id}" ${record && record.destinationSiteId === s.id ? 'selected' : ''}>${s.name} (${s.customerName || 'Unknown'})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="stock-form-section mt-4">
          <h4>Materials</h4>
          <div class="table-container">
            <table class="inline-table">
              <thead>
                <tr>
                  <th style="width:5%">#</th>
                  <th style="width:40%">Material</th>
                  <th style="width:20%">Quantity</th>
                  <th style="width:25%">Unit</th>
                  <th style="width:10%"></th>
                </tr>
              </thead>
              <tbody id="inc-items-body">
                ${items.map((item, idx) => {
                  const prod = materials.find(p => p.id === item.materialId);
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>
                        <select class="form-control" onchange="IncomingPage.onItemChange(${idx}, 'materialId', this.value)">
                          <option value="">Select Material</option>
                          ${materials.map(p => `<option value="${p.id}" ${item.materialId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                      </td>
                      <td><input type="number" class="form-control" value="${item.quantity || ''}" placeholder="0" onchange="IncomingPage.onItemChange(${idx}, 'quantity', this.value)"></td>
                      <td><span class="text-sm">${prod ? prod.unit : '-'}</span></td>
                      <td>${items.length > 1 ? `<button class="btn btn-icon btn-ghost" onclick="IncomingPage.removeItem(${idx})">${Icons.x}</button>` : ''}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:8px">
            <a class="add-row-link" onclick="IncomingPage.addItem()">${Icons.plus} Add Material</a>
          </div>
        </div>

        <div class="form-group mt-3">
          <label>Notes</label>
          <textarea class="form-control" id="inc-notes" rows="2" placeholder="Additional notes...">${record ? record.notes || '' : ''}</textarea>
        </div>

        <div class="flex justify-between mt-4">
          <button class="btn btn-outline" onclick="IncomingPage.newRecord()">Cancel</button>
          <button class="btn btn-primary" onclick="IncomingPage.save()">
            ${Icons.arrowDownCircle} Save Incoming Stock
          </button>
        </div>
      </form>
    `;
  },

  onDestTypeChange() {
    const type = document.getElementById('inc-dest-type').value;
    document.getElementById('inc-site-group').style.display = type === 'site' ? 'block' : 'none';
  },

  onItemChange(idx, field, value) {
    const items = this.getFormItems();
    if (items[idx]) {
      items[idx][field] = value;
      if (field === 'materialId') {
        const material = Store.Materials.getById(value);
        if (material) items[idx].rate = material.unitPrice;
      }
      if (field === 'quantity' || field === 'rate' || field === 'materialId') {
        items[idx].amount = (parseFloat(items[idx].quantity) || 0) * (parseFloat(items[idx].rate) || 0);
      }
      this.formItems = items;
      this.refreshForm();
    }
  },

  getFormItems() {
    return [...this.formItems];
  },

  addItem() {
    this.formItems.push({ materialId: '', quantity: '', rate: '', amount: 0 });
    this.refreshForm();
  },

  removeItem(idx) {
    this.formItems.splice(idx, 1);
    this.refreshForm();
  },

  refreshForm() {
    const area = document.getElementById('incoming-form-area');
    if (area) area.innerHTML = this.renderForm();
  },

  newRecord() {
    this.selectedId = null;
    this.formItems = [{ materialId: '', quantity: '', rate: '', amount: 0 }];
    // Re-render entire page
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = this.render();
      this.init();
    }
  },

  selectRecord(id) {
    this.selectedId = id;
    const record = Store.Incoming.getById(id);
    if (record) {
      this.formItems = [...record.items];
    }
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = this.render();
      this.init();
    }
  },

  save() {
    const supplier = document.getElementById('inc-supplier').value.trim();
    const invoiceNo = document.getElementById('inc-invoice').value.trim();
    const date = document.getElementById('inc-date').value;
    const referenceNo = document.getElementById('inc-ref').value.trim();
    const destinationType = document.getElementById('inc-dest-type').value;
    const destinationSiteId = document.getElementById('inc-dest-site')?.value || '';
    const notes = document.getElementById('inc-notes').value.trim();

    if (!supplier) { alert('Supplier is required'); return; }
    if (!date) { alert('Date is required'); return; }

    const items = this.formItems.filter(i => i.materialId && parseFloat(i.quantity) > 0);
    if (items.length === 0) { alert('Add at least one material'); return; }

    const data = {
      supplier, invoiceNo, date, referenceNo, destinationType, destinationSiteId, notes,
      items: items.map(i => ({
        materialId: i.materialId,
        quantity: parseFloat(i.quantity) || 0,
        rate: parseFloat(i.rate) || 0,
        amount: (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0)
      }))
    };

    if (this.selectedId) {
      Store.Incoming.update(this.selectedId, data);
    } else {
      const saved = Store.Incoming.add(data);
      this.selectedId = saved.id;
    }

    this.formItems = [...data.items];
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = this.render();
      this.init();
    }
  }
};
