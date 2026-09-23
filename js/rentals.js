/* ============================================
   BuildMate Rental Sites Module (Material Hire)
   Warehouse Free / Independent Rental Inventory
   Supports Optional Coming Date, Active Auto-Days, & Seamless Monthly Registers
   ============================================ */

var RentalsPage = {
  selectedId: null,
  searchTerm: '',
  selectedCustomerFilter: '',
  selectedCustomerFilters: [], // Multi-select customers array (empty = All)
  selectedSiteFilters: [],     // Multi-select sites array (empty = All)
  customerFilterSearch: '',
  siteFilterSearch: '',
  openDropdown: null,          // 'customer' | 'site' | null
  viewMode: 'all', // 'all' (list view) or 'grouped' (customer-wise categorization)
  activeTab: 'contracts', // 'contracts' or 'monthly-register'
  selectedMonth: new Date().toISOString().slice(0, 7), // 'YYYY-MM'
  formItems: [{ materialId: '', quantity: '', rate: '' }],
  isEditing: false,

  switchTab(tab) {
    this.activeTab = tab;
    this.refresh();
  },

  onMonthChange(monthVal) {
    this.selectedMonth = monthVal || new Date().toISOString().slice(0, 7);
    this.refresh();
  },

  onCustomerFilterChange(val) {
    this.selectedCustomerFilter = val || '';
    this.selectedCustomerFilters = val ? [val] : [];
    this.cleanupOrphanSiteFilters();
    this.refresh();
  },

  toggleCustomerFilter(custName) {
    if (!this.selectedCustomerFilters) this.selectedCustomerFilters = [];
    const idx = this.selectedCustomerFilters.indexOf(custName);
    if (idx >= 0) {
      this.selectedCustomerFilters.splice(idx, 1);
    } else {
      this.selectedCustomerFilters.push(custName);
    }
    this.cleanupOrphanSiteFilters();
    this.refresh();
  },

  toggleAllCustomers(select) {
    if (!select) {
      this.selectedCustomerFilters = [];
      this.selectedSiteFilters = [];
    } else {
      const allCusts = this.getAvailableCustomers();
      this.selectedCustomerFilters = [...allCusts];
    }
    this.refresh();
  },

  toggleSiteFilter(siteName) {
    if (!this.selectedSiteFilters) this.selectedSiteFilters = [];
    const idx = this.selectedSiteFilters.indexOf(siteName);
    if (idx >= 0) {
      this.selectedSiteFilters.splice(idx, 1);
    } else {
      this.selectedSiteFilters.push(siteName);
    }
    this.refresh();
  },

  toggleAllSites(select) {
    if (!select) {
      this.selectedSiteFilters = [];
    } else {
      const availableSites = this.getAvailableSites();
      this.selectedSiteFilters = [...availableSites];
    }
    this.refresh();
  },

  clearAllFilters() {
    this.selectedCustomerFilters = [];
    this.selectedSiteFilters = [];
    this.customerFilterSearch = '';
    this.siteFilterSearch = '';
    this.openDropdown = null;
    this.refresh();
  },

  toggleDropdown(type) {
    this.openDropdown = (this.openDropdown === type) ? null : type;
    this.refresh();
  },

  closeDropdowns() {
    this.openDropdown = null;
    this.refresh();
  },

  onCustomerSearch(val) {
    this.customerFilterSearch = val || '';
    this.refresh();
  },

  onSiteSearch(val) {
    this.siteFilterSearch = val || '';
    this.refresh();
  },

  cleanupOrphanSiteFilters() {
    if (!this.selectedCustomerFilters || this.selectedCustomerFilters.length === 0) return;
    const validSites = this.getAvailableSites();
    this.selectedSiteFilters = (this.selectedSiteFilters || []).filter(s => validSites.includes(s));
  },

  getAvailableCustomers() {
    const allRecords = Store.RentalSites ? Store.RentalSites.getAll() : [];
    const allCusts = Store.Customers ? Store.Customers.getAll() : [];
    const rentalCustNames = [...new Set(allRecords.map(r => r.customerName).filter(Boolean))];
    return [...new Set([
      ...allCusts.map(c => c.name).filter(Boolean),
      ...rentalCustNames
    ])].sort((a, b) => a.localeCompare(b));
  },

  getAvailableSites() {
    const allRecords = Store.RentalSites ? Store.RentalSites.getAll() : [];
    const allSites = Store.Sites ? Store.Sites.getAll() : [];

    let filteredRecords = allRecords;
    if (this.selectedCustomerFilters && this.selectedCustomerFilters.length > 0) {
      const lowerCusts = this.selectedCustomerFilters.map(c => c.toLowerCase());
      filteredRecords = filteredRecords.filter(r => lowerCusts.includes((r.customerName || '').toLowerCase()));
    }

    const rentalSites = [...new Set(filteredRecords.map(r => r.siteName).filter(Boolean))];
    const systemSites = allSites.filter(s => {
      if (!this.selectedCustomerFilters || this.selectedCustomerFilters.length === 0) return true;
      const lowerCusts = this.selectedCustomerFilters.map(c => c.toLowerCase());
      return lowerCusts.includes((s.customerName || '').toLowerCase());
    }).map(s => s.name).filter(Boolean);

    return [...new Set([...rentalSites, ...systemSites])].sort((a, b) => a.localeCompare(b));
  },

  setViewMode(mode) {
    this.viewMode = mode;
    this.refresh();
  },

  render() {
    const materials = Store.Materials.getSorted().filter(m => m.status !== 'Archived');
    let records = Store.RentalSites.getAll().sort((a, b) => new Date(b.createdAt || b.goingDate) - new Date(a.createdAt || a.goingDate));

    if (this.selectedCustomerFilters && this.selectedCustomerFilters.length > 0) {
      const lowerCusts = this.selectedCustomerFilters.map(c => c.toLowerCase());
      records = records.filter(r => lowerCusts.includes((r.customerName || '').toLowerCase()));
    } else if (this.selectedCustomerFilter) {
      records = records.filter(r => (r.customerName || '').toLowerCase() === this.selectedCustomerFilter.toLowerCase());
    }

    if (this.selectedSiteFilters && this.selectedSiteFilters.length > 0) {
      const lowerSites = this.selectedSiteFilters.map(s => s.toLowerCase());
      records = records.filter(r => lowerSites.includes((r.siteName || '').toLowerCase()));
    }

    if (this.searchTerm) {
      const st = this.searchTerm.toLowerCase();
      records = records.filter(r => 
        (r.customerName || '').toLowerCase().includes(st) || 
        (r.siteName || '').toLowerCase().includes(st)
      );
    }

    return `
      <div class="page-header" style="background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-body) 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div class="page-header-title" style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 48px; height: 48px; background: rgba(59, 130, 246, 0.1); color: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            ${Icons.truck}
          </div>
          <div>
            <h2 style="margin: 0; font-size: 1.5rem; color: var(--text-primary);">Rental Sites Management</h2>
            <p style="margin: 4px 0 0 0; color: var(--text-tertiary);">Independent Material Hire • Customer-Wise Categorization & Monthly Registers</p>
          </div>
        </div>
        <div class="page-header-actions" style="display: flex; gap: 10px;">
          <button class="btn btn-primary" onclick="RentalsPage.newRecord()" style="display:inline-flex;align-items:center;gap:6px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">
            ${Icons.plus} New Rental Site
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); margin-bottom: 24px; padding-bottom: 8px; overflow-x: auto;">
        <button class="btn ${this.activeTab === 'contracts' ? 'btn-primary' : 'btn-ghost'}" onclick="RentalsPage.switchTab('contracts')">
          📋 Rental Contracts
        </button>
        <button class="btn ${this.activeTab === 'monthly-register' ? 'btn-primary' : 'btn-ghost'}" onclick="RentalsPage.switchTab('monthly-register')">
          📅 Monthly Dispatch Register (Date-Wise)
        </button>
      </div>

      ${this.activeTab === 'monthly-register' ? this.renderMonthlyRegister() : this.renderContractsLayout(records)}
    `;
  },

  renderContractsLayout(records) {
    const allCustomers = Store.Customers ? Store.Customers.getAll() : [];
    const allRentalSites = Store.RentalSites ? Store.RentalSites.getAll() : [];
    const rentalCustNames = [...new Set(allRentalSites.map(r => r.customerName).filter(Boolean))];
    const customerOptions = [...new Set([
      ...allCustomers.map(c => c.name).filter(Boolean),
      ...rentalCustNames
    ])].sort((a, b) => a.localeCompare(b));

    let listContentHtml = '';

    if (this.viewMode === 'grouped') {
      // Group records by Customer Name
      const groups = {};
      records.forEach(r => {
        const cName = r.customerName || 'Unassigned Customer';
        if (!groups[cName]) groups[cName] = [];
        groups[cName].push(r);
      });

      const groupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b));

      if (groupNames.length === 0) {
        listContentHtml = '<div style="padding:40px;text-align:center;color:var(--text-tertiary)">No rental sites match the selected filter.</div>';
      } else {
        listContentHtml = groupNames.map(cName => {
          const siteList = groups[cName];
          const totalUnits = siteList.reduce((sum, r) => sum + (r.items ? r.items.reduce((s, i) => s + parseFloat(i.quantity || 0), 0) : 0), 0);
          const totalRev = siteList.reduce((sum, r) => {
            return sum + (r.items ? r.items.reduce((s, i) => s + RentalsPage.calculateItemBilling(r, i).amount, 0) : 0);
          }, 0);

          return `
            <div style="margin-bottom: 16px; border: 1px solid var(--border-color); border-radius: 10px; overflow: hidden; background: var(--bg-card); box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong style="font-size: 0.95rem; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
                    👤 ${cName}
                  </strong>
                  <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">
                    ${siteList.length} Site(s) • ${totalUnits} total units leased
                  </div>
                </div>
                <div>
                  <span class="badge badge-success" style="font-size: 0.8rem; font-weight: 700;">₹${Math.round(totalRev).toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div>
                ${siteList.map(r => {
                  const totalItems = r.items ? r.items.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0) : 0;
                  const days = RentalsPage.getInclusiveDays(r.goingDate, r.comingDate);
                  const isMonthly = r.billingBasis === 'Monthly';
                  const totalVal = r.items ? r.items.reduce((sum, i) => sum + RentalsPage.calculateItemBilling(r, i).amount, 0) : 0;

                  return `
                    <div class="list-item ${this.selectedId === r.id ? 'active' : ''}" style="cursor: pointer; padding: 12px 14px; border-bottom: 1px solid var(--border-color); transition: background-color 0.2s;" onclick="RentalsPage.selectRecord('${r.id}')">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <div style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">📍 Site: ${r.siteName || '-'}</div>
                        ${RentalsPage.getContractStatusBadge(r)}
                      </div>
                      <div style="font-size: 0.8rem; color: var(--text-tertiary); display:flex; justify-content:space-between; align-items:center;">
                        <span>Qty: ${totalItems} • ${days} Days • <span class="badge ${isMonthly ? 'badge-neutral' : 'badge-primary'}" style="font-size:0.65rem;">${isMonthly ? 'Monthly' : 'Daily'}</span></span>
                        <strong style="color: var(--success); font-size: 0.85rem;">₹${Math.round(totalVal).toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('');
      }
    } else {
      // Standard Flat List View
      listContentHtml = records.map(r => {
        const totalItems = r.items ? r.items.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0) : 0;
        const days = RentalsPage.getInclusiveDays(r.goingDate, r.comingDate);
        const isMonthly = r.billingBasis === 'Monthly';
        const totalVal = r.items ? r.items.reduce((sum, i) => sum + RentalsPage.calculateItemBilling(r, i).amount, 0) : 0;

        return `
          <div class="list-item ${this.selectedId === r.id ? 'active' : ''}" style="cursor: pointer; padding: 16px; border-bottom: 1px solid var(--border-color); transition: background-color 0.2s;" onclick="RentalsPage.selectRecord('${r.id}')">
            <div class="flex items-center justify-between" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div class="item-title" style="font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                👤 ${r.customerName}
              </div>
              ${RentalsPage.getContractStatusBadge(r)}
            </div>
            <div class="item-sub" style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 4px;">
              📍 Site: ${r.siteName || '-'} • <span class="badge ${isMonthly ? 'badge-neutral' : 'badge-primary'}" style="font-size:0.7rem;">${isMonthly ? '📅 Monthly' : '☀️ Daily'}</span>
            </div>
            <div class="item-sub" style="font-size: 0.8rem; color: var(--text-tertiary); display:flex; justify-content:space-between; align-items:center;">
              <span>Qty: ${totalItems} • ${days} Days ${r.comingDate ? '' : '(Active)'}</span>
              <strong style="color: var(--success); font-size: 0.95rem;">₹${Math.round(totalVal).toLocaleString('en-IN')}</strong>
            </div>
          </div>
        `;
      }).join('');

      if (records.length === 0) {
        listContentHtml = '<div style="padding:40px;text-align:center;color:var(--text-tertiary)">No rental sites match the selected filter.</div>';
      }
    }

    return `
      <div class="split-layout">
        <!-- Left: List & Customer Categorization -->
        <div class="card side-list">
          <div class="card-header" style="border-bottom: 1px solid var(--border-color); padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
              <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">Rental Sites</h3>
              <!-- Categorization View Mode Toggle -->
              <div style="display: flex; gap: 4px; background: var(--bg-body); padding: 3px; border-radius: 6px; border: 1px solid var(--border-color);">
                <button class="btn btn-sm ${this.viewMode === 'all' ? 'btn-primary' : 'btn-ghost'}" onclick="RentalsPage.setViewMode('all')" style="padding: 3px 8px; font-size: 0.75rem;" title="Flat List View">
                  📋 Flat List
                </button>
                <button class="btn btn-sm ${this.viewMode === 'grouped' ? 'btn-primary' : 'btn-ghost'}" onclick="RentalsPage.setViewMode('grouped')" style="padding: 3px 8px; font-size: 0.75rem;" title="Customer Grouped View">
                  👥 By Customer
                </button>
              </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="position: relative;">
                <input type="text" class="form-control" placeholder="Search customer or site..." 
                       value="${this.searchTerm}" onkeyup="RentalsPage.onSearch(event)" style="background: var(--bg-body); padding-left: 36px;">
                <div style="position: absolute; left: 12px; top: 10px; width: 16px; height: 16px; color: var(--text-tertiary);">${Icons.search}</div>
              </div>

              <!-- Customer Dropdown Filter -->
              <select id="rental-customer-select" class="form-control" onchange="RentalsPage.onCustomerFilterChange(this.value)" style="background: var(--bg-body); font-weight: 600; color: var(--text-primary);">
                <option value="">👤 Filter by Customer (All Customers)</option>
                ${customerOptions.map(cName => `
                  <option value="${cName}" ${this.selectedCustomerFilter.toLowerCase() === cName.toLowerCase() ? 'selected' : ''}>👤 ${cName}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div id="rentals-list" style="max-height: 65vh; overflow-y: auto; padding: 12px;">
            ${listContentHtml}
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

  renderMonthlyRegister() {
    const allRecords = Store.RentalSites ? Store.RentalSites.getAll() : [];
    const materials = Store.Materials.getSorted().filter(m => m.status !== 'Archived');

    const customerOptions = this.getAvailableCustomers();
    const siteOptions = this.getAvailableSites();

    // Base records for the selected month
    const monthAllRecords = allRecords.filter(r => {
      if (!r.goingDate) return false;
      const goingMonth = r.goingDate.slice(0, 7);
      const comingMonth = r.comingDate ? r.comingDate.slice(0, 7) : '';

      const startedInOrBefore = goingMonth <= this.selectedMonth;
      const endedInOrAfter = !r.comingDate || comingMonth >= this.selectedMonth;

      return startedInOrBefore && endedInOrAfter;
    });

    // Apply customer & site filters
    let monthRecords = monthAllRecords;

    if (this.selectedCustomerFilters && this.selectedCustomerFilters.length > 0) {
      const lowerCusts = this.selectedCustomerFilters.map(c => c.toLowerCase());
      monthRecords = monthRecords.filter(r => lowerCusts.includes((r.customerName || '').toLowerCase()));
    } else if (this.selectedCustomerFilter) {
      monthRecords = monthRecords.filter(r => (r.customerName || '').toLowerCase() === this.selectedCustomerFilter.toLowerCase());
    }

    if (this.selectedSiteFilters && this.selectedSiteFilters.length > 0) {
      const lowerSites = this.selectedSiteFilters.map(s => s.toLowerCase());
      monthRecords = monthRecords.filter(r => lowerSites.includes((r.siteName || '').toLowerCase()));
    }

    monthRecords.sort((a, b) => new Date(a.goingDate) - new Date(b.goingDate));

    // Summary calculations
    let totalDispatches = monthRecords.length;
    let totalItemsLeased = 0;
    let totalMonthlyBill = 0;

    monthRecords.forEach(r => {
      const days = this.getDaysInMonth(r.goingDate, r.comingDate, this.selectedMonth);

      if (r.items && days > 0) {
        r.items.forEach(i => {
          totalItemsLeased += parseFloat(i.quantity || 0);
          totalMonthlyBill += RentalsPage.calculateItemBilling(r, i, this.selectedMonth).amount;
        });
      }
    });

    const monthLabel = new Date(this.selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    // Customer button label
    let custBtnLabel = 'All Customers';
    if (this.selectedCustomerFilters && this.selectedCustomerFilters.length === 1) {
      custBtnLabel = `👤 ${this.selectedCustomerFilters[0]}`;
    } else if (this.selectedCustomerFilters && this.selectedCustomerFilters.length > 1) {
      custBtnLabel = `👥 ${this.selectedCustomerFilters.length} Customers`;
    }

    // Site button label
    let siteBtnLabel = 'All Sites';
    if (this.selectedSiteFilters && this.selectedSiteFilters.length === 1) {
      siteBtnLabel = `📍 ${this.selectedSiteFilters[0]}`;
    } else if (this.selectedSiteFilters && this.selectedSiteFilters.length > 1) {
      siteBtnLabel = `📍 ${this.selectedSiteFilters.length} Sites`;
    }

    // Search filter for customer popover
    const searchCust = (this.customerFilterSearch || '').toLowerCase();
    const popoverCustList = customerOptions.filter(c => c.toLowerCase().includes(searchCust));

    // Search filter for site popover
    const searchSite = (this.siteFilterSearch || '').toLowerCase();
    const popoverSiteList = siteOptions.filter(s => s.toLowerCase().includes(searchSite));

    const isCustAllChecked = !this.selectedCustomerFilters || this.selectedCustomerFilters.length === 0;
    const isSiteAllChecked = !this.selectedSiteFilters || this.selectedSiteFilters.length === 0;

    return `
      <!-- Monthly Header & Multi-Select Selector Bar -->
      <div class="card" style="margin-bottom: 24px; position: relative; z-index: 100;">
        <div class="card-body" style="padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <h3 style="margin:0; font-size: 1.25rem; color: var(--text-primary);">Monthly Rental Dispatch Register</h3>
              <p style="margin:4px 0 0 0; color: var(--text-tertiary); font-size: 0.85rem;">Date-wise inclusive statement of materials dispatched in <strong>${monthLabel}</strong></p>
            </div>
            
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              
              <!-- Multi-Customer Dropdown Picker -->
              <div class="multi-select-container" style="position: relative;">
                <button class="btn btn-outline" onclick="event.stopPropagation(); RentalsPage.toggleDropdown('customer')" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600; background: var(--bg-body); border-color: ${this.selectedCustomerFilters && this.selectedCustomerFilters.length > 0 ? 'var(--primary)' : 'var(--border-color)'}; color: var(--text-primary); font-size: 0.88rem;">
                  <span>${custBtnLabel}</span>
                  <span style="font-size: 0.7rem; opacity: 0.7;">▼</span>
                </button>

                ${this.openDropdown === 'customer' ? `
                  <div class="card multi-select-popover" style="position: absolute; top: 100%; left: 0; margin-top: 6px; z-index: 1000; width: 300px; max-width: calc(100vw - 32px); box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 1px solid var(--border-color); background: var(--bg-card); border-radius: 10px; padding: 12px;" onclick="event.stopPropagation();">
                    <div style="margin-bottom: 8px;">
                      <input type="text" class="form-control" placeholder="🔍 Search customers..." value="${this.customerFilterSearch || ''}" onkeyup="RentalsPage.onCustomerSearch(this.value)" style="font-size: 0.85rem; padding: 6px 10px; background: var(--bg-body);">
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); margin-bottom: 8px;">
                      <button class="btn btn-xs btn-ghost" onclick="RentalsPage.toggleAllCustomers(true)" style="font-size: 0.75rem; color: var(--primary);">Select All</button>
                      <button class="btn btn-xs btn-ghost" onclick="RentalsPage.toggleAllCustomers(false)" style="font-size: 0.75rem; color: var(--danger);">Clear All</button>
                    </div>
                    <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
                      ${popoverCustList.length === 0 ? '<div style="font-size:0.8rem; color:var(--text-tertiary); padding:8px; text-align:center;">No customers found</div>' : popoverCustList.map(cName => {
                        const isChecked = !isCustAllChecked && this.selectedCustomerFilters.includes(cName);
                        const count = monthAllRecords.filter(r => (r.customerName || '').toLowerCase() === cName.toLowerCase()).length;
                        return `
                          <label style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; background: ${isChecked ? 'rgba(59,130,246,0.12)' : 'transparent'};">
                            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                              <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="RentalsPage.toggleCustomerFilter('${cName.replace(/'/g, "\\'")}')">
                              <span style="font-weight: ${isChecked ? '700' : '400'}; color: var(--text-primary);">${cName}</span>
                            </div>
                            <span class="badge badge-neutral" style="font-size: 0.7rem;">${count}</span>
                          </label>
                        `;
                      }).join('')}
                    </div>
                    <div style="padding-top: 8px; border-top: 1px solid var(--border-color); margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 0.75rem; color: var(--text-tertiary);">${this.selectedCustomerFilters.length} selected</span>
                      <button class="btn btn-sm btn-primary" onclick="RentalsPage.closeDropdowns()" style="padding: 4px 12px; font-size: 0.8rem;">Done</button>
                    </div>
                  </div>
                ` : ''}
              </div>

              <!-- Multi-Site Dropdown Picker -->
              <div class="multi-select-container" style="position: relative;">
                <button class="btn btn-outline" onclick="event.stopPropagation(); RentalsPage.toggleDropdown('site')" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600; background: var(--bg-body); border-color: ${this.selectedSiteFilters && this.selectedSiteFilters.length > 0 ? 'var(--primary)' : 'var(--border-color)'}; color: var(--text-primary); font-size: 0.88rem;">
                  <span>${siteBtnLabel}</span>
                  <span style="font-size: 0.7rem; opacity: 0.7;">▼</span>
                </button>

                ${this.openDropdown === 'site' ? `
                  <div class="card multi-select-popover" style="position: absolute; top: 100%; left: 0; margin-top: 6px; z-index: 1000; width: 300px; max-width: calc(100vw - 32px); box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 1px solid var(--border-color); background: var(--bg-card); border-radius: 10px; padding: 12px;" onclick="event.stopPropagation();">
                    <div style="margin-bottom: 8px;">
                      <input type="text" class="form-control" placeholder="🔍 Search sites..." value="${this.siteFilterSearch || ''}" onkeyup="RentalsPage.onSiteSearch(this.value)" style="font-size: 0.85rem; padding: 6px 10px; background: var(--bg-body);">
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); margin-bottom: 8px;">
                      <button class="btn btn-xs btn-ghost" onclick="RentalsPage.toggleAllSites(true)" style="font-size: 0.75rem; color: var(--primary);">Select All</button>
                      <button class="btn btn-xs btn-ghost" onclick="RentalsPage.toggleAllSites(false)" style="font-size: 0.75rem; color: var(--danger);">Clear All</button>
                    </div>
                    <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
                      ${popoverSiteList.length === 0 ? '<div style="font-size:0.8rem; color:var(--text-tertiary); padding:8px; text-align:center;">No sites found</div>' : popoverSiteList.map(sName => {
                        const isChecked = !isSiteAllChecked && this.selectedSiteFilters.includes(sName);
                        const count = monthAllRecords.filter(r => (r.siteName || '').toLowerCase() === sName.toLowerCase()).length;
                        return `
                          <label style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; background: ${isChecked ? 'rgba(59,130,246,0.12)' : 'transparent'};">
                            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                              <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="RentalsPage.toggleSiteFilter('${sName.replace(/'/g, "\\'")}')">
                              <span style="font-weight: ${isChecked ? '700' : '400'}; color: var(--text-primary);">📍 ${sName}</span>
                            </div>
                            <span class="badge badge-neutral" style="font-size: 0.7rem;">${count}</span>
                          </label>
                        `;
                      }).join('')}
                    </div>
                    <div style="padding-top: 8px; border-top: 1px solid var(--border-color); margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 0.75rem; color: var(--text-tertiary);">${this.selectedSiteFilters.length} selected</span>
                      <button class="btn btn-sm btn-primary" onclick="RentalsPage.closeDropdowns()" style="padding: 4px 12px; font-size: 0.8rem;">Done</button>
                    </div>
                  </div>
                ` : ''}
              </div>

              <label for="rental-month-select" style="font-weight: 600; color: var(--text-secondary); font-size: 0.9rem;">Month:</label>
              <input type="month" id="rental-month-select" class="form-control" value="${this.selectedMonth}" onchange="RentalsPage.onMonthChange(this.value)" style="width: 160px; font-weight:600; background: var(--bg-body);">

              <button class="btn btn-outline" onclick="RentalsPage.printMonthlyRegister()" style="display:inline-flex; align-items:center; gap:6px;">
                ${Icons.printer} Print Monthly Bill Statement
              </button>
            </div>
          </div>

          <!-- Active Filter Chips Bar -->
          ${((this.selectedCustomerFilters && this.selectedCustomerFilters.length > 0) || (this.selectedSiteFilters && this.selectedSiteFilters.length > 0)) ? `
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--border-color);">
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Active Filters:</span>
              ${(this.selectedCustomerFilters || []).map(cName => `
                <span class="badge badge-primary" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: 0.8rem; border-radius: 20px;">
                  👤 ${cName}
                  <span style="cursor: pointer; font-weight: bold; margin-left: 2px;" onclick="RentalsPage.toggleCustomerFilter('${cName.replace(/'/g, "\\'")}')" title="Remove customer filter">✕</span>
                </span>
              `).join('')}
              ${(this.selectedSiteFilters || []).map(sName => `
                <span class="badge badge-info" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: 0.8rem; border-radius: 20px;">
                  📍 ${sName}
                  <span style="cursor: pointer; font-weight: bold; margin-left: 2px;" onclick="RentalsPage.toggleSiteFilter('${sName.replace(/'/g, "\\'")}')" title="Remove site filter">✕</span>
                </span>
              `).join('')}
              <button class="btn btn-xs btn-ghost" onclick="RentalsPage.clearAllFilters()" style="font-size: 0.75rem; color: var(--danger); text-decoration: underline; margin-left: 4px;">
                Clear All Filters
              </button>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Monthly Summary Metrics -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div class="card" style="padding: 20px; border-left: 4px solid var(--primary-500);">
          <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); font-weight: 600;">Dispatches Active/Sent</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary); margin-top: 4px;">${totalDispatches}</div>
        </div>
        <div class="card" style="padding: 20px; border-left: 4px solid #3b82f6;">
          <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); font-weight: 600;">Total Material Quantity</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: #2563eb; margin-top: 4px;">${totalItemsLeased.toLocaleString('en-IN')} units</div>
        </div>
        <div class="card" style="padding: 20px; border-left: 4px solid #10b981;">
          <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); font-weight: 600;">Monthly Billing Generated</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: #059669; margin-top: 4px;">₹${Math.round(totalMonthlyBill).toLocaleString('en-IN')}</div>
        </div>
      </div>

      <!-- Date-Wise Register Table -->
      <div class="card">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Going Date (Dispatch)</th>
                <th>Customer & Site</th>
                <th>Materials Dispatched</th>
                <th>Rate Basis</th>
                <th>Lease Duration (${monthLabel})</th>
                <th style="text-align: right;">Total Bill (${monthLabel})</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${monthRecords.length === 0 ? `
                <tr><td colspan="8" style="text-align:center; padding: 48px; color: var(--text-tertiary);">No rental dispatches found for ${monthLabel}${this.selectedCustomerFilters.length || this.selectedSiteFilters.length ? ' matching the selected filters' : ''}.</td></tr>
              ` : monthRecords.map(r => {
                const days = this.getDaysInMonth(r.goingDate, r.comingDate, this.selectedMonth);
                const isMonthly = r.billingBasis === 'Monthly';
                let totalVal = 0;
                (r.items || []).forEach(i => {
                  totalVal += RentalsPage.calculateItemBilling(r, i, this.selectedMonth).amount;
                });
                
                const itemsSummary = (r.items || []).map(i => {
                  const m = materials.find(x => x.id === i.materialId);
                  return `<div style="font-size:0.85rem;">• <strong>${m ? m.name : 'Item'}</strong>: ${i.quantity} ${m ? m.unit : ''} @ ₹${i.rate}/${isMonthly ? 'mo' : 'day'}</div>`;
                }).join('');

                return `
                  <tr>
                    <td>
                      <strong style="color: var(--text-primary); font-size:0.95rem;">📅 ${r.goingDate}</strong>
                    </td>
                    <td>
                      <strong style="color: var(--text-primary);">${r.customerName}</strong>
                      <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top:2px;">📍 Site: ${r.siteName || '-'}</div>
                    </td>
                    <td>
                      ${itemsSummary}
                    </td>
                    <td>
                      <span class="badge ${isMonthly ? 'badge-neutral' : 'badge-primary'}" style="font-size:0.75rem;">
                        ${isMonthly ? '📅 Monthly' : '☀️ Daily'}
                      </span>
                    </td>
                    <td>
                      <span class="badge badge-info" style="font-size:0.8rem; padding: 4px 8px;">
                        ${days} Days in ${monthLabel} ${r.comingDate ? '' : '(Active)'}
                      </span>
                    </td>
                    <td style="text-align: right; font-weight: 800; color: #059669; font-size: 1.05rem;">
                      ₹${Math.round(totalVal).toLocaleString('en-IN')}
                    </td>
                    <td>
                      ${RentalsPage.getContractStatusBadge(r)}
                    </td>
                    <td style="text-align: right;">
                      <button class="btn btn-sm btn-ghost" onclick="RentalsPage.selectRecord('${r.id}'); RentalsPage.switchTab('contracts');" title="View Contract Details">
                        View Details →
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  init() {
    const items = document.querySelectorAll('#rentals-list .list-item');
    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        if (!item.classList.contains('active')) item.style.backgroundColor = 'var(--bg-body)';
      });
      item.addEventListener('mouseleave', () => {
        if (!item.classList.contains('active')) item.style.backgroundColor = 'transparent';
      });
    });

    if (!this._hasClickOutsideListener) {
      this._hasClickOutsideListener = true;
      document.addEventListener('click', (e) => {
        if (RentalsPage.openDropdown && !e.target.closest('.multi-select-container')) {
          RentalsPage.openDropdown = null;
          RentalsPage.refresh();
        }
      });
    }
  },

  onSearch(e) {
    this.searchTerm = e.target.value;
    this.refresh();
  },

  refresh() {
    const container = document.getElementById('page-container');
    if (container && window.location.hash === '#rentals') {
      container.innerHTML = this.render();
      this.init();
    }
  },

  getInclusiveDays(date1, date2) {
    if (!date1) return 0;
    const d1 = new Date(date1);
    const d2 = date2 ? new Date(date2) : new Date(); // If comingDate missing/active, calculate up to TODAY
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    const diffMs = utc2 - utc1;
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  },

  getDaysInMonth(goingDate, comingDate, targetMonthStr) {
    if (!goingDate || !targetMonthStr) return 0;

    const parts = targetMonthStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;

    const mStart = new Date(year, month, 1, 0, 0, 0, 0);
    const mEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const gDate = new Date(goingDate + 'T00:00:00');
    if (gDate > mEnd) return 0;

    let cDate;
    if (comingDate) {
      cDate = new Date(comingDate + 'T23:59:59');
    } else {
      cDate = new Date();
    }

    if (cDate < mStart) return 0;

    const effectiveStart = gDate > mStart ? gDate : mStart;
    const effectiveEnd = cDate < mEnd ? cDate : mEnd;

    if (effectiveStart > effectiveEnd) return 0;

    const utc1 = Date.UTC(effectiveStart.getFullYear(), effectiveStart.getMonth(), effectiveStart.getDate());
    const utc2 = Date.UTC(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), effectiveEnd.getDate());
    const diffMs = utc2 - utc1;
    if (diffMs < 0) return 0;

    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  },

  getContractMonths(goingDate, comingDate) {
    if (!goingDate) return [];
    const start = new Date(goingDate + 'T00:00:00');
    const end = comingDate ? new Date(comingDate + 'T00:00:00') : new Date();

    const months = [];
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cur <= last) {
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      months.push(`${yyyy}-${mm}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  },

  getContractReturnSummary(r) {
    const summary = {};
    (r.items || []).forEach(i => {
      summary[i.materialId] = {
        materialId: i.materialId,
        leased: parseFloat(i.quantity) || 0,
        rate: parseFloat(i.rate) || 0,
        returned: 0,
        remaining: parseFloat(i.quantity) || 0
      };
    });

    if (Array.isArray(r.returns) && r.returns.length > 0) {
      r.returns.forEach(ret => {
        (ret.items || []).forEach(ri => {
          if (summary[ri.materialId]) {
            summary[ri.materialId].returned += parseFloat(ri.quantity) || 0;
          }
        });
      });
      Object.keys(summary).forEach(mId => {
        summary[mId].remaining = Math.max(0, summary[mId].leased - summary[mId].returned);
      });
    } else if (r.status === 'Returned' || r.comingDate) {
      Object.keys(summary).forEach(mId => {
        summary[mId].returned = summary[mId].leased;
        summary[mId].remaining = 0;
      });
    }

    return summary;
  },

  calculateItemBilling(r, item, targetMonth = null) {
    const isMonthly = r.billingBasis === 'Monthly';
    const mId = item.materialId;
    const initialQty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;

    let totalAmount = 0;
    let totalActiveDaysWeighted = 0;

    const returnsForMat = [];
    if (Array.isArray(r.returns) && r.returns.length > 0) {
      r.returns.forEach(ret => {
        (ret.items || []).forEach(ri => {
          if (ri.materialId === mId && parseFloat(ri.quantity) > 0) {
            returnsForMat.push({
              returnDate: ret.returnDate,
              qty: parseFloat(ri.quantity)
            });
          }
        });
      });
    } else if (r.status === 'Returned' && r.comingDate) {
      returnsForMat.push({
        returnDate: r.comingDate,
        qty: initialQty
      });
    }

    let returnedSum = 0;
    returnsForMat.forEach(b => {
      returnedSum += b.qty;
      const days = targetMonth
        ? this.getDaysInMonth(r.goingDate, b.returnDate, targetMonth)
        : this.getInclusiveDays(r.goingDate, b.returnDate);
      const mult = isMonthly ? (days / 30) : days;
      totalAmount += b.qty * rate * mult;
      totalActiveDaysWeighted += b.qty * days;
    });

    const remainingQty = Math.max(0, initialQty - returnedSum);
    if (remainingQty > 0) {
      const endDate = r.comingDate || window.localDateStr();
      const days = targetMonth
        ? this.getDaysInMonth(r.goingDate, endDate, targetMonth)
        : this.getInclusiveDays(r.goingDate, endDate);
      const mult = isMonthly ? (days / 30) : days;
      totalAmount += remainingQty * rate * mult;
      totalActiveDaysWeighted += remainingQty * days;
    }

    return {
      amount: totalAmount,
      avgDays: initialQty > 0 ? (totalActiveDaysWeighted / initialQty) : 0,
      returnedQty: returnedSum,
      remainingQty: remainingQty
    };
  },

  getContractStatusBadge(r) {
    const summary = this.getContractReturnSummary(r);
    let totalLeased = 0;
    let totalReturned = 0;
    Object.values(summary).forEach(s => {
      totalLeased += s.leased;
      totalReturned += s.returned;
    });

    if (r.status === 'Returned' || (totalLeased > 0 && totalReturned >= totalLeased)) {
      return '<span class="badge badge-success" style="font-size: 0.75rem;">🟢 Fully Returned</span>';
    } else if (totalReturned > 0) {
      return `<span class="badge badge-info" style="font-size: 0.75rem;">🔵 Partial (${totalReturned}/${totalLeased} Returned)</span>`;
    } else {
      return '<span class="badge badge-warning" style="font-size: 0.75rem;">🟡 Active (Leased)</span>';
    }
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

    const materials = Store.Materials.getSorted().filter(m => m.status !== 'Archived');
    const days = this.getInclusiveDays(r.goingDate, r.comingDate);
    const isMonthly = r.billingBasis === 'Monthly';

    const summary = this.getContractReturnSummary(r);
    let grandTotal = 0;
    let totalLeasedQty = 0;
    let totalReturnedQty = 0;
    let totalRemainingQty = 0;

    (r.items || []).forEach(i => {
      const b = this.calculateItemBilling(r, i);
      grandTotal += b.amount;
      const s = summary[i.materialId] || {};
      totalLeasedQty += (s.leased || 0);
      totalReturnedQty += (s.returned || 0);
      totalRemainingQty += (s.remaining || 0);
    });

    const isFullyReturned = totalRemainingQty === 0 && totalLeasedQty > 0;
    const contractMonths = this.getContractMonths(r.goingDate, r.comingDate);

    return `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:24px; border-bottom: 1px solid var(--border-color); padding-bottom:20px;">
        <div>
          <h3 style="margin:0 0 8px 0; font-size:1.6rem; color:var(--text-primary); font-weight:800;">${r.customerName}</h3>
          <p style="margin:0; color:var(--text-secondary); font-size:1rem; display:flex; align-items:center; gap:8px;">
            ${Icons.mapPin} Site: <strong>${r.siteName || '-'}</strong> • <span class="badge ${isMonthly ? 'badge-neutral' : 'badge-primary'}">${isMonthly ? '📅 Monthly Basis' : '☀️ Daily Basis'}</span>
          </p>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${!isFullyReturned ? `
            <button class="btn btn-success" onclick="RentalsPage.openSplitReturnModal('${r.id}')" style="display:inline-flex;align-items:center;gap:6px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);">
              ↩️ Record Partial Return
            </button>
            <button class="btn btn-primary" onclick="RentalsPage.markReturned()" style="display:inline-flex;align-items:center;gap:6px;">
              ${Icons.check} Mark All Returned
            </button>
          ` : ''}
          <button class="btn btn-outline" onclick="RentalsPage.printChallan()" style="display:inline-flex;align-items:center;gap:6px;">
            ${Icons.fileText} Print Cumulative Slip
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
          <div style="font-size: 0.8rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Return Status</div>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 1.1rem; display:flex; align-items:center; gap:6px;">
            ${isFullyReturned ? `📅 ${r.comingDate || 'Returned'}` : `<span style="color:#eab308; font-size:0.95rem;">Active (${totalRemainingQty} Pcs Remaining)</span>`}
          </div>
        </div>
        <div style="background: var(--bg-body); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.8rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Total Lifetime Duration</div>
          <div style="font-weight: 700; color: var(--primary); font-size: 1.1rem;">
            ${days} Days ${r.comingDate ? `(${isMonthly ? (days/30).toFixed(1) + ' Months' : 'Inclusive'})` : '(Till Today)'}
          </div>
        </div>
        <div style="background: var(--bg-body); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.8rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Contract Status</div>
          <div style="font-weight: 700;">
            ${this.getContractStatusBadge(r)}
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">Leased Materials & Return Progress</h4>
        ${!isFullyReturned ? `
          <button class="btn btn-sm btn-success" onclick="RentalsPage.openSplitReturnModal('${r.id}')" style="display:inline-flex; align-items:center; gap:4px; font-size:0.8rem;">
            ↩️ Record Return Now
          </button>
        ` : ''}
      </div>

      <div class="table-container" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; margin-bottom:24px;">
        <table class="data-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: var(--bg-body);">
              <th align="left" style="padding: 12px 16px;">Material</th>
              <th align="center" style="padding: 12px 16px; text-align:center;">Initial Leased</th>
              <th align="center" style="padding: 12px 16px; text-align:center;">Returned</th>
              <th align="center" style="padding: 12px 16px; text-align:center;">Remaining Active</th>
              <th align="right" style="padding: 12px 16px; text-align:right;">Rate (${isMonthly ? 'per Month' : 'per Day'})</th>
              <th align="right" style="padding: 12px 16px; text-align:right;">Total Accrued</th>
            </tr>
          </thead>
          <tbody>
            ${r.items.map(i => {
              const mat = materials.find(m => m.id === i.materialId);
              const b = this.calculateItemBilling(r, i);
              const sum = summary[i.materialId] || { leased: i.quantity, returned: 0, remaining: i.quantity };

              return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 14px 16px;">
                    <div style="font-weight: 600; color: var(--text-primary);">${mat ? mat.name : 'Unknown Material'}</div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 2px;">${mat ? mat.sku : '-'}</div>
                  </td>
                  <td align="center" style="padding: 14px 16px; text-align:center; font-weight: 600;">
                    ${sum.leased} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-secondary);">${mat ? mat.unit : ''}</span>
                  </td>
                  <td align="center" style="padding: 14px 16px; text-align:center; font-weight: 600;">
                    <span class="badge ${sum.returned > 0 ? 'badge-success' : 'badge-neutral'}" style="font-size:0.85rem;">
                      ${sum.returned} ${mat ? mat.unit : ''}
                    </span>
                  </td>
                  <td align="center" style="padding: 14px 16px; text-align:center; font-weight: 700;">
                    <span class="badge ${sum.remaining > 0 ? 'badge-warning' : 'badge-success'}" style="font-size:0.85rem;">
                      ${sum.remaining} ${mat ? mat.unit : ''}
                    </span>
                  </td>
                  <td align="right" style="padding: 14px 16px; text-align:right; font-weight: 600; color: var(--text-secondary);">
                    ₹${parseFloat(i.rate || 0).toLocaleString('en-IN')}/${isMonthly ? 'mo' : 'day'}
                  </td>
                  <td align="right" style="padding: 14px 16px; text-align:right; font-weight: 700; color: var(--success);">
                    ₹${Math.round(b.amount).toLocaleString('en-IN')}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-body); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 24px;">
        <div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Contract Material Progress</div>
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
            ${totalReturnedQty} of ${totalLeasedQty} items returned (${totalRemainingQty} active on site)
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Grand Total Revenue</div>
          <div style="font-size: 2rem; font-weight: 800; color: var(--success); line-height: 1;">
            ₹${Math.round(grandTotal).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <!-- Partial / Split Return Logs Section -->
      ${(Array.isArray(r.returns) && r.returns.length > 0) ? `
        <div class="card" style="padding: 20px; border: 1px solid var(--border-color); margin-bottom: 24px; background: var(--bg-card);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h4 style="margin:0; font-size:1.1rem; color:var(--text-primary); font-weight:700; display:flex; align-items:center; gap:8px;">
              ↩️ Partial / Split Return Logs (${r.returns.length} Shipment Returns)
            </h4>
            ${!isFullyReturned ? `
              <button class="btn btn-xs btn-success" onclick="RentalsPage.openSplitReturnModal('${r.id}')">+ Add Return</button>
            ` : ''}
          </div>
          <div class="table-container" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg-body);">
                  <th style="padding: 10px 14px; text-align: left;">Return Date</th>
                  <th style="padding: 10px 14px; text-align: left;">Items Returned</th>
                  <th style="padding: 10px 14px; text-align: left;">Notes / Slip</th>
                  <th style="padding: 10px 14px; text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${r.returns.slice().sort((a,b) => new Date(b.returnDate) - new Date(a.returnDate)).map(ret => {
                  const retItemsSummary = (ret.items || []).map(ri => {
                    const mat = materials.find(m => m.id === ri.materialId);
                    return `<strong>${ri.quantity}</strong> ${mat ? mat.name : 'Item'}`;
                  }).join(', ');

                  return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                      <td style="padding: 10px 14px; font-weight: 700; color: var(--text-primary);">
                        📅 ${ret.returnDate}
                      </td>
                      <td style="padding: 10px 14px; color: var(--text-primary);">
                        ${retItemsSummary || '-'}
                      </td>
                      <td style="padding: 10px 14px; color: var(--text-tertiary); font-size: 0.85rem;">
                        ${ret.notes || '-'}
                      </td>
                      <td style="padding: 10px 14px; text-align: right;">
                        <button class="btn btn-xs btn-ghost" onclick="RentalsPage.deleteSplitReturn('${ret.id || ret._id}')" style="color: var(--danger);" title="Delete this return log">
                          ${Icons.trash || '✕'} Delete Log
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Month-Wise Rental Breakdown Card -->
      <div class="card" style="padding: 20px; border: 1px solid var(--border-color);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
          <div>
            <h4 style="margin:0; font-size:1.1rem; color:var(--text-primary); font-weight:700;">📅 Month-Wise Rental Breakdown & Slips</h4>
            <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-secondary);">
              ${!isFullyReturned ? '<span style="color:#059669; font-weight:700;">🔄 Auto Month-Addition Active:</span> Customer hasn\'t fully returned material yet. Every new month gets automatically added to the bill as time passes.' : 'Rental items fully returned. Final month-by-month breakdown below.'}
            </p>
          </div>
        </div>
        <div class="table-container" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: var(--bg-body);">
                <th align="left" style="padding: 12px 16px;">Billing Month</th>
                <th align="center" style="padding: 12px 16px; text-align:center;">Active Days in Month</th>
                <th align="center" style="padding: 12px 16px; text-align:center;">Month Status</th>
                <th align="right" style="padding: 12px 16px; text-align:right;">Monthly Bill Total</th>
                <th align="right" style="padding: 12px 16px; text-align:right;">Print Slip</th>
              </tr>
            </thead>
            <tbody>
              ${contractMonths.map((mStr, idx) => {
                const isCurrentMonth = mStr === new Date().toISOString().slice(0, 7);
                const mDays = RentalsPage.getDaysInMonth(r.goingDate, r.comingDate, mStr);

                let mTotal = 0;
                (r.items || []).forEach(i => {
                  mTotal += RentalsPage.calculateItemBilling(r, i, mStr).amount;
                });

                const mLabel = new Date(mStr + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

                const statusBadge = isCurrentMonth && !isFullyReturned
                  ? '<span class="badge badge-warning" style="font-size:0.75rem;">⏳ Current Month (Auto-Adding Daily)</span>'
                  : '<span class="badge badge-success" style="font-size:0.75rem;">✅ Month Bill Added</span>';

                return `
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 14px 16px; font-weight: 700; color: var(--text-primary);">
                      📅 ${mLabel}
                    </td>
                    <td align="center" style="padding: 14px 16px; text-align:center;">
                      <span class="badge badge-info" style="font-size:0.85rem; padding: 4px 10px;">${mDays} Days</span>
                    </td>
                    <td align="center" style="padding: 14px 16px; text-align:center;">
                      ${statusBadge}
                    </td>
                    <td align="right" style="padding: 14px 16px; text-align:right; font-weight: 800; color: #059669; font-size:1.05rem;">
                      ₹${Math.round(mTotal).toLocaleString('en-IN')}
                    </td>
                    <td align="right" style="padding: 14px 16px; text-align:right;">
                      <button class="btn btn-sm btn-outline" onclick="RentalsPage.printMonthlyChallan('${r.id}', '${mStr}')" style="display:inline-flex; align-items:center; gap:6px;">
                        ${Icons.printer} Print ${mLabel} Slip
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  onBillingBasisChange(type) {
    const rateHeader = document.getElementById('rental-rate-header');
    if (rateHeader) {
      rateHeader.innerText = type === 'Monthly' ? 'Monthly Rate (₹/mo)' : 'Daily Rate (₹/day)';
    }
    RentalsPage.calculateFormTotals();
  },

  renderForm() {
    const materials = Store.Materials.getSorted().filter(m => m.status !== 'Archived');
    const record = this.selectedId ? Store.RentalSites.getById(this.selectedId) : null;
    const isMonthly = record && record.billingBasis === 'Monthly';

    return `
      <form id="rental-stock-form" onsubmit="event.preventDefault(); RentalsPage.save();">
        <div class="form-group" style="margin-bottom: 20px; background: var(--bg-body); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
          <label style="font-weight: 700; color: var(--text-primary); margin-bottom: 8px; display:block;">Rental Billing Rate Basis *</label>
          <div style="display: flex; gap: 24px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600;">
              <input type="radio" name="rental-billing-basis" value="Daily" ${!isMonthly ? 'checked' : ''} onchange="RentalsPage.onBillingBasisChange('Daily')">
              ☀️ Daily Basis (Rate per Day)
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600;">
              <input type="radio" name="rental-billing-basis" value="Monthly" ${isMonthly ? 'checked' : ''} onchange="RentalsPage.onBillingBasisChange('Monthly')">
              📅 Monthly Basis (Rate per Month)
            </label>
          </div>
        </div>

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
            <input type="date" class="form-control" id="rental-going-date" required onchange="RentalsPage.calculateFormTotals()" value="${record ? record.goingDate : window.localDateStr()}" style="background: var(--bg-body);">
          </div>
          <div class="form-group">
            <label>Coming Date (Lease End) <span style="font-weight:normal; font-size:0.8em; color:var(--text-tertiary);">(Optional if active)</span></label>
            <input type="date" class="form-control" id="rental-coming-date" onchange="RentalsPage.calculateFormTotals()" value="${record ? record.comingDate : ''}" style="background: var(--bg-body);">
          </div>
        </div>

        <div class="stock-form-section mt-4">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="margin:0; font-size:1.1rem; color:var(--text-primary);">Leased Materials</h4>
            <div style="font-size:0.9rem; color:var(--text-secondary); font-weight:600;" id="rental-form-days-label">Duration: 1 Day (Inclusive)</div>
          </div>
          <div class="table-container" style="border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
            <table class="inline-table">
              <thead>
                <tr style="background: var(--bg-body);">
                  <th style="width:5%">#</th>
                  <th style="width:40%">Material</th>
                  <th style="width:20%">Quantity</th>
                  <th style="width:20%" id="rental-rate-header">${isMonthly ? 'Monthly Rate (₹/mo)' : 'Daily Rate (₹/day)'}</th>
                  <th style="width:15%">Line Total</th>
                  <th style="width:10%"></th>
                </tr>
              </thead>
              <tbody id="rental-items-body">
                ${this.formItems.map((item, idx) => {
                  const prod = materials.find(p => p.id === item.materialId);
                  
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
    this.activeTab = 'contracts';
    this.formItems = [{ materialId: '', quantity: '', rate: '' }];
    this.refresh();
    setTimeout(() => RentalsPage.calculateFormTotals(), 50);
  },

  editRecord() {
    if (!this.selectedId) return;
    const r = Store.RentalSites.getById(this.selectedId);
    if (!r) return;
    this.isEditing = true;
    this.activeTab = 'contracts';
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
    const basis = document.querySelector('input[name="rental-billing-basis"]:checked')?.value || 'Daily';
    const days = RentalsPage.getInclusiveDays(going, coming);

    const daysLabel = document.getElementById('rental-form-days-label');
    if (daysLabel) {
      if (basis === 'Monthly') {
        const mos = (days / 30).toFixed(1);
        daysLabel.innerText = `Duration: ${days} Days (~${mos} Months ${coming ? 'Inclusive' : 'Active'})`;
      } else {
        daysLabel.innerText = `Duration: ${days} ${days === 1 ? 'Day' : 'Days'} ${coming ? '(Inclusive)' : '(Active Till Today)'}`;
      }
    }

    const rows = document.querySelectorAll('#rental-items-body tr');
    let grandTotal = 0;

    const multiplier = basis === 'Monthly' ? (days / 30) : days;

    rows.forEach((row, idx) => {
      const qty = parseFloat(row.querySelector('.r-qty').value) || 0;
      const rate = parseFloat(row.querySelector('.r-rate').value) || 0;
      const lineTotal = Math.round(qty * rate * multiplier);
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
    const billingBasis = document.querySelector('input[name="rental-billing-basis"]:checked')?.value || 'Daily';

    if (!customerName || !siteName || !goingDate) {
      alert('Please fill out Customer Name, Site Address, and Going Date.');
      return;
    }

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
      comingDate: comingDate || '',
      billingBasis,
      items: items.map(i => ({
        materialId: i.materialId,
        quantity: parseFloat(i.quantity) || 0,
        rate: parseFloat(i.rate) || 0
      })),
      status: record ? record.status : (comingDate ? 'Returned' : 'Active'),
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

  openSplitReturnModal(contractId) {
    const r = Store.RentalSites.getById(contractId || this.selectedId);
    if (!r) return;
    this.splitReturnContractId = r.id;

    const materials = Store.Materials.getAll();
    const summary = this.getContractReturnSummary(r);

    const activeItems = r.items.filter(i => (summary[i.materialId]?.remaining || 0) > 0);
    if (activeItems.length === 0) {
      alert('All items in this contract are already fully returned!');
      return;
    }

    const todayStr = window.localDateStr();

    let modalHtml = `
      <div class="modal-backdrop active" id="split-return-modal" style="display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10000; padding:16px;">
        <div class="modal card" style="max-width: 620px; width:100%; border-radius:12px; overflow:hidden; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); background:var(--bg-card);">
          <div class="modal-header" style="padding:16px 20px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%); border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
            <h3 style="color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin: 0; font-size:1.2rem;">
              ↩️ Record Partial / Split Return
            </h3>
            <button class="modal-close btn btn-ghost" onclick="RentalsPage.closeSplitReturnModal()" style="font-size:1.2rem; cursor:pointer;">${Icons.x || '✕'}</button>
          </div>
          <form onsubmit="event.preventDefault(); RentalsPage.saveSplitReturn();">
            <div class="modal-body" style="padding: 20px; max-height:75vh; overflow-y:auto;">
              <div style="background: var(--bg-body); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 16px;">
                <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">👤 ${r.customerName}</div>
                <div style="font-size: 0.85rem; color: var(--text-tertiary);">📍 Site: ${r.siteName || '-'} • Dispatch Date: ${r.goingDate}</div>
              </div>

              <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-weight: 600; color: var(--text-secondary); margin-bottom:6px; display:block;">Return Date *</label>
                <input type="date" class="form-control" id="split-return-date" required value="${todayStr}" min="${r.goingDate}" style="background: var(--bg-body); width:100%;">
              </div>

              <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; display: block;">Items Being Returned Now *</label>
                <div class="table-container" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                  <table class="data-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="background: var(--bg-body);">
                        <th style="padding: 10px 12px; text-align: left;">Material</th>
                        <th style="padding: 10px 12px; text-align: center;">Leased / Returned</th>
                        <th style="padding: 10px 12px; text-align: center;">Remaining</th>
                        <th style="padding: 10px 12px; text-align: right; width: 140px;">Return Now</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${activeItems.map(i => {
                        const mat = materials.find(m => m.id === i.materialId);
                        const sum = summary[i.materialId];
                        return `
                          <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 10px 12px;">
                              <strong style="color: var(--text-primary);">${mat ? mat.name : 'Material'}</strong>
                            </td>
                            <td align="center" style="padding: 10px 12px; font-size: 0.85rem; color: var(--text-secondary);">
                              ${sum.leased} / ${sum.returned} ${mat ? mat.unit : ''}
                            </td>
                            <td align="center" style="padding: 10px 12px;">
                              <span class="badge badge-warning" style="font-size: 0.85rem;">${sum.remaining} ${mat ? mat.unit : ''}</span>
                            </td>
                            <td align="right" style="padding: 10px 12px;">
                              <div style="display: flex; gap: 6px; align-items: center; justify-content: flex-end;">
                                <input type="number" class="form-control split-ret-qty" data-mat-id="${i.materialId}" data-max-qty="${sum.remaining}" min="0" max="${sum.remaining}" placeholder="0" style="width: 80px; text-align: right; background: var(--bg-body); font-weight: 700;">
                                <button type="button" class="btn btn-xs btn-outline" onclick="this.previousElementSibling.value = ${sum.remaining}" title="Set max remaining">All</button>
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label style="font-weight: 600; color: var(--text-secondary); margin-bottom:6px; display:block;">Notes / Slip No. (Optional)</label>
                <input type="text" class="form-control" id="split-return-notes" placeholder="e.g. Challan #104, Truck UP14-XX-1234" style="background: var(--bg-body); width:100%;">
              </div>
            </div>
            <div class="modal-footer" style="padding: 16px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; background:var(--bg-card);">
              <button type="button" class="btn btn-outline" onclick="RentalsPage.closeSplitReturnModal()">Cancel</button>
              <button type="submit" class="btn btn-success" style="display: inline-flex; align-items: center; gap: 6px;">
                ${Icons.check || '✓'} Save Partial Return Log
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    const existingModal = document.getElementById('split-return-modal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  closeSplitReturnModal() {
    const el = document.getElementById('split-return-modal');
    if (el) el.remove();
  },

  saveSplitReturn() {
    if (!this.splitReturnContractId) return;
    const r = Store.RentalSites.getById(this.splitReturnContractId);
    if (!r) return;

    const returnDate = document.getElementById('split-return-date')?.value;
    if (!returnDate) {
      alert('Please enter return date.');
      return;
    }
    if (returnDate < r.goingDate) {
      alert(`Return date cannot be earlier than going date (${r.goingDate}).`);
      return;
    }

    const qtyInputs = document.querySelectorAll('.split-ret-qty');
    const returnItems = [];
    let hasQuantity = false;
    let overflowError = false;

    qtyInputs.forEach(inp => {
      const matId = inp.getAttribute('data-mat-id');
      const maxQty = parseFloat(inp.getAttribute('data-max-qty')) || 0;
      const qty = parseFloat(inp.value) || 0;

      if (qty > maxQty) {
        alert(`Returned quantity cannot exceed remaining quantity (${maxQty}).`);
        overflowError = true;
        return;
      }
      if (qty > 0) {
        hasQuantity = true;
        returnItems.push({ materialId: matId, quantity: qty });
      }
    });

    if (overflowError) return;

    if (!hasQuantity) {
      alert('Please enter a quantity greater than 0 for at least one item.');
      return;
    }

    const notes = document.getElementById('split-return-notes')?.value.trim() || '';

    const newReturnLog = {
      id: 'ret_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      returnDate: returnDate,
      notes: notes,
      items: returnItems,
      createdAt: new Date().toISOString()
    };

    const existingReturns = Array.isArray(r.returns) ? [...r.returns] : [];
    existingReturns.push(newReturnLog);

    const summary = this.getContractReturnSummary({ ...r, returns: existingReturns });
    let totalLeased = 0;
    let totalReturned = 0;
    Object.values(summary).forEach(s => {
      totalLeased += s.leased;
      totalReturned += s.returned;
    });

    const isFullyReturned = totalReturned >= totalLeased && totalLeased > 0;
    const latestReturnDate = existingReturns.reduce((maxDate, ret) => (!maxDate || ret.returnDate > maxDate) ? ret.returnDate : maxDate, '');

    Store.RentalSites.update(this.splitReturnContractId, {
      returns: existingReturns,
      status: isFullyReturned ? 'Returned' : 'Active',
      comingDate: isFullyReturned ? latestReturnDate : (r.comingDate || '')
    });

    this.closeSplitReturnModal();
    alert('Partial return recorded successfully!');
    this.refresh();
  },

  deleteSplitReturn(returnId) {
    if (!this.selectedId) return;
    const r = Store.RentalSites.getById(this.selectedId);
    if (!r || !Array.isArray(r.returns)) return;

    if (!confirm('Are you sure you want to delete this return log entry? Remaining item balances will be adjusted.')) {
      return;
    }

    const updatedReturns = r.returns.filter(ret => (ret.id || ret._id) !== returnId);
    const summary = this.getContractReturnSummary({ ...r, returns: updatedReturns });
    let totalLeased = 0;
    let totalReturned = 0;
    Object.values(summary).forEach(s => {
      totalLeased += s.leased;
      totalReturned += s.returned;
    });

    const isFullyReturned = totalReturned >= totalLeased && totalLeased > 0;

    Store.RentalSites.update(this.selectedId, {
      returns: updatedReturns,
      status: isFullyReturned ? 'Returned' : 'Active',
      comingDate: isFullyReturned ? (r.comingDate || window.localDateStr()) : ''
    });

    alert('Return log entry deleted.');
    this.refresh();
  },

  setComingDatePrompt(contractId) {
    const c = Store.RentalSites.getById(contractId);
    if (!c) return;

    const dateInput = prompt('Enter Return / Coming Date (YYYY-MM-DD):', window.localDateStr());
    if (dateInput) {
      Store.RentalSites.update(contractId, {
        comingDate: dateInput,
        status: 'Returned'
      });
      alert('Return Date updated successfully!');
      this.refresh();
    }
  },

  markReturned() {
    if (!this.selectedId) return;
    const c = Store.RentalSites.getById(this.selectedId);
    if (!c) return;

    const returnDate = c.comingDate || window.localDateStr();
    if (confirm(`Mark all remaining rental items as returned on ${returnDate}?`)) {
      const summary = this.getContractReturnSummary(c);
      const remainingItems = [];
      Object.values(summary).forEach(s => {
        if (s.remaining > 0) {
          remainingItems.push({ materialId: s.materialId, quantity: s.remaining });
        }
      });

      const existingReturns = Array.isArray(c.returns) ? [...c.returns] : [];
      if (remainingItems.length > 0) {
        existingReturns.push({
          id: 'ret_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          returnDate: returnDate,
          notes: 'Full Return Completed',
          items: remainingItems,
          createdAt: new Date().toISOString()
        });
      }

      Store.RentalSites.update(this.selectedId, {
        returns: existingReturns,
        comingDate: returnDate,
        status: 'Returned'
      });
      alert('Rental contract status updated to Fully Returned!');
      this.refresh();
    }
  },

  deleteRecord() {
    if (!this.selectedId) return;
    if (confirm('Are you absolutely sure you want to delete this rental contract?')) {
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
    const isMonthly = r.billingBasis === 'Monthly';
    const summary = this.getContractReturnSummary(r);

    let grandTotal = 0;
    const rows = (r.items || []).map((i, idx) => {
      const mat = materials.find(m => m.id === i.materialId);
      const b = this.calculateItemBilling(r, i);
      grandTotal += b.amount;
      const s = summary[i.materialId] || { leased: i.quantity, returned: 0, remaining: i.quantity };

      return `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px;">
            <strong>${mat ? mat.name : 'Unknown Material'}</strong>
            <div style="font-size:11px; color:#64748b;">Leased: ${s.leased} ${mat ? mat.unit : ''} | Returned: ${s.returned} | Remaining: ${s.remaining}</div>
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${r.goingDate}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold;">${Math.round(b.avgDays)} Days avg</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">₹${parseFloat(i.rate || 0).toLocaleString('en-IN')}/${isMonthly ? 'mo' : 'day'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-weight: bold; color: #059669;">₹${Math.round(b.amount).toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');

    const returnsHtml = (Array.isArray(r.returns) && r.returns.length > 0) ? `
      <div style="margin-bottom: 24px;">
        <h4 style="color: #1e40af; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">Shipment Return Logs (Partial Returns Received)</h4>
        <table>
          <thead>
            <tr>
              <th style="width: 120px;">Return Date</th>
              <th>Items Returned</th>
              <th>Notes / Slip No</th>
            </tr>
          </thead>
          <tbody>
            ${r.returns.slice().sort((a,b) => new Date(a.returnDate) - new Date(b.returnDate)).map(ret => {
              const itemsList = (ret.items || []).map(ri => {
                const mat = materials.find(m => m.id === ri.materialId);
                return `${ri.quantity} ${mat ? mat.name : 'Item'}`;
              }).join(', ');
              return `
                <tr>
                  <td><strong>${ret.returnDate}</strong></td>
                  <td>${itemsList || '-'}</td>
                  <td>${ret.notes || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
      <html><head>
        <title>Rental Delivery Bill / Slip - ${r.customerName}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5; padding: 20px; background: #fff; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .title { font-size: 24px; font-weight: bold; color: #1e40af; }
          .info-block { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .card h4 { color: #1e40af; margin-bottom: 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
          .card p { font-size: 13px; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #0f172a; color: white; border: 1px solid #0f172a; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
          td { border: 1px solid #cbd5e1; padding: 10px; font-size: 13px; }
          .total-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; }
          .total-card { border: 2px solid #10b981; background: #ecfdf5; border-radius: 8px; padding: 16px; min-width: 250px; text-align: right; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
          .sig-line { border-top: 1px solid #94a3b8; width: 200px; margin-top: 40px; text-align: center; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">KSS CONSTRUCTION MATERIALS</div>
            <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Material Rental Bill & Delivery Slip</p>
          </div>
          <div style="text-align: right;">
            <p style="font-weight: bold;">Date: ${today}</p>
            <p style="font-size: 12px; color: #64748b;">Ref: ${r.id}</p>
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
            <p><strong>Coming Date:</strong> ${r.comingDate || 'Active / Ongoing'}</p>
            <p><strong>Billing Basis:</strong> ${isMonthly ? 'MONTHLY BASIS' : 'DAILY BASIS'}</p>
            <p><strong>Total Duration:</strong> ${days} Days ${r.comingDate ? `(${isMonthly ? (days/30).toFixed(1) + ' Months' : 'Inclusive'})` : '(Active Till Today)'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 60px; text-align: center;">S.No</th>
              <th>ITEM Description & Balance</th>
              <th style="width: 120px; text-align: center;">Date</th>
              <th style="width: 100px; text-align: center;">Duration</th>
              <th style="width: 110px; text-align: right;">Rate (₹)</th>
              <th style="width: 130px; text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        ${returnsHtml}

        <div class="total-section">
          <div style="font-weight: 700; font-size: 14px; color: #1e40af; border: 1px solid #93c5fd; background: #eff6ff; padding: 10px 16px; border-radius: 6px;">
            Statement Period: <strong>${r.goingDate} TO ${r.comingDate || 'ACTIVE'}</strong>
          </div>
          <div class="total-card">
            <span style="font-size: 11px; text-transform: uppercase; color: #047857; font-weight: bold; display: block; margin-bottom: 4px;">Grand Total Rental Charge</span>
            <span style="font-size: 22px; font-weight: 800; color: #065f46;">₹${Math.round(grandTotal).toLocaleString('en-IN')}</span>
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
  },

  printMonthlyChallan(contractId, targetMonthStr) {
    contractId = contractId || this.selectedId;
    if (!contractId) return;
    const r = Store.RentalSites.getById(contractId);
    if (!r) return;

    targetMonthStr = targetMonthStr || this.selectedMonth || new Date().toISOString().slice(0, 7);

    const materials = Store.Materials.getAll();
    const daysInMonth = this.getDaysInMonth(r.goingDate, r.comingDate, targetMonthStr);
    const isMonthly = r.billingBasis === 'Monthly';

    let grandTotal = 0;
    const rows = (r.items || []).map((i, idx) => {
      const mat = materials.find(m => m.id === i.materialId);
      const b = this.calculateItemBilling(r, i, targetMonthStr);
      grandTotal += b.amount;
      return `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px;">
            <strong>${mat ? mat.name : 'Unknown Material'}</strong> (${i.quantity} ${mat ? mat.unit : ''})
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${r.goingDate}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold;">${daysInMonth} Days</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">₹${parseFloat(i.rate || 0).toLocaleString('en-IN')}/${isMonthly ? 'mo' : 'day'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-weight: bold; color: #059669;">₹${Math.round(b.amount).toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const monthLabel = new Date(targetMonthStr + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const yearStr = targetMonthStr.split('-')[0];
    const monthStr = targetMonthStr.split('-')[1];
    const lastDayNum = new Date(yearStr, monthStr, 0).getDate();
    const monthRangeStr = `01-${monthStr}-${yearStr} TO ${lastDayNum}-${monthStr}-${yearStr}`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
      <html><head>
        <title>Monthly Rental Bill Slip - ${r.customerName} (${monthLabel})</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5; padding: 20px; background: #fff; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .title { font-size: 24px; font-weight: bold; color: #1e40af; }
          .info-block { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .card h4 { color: #1e40af; margin-bottom: 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
          .card p { font-size: 13px; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #0f172a; color: white; border: 1px solid #0f172a; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
          td { border: 1px solid #cbd5e1; padding: 10px; font-size: 13px; }
          .total-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; }
          .total-card { border: 2px solid #10b981; background: #ecfdf5; border-radius: 8px; padding: 16px; min-width: 250px; text-align: right; }
          .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
          .sig-line { border-top: 1px solid #94a3b8; width: 200px; margin-top: 40px; text-align: center; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">KSS CONSTRUCTION MATERIALS</div>
            <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Month-Wise Rental Bill & Delivery Slip | <strong>${monthLabel}</strong></p>
          </div>
          <div style="text-align: right;">
            <p style="font-weight: bold;">Date: ${today}</p>
            <p style="font-size: 12px; color: #64748b;">Ref: ${r.id}</p>
          </div>
        </div>

        <div class="info-block">
          <div class="card">
            <h4>Customer & Site Info</h4>
            <p><strong>Customer Name:</strong> ${r.customerName}</p>
            <p><strong>Site Location:</strong> ${r.siteName || '-'}</p>
          </div>
          <div class="card">
            <h4>Monthly Rental Statement Details</h4>
            <p><strong>Billing Month:</strong> <span style="color:#1e40af; font-weight:bold;">${monthLabel}</span></p>
            <p><strong>Dispatch Start Date:</strong> ${r.goingDate}</p>
            <p><strong>Billing Basis:</strong> ${isMonthly ? 'MONTHLY BASIS' : 'DAILY BASIS'}</p>
            <p><strong>Active Days in ${monthLabel}:</strong> ${daysInMonth} Days</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 60px; text-align: center;">S.No</th>
              <th>ITEM Description</th>
              <th style="width: 120px; text-align: center;">Going Date</th>
              <th style="width: 110px; text-align: center;">Days (${monthLabel})</th>
              <th style="width: 110px; text-align: right;">Rate (₹)</th>
              <th style="width: 130px; text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="total-section">
          <div style="font-weight: 700; font-size: 14px; color: #1e40af; border: 1px solid #93c5fd; background: #eff6ff; padding: 10px 16px; border-radius: 6px;">
            Statement Month Period: <strong>${monthRangeStr}</strong>
          </div>
          <div class="total-card">
            <span style="font-size: 11px; text-transform: uppercase; color: #047857; font-weight: bold; display: block; margin-bottom: 4px;">Total Bill Amount (${monthLabel})</span>
            <span style="font-size: 22px; font-weight: 800; color: #065f46;">₹${Math.round(grandTotal).toLocaleString('en-IN')}</span>
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
  },

  printMonthlyRegister() {
    const allRecords = Store.RentalSites ? Store.RentalSites.getAll() : [];
    const materials = Store.Materials.getSorted().filter(m => m.status !== 'Archived');

    let monthRecords = allRecords.filter(r => {
      if (!r.goingDate) return false;
      const goingMonth = r.goingDate.slice(0, 7);
      const comingMonth = r.comingDate ? r.comingDate.slice(0, 7) : '';

      const startedInOrBefore = goingMonth <= this.selectedMonth;
      const endedInOrAfter = !r.comingDate || comingMonth >= this.selectedMonth;

      return startedInOrBefore && endedInOrAfter;
    });

    if (this.selectedCustomerFilters && this.selectedCustomerFilters.length > 0) {
      const lowerCusts = this.selectedCustomerFilters.map(c => c.toLowerCase());
      monthRecords = monthRecords.filter(r => lowerCusts.includes((r.customerName || '').toLowerCase()));
    } else if (this.selectedCustomerFilter) {
      monthRecords = monthRecords.filter(r => (r.customerName || '').toLowerCase() === this.selectedCustomerFilter.toLowerCase());
    }

    if (this.selectedSiteFilters && this.selectedSiteFilters.length > 0) {
      const lowerSites = this.selectedSiteFilters.map(s => s.toLowerCase());
      monthRecords = monthRecords.filter(r => lowerSites.includes((r.siteName || '').toLowerCase()));
    }

    monthRecords.sort((a, b) => new Date(a.goingDate) - new Date(b.goingDate));

    const monthLabel = new Date(this.selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const yearStr = this.selectedMonth.split('-')[0];
    const monthStr = this.selectedMonth.split('-')[1];

    const lastDay = new Date(yearStr, monthStr, 0).getDate();
    const dateRangeStr = `01-${monthStr}-${yearStr} TO ${lastDay}-${monthStr}-${yearStr}`;

    let custFilterLabel = 'All Customers';
    if (this.selectedCustomerFilters && this.selectedCustomerFilters.length === 1) {
      custFilterLabel = this.selectedCustomerFilters[0];
    } else if (this.selectedCustomerFilters && this.selectedCustomerFilters.length > 1) {
      custFilterLabel = `${this.selectedCustomerFilters.length} Customers (${this.selectedCustomerFilters.join(', ')})`;
    } else if (this.selectedCustomerFilter) {
      custFilterLabel = this.selectedCustomerFilter;
    }

    let siteFilterLabel = 'All Sites';
    if (this.selectedSiteFilters && this.selectedSiteFilters.length === 1) {
      siteFilterLabel = this.selectedSiteFilters[0];
    } else if (this.selectedSiteFilters && this.selectedSiteFilters.length > 1) {
      siteFilterLabel = `${this.selectedSiteFilters.length} Sites (${this.selectedSiteFilters.join(', ')})`;
    }

    let grandMonthlyBill = 0;
    let sNoCounter = 1;
    let tableRowsHtml = '';

    monthRecords.forEach(r => {
      const days = this.getDaysInMonth(r.goingDate, r.comingDate, this.selectedMonth);
      const isMonthly = r.billingBasis === 'Monthly';
      const durationMultiplier = isMonthly ? (days / 30) : days;

      if (days > 0) {
        (r.items || []).forEach(i => {
          const mat = materials.find(x => x.id === i.materialId);
          const lineTotal = Math.round(parseFloat(i.quantity || 0) * parseFloat(i.rate || 0) * durationMultiplier);
          grandMonthlyBill += lineTotal;

          tableRowsHtml += `
            <tr>
              <td style="padding:10px; border:1px solid #cbd5e1; text-align:center; font-weight:600;">${sNoCounter++}</td>
              <td style="padding:10px; border:1px solid #cbd5e1;">
                <strong style="color:#0f172a;">${mat ? mat.name : 'Rental Material'}</strong> (${i.quantity} ${mat ? mat.unit : ''})<br>
                <span style="font-size:10px; color:#64748b;">Customer: ${r.customerName} | Site: ${r.siteName || '-'}</span>
              </td>
              <td style="padding:10px; border:1px solid #cbd5e1; text-align:center;">${r.goingDate}</td>
              <td style="padding:10px; border:1px solid #cbd5e1; text-align:center; font-weight:700;">${days} Days (${monthLabel})</td>
              <td style="padding:10px; border:1px solid #cbd5e1; text-align:right;">₹${parseFloat(i.rate || 0).toLocaleString('en-IN')}/${isMonthly ? 'mo' : 'day'}</td>
              <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; font-weight:700; color:#059669;">₹${lineTotal.toLocaleString('en-IN')}</td>
            </tr>
          `;
        });
      }
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>KSS Monthly Rental Register - ${monthLabel}</title>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap");
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: 'Inter', sans-serif; color: #0f172a; padding: 10px; background: #fff; line-height: 1.4; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 22px; font-weight: 800; color: #1e40af; text-transform: uppercase; }
          .sub { font-size: 11px; color: #475569; margin-top: 4px; }
          .filter-bar { font-size: 11px; color: #334155; margin-top: 6px; background: #f1f5f9; padding: 4px 10px; border-radius: 4px; display: inline-flex; gap: 16px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
          .table th { background: #0f172a; color: white; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; border: 1px solid #0f172a; }
          .table td { padding: 10px; border: 1px solid #cbd5e1; }
          .footer-box { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding: 16px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; }
          .date-range-box { font-size: 15px; font-weight: 800; color: #1e40af; border-bottom: 2px underline #1e40af; }
          .total-box { font-size: 18px; font-weight: 800; color: #059669; border: 2px solid #10b981; background: #ecfdf5; padding: 10px 20px; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">KSS CONSTRUCTION MATERIALS</div>
            <div class="sub">Monthly Rental Bill & Dispatch Register | Month: <strong>${monthLabel}</strong></div>
            <div class="filter-bar">
              <span><strong>Customer(s):</strong> ${custFilterLabel}</span>
              <span><strong>Site(s):</strong> ${siteFilterLabel}</span>
            </div>
          </div>
          <div style="text-align:right; font-size:10px; color:#64748b;">
            <div>Printed on: ${new Date().toLocaleString('en-IN')}</div>
            <div>Independent Rental Statement</div>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">S.No</th>
              <th>ITEM Description</th>
              <th style="width: 110px; text-align: center;">Date</th>
              <th style="width: 90px; text-align: center;">Days</th>
              <th style="width: 100px; text-align: right;">Rate (₹)</th>
              <th style="width: 120px; text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml.length > 0 ? tableRowsHtml : '<tr><td colspan="6" style="text-align:center; padding:20px;">No rental dispatches found for this month matching the selected filters</td></tr>'}
          </tbody>
        </table>

        <div class="footer-box">
          <div class="date-range-box">
            ${dateRangeStr}
          </div>
          <div class="total-box">
            Total Amount: ₹${grandMonthlyBill.toLocaleString('en-IN')}
          </div>
        </div>

        <div style="margin-top: 60px; display: flex; justify-content: space-between; font-size: 12px; color: #475569;">
          <div>Customer Signature: __________________</div>
          <div>Authorized Signatory: __________________</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          }
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  }
};
