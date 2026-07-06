/* ============================================
   BuildMate Outgoing Stock Page
   ============================================ */

var OutgoingPage = {
  selectedId: null,
  searchTerm: '',
  formItems: [{ materialId: '', quantity: '', rate: '', amount: 0 }],
  prefillSiteId: null,

  render() {
    let records = Store.Outgoing.getAll().sort((a, b) => new Date(b.date) - new Date(a.date));
    const sites = Store.Sites.getAll();

    if (this.searchTerm) {
      const st = this.searchTerm.toLowerCase();
      records = records.filter(r => {
        const site = sites.find(s => s.id === r.siteId);
        const siteName = site ? site.name.toLowerCase() : '';
        const custName = site && site.customerName ? site.customerName.toLowerCase() : '';
        
        const materialNames = (r.items || []).map(i => {
           const m = materials.find(mat => mat.id === i.materialId);
           return m ? m.name.toLowerCase() : '';
        }).join(' ');

        return siteName.includes(st) || 
               custName.includes(st) ||
               materialNames.includes(st) ||
               (r.referenceNo || '').toLowerCase().includes(st) ||
               (r.date || '').includes(st);
      });
    }

    const materials = Store.Materials.getAll();

    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Outgoing Stock</h2>
          <p>Record new outgoing stock</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-danger" onclick="OutgoingPage.newRecord()">
            ${Icons.plus} New Outgoing
          </button>
        </div>
      </div>

      <div class="split-layout">
        <!-- Left: List -->
        <div class="card side-list">
          <div class="card-header">
            <h3>Records</h3>
            <div style="margin-top: 10px;">
              <input type="text" class="form-control" placeholder="Search site, customer, material, reference..." 
                     value="${this.searchTerm}" onkeyup="OutgoingPage.onSearch(event)">
            </div>
          </div>
          <div id="outgoing-list">
            ${records.map(r => {
              const site = sites.find(s => s.id === r.siteId);
              const totalAmt = (r.items || []).reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
              return `
                <div class="list-item ${this.selectedId === r.id ? 'active' : ''}" onclick="OutgoingPage.selectRecord('${r.id}')">
                  <div class="flex items-center justify-between">
                    <div class="item-title">${site ? site.customerName : 'Unknown Customer'}</div>
                    <span class="badge badge-outgoing">Outgoing</span>
                  </div>
                  <div class="item-sub">${site ? site.name : '-'} • ${new Date(r.date).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</div>
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
            <h3>Outgoing Stock Details</h3>
          </div>
          <div class="card-body" id="outgoing-form-area">
            ${this.renderForm()}
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const records = Store.Outgoing.getAll();
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
    const sites = Store.Sites.getAll().filter(s => s.status !== 'Archived');
    const materials = Store.Materials.getAll();
    const record = this.selectedId ? Store.Outgoing.getById(this.selectedId) : null;

    // Get available stock for each material
    const overview = Store.Inventory.getOverview();

    const items = record ? record.items : this.formItems;
    const totalAmount = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);

    return `
      <form id="outgoing-stock-form" onsubmit="event.preventDefault()">
        <div class="form-row">
          <div class="form-group" style="flex: 2;">
            <label>Destination Site *</label>
            <select class="form-control" id="out-site">
              <option value="">Select Site</option>
              ${sites.map(s => `<option value="${s.id}" ${(record && record.siteId === s.id) || (!record && this.prefillSiteId === s.id) ? 'selected' : ''}>${s.name} (${s.customerName || 'Unknown'})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Date *</label>
            <input type="date" class="form-control" id="out-date" value="${record ? record.date : new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Reference No</label>
            <input type="text" class="form-control" id="out-ref" placeholder="Reference number" value="${record ? record.referenceNo || '' : ''}">
          </div>
        </div>

        <div class="stock-form-section mt-4">
          <h4>Materials</h4>
          <div class="table-container">
            <table class="inline-table">
              <thead>
                <tr>
                  <th style="width:5%">#</th>
                  <th style="width:35%">Material</th>
                  <th style="width:15%">Qty</th>
                  <th style="width:15%">Available</th>
                  <th style="width:20%">Unit</th>
                  <th style="width:10%"></th>
                </tr>
              </thead>
              <tbody id="out-items-body">
                ${items.map((item, idx) => {
                  const prod = materials.find(p => p.id === item.materialId);
                  const stockInfo = overview.find(o => o.material.id === item.materialId);
                  const available = stockInfo ? stockInfo.warehouseStock : '-';
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>
                        <select class="form-control" onchange="OutgoingPage.onItemChange(${idx}, 'materialId', this.value)">
                          <option value="">Select Material</option>
                          ${materials.map(p => `<option value="${p.id}" ${item.materialId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                      </td>
                      <td><input type="number" class="form-control" value="${item.quantity || ''}" placeholder="0" onchange="OutgoingPage.onItemChange(${idx}, 'quantity', this.value)"></td>
                      <td><span class="text-sm ${typeof available === 'number' && available < 0 ? 'text-danger' : ''}">${typeof available === 'number' ? available.toLocaleString('en-IN') : '-'}</span></td>
                      <td><span class="text-sm">${prod ? prod.unit : '-'}</span></td>
                      <td>${items.length > 1 ? `<button class="btn btn-icon btn-ghost" onclick="OutgoingPage.removeItem(${idx})">${Icons.x}</button>` : ''}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:8px">
            <a class="add-row-link" onclick="OutgoingPage.addItem()">${Icons.plus} Add Material</a>
          </div>
        </div>

        <div class="form-group mt-3">
          <label>Notes</label>
          <textarea class="form-control" id="out-notes" rows="2" placeholder="Material required for 2nd floor work...">${record ? record.notes || '' : ''}</textarea>
        </div>

        <div class="flex justify-between mt-4">
          <button class="btn btn-outline" onclick="OutgoingPage.newRecord()">Cancel</button>
          <button class="btn btn-danger" onclick="OutgoingPage.save()">
            ${Icons.arrowUpCircle} Save Outgoing Stock
          </button>
        </div>
      </form>
    `;
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
    const area = document.getElementById('outgoing-form-area');
    if (area) area.innerHTML = this.renderForm();
  },

  newRecord(siteId = null) {
    this.selectedId = null;
    this.prefillSiteId = siteId;
    this.formItems = [{ materialId: '', quantity: '', rate: '', amount: 0 }];
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = this.render();
      this.init();
    }
  },

  selectRecord(id) {
    this.selectedId = id;
    const record = Store.Outgoing.getById(id);
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
    const siteId = document.getElementById('out-site').value;
    const date = document.getElementById('out-date').value;
    const referenceNo = document.getElementById('out-ref').value.trim();
    const notes = document.getElementById('out-notes').value.trim();

    if (!siteId) { alert('Site is required'); return; }
    if (!date) { alert('Date is required'); return; }

    const items = this.formItems.filter(i => i.materialId && parseFloat(i.quantity) > 0);
    if (items.length === 0) { alert('Add at least one material'); return; }

    const data = {
      siteId, date, referenceNo, notes,
      items: items.map(i => ({
        materialId: i.materialId,
        quantity: parseFloat(i.quantity) || 0,
        rate: parseFloat(i.rate) || 0,
        amount: (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0)
      }))
    };

    if (this.selectedId) {
      Store.Outgoing.update(this.selectedId, data);
    } else {
      const saved = Store.Outgoing.add(data);
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
