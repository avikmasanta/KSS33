/* ============================================
   BuildMate Rental Sites Module (Material Hire)
   ============================================ */

var RentalsPage = {
  selectedId: null,
  searchTerm: '',
  formItems: [{ materialId: '', quantity: '', rate: '' }],
  isEditing: false,

  render() {
    const materials = Store.Materials.getAll();
    let records = Store.RentalSites.getAll().sort((a, b) => new Date(b.createdAt || b.goingDate) - new Date(a.createdAt || a.goingDate));

    if (this.searchTerm) {
      const st = this.searchTerm.toLowerCase();
      records = records.filter(r => 
        (r.customerName || '').toLowerCase().includes(st) || 
        (r.siteName || '').toLowerCase().includes(st)
      );
    }

    return `
      <div class="page-header" style="background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-body) 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center;">
        <div class="page-header-title" style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 48px; height: 48px; background: rgba(59, 130, 246, 0.1); color: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            ${Icons.truck}
          </div>
          <div>
            <h2 style="margin: 0; font-size: 1.5rem; color: var(--text-primary);">Rental Sites</h2>
            <p style="margin: 4px 0 0 0; color: var(--text-tertiary);">Track materials leased on daily rates</p>
          </div>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="RentalsPage.newRecord()" style="display:inline-flex;align-items:center;gap:6px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">
            ${Icons.plus} New Rental Site
          </button>
        </div>
      </div>

      <div class="split-layout">
        <!-- Left: List -->
        <div class="card side-list">
          <div class="card-header" style="border-bottom: 1px solid var(--border-color); padding: 16px;">
            <h3 style="margin: 0 0 12px 0; font-size: 1.1rem; color: var(--text-primary);">Active Rentals</h3>
            <div style="position: relative;">
              <input type="text" class="form-control" placeholder="Search customer or site..." 
                     value="${this.searchTerm}" onkeyup="RentalsPage.onSearch(event)" style="background: var(--bg-body); padding-left: 36px;">
              <div style="position: absolute; left: 12px; top: 10px; width: 16px; height: 16px; color: var(--text-tertiary);">${Icons.search}</div>
            </div>
          </div>
          <div id="rentals-list" style="max-height: 65vh; overflow-y: auto;">
            ${records.map(r => {
              const totalItems = r.items ? r.items.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0) : 0;
              const days = RentalsPage.getInclusiveDays(r.goingDate, r.comingDate);
              const totalVal = r.items ? r.items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.rate || 0) * days), 0) : 0;

              return `
                <div class="list-item ${this.selectedId === r.id ? 'active' : ''}" style="cursor: pointer; padding: 16px; border-bottom: 1px solid var(--border-color); transition: background-color 0.2s;" onclick="RentalsPage.selectRecord('${r.id}')">
                  <div class="flex items-center justify-between" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div class="item-title" style="font-weight: 700; color: var(--text-primary);">${r.customerName}</div>
                    <span class="badge ${r.status === 'Active' ? 'badge-warning' : 'badge-success'}">${r.status === 'Active' ? 'Leased' : 'Returned'}</span>
                  </div>
                  <div class="item-sub" style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 4px;">Site: ${r.siteName || '-'}</div>
                  <div class="item-sub" style="font-size: 0.8rem; color: var(--text-tertiary); display:flex; justify-content:space-between; align-items:center;">
                    <span>Qty: ${totalItems} • ${days} Days</span>
                    <strong style="color: var(--success); font-size: 0.95rem;">₹${totalVal.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              `;
            }).join('')}
            ${records.length === 0 ? '<div style="padding:40px;text-align:center;color:var(--text-tertiary)">No rental sites found</div>' : ''}
          </div>
        </div>

        <!-- Right: Form / Detail -->
        <div class="card detail-panel" style="box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
          <div class="card-header" style="border-bottom: 1px solid var(--border-color); padding: 20px;">
            <h3 style="margin:0; font-size: 1.15rem; color: var(--text-primary);">Rental Contract Details</h3>
          </div>
          <div class="card-body" id="rentals-form-area" style="padding: 24px;">
            ${this.isEditing ? this.renderForm() : this.renderDetails()}
          </div>
        </div>
      </div>
    `;
  },

  init() {
    // Row hover styles
    const items = document.querySelectorAll('#rentals-list .list-item');
    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        if (!item.classList.contains('active')) item.style.backgroundColor = 'var(--bg-body)';
      });
      item.addEventListener('mouseleave', () => {
        if (!item.classList.contains('active')) item.style.backgroundColor = 'transparent';
      });
    });
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

  refresh() {
    const container = document.getElementById('page-container');
    if (container && window.location.hash === '#rentals') {
      container.innerHTML = this.render();
      this.init();
    }
  },

  getInclusiveDays(date1, date2) {
    if (!date1 || !date2) return 0;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    const diffMs = utc2 - utc1;
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  },

  renderDetails() {
    if (!this.selectedId) {
      return `
        <div style="text-align: center; padding: 80px 20px; color: var(--text-tertiary);">
          <div style="width: 64px; height: 64px; margin: 0 auto 16px; opacity: 0.3;">${Icons.truck}</div>
          <h3 style="margin: 0 0 8px 0; color: var(--text-secondary);">No Contract Selected</h3>
          <p style="margin: 0; font-size: 0.9rem;">Select a rental site from the left side, or create a new one.</p>
        </div>
      `;
    }

    const r = Store.RentalSites.getById(this.selectedId);
    if (!r) return '<div class="empty-state">Contract not found</div>';

    const materials = Store.Materials.getAll();
    const days = this.getInclusiveDays(r.goingDate, r.comingDate);
    const grandTotal = r.items ? r.items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.rate || 0) * days), 0) : 0;

    return `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:24px; border-bottom: 1px solid var(--border-color); padding-bottom:20px;">
        <div>
          <h3 style="margin:0 0 8px 0; font-size:1.6rem; color:var(--text-primary); font-weight:800;">${r.customerName}</h3>
          <p style="margin:0; color:var(--text-secondary); font-size:1rem; display:flex; align-items:center; gap:8px;">
            ${Icons.mapPin} Site: <strong>${r.siteName || '-'}</strong>
          </p>
        </div>
        <div style="display:flex; gap:10px;">
          ${r.status === 'Active' ? `
            <button class="btn btn-success" onclick="RentalsPage.markReturned()" style="display:inline-flex;align-items:center;gap:6px;">
              ${Icons.check} Mark Returned
            </button>
          ` : ''}
          <button class="btn btn-outline" onclick="RentalsPage.printChallan()" style="display:inline-flex;align-items:center;gap:6px;">
            ${Icons.fileText} Print Challan
          </button>
          <button class="btn btn-outline" onclick="RentalsPage.editRecord()" style="display:inline-flex;align-items:center;gap:6px;">
            ${Icons.edit} Edit
          </button>
          <button class="btn btn-danger" onclick="RentalsPage.deleteRecord()" style="display:inline-flex;align-items:center;gap:6px;">
            ${Icons.trash} Delete
          </button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 30px;">
        <div style="background: var(--bg-body); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.8rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Going Date (Dispatch)</div>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 1.1rem; display:flex; align-items:center; gap:6px;">
            ${Icons.calendar} ${r.goingDate}
          </div>
        </div>
        <div style="background: var(--bg-body); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.8rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Coming Date (Return)</div>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 1.1rem; display:flex; align-items:center; gap:6px;">
            ${Icons.calendar} ${r.comingDate || '-'}
          </div>
        </div>
        <div style="background: var(--bg-body); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.8rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Rental Duration</div>
          <div style="font-weight: 700; color: var(--primary); font-size: 1.1rem;">
            ${days} Days (Inclusive)
          </div>
        </div>
        <div style="background: var(--bg-body); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.8rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Contract Status</div>
          <div style="font-weight: 700;">
            <span class="badge ${r.status === 'Active' ? 'badge-warning' : 'badge-success'}">${r.status === 'Active' ? 'Leased Out' : 'Returned'}</span>
          </div>
        </div>
      </div>

      <h4 style="margin: 0 0 12px 0; font-size: 1.1rem; color: var(--text-primary);">Leased Materials</h4>
      <div class="table-container" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; margin-bottom:24px;">
        <table class="data-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: var(--bg-body);">
              <th align="left" style="padding: 12px 16px;">Material</th>
              <th align="center" style="padding: 12px 16px; text-align:center;">Qty Leased</th>
              <th align="right" style="padding: 12px 16px; text-align:right;">Rate (per Day)</th>
              <th align="right" style="padding: 12px 16px; text-align:right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${r.items.map(i => {
              const mat = materials.find(m => m.id === i.materialId);
              const total = parseFloat(i.quantity || 0) * parseFloat(i.rate || 0) * days;
              return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 14px 16px;">
                    <div style="font-weight: 600; color: var(--text-primary);">${mat ? mat.name : 'Unknown Material'}</div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 2px;">${mat ? mat.sku : '-'}</div>
                  </td>
                  <td align="center" style="padding: 14px 16px; text-align:center; font-weight: 600;">
                    ${i.quantity} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-secondary);">${mat ? mat.unit : ''}</span>
                  </td>
                  <td align="right" style="padding: 14px 16px; text-align:right; font-weight: 600; color: var(--text-secondary);">
                    ₹${parseFloat(i.rate || 0).toLocaleString('en-IN')}
                  </td>
                  <td align="right" style="padding: 14px 16px; text-align:right; font-weight: 700; color: var(--success);">
                    ₹${total.toLocaleString('en-IN')}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: flex-end; align-items: center; background: var(--bg-body); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
        <div style="text-align: right;">
          <div style="font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Grand Total Earnings</div>
          <div style="font-size: 2rem; font-weight: 800; color: var(--success); line-height: 1;">
            ₹${grandTotal.toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    `;
  },

  renderForm() {
    const materials = Store.Materials.getAll();
    const record = this.selectedId ? Store.RentalSites.getById(this.selectedId) : null;

    return `
      <form id="rental-stock-form" onsubmit="event.preventDefault(); RentalsPage.save();">
        <div class="form-row">
          <div class="form-group">
            <label>Customer Name *</label>
            <input type="text" class="form-control" id="rental-cust-name" required placeholder="e.g. John Doe" value="${record ? record.customerName : ''}" style="background: var(--bg-body);">
          </div>
          <div class="form-group">
            <label>Site Address / Location *</label>
            <input type="text" class="form-control" id="rental-site-name" required placeholder="e.g. Sector 5, Lane 2" value="${record ? record.siteName : ''}" style="background: var(--bg-body);">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Going Date (Lease Start) *</label>
            <input type="date" class="form-control" id="rental-going-date" required onchange="RentalsPage.calculateFormTotals()" value="${record ? record.goingDate : new Date().toISOString().split('T')[0]}" style="background: var(--bg-body);">
          </div>
          <div class="form-group">
            <label>Coming Date (Lease End) *</label>
            <input type="date" class="form-control" id="rental-coming-date" required onchange="RentalsPage.calculateFormTotals()" value="${record ? record.comingDate : new Date().toISOString().split('T')[0]}" style="background: var(--bg-body);">
          </div>
        </div>

        <div class="stock-form-section mt-4">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="margin:0; font-size:1.1rem; color:var(--text-primary);">Leased Materials</h4>
            <div style="font-size:0.9rem; color:var(--text-secondary); font-weight:600;" id="rental-form-days-label">Duration: 1 Day</div>
          </div>
          <div class="table-container" style="border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
            <table class="inline-table">
              <thead>
                <tr style="background: var(--bg-body);">
                  <th style="width:5%">#</th>
                  <th style="width:40%">Material</th>
                  <th style="width:20%">Quantity</th>
                  <th style="width:20%">Daily Rate (₹)</th>
                  <th style="width:15%">Line Total</th>
                  <th style="width:10%"></th>
                </tr>
              </thead>
              <tbody id="rental-items-body">
                ${this.formItems.map((item, idx) => {
                  const prod = materials.find(p => p.id === item.materialId);
                  const currentAllocated = record ? (record.items.find(i => i.materialId === item.materialId)?.quantity || 0) : 0;
                  const available = prod ? (Store.Inventory.getWarehouseCurrentBalance(prod.id) + parseFloat(currentAllocated)) : 0;
                  
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>
                        <select class="form-control searchable-select" onchange="RentalsPage.onItemChange(${idx}, 'materialId', this.value)" style="background: var(--bg-body);">
                          <option value="">Select Material</option>
                          ${Object.keys(materials.reduce((acc, m) => {
                            acc[m.category] = acc[m.category] || [];
                            acc[m.category].push(m);
                            return acc;
                          }, {})).map(cat => `
                            <optgroup label="${cat}">
                              ${materials.filter(m => m.category === cat).map(p => `<option value="${p.id}" ${item.materialId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                            </optgroup>
                          `).join('')}
                        </select>
                        ${prod ? `<div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">Available stock: <strong style="color:var(--primary);">${available}</strong> ${prod.unit}</div>` : ''}
                      </td>
                      <td>
                        <input type="number" class="form-control r-qty" value="${item.quantity || ''}" placeholder="0" min="1" oninput="RentalsPage.onItemChange(${idx}, 'quantity', this.value)" style="background: var(--bg-body);">
                      </td>
                      <td>
                        <input type="number" class="form-control r-rate" value="${item.rate || ''}" placeholder="0" min="0.01" step="0.01" oninput="RentalsPage.onItemChange(${idx}, 'rate', this.value)" style="background: var(--bg-body);">
                      </td>
                      <td style="font-weight: 700; color: var(--success); font-size: 1rem; vertical-align: middle;" class="r-line-total">
                        ₹0
                      </td>
                      <td>
                        ${this.formItems.length > 1 ? `<button type="button" class="btn btn-icon btn-ghost" onclick="RentalsPage.removeItem(${idx})">${Icons.x}</button>` : ''}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:12px">
            <a class="add-row-link" style="cursor:pointer; color:var(--primary); font-weight:600; display:inline-flex; align-items:center; gap:4px;" onclick="RentalsPage.addItem()">${Icons.plus} Add Material</a>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 24px; border-top:1px solid var(--border-color); padding-top:20px;">
          <div style="font-size: 1.1rem; color: var(--text-secondary);">
            Estimated Revenue: <strong style="color: var(--success); font-size: 1.3rem;" id="rental-form-total-label">₹0</strong>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="btn btn-outline" onclick="RentalsPage.cancelEdit()">Cancel</button>
            <button type="submit" class="btn btn-primary">
              ${Icons.check} Save Rental Contract
            </button>
          </div>
        </div>
      </form>
    `;
  },

  newRecord() {
    this.selectedId = null;
    this.isEditing = true;
    this.formItems = [{ materialId: '', quantity: '', rate: '' }];
    this.refresh();
    setTimeout(() => RentalsPage.calculateFormTotals(), 50);
  },

  editRecord() {
    if (!this.selectedId) return;
    const r = Store.RentalSites.getById(this.selectedId);
    if (!r) return;
    this.isEditing = true;
    this.formItems = r.items.map(i => ({ materialId: i.materialId, quantity: i.quantity, rate: i.rate }));
    this.refresh();
    setTimeout(() => RentalsPage.calculateFormTotals(), 50);
  },

  cancelEdit() {
    this.isEditing = false;
    this.refresh();
  },

  addItem() {
    this.formItems.push({ materialId: '', quantity: '', rate: '' });
    const area = document.getElementById('rentals-form-area');
    if (area) {
      area.innerHTML = this.renderForm();
      RentalsPage.calculateFormTotals();
    }
  },

  removeItem(idx) {
    this.formItems.splice(idx, 1);
    const area = document.getElementById('rentals-form-area');
    if (area) {
      area.innerHTML = this.renderForm();
      RentalsPage.calculateFormTotals();
    }
  },

  onItemChange(idx, field, value) {
    if (this.formItems[idx]) {
      this.formItems[idx][field] = value;
      if (field === 'materialId') {
        const area = document.getElementById('rentals-form-area');
        if (area) {
          area.innerHTML = this.renderForm();
        }
      }
      RentalsPage.calculateFormTotals();
    }
  },

  calculateFormTotals() {
    const going = document.getElementById('rental-going-date')?.value || '';
    const coming = document.getElementById('rental-coming-date')?.value || '';
    const days = RentalsPage.getInclusiveDays(going, coming);

    const daysLabel = document.getElementById('rental-form-days-label');
    if (daysLabel) {
      daysLabel.innerText = `Duration: ${days} ${days === 1 ? 'Day' : 'Days'} (Inclusive)`;
    }

    const rows = document.querySelectorAll('#rental-items-body tr');
    let grandTotal = 0;

    rows.forEach((row, idx) => {
      const qty = parseFloat(row.querySelector('.r-qty').value) || 0;
      const rate = parseFloat(row.querySelector('.r-rate').value) || 0;
      const lineTotal = qty * rate * days;
      grandTotal += lineTotal;

      const cell = row.querySelector('.r-line-total');
      if (cell) {
        cell.innerText = `₹${lineTotal.toLocaleString('en-IN')}`;
      }
    });

    const totalLabel = document.getElementById('rental-form-total-label');
    if (totalLabel) {
      totalLabel.innerText = `₹${grandTotal.toLocaleString('en-IN')}`;
    }
  },

  selectRecord(id) {
    this.selectedId = id;
    this.isEditing = false;
    this.refresh();
  },

  save() {
    const customerName = document.getElementById('rental-cust-name').value.trim();
    const siteName = document.getElementById('rental-site-name').value.trim();
    const goingDate = document.getElementById('rental-going-date').value;
    const comingDate = document.getElementById('rental-coming-date').value;

    if (!customerName || !siteName || !goingDate || !comingDate) {
      alert('Please fill out all required fields.');
      return;
    }

    const days = this.getInclusiveDays(goingDate, comingDate);
    if (days <= 0) {
      alert('Coming Date must be on or after Going Date.');
      return;
    }

    // Filter valid items
    const items = this.formItems.filter(i => i.materialId && parseFloat(i.quantity) > 0);
    if (items.length === 0) {
      alert('Please add at least one material with a quantity greater than 0.');
      return;
    }

    const record = this.selectedId ? Store.RentalSites.getById(this.selectedId) : null;


    const data = {
      customerName,
      siteName,
      goingDate,
      comingDate,
      items: items.map(i => ({
        materialId: i.materialId,
        quantity: parseFloat(i.quantity) || 0,
        rate: parseFloat(i.rate) || 0
      })),
      status: record ? record.status : 'Active',
      createdAt: record ? record.createdAt : new Date().toISOString()
    };

    if (this.selectedId) {
      Store.RentalSites.update(this.selectedId, data);
      alert('Rental contract updated successfully!');
    } else {
      const saved = Store.RentalSites.add(data);
      this.selectedId = saved.id;
      alert('Rental contract created successfully!');
    }

    this.isEditing = false;
    this.refresh();
  },

  async markReturned() {
    if (!this.selectedId) return;
    if (confirm('Are you sure you want to mark this rental contract as fully returned?\nThis will add all materials back to the warehouse stock.')) {
      Store.RentalSites.update(this.selectedId, { status: 'Returned' });
      alert('Stock successfully returned to warehouse!');
      this.refresh();
    }
  },

  async deleteRecord() {
    if (!this.selectedId) return;
    if (confirm('Are you absolutely sure you want to delete this rental contract?\nThis action cannot be undone.')) {
      Store.RentalSites.remove(this.selectedId);
      this.selectedId = null;
      alert('Rental contract deleted successfully!');
      this.refresh();
    }
  },

  printChallan() {
    if (!this.selectedId) return;
    const r = Store.RentalSites.getById(this.selectedId);
    if (!r) return;

    const materials = Store.Materials.getAll();
    const days = this.getInclusiveDays(r.goingDate, r.comingDate);
    const grandTotal = r.items ? r.items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.rate || 0) * days), 0) : 0;
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const rows = r.items.map((i, idx) => {
      const mat = materials.find(m => m.id === i.materialId);
      const total = parseFloat(i.quantity || 0) * parseFloat(i.rate || 0) * days;
      return `
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 10px;">
            <strong>${mat ? mat.name : 'Unknown Material'}</strong><br>
            <span style="font-size: 11px; color: #666;">SKU: ${mat ? mat.sku : '-'}</span>
          </td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold;">
            ${i.quantity} ${mat ? mat.unit : ''}
          </td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">
            ₹${parseFloat(i.rate || 0).toLocaleString('en-IN')}
          </td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold; color: #10b981;">
            ₹${total.toLocaleString('en-IN')}
          </td>
        </tr>
      `;
    }).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
      <html><head>
        <title>Rental Delivery Challan - ${r.customerName}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; color: #333; line-height: 1.5; padding: 20px; background: #fff; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .title { font-size: 24px; font-weight: bold; color: #1e3a8a; }
          .info-block { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .card h4 { color: #1e3a8a; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
          .card p { font-size: 13px; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 12px 10px; text-align: left; font-size: 13px; color: #334155; }
          td { border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; }
          .total-section { display: flex; justify-content: flex-end; margin-bottom: 40px; }
          .total-card { border: 2px solid #10b981; background: #f0fdf4; border-radius: 8px; padding: 16px; min-width: 250px; text-align: right; }
          .footer { margin-top: 60px; border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
          .sig-line { border-top: 1px solid #94a3b8; width: 200px; margin-top: 40px; text-align: center; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">KSS CONSTRUCTION MATERIALS</div>
            <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Material Rental & Delivery Challan</p>
          </div>
          <div style="text-align: right;">
            <p style="font-weight: bold;">Challan Date: ${today}</p>
            <p style="font-size: 12px; color: #64748b;">Contract ID: ${r.id}</p>
          </div>
        </div>

        <div class="info-block">
          <div class="card">
            <h4>Customer & Site Info</h4>
            <p><strong>Customer Name:</strong> ${r.customerName}</p>
            <p><strong>Site Location:</strong> ${r.siteName || '-'}</p>
          </div>
          <div class="card">
            <h4>Rental Lease Details</h4>
            <p><strong>Going Date:</strong> ${r.goingDate}</p>
            <p><strong>Coming Date:</strong> ${r.comingDate}</p>
            <p><strong>Lease Duration:</strong> ${days} Days (Inclusive)</p>
            <p><strong>Lease Status:</strong> ${r.status === 'Active' ? 'ACTIVE LEASE' : 'RETURNED'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 8%; text-align: center;">S.No</th>
              <th>Material Description</th>
              <th style="width: 15%; text-align: center;">Qty Leased</th>
              <th style="width: 18%; text-align: right;">Rate (per Day)</th>
              <th style="width: 20%; text-align: right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-card">
            <span style="font-size: 11px; text-transform: uppercase; color: #047857; font-weight: bold; display: block; margin-bottom: 4px;">Estimated Rental Charge</span>
            <span style="font-size: 22px; font-weight: 800; color: #065f46;">₹${grandTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div class="footer">
          <div>
            <p>Printed on: ${new Date().toLocaleString('en-IN')}</p>
            <p>Thank you for your business!</p>
          </div>
          <div style="display: flex; gap: 40px;">
            <div class="sig-line">Customer Signature</div>
            <div class="sig-line">Authorized Signatory</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          }
        </script>
      </body></html>
    `);
    printWindow.document.close();
  }
};
