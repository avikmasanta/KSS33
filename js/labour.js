/* ============================================
   BuildMate Labour Log Module
   ============================================ */

var LabourPage = {
  activeTab: 'dashboard', // 'dashboard', 'master', 'log', 'reports'
  searchTerm: '',
  statusFilter: 'Active',
  selectedLabourId: null,
  profileTab: 'overview', // 'overview', 'attendance', 'payments'
  
  // Daily Log state
  logDate: window.localDateStr(),
  globalSiteId: '',
  dailyLogsData: {}, // key: labourId -> log object

  // Report state
  reportStartDate: window.localDateStr(new Date(new Date().setDate(new Date().getDate() - 30))),
  reportEndDate: window.localDateStr(),
  reportSiteId: '',
  reportLabourId: '',
  reportAttendance: '',

  // Cache for aggregated dashboard/report totals
  summaryData: {
    summary: {
      totalLabour: 0,
      presentToday: 0,
      halfDayToday: 0,
      absentToday: 0,
      totalPayable: 0,
      totalAdvancePaid: 0
    },
    labours: []
  },

  async init() {
    this.logDate = window.localDateStr();
    this.reportStartDate = window.localDateStr(new Date(new Date().setDate(new Date().getDate() - 30)));
    this.reportEndDate = window.localDateStr();
    await this.fetchData();
  },

  async refresh() {
    if (window.location.hash === '#labour') {
      await this.fetchData();
      const container = document.getElementById('page-container');
      if (container) {
        container.innerHTML = this.render();
        this.bindEvents();
      }
    }
  },

  async fetchData() {
    try {
      // Fetch summary from backend which uses MongoDB aggregations
      let query = `?startDate=${this.reportStartDate}&endDate=${this.reportEndDate}`;
      if (this.reportSiteId) query += `&siteId=${this.reportSiteId}`;
      if (this.reportLabourId) query += `&labourId=${this.reportLabourId}`;
      if (this.reportAttendance) query += `&attendance=${this.reportAttendance}`;

      const res = await fetch(`/api/labours-summary${query}`);
      if (res.ok) {
        this.summaryData = await res.json();
      }

      // Prefill logs from local Store cache to ensure instant reactivity and sync
      const allLogs = Store.LabourLogs.getAll();
      this.dailyLogsData = {};
      allLogs.forEach(log => {
        if (log.date === this.logDate) {
          this.dailyLogsData[log.labourId] = log;
        }
      });
    } catch (err) {
      console.error("Error fetching labour data:", err);
    }
  },

  render() {
    const activeTabClass = (tab) => this.activeTab === tab ? 'active' : '';

    return `
      <div class="page-header" style="background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-body) 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div class="page-header-title" style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 48px; height: 48px; background: rgba(37, 99, 235, 0.1); color: var(--primary-500); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            ${Icons.users}
          </div>
          <div>
            <h2 style="margin: 0; font-size: 1.5rem; color: var(--text-primary);">Labour Log & Payroll</h2>
            <p style="margin: 4px 0 0 0; color: var(--text-tertiary);">Manage workforce, daily logs, wages and payroll</p>
          </div>
        </div>
        <div class="page-header-actions" style="display: flex; gap: 10px;">
          <button class="btn btn-primary" onclick="LabourPage.openAddLabourModal()">
            ${Icons.plus} Add Labour
          </button>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); margin-bottom: 24px; padding-bottom: 8px; overflow-x: auto;">
        <button class="btn ${this.activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}" onclick="LabourPage.switchTab('dashboard')">
          ${Icons.home} &nbsp; Dashboard
        </button>
        <button class="btn ${this.activeTab === 'master' ? 'btn-primary' : 'btn-ghost'}" onclick="LabourPage.switchTab('master')">
          ${Icons.users} &nbsp; Labour Master
        </button>
        <button class="btn ${this.activeTab === 'log' ? 'btn-primary' : 'btn-ghost'}" onclick="LabourPage.switchTab('log')">
          ${Icons.calendar} &nbsp; Daily Attendance Log
        </button>
        <button class="btn ${this.activeTab === 'reports' ? 'btn-primary' : 'btn-ghost'}" onclick="LabourPage.switchTab('reports')">
          ${Icons.barChart} &nbsp; Payroll Reports
        </button>
      </div>

      <div class="tab-content">
        ${this.renderTabContent()}
      </div>

      <!-- Add/Edit Labour Modal -->
      <div class="modal-backdrop" id="labour-modal-backdrop" onclick="LabourPage.closeLabourModal()">
        <div class="modal" id="labour-modal" style="max-width: 480px;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3 id="labour-modal-title">Add New Labour</h3>
            <button type="button" class="modal-close" onclick="LabourPage.closeLabourModal()">${Icons.x}</button>
          </div>
          <div class="modal-body">
            <form id="labour-form" onsubmit="LabourPage.handleLabourSubmit(event)">
              <input type="hidden" id="labour-id">
              <div class="form-group" style="margin-bottom: 16px;">
                <label for="labour-name">Labour Name <span style="color:var(--danger)">*</span></label>
                <input type="text" id="labour-name" class="form-control" placeholder="e.g. Ramesh Kumar" required>
              </div>
              <div class="form-group" style="margin-bottom: 16px;">
                <label for="labour-nickname">Nickname / Alias</label>
                <input type="text" id="labour-nickname" class="form-control" placeholder="e.g. Ramesh">
              </div>
              <div class="form-group" style="margin-bottom: 16px;">
                <label for="labour-phone">Mobile Number</label>
                <input type="tel" id="labour-phone" class="form-control" placeholder="e.g. 9876543210" pattern="[0-9]{10}">
              </div>
              <div class="form-group" style="margin-bottom: 16px;">
                <label for="labour-default-wage">Default Daily Wage (₹) <span style="font-size:0.8em;color:var(--text-secondary)">— carries forward each day</span></label>
                <input type="number" id="labour-default-wage" class="form-control" placeholder="e.g. 700" min="0">
              </div>
              <div class="form-group" style="margin-bottom: 24px;">
                <label for="labour-status">Status</label>
                <select id="labour-status" class="form-control">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button type="button" class="btn btn-outline" onclick="LabourPage.closeLabourModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Details</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  renderTabContent() {
    switch (this.activeTab) {
      case 'dashboard':
        return this.renderDashboard();
      case 'master':
        return this.renderMaster();
      case 'log':
        return this.renderLog();
      case 'reports':
        return this.renderReports();
      default:
        return '';
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    this.fetchData().then(() => {
      const container = document.getElementById('page-container');
      if (container) {
        container.innerHTML = this.render();
        this.bindEvents();
      }
    });
  },

  // ==========================================
  // DASHBOARD TAB
  // ==========================================
  renderDashboard() {
    const s = this.summaryData.summary;
    const formatCurrency = (v) => '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <div class="card" style="padding: 20px; background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%); border-left: 5px solid var(--primary-500); display:flex; align-items:center; justify-content:space-between; box-shadow: var(--card-shadow);">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Total Labour (Active)</div>
            <h2 style="margin: 8px 0 0 0; font-size: 2rem; color: var(--text-primary); font-family: var(--font-family-heading);">${s.totalLabour || 0}</h2>
          </div>
          <div style="color: var(--primary-500); opacity: 0.8;">${Icons.users}</div>
        </div>
        <div class="card" style="padding: 20px; background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%); border-left: 5px solid var(--success); display:flex; align-items:center; justify-content:space-between; box-shadow: var(--card-shadow);">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Present Today</div>
            <h2 style="margin: 8px 0 0 0; font-size: 2rem; color: var(--success); font-family: var(--font-family-heading);">${s.presentToday || 0}</h2>
          </div>
          <div style="color: var(--success); opacity: 0.8;">${Icons.check}</div>
        </div>
        <div class="card" style="padding: 20px; background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%); border-left: 5px solid var(--warning); display:flex; align-items:center; justify-content:space-between; box-shadow: var(--card-shadow);">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Half Day Today</div>
            <h2 style="margin: 8px 0 0 0; font-size: 2rem; color: var(--warning); font-family: var(--font-family-heading);">${s.halfDayToday || 0}</h2>
          </div>
          <div style="color: var(--warning); opacity: 0.8;">${Icons.activity}</div>
        </div>
        <div class="card" style="padding: 20px; background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%); border-left: 5px solid var(--danger); display:flex; align-items:center; justify-content:space-between; box-shadow: var(--card-shadow);">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Absent Today</div>
            <h2 style="margin: 8px 0 0 0; font-size: 2rem; color: var(--danger); font-family: var(--font-family-heading);">${s.absentToday || 0}</h2>
          </div>
          <div style="color: var(--danger); opacity: 0.8;">${Icons.x}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <div class="card" style="padding: 24px; background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); border: 1px solid var(--border-color); border-radius: var(--card-radius);">
          <h4 style="margin:0 0 8px 0; color: var(--text-secondary); font-weight:500;">Total Payable Wages</h4>
          <h2 style="margin:0; font-size: 2.25rem; color: var(--text-primary); font-weight:700;">${formatCurrency(s.totalPayable || 0)}</h2>
          <p style="margin: 8px 0 0 0; font-size: 0.8rem; color: var(--text-tertiary);">Outstanding wages due for payment</p>
        </div>
        <div class="card" style="padding: 24px; background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); border: 1px solid var(--border-color); border-radius: var(--card-radius);">
          <h4 style="margin:0 0 8px 0; color: var(--text-secondary); font-weight:500;">Total Advance Paid</h4>
          <h2 style="margin:0; font-size: 2.25rem; color: var(--success); font-weight:700;">${formatCurrency(s.totalAdvancePaid || 0)}</h2>
          <p style="margin: 8px 0 0 0; font-size: 0.8rem; color: var(--text-tertiary);">Advance salary/balances given to labour</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Quick Active Labour Summary</h3>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Labour Name</th>
                <th>Nickname</th>
                <th>Mobile Number</th>
                <th style="text-align:center;">Present</th>
                <th style="text-align:center;">Half Day</th>
                <th style="text-align:center;">Absent</th>
                <th style="text-align:right;">Total Earnings</th>
                <th style="text-align:right;">Money Given</th>
                <th style="text-align:right;">Balance status</th>
              </tr>
            </thead>
            <tbody>
              ${this.summaryData.labours.slice(0, 8).map(l => {
                let balBadge = '';
                if (l.payableAmount > 0) {
                  balBadge = `<span class="badge badge-warning" style="background:#fef3c7;color:#d97706">Payable: ₹${l.payableAmount}</span>`;
                } else if (l.advanceBalance > 0) {
                  balBadge = `<span class="badge badge-success" style="background:#d1fae5;color:#059669">Advance: ₹${l.advanceBalance}</span>`;
                } else {
                  balBadge = `<span class="badge badge-success" style="background:var(--border-light);color:var(--text-secondary)">Clear</span>`;
                }
                return `
                  <tr>
                    <td><strong>${l.name}</strong></td>
                    <td>${l.nickname || '-'}</td>
                    <td>${l.phone || '-'}</td>
                    <td style="text-align:center;font-weight:600;">${l.presentDays}</td>
                    <td style="text-align:center;font-weight:600;">${l.halfDays}</td>
                    <td style="text-align:center;font-weight:600;">${l.absentDays}</td>
                    <td style="text-align:right;font-weight:700;">₹${l.totalEarnings}</td>
                    <td style="text-align:right;">₹${l.totalMoneyGiven}</td>
                    <td style="text-align:right;">${balBadge}</td>
                  </tr>
                `;
              }).join('')}
              ${this.summaryData.labours.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-tertiary);">No labour data found. Add labour in the Labour Master tab.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ==========================================
  // LABOUR MASTER TAB
  // ==========================================
  renderMaster() {
    let filteredLabours = Store.Labours.getAll();

    // Filter by search
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      filteredLabours = filteredLabours.filter(l => 
        (l.name || '').toLowerCase().includes(q) || 
        (l.nickname || '').toLowerCase().includes(q) || 
        (l.phone || '').includes(q)
      );
    }

    // Filter by status
    if (this.statusFilter) {
      filteredLabours = filteredLabours.filter(l => l.status === this.statusFilter);
    }

    const selectedLabour = this.selectedLabourId ? Store.Labours.getById(this.selectedLabourId) : null;

    return `
      <div class="split-layout">
        <!-- Left Pane: list -->
        <div class="card side-list">
          <div class="card-header" style="border-bottom: 1px solid var(--border-color); padding: 16px;">
            <h3 style="margin: 0 0 12px 0;">Labour List</h3>
            <div style="display: flex; gap: 8px; flex-direction: column;">
              <input type="text" class="form-control" placeholder="Search by name, nickname, phone..." 
                     value="${this.searchTerm}" onkeyup="LabourPage.onMasterSearch(event)">
              <select class="form-control" onchange="LabourPage.onMasterStatusFilter(event)">
                <option value="Active" ${this.statusFilter === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Inactive" ${this.statusFilter === 'Inactive' ? 'selected' : ''}>Inactive</option>
                <option value="" ${this.statusFilter === '' ? 'selected' : ''}>All Statuses</option>
              </select>
            </div>
          </div>
          <div style="max-height: 60vh; overflow-y: auto;">
            ${filteredLabours.map(l => `
              <div class="list-item ${this.selectedLabourId === l.id ? 'active' : ''}" style="cursor: pointer; position: relative;" onclick="LabourPage.selectLabour('${l.id}')">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="font-weight: 600; color: var(--text-primary);">${l.name}</div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="badge ${l.status === 'Active' ? 'badge-success' : 'badge-danger'}">${l.status}</span>
                    <button class="btn btn-icon btn-sm text-danger" style="padding: 2px; color: var(--danger); border: none; background: transparent; display: inline-flex; align-items: center;" onclick="event.stopPropagation(); LabourPage.deleteLabour('${l.id}')" title="Delete Labour">
                      ${Icons.trash}
                    </button>
                  </div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                  Nickname: ${l.nickname || '-'} • Phone: ${l.phone || '-'}
                </div>
              </div>
            `).join('')}
            ${filteredLabours.length === 0 ? '<div style="padding:24px; text-align:center; color: var(--text-tertiary);">No labour matching filters</div>' : ''}
          </div>
        </div>

        <!-- Right Pane: details drawer -->
        <div class="card detail-panel">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <h3>Labour Profile & Ledger</h3>
            ${selectedLabour ? `
              <div style="display:flex; gap:6px;">
                <button class="btn btn-sm btn-outline" onclick="LabourPage.openEditLabourModal('${selectedLabour.id}')">${Icons.edit} Edit</button>
                <button class="btn btn-sm btn-danger" style="background:var(--danger);color:white" onclick="LabourPage.deleteLabour('${selectedLabour.id}')">${Icons.trash} Delete</button>
              </div>
            ` : ''}
          </div>
          <div class="card-body" id="labour-detail-body">
            ${selectedLabour ? this.renderLabourProfile(selectedLabour) : `
              <div style="text-align: center; padding: 80px 20px; color: var(--text-tertiary);">
                <div style="width: 64px; height: 64px; margin: 0 auto 16px; opacity: 0.3;">${Icons.users}</div>
                <h3 style="margin: 0 0 8px 0; color: var(--text-secondary);">No Labour Selected</h3>
                <p style="margin: 0; font-size: 0.9rem;">Select a labour from the left list to see personal details, ledger and payment histories.</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  },

  selectLabour(id) {
    this.selectedLabourId = id;
    this.profileTab = 'overview';
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = this.render();
      this.bindEvents();
    }
  },

  onMasterSearch(e) {
    this.searchTerm = e.target.value;
    const list = document.querySelector('.side-list');
    if (list) {
      this.fetchData().then(() => {
        const container = document.getElementById('page-container');
        if (container) {
          container.innerHTML = this.render();
          const searchInput = container.querySelector('.side-list input[type="text"]');
          if (searchInput) {
            searchInput.focus();
            searchInput.setSelectionRange(this.searchTerm.length, this.searchTerm.length);
          }
        }
      });
    }
  },

  onMasterStatusFilter(e) {
    this.statusFilter = e.target.value;
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = this.render();
    }
  },

  renderLabourProfile(labour) {
    const summary = this.summaryData.labours.find(l => l.id === labour.id) || {
      presentDays: 0, halfDays: 0, absentDays: 0, grossWages: 0, totalOvertime: 0, totalMoneyGiven: 0, totalEarnings: 0, payableAmount: 0, advanceBalance: 0
    };

    return `
      <!-- Personal Info Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">
        <div>
          <label style="font-size:0.75rem; color:var(--text-tertiary); font-weight:600; text-transform:uppercase;">Full Name</label>
          <div style="font-weight:600; color:var(--text-primary); margin-top:4px;">${labour.name}</div>
        </div>
        <div>
          <label style="font-size:0.75rem; color:var(--text-tertiary); font-weight:600; text-transform:uppercase;">Nickname</label>
          <div style="font-weight:600; color:var(--text-primary); margin-top:4px;">${labour.nickname || '-'}</div>
        </div>
        <div>
          <label style="font-size:0.75rem; color:var(--text-tertiary); font-weight:600; text-transform:uppercase;">Mobile Number</label>
          <div style="font-weight:600; color:var(--text-primary); margin-top:4px;">${labour.phone || '-'}</div>
        </div>
        <div>
          <label style="font-size:0.75rem; color:var(--text-tertiary); font-weight:600; text-transform:uppercase;">Registered Date</label>
          <div style="font-weight:600; color:var(--text-primary); margin-top:4px;">${labour.createdAt || '-'}</div>
        </div>
      </div>

      <!-- Financial Metrics Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px;">
        <div style="background:var(--bg-body); padding:12px; border-radius:8px; border:1px solid var(--border-color); text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-secondary)">Total Earnings</div>
          <div style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin-top:4px;">₹${summary.totalEarnings}</div>
        </div>
        <div style="background:var(--bg-body); padding:12px; border-radius:8px; border:1px solid var(--border-color); text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-secondary)">Money Given</div>
          <div style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin-top:4px;">₹${summary.totalMoneyGiven}</div>
        </div>
        <div style="background:var(--bg-body); padding:12px; border-radius:8px; border:1px solid var(--border-color); text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-secondary)">Payable Balance</div>
          <div style="font-size:1.15rem; font-weight:700; color:var(--danger); margin-top:4px;">₹${summary.payableAmount}</div>
        </div>
        <div style="background:var(--bg-body); padding:12px; border-radius:8px; border:1px solid var(--border-color); text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-secondary)">Advance Balance</div>
          <div style="font-size:1.15rem; font-weight:700; color:var(--success); margin-top:4px;">₹${summary.advanceBalance}</div>
        </div>
      </div>

      <!-- Profile Sub-Tabs -->
      <div style="display:flex; gap:16px; border-bottom:1px solid var(--border-color); margin-bottom:16px;">
        <button class="btn btn-sm ${this.profileTab === 'overview' ? 'btn-primary' : 'btn-ghost'}" onclick="LabourPage.switchProfileTab('overview')">Running Ledger</button>
        <button class="btn btn-sm ${this.profileTab === 'attendance' ? 'btn-primary' : 'btn-ghost'}" onclick="LabourPage.switchProfileTab('attendance')">Attendance Summary</button>
      </div>

      <div id="profile-subtab-content">
        ${this.renderProfileTabContent(labour.id)}
      </div>
    `;
  },

  switchProfileTab(tab) {
    this.profileTab = tab;
    const body = document.getElementById('labour-detail-body');
    if (body && this.selectedLabourId) {
      const labour = Store.Labours.getById(this.selectedLabourId);
      if (labour) {
        body.innerHTML = this.renderLabourProfile(labour);
      }
    }
  },

  renderProfileTabContent(labourId) {
    // We will render chronological logs for this labour
    // Fetch logs from store (filtered by labourId)
    let logs = Store.LabourLogs.getAll()
      .filter(l => l.labourId === labourId)
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // chronological for ledger

    if (this.profileTab === 'overview') {
      let runningBalance = 0;
      const ledgerRows = logs.map(l => {
        const attVal = l.attendance === 'Present' ? 1.0 : (l.attendance === 'Half Day' ? 0.5 : 0.0);
        const gross = (l.dailyWage || 0) * attVal;
        const otEarn = (l.overtimeHours && l.dailyWage) ? ((l.dailyWage / 8) * l.overtimeHours) : (l.overtime || 0);
        const totalEarn = gross + otEarn;
        const given = l.moneyGiven || 0;
        runningBalance = runningBalance + totalEarn - given;

        let statusClass = 'badge-success';
        if (l.attendance === 'Half Day') statusClass = 'badge-warning';
        if (l.attendance === 'Absent') statusClass = 'badge-danger';

        const site = Store.Sites.getById(l.siteId);

        let otDisplay = '—';
        const otH = parseFloat(l.overtimeHours) || 0;
        const otP = parseFloat(l.overtime) || 0;
        const dw = parseFloat(l.dailyWage) || 0;
        if (otH > 0) {
          const otPayVal = dw > 0 ? Math.round((dw / 8) * otH) : Math.round(otP);
          otDisplay = `${Number(otH.toFixed(1))} hrs${l.overtimeTime ? ` (${l.overtimeTime})` : ''} = ₹${otPayVal}`;
        } else if (otP > 0) {
          const derivedH = dw > 0 ? Number(((otP / dw) * 8).toFixed(1)) : 0;
          otDisplay = `${derivedH > 0 ? derivedH + ' hrs = ' : ''}₹${Math.round(otP)}`;
        }

        const balFormatted = Math.abs(runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

        return `
          <tr>
            <td>${l.date}</td>
            <td><span class="badge ${statusClass}">${l.attendance}</span></td>
            <td>${site ? site.name : '-'}</td>
            <td>₹${l.dailyWage} (₹${gross})</td>
            <td>${otDisplay}</td>
            <td>₹${given}</td>
            <td style="font-weight:700; color:${runningBalance >= 0 ? 'var(--danger)' : 'var(--success)'}">₹${balFormatted} ${runningBalance >= 0 ? 'Payable' : 'Adv'}</td>
          </tr>
        `;
      }).reverse(); // Latest on top for view

      return `
        <div class="table-container" style="border:1px solid var(--border-color); border-radius:8px;">
          <table class="data-table" style="width:100%;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Attendance</th>
                <th>Site</th>
                <th>Wage Rate (Earned)</th>
                <th>Overtime</th>
                <th>Money Paid</th>
                <th style="text-align:right;">Running Bal</th>
              </tr>
            </thead>
            <tbody>
              ${ledgerRows.join('')}
              ${logs.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-tertiary)">No logs found</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      `;
    } else {
      // Attendance summary counts
      const present = logs.filter(l => l.attendance === 'Present').length;
      const half = logs.filter(l => l.attendance === 'Half Day').length;
      const absent = logs.filter(l => l.attendance === 'Absent').length;

      return `
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:20px;">
          <div style="background:#ecfdf5; border:1px solid #d1fae5; border-radius:8px; padding:12px; text-align:center;">
            <div style="color:#059669; font-weight:600;">Present Days</div>
            <div style="font-size:1.5rem; font-weight:700; color:#059669; margin-top:4px;">${present}</div>
          </div>
          <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:8px; padding:12px; text-align:center;">
            <div style="color:#d97706; font-weight:600;">Half Days</div>
            <div style="font-size:1.5rem; font-weight:700; color:#d97706; margin-top:4px;">${half}</div>
          </div>
          <div style="background:#fef2f2; border:1px solid #fee2e2; border-radius:8px; padding:12px; text-align:center;">
            <div style="color:#dc2626; font-weight:600;">Absent Days</div>
            <div style="font-size:1.5rem; font-weight:700; color:#dc2626; margin-top:4px;">${absent}</div>
          </div>
        </div>
      `;
    }
  },

  // Modal actions
  openAddLabourModal() {
    document.getElementById('labour-id').value = '';
    document.getElementById('labour-name').value = '';
    document.getElementById('labour-nickname').value = '';
    document.getElementById('labour-phone').value = '';
    document.getElementById('labour-default-wage').value = '500';
    document.getElementById('labour-status').value = 'Active';
    document.getElementById('labour-modal-title').textContent = 'Add New Labour';
    document.getElementById('labour-modal-backdrop').classList.add('active');
  },

  openEditLabourModal(id) {
    const l = Store.Labours.getById(id);
    if (!l) return;
    document.getElementById('labour-id').value = l.id;
    document.getElementById('labour-name').value = l.name;
    document.getElementById('labour-nickname').value = l.nickname || '';
    document.getElementById('labour-phone').value = l.phone || '';
    document.getElementById('labour-default-wage').value = l.defaultWage !== undefined ? l.defaultWage : 500;
    document.getElementById('labour-status').value = l.status;
    document.getElementById('labour-modal-title').textContent = 'Edit Labour details';
    document.getElementById('labour-modal-backdrop').classList.add('active');
  },

  closeLabourModal() {
    document.getElementById('labour-modal-backdrop').classList.remove('active');
  },

  async handleLabourSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('labour-id').value;
    const payload = {
      name: document.getElementById('labour-name').value,
      nickname: document.getElementById('labour-nickname').value,
      phone: document.getElementById('labour-phone').value,
      defaultWage: parseFloat(document.getElementById('labour-default-wage').value) || 500,
      status: document.getElementById('labour-status').value
    };

    if (id) {
      await Store.Labours.update(id, payload);
    } else {
      await Store.Labours.addAsync(payload);
    }

    this.closeLabourModal();
    this.refresh();
  },

  async deleteLabour(id) {
    if (confirm("Are you sure you want to delete this labour? This action will permanently remove all daily logs associated with them.")) {
      // 1. Delete associated logs from DB first
      const allLogs = Store.LabourLogs.getAll().filter(l => l.labourId === id);
      for (const log of allLogs) {
        await Store.LabourLogs.remove(log.id);
      }
      // 2. Delete labour
      await Store.Labours.remove(id);
      this.selectedLabourId = null;
      this.refresh();
    }
  },

  // ==========================================
  // DAILY LOG TAB
  // ==========================================
  renderLog() {
    const activeLabours = Store.Labours.getAll().filter(l => l.status === 'Active');
    const sites = Store.Sites.getAll();

    return `
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-body" style="display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between;">
          <div class="form-group" style="margin:0; min-width:200px;">
            <label style="font-weight:600;margin-bottom:4px;">Attendance Date</label>
            <input type="date" id="daily-log-date" class="form-control" value="${this.logDate}" onchange="LabourPage.onLogDateChange(event)">
          </div>
          <div class="form-group" style="margin:0; min-width:240px;">
            <label style="font-weight:600;margin-bottom:4px;">Bulk Set Site (Optional)</label>
            <select id="global-site-select" class="form-control" onchange="LabourPage.onGlobalSiteChange(event)">
              <option value="">-- No Global Site (Individual override) --</option>
              ${sites.map(s => `<option value="${s.id}" ${this.globalSiteId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <button class="btn btn-success" onclick="LabourPage.saveDailyLogs()" style="height:42px; display:inline-flex; align-items:center; gap:6px;">
              ${Icons.check} Save All logs
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Daily Log sheet</h3>
        </div>
        <div class="table-container">
          <table class="data-table" style="min-width: 900px;">
            <thead>
              <tr>
                <th>Labour Name</th>
                <th style="width: 250px;">Attendance Status</th>
                <th style="width: 150px;">Site</th>
                <th style="width: 110px;">Daily Wage (₹)</th>
                <th style="width: 120px;">Overtime Hrs</th>
                <th style="width: 110px;">Money Paid (₹)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${activeLabours.map(l => {
                const log = this.dailyLogsData[l.id] || {};
                const att = log.attendance || 'Absent';
                // Resolve wage: current log wage -> most recent past log wage -> master defaultWage -> 500
                let wage = log.dailyWage;
                if (wage === undefined) {
                  const pastLogs = Store.LabourLogs.getAll()
                    .filter(pl => pl.labourId === l.id && pl.dailyWage !== undefined && pl.dailyWage > 0)
                    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                  if (pastLogs.length > 0) {
                    wage = pastLogs[0].dailyWage;
                  } else {
                    const masterLabour = Store.Labours.getById(l.id) || l;
                    wage = masterLabour.defaultWage !== undefined ? masterLabour.defaultWage : 500;
                  }
                }
                const overtimeHours = log.overtimeHours !== undefined ? log.overtimeHours : 0;
                const otTime = log.overtimeTime || '';
                const money = log.moneyGiven || 0;
                const note = log.notes || '';
                const siteId = log.siteId || this.globalSiteId || '';
                // Calculate OT pay for display: (wage / 8) * hours
                const otPay = overtimeHours > 0 ? ((wage / 8) * overtimeHours).toFixed(0) : 0;

                return `
                  <tr data-labour-id="${l.id}">
                    <td>
                      <strong>${l.name}</strong><br>
                      <span style="font-size:11px;color:var(--text-secondary);">${l.nickname ? l.nickname : ''}</span>
                    </td>
                    <td>
                      <div class="attendance-buttons" style="display:flex; gap:4px;">
                        <button type="button" class="btn btn-sm att-btn ${att === 'Present' ? 'btn-success' : 'btn-outline'}" 
                                style="flex:1; border-color:var(--success); color:${att === 'Present' ? 'white' : 'var(--success)'}; font-weight:600;"
                                onclick="LabourPage.setAttStatus(this, 'Present')">Present</button>
                        <button type="button" class="btn btn-sm att-btn ${att === 'Half Day' ? 'btn-warning' : 'btn-outline'}" 
                                style="flex:1; border-color:var(--warning); color:${att === 'Half Day' ? 'white' : 'var(--warning)'}; font-weight:600;"
                                onclick="LabourPage.setAttStatus(this, 'Half Day')">Half</button>
                        <button type="button" class="btn btn-sm att-btn ${att === 'Absent' ? 'btn-danger' : 'btn-outline'}" 
                                style="flex:1; border-color:var(--danger); color:${att === 'Absent' ? 'white' : 'var(--danger)'}; font-weight:600;"
                                onclick="LabourPage.setAttStatus(this, 'Absent')">Absent</button>
                      </div>
                    </td>
                    <td>
                      <select class="form-control log-site" style="height:36px; padding:0 8px;">
                        <option value="">-- Select --</option>
                        ${sites.map(s => `<option value="${s.id}" ${siteId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                      </select>
                    </td>
                    <td>
                      <input type="number" class="form-control log-wage" value="${wage}" style="height:36px; text-align:right;" min="0" oninput="LabourPage.updateOtDisplay(this)">
                    </td>
                    <td>
                      <div style="display:flex; flex-direction:column; gap:3px;">
                        <input type="number" class="form-control log-ot-hours" value="${overtimeHours}" style="height:34px; text-align:right;" min="0" step="0.5" placeholder="hrs" oninput="LabourPage.updateOtDisplay(this)">
                        <input type="text" class="form-control log-ot-time" value="${otTime}" placeholder="e.g. 7pm-9pm, 10pm-11pm" style="height:28px; font-size:11px;" title="Written time slots / notes">
                        <span class="log-ot-calc" style="font-size:10px; color:var(--text-tertiary); text-align:right; display:${overtimeHours > 0 ? 'block' : 'none'};">= ₹${otPay}</span>
                      </div>
                    </td>
                    <td>
                      <input type="number" class="form-control log-money" value="${money}" style="height:36px; text-align:right;" min="0">
                    </td>
                    <td>
                      <input type="text" class="form-control log-notes" value="${note}" placeholder="e.g. advance payment" style="height:36px;">
                    </td>
                  </tr>
                `;
              }).join('')}
              ${activeLabours.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-tertiary);">No active labours to log attendance. Create active labours in the Labour Master tab first.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  onLogDateChange(e) {
    this.logDate = e.target.value;
    this.fetchData().then(() => {
      const container = document.getElementById('page-container');
      if (container) {
        container.innerHTML = this.render();
      }
    });
  },

  onGlobalSiteChange(e) {
    this.globalSiteId = e.target.value;
    // Update all dropdowns that don't have overrides
    document.querySelectorAll('tr[data-labour-id]').forEach(tr => {
      const select = tr.querySelector('.log-site');
      if (select) {
        select.value = this.globalSiteId;
      }
    });
  },

  setAttStatus(button, status) {
    const parent = button.parentElement;
    parent.querySelectorAll('.att-btn').forEach(btn => {
      btn.classList.remove('btn-success', 'btn-warning', 'btn-danger');
      btn.classList.add('btn-outline');
      btn.style.color = btn.style.borderColor; // Restore default colored outline text
    });

    if (status === 'Present') {
      button.classList.remove('btn-outline');
      button.classList.add('btn-success');
      button.style.color = 'white';
    } else if (status === 'Half Day') {
      button.classList.remove('btn-outline');
      button.classList.add('btn-warning');
      button.style.color = 'white';
    } else if (status === 'Absent') {
      button.classList.remove('btn-outline');
      button.classList.add('btn-danger');
      button.style.color = 'white';
    }
  },

  updateOtDisplay(inputElement) {
    const tr = inputElement.closest('tr');
    if (!tr) return;
    const wageInput = tr.querySelector('.log-wage');
    const otInput = tr.querySelector('.log-ot-hours');
    const calcSpan = tr.querySelector('.log-ot-calc');
    if (wageInput && otInput && calcSpan) {
      const wage = parseFloat(wageInput.value) || 0;
      const otHours = parseFloat(otInput.value) || 0;
      if (otHours > 0 && wage > 0) {
        const otPay = ((wage / 8) * otHours).toFixed(0);
        calcSpan.textContent = `= ₹${otPay}`;
        calcSpan.style.display = 'block';
      } else {
        calcSpan.style.display = 'none';
      }
    }
  },

  async saveDailyLogs() {
    const rows = document.querySelectorAll('tr[data-labour-id]');
    let count = 0;
    for (const tr of rows) {
      const labourId = tr.dataset.labourId;
      
      // Determine selected attendance
      let attendance = 'Absent';
      const successBtn = tr.querySelector('.att-btn.btn-success');
      const warningBtn = tr.querySelector('.att-btn.btn-warning');
      const dangerBtn = tr.querySelector('.att-btn.btn-danger');
      if (successBtn) attendance = 'Present';
      else if (warningBtn) attendance = 'Half Day';
      else if (dangerBtn) attendance = 'Absent';

      const siteId = tr.querySelector('.log-site').value;
      const dailyWage = parseFloat(tr.querySelector('.log-wage').value) || 0;
      const overtimeHours = parseFloat(tr.querySelector('.log-ot-hours').value) || 0;
      const overtimeTimeInput = tr.querySelector('.log-ot-time');
      const overtimeTime = overtimeTimeInput ? overtimeTimeInput.value.trim() : '';
      // Calculate OT rupee amount for backwards compat display
      const overtimeAmount = overtimeHours > 0 ? parseFloat(((dailyWage / 8) * overtimeHours).toFixed(2)) : 0;
      const moneyGiven = parseFloat(tr.querySelector('.log-money').value) || 0;
      const notes = tr.querySelector('.log-notes').value;

      // Auto-set defaultWage on the master labour only if missing
      const labour = Store.Labours.getById(labourId);
      if (labour && labour.defaultWage === undefined) {
        labour.defaultWage = dailyWage;
        await Store.Labours.update(labourId, { ...labour, defaultWage: dailyWage });
      }

      // Check if existing log for this date & labour exists
      const existing = this.dailyLogsData[labourId];

      const payload = {
        date: this.logDate,
        labourId,
        siteId,
        attendance,
        dailyWage,
        overtimeHours,
        overtimeTime,
        overtime: overtimeAmount, // legacy field kept for backward compat
        moneyGiven,
        notes
      };

      if (existing) {
        await Store.LabourLogs.update(existing.id, payload);
      } else {
        await Store.LabourLogs.addAsync(payload);
      }
      count++;
    }

    alert(`Saved logs for ${count} labours successfully!`);
    this.fetchData().then(() => {
      const container = document.getElementById('page-container');
      if (container) {
        container.innerHTML = this.render();
      }
    });
  },

  // ==========================================
  // REPORTS TAB
  // ==========================================
  renderReports() {
    const sites = Store.Sites.getAll();
    const labours = Store.Labours.getAll();

    return `
      <!-- Filters header card -->
      <div class="card" style="margin-bottom: 24px; padding: 20px;">
        <h4 style="margin: 0 0 16px 0; color: var(--text-primary);">Report Filter Parameters</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; align-items: flex-end;">
          <div class="form-group" style="margin:0;">
            <label style="font-weight:600;margin-bottom:4px;">Start Date</label>
            <input type="date" id="rep-start-date" class="form-control" value="${this.reportStartDate}">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-weight:600;margin-bottom:4px;">End Date</label>
            <input type="date" id="rep-end-date" class="form-control" value="${this.reportEndDate}">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-weight:600;margin-bottom:4px;">Filter Site</label>
            <select id="rep-site-id" class="form-control">
              <option value="">-- All Sites --</option>
              ${sites.map(s => `<option value="${s.id}" ${this.reportSiteId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-weight:600;margin-bottom:4px;">Filter Labour</label>
            <select id="rep-labour-id" class="form-control">
              <option value="">-- All Labours --</option>
              ${labours.map(l => `<option value="${l.id}" ${this.reportLabourId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary" style="flex:1; height:42px;" onclick="LabourPage.applyReportFilters()">Apply</button>
            <button class="btn btn-outline" style="height:42px; display:inline-flex; align-items:center; justify-content:center;" title="Reset" onclick="LabourPage.resetReportFilters()">
              ${Icons.refreshCw}
            </button>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div style="display:flex; justify-content:flex-end; gap:12px; margin-bottom:16px;">
        <button class="btn btn-outline" onclick="LabourPage.exportCSV()" style="display:inline-flex; align-items:center; gap:6px;">
          ${Icons.download} Export Excel
        </button>
        <button class="btn btn-primary" onclick="LabourPage.printPDF()" style="display:inline-flex; align-items:center; gap:6px;">
          ${Icons.fileText} Export PDF
        </button>
      </div>

      <!-- Aggregated Results - Detailed Cards per Labour -->
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3>Payroll Summary Report</h3>
          <span style="font-size:0.8rem; color:var(--text-tertiary);">${this.summaryData.labours.length} labour(s)</span>
        </div>
        <div style="padding: 16px; display: flex; flex-direction: column; gap: 20px;">
          ${this.summaryData.labours.length === 0 ? `
            <div style="text-align:center; padding:40px; color:var(--text-tertiary);">No report details match the selected filters.</div>
          ` : this.summaryData.labours.map(l => {
            const fmt = (d) => { const p = (d || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : d; };
            const presentDates = (l.presentDates || []).sort().map(d => `<span style="background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;">${fmt(d)}</span>`).join(' ');
            const halfDates = (l.halfDayDates || []).sort().map(d => `<span style="background:#fef9c3;color:#a16207;border:1px solid #fef08a;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;">${fmt(d)}</span>`).join(' ');
            const absentDates = (l.absentDates || []).sort().map(d => `<span style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;">${fmt(d)}</span>`).join(' ');
            
            const otLogs = (l.overtimeLogs || []).sort((a,b) => (a.date || '').localeCompare(b.date || '')).map(o => {
              const timeStr = o.time ? ` (${o.time})` : '';
              const hrsNum = o.hours !== undefined ? Number(parseFloat(o.hours).toFixed(1)) : 0;
              return `<span style="background:#f3e8ff;color:#6b21a8;border:1px solid #e9d5ff;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;">${fmt(o.date)}: ${hrsNum}h${timeStr} = ₹${Math.round(o.pay)}</span>`;
            }).join(' ');
            
            const rawOtHours = parseFloat(l.totalOvertimeHours) || 0;
            const otHours = Number(rawOtHours.toFixed(1));
            const otPay = Math.round(l.totalOvertime || 0);
            const payable = Math.round(l.payableAmount || 0);
            const advance = Math.round(l.advanceBalance || 0);

            return `
              <div style="border:1px solid var(--border-color); border-radius:14px; overflow:hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); background:#ffffff;">
                <!-- Header row -->
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color:white; padding:16px 22px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                  <div>
                    <div style="font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:8px;">
                      ${l.name}
                      ${l.nickname ? `<span style="background:rgba(255,255,255,0.15); color:#e2e8f0; font-size:0.75rem; font-weight:500; padding:2px 8px; border-radius:12px;">${l.nickname}</span>` : ''}
                    </div>
                    <div style="font-size:0.8rem; color:#94a3b8; margin-top:3px; display:flex; align-items:center; gap:6px;">
                      <span>📞 ${l.phone || 'No phone'}</span>
                    </div>
                  </div>
                  <div style="text-align:right; background:rgba(255,255,255,0.06); padding:8px 16px; border-radius:10px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Net Payable</div>
                    <div style="font-size:1.65rem; font-weight:800; line-height:1.1; color:${payable > 0 ? '#fde047' : '#4ade80'};">
                      ₹${payable > 0 ? payable.toLocaleString('en-IN') : (advance > 0 ? '-' + advance.toLocaleString('en-IN') : '0')}
                    </div>
                    <div style="font-size:0.7rem; color:#cbd5e1; font-weight:500;">${payable > 0 ? 'amount to pay' : advance > 0 ? 'advance balance' : 'settled'}</div>
                  </div>
                </div>

                <!-- Attendance date chips -->
                <div style="padding:16px 22px; background:#fafafa; display:flex; flex-direction:column; gap:12px; border-bottom:1px solid var(--border-color);">
                  <div style="display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                    <span style="font-size:0.75rem; font-weight:700; color:#166534; min-width:90px; padding-top:2px;">✅ PRESENT (${l.presentDays})</span>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">${presentDates || '<span style="font-size:11px;color:var(--text-tertiary);">—</span>'}</div>
                  </div>
                  ${(l.halfDays > 0) ? `
                  <div style="display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                    <span style="font-size:0.75rem; font-weight:700; color:#854d0e; min-width:90px; padding-top:2px;">🌗 HALF DAY (${l.halfDays})</span>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">${halfDates}</div>
                  </div>` : ''}
                  ${(l.absentDays > 0) ? `
                  <div style="display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                    <span style="font-size:0.75rem; font-weight:700; color:#991b1b; min-width:90px; padding-top:2px;">❌ ABSENT (${l.absentDays})</span>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">${absentDates}</div>
                  </div>` : ''}
                  ${(l.overtimeLogs && l.overtimeLogs.length > 0) ? `
                  <div style="display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                    <span style="font-size:0.75rem; font-weight:700; color:#6b21a8; min-width:90px; padding-top:2px;">⏰ OVERTIME (${otHours}h)</span>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">${otLogs}</div>
                  </div>` : ''}
                </div>

                <!-- Financial summary cards grid -->
                <div style="padding:16px 22px; display:grid; grid-template-columns: repeat(auto-fit, minmax(130px,1fr)); gap:12px;">
                  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; text-align:center;">
                    <div style="font-size:0.72rem; color:var(--text-tertiary); text-transform:uppercase; font-weight:600; margin-bottom:4px;">Gross Wages</div>
                    <div style="font-size:1.2rem; font-weight:700; color:var(--text-primary);">₹${Math.round(l.grossWages || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:10px; padding:12px 14px; text-align:center;">
                    <div style="font-size:0.72rem; color:#6d28d9; text-transform:uppercase; font-weight:600; margin-bottom:4px;">OT Hours</div>
                    <div style="font-size:1.2rem; font-weight:700; color:#6d28d9;">${otHours > 0 ? otHours + ' hrs' : '—'}</div>
                    ${otHours > 0 ? `<div style="font-size:0.75rem; color:#7c3aed; font-weight:600; margin-top:2px;">= ₹${otPay.toLocaleString('en-IN')}</div>` : ''}
                  </div>
                  <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:12px 14px; text-align:center;">
                    <div style="font-size:0.72rem; color:#047857; text-transform:uppercase; font-weight:600; margin-bottom:4px;">Money Given</div>
                    <div style="font-size:1.2rem; font-weight:700; color:#059669;">₹${Math.round(l.totalMoneyGiven || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div style="background:${payable > 0 ? '#fef2f2' : '#f0fdf4'}; border:1px solid ${payable > 0 ? '#fecaca' : '#bbf7d0'}; border-radius:10px; padding:12px 14px; text-align:center;">
                    <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:${payable > 0 ? '#b91c1c' : '#15803d'}; margin-bottom:4px;">
                      ${payable > 0 ? '💰 To Pay' : advance > 0 ? '✅ Advance Bal' : '✅ Settled'}
                    </div>
                    <div style="font-size:1.25rem; font-weight:800; color:${payable > 0 ? '#dc2626' : '#16a34a'};">
                      ₹${(payable > 0 ? payable : advance).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  applyReportFilters() {
    this.reportStartDate = document.getElementById('rep-start-date').value;
    this.reportEndDate = document.getElementById('rep-end-date').value;
    this.reportSiteId = document.getElementById('rep-site-id').value;
    this.reportLabourId = document.getElementById('rep-labour-id').value;

    this.fetchData().then(() => {
      const container = document.getElementById('page-container');
      if (container) {
        container.innerHTML = this.render();
      }
    });
  },

  resetReportFilters() {
    this.reportStartDate = window.localDateStr(new Date(new Date().setDate(new Date().getDate() - 30)));
    this.reportEndDate = window.localDateStr();
    this.reportSiteId = '';
    this.reportLabourId = '';

    this.fetchData().then(() => {
      const container = document.getElementById('page-container');
      if (container) {
        container.innerHTML = this.render();
      }
    });
  },

  // EXPORT EXCEL (CSV Format)
  exportCSV() {
    if (this.summaryData.labours.length === 0) {
      alert("No data to export.");
      return;
    }

    const rows = [
      ["Labour Name", "Mobile Number", "Present Days", "Half Days", "Absent Days", "Gross Wages (₹)", "Overtime (₹)", "Money Given (₹)", "Payable Amount (₹)"]
    ];

    this.summaryData.labours.forEach(l => {
      rows.push([
        l.name,
        l.phone || '',
        l.presentDays,
        l.halfDays,
        l.absentDays,
        l.grossWages,
        l.totalOvertime,
        l.totalMoneyGiven,
        l.payableAmount
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8,\ufeff" 
      + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KSS_Labour_Payroll_Report_${this.reportStartDate}_to_${this.reportEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // EXPORT PRINTABLE PDF
  printPDF() {
    if (this.summaryData.labours.length === 0) {
      alert("No data to export.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to export printable PDF.");
      return;
    }

    const dateRangeStr = `${this.reportStartDate} to ${this.reportEndDate}`;
    const tableRows = this.summaryData.labours.map(l => `
      <tr>
        <td style="border: 1px solid #333; padding: 8px;"><strong>${l.name}</strong></td>
        <td style="border: 1px solid #333; padding: 8px; text-align:center;">${l.phone || '-'}</td>
        <td style="border: 1px solid #333; padding: 8px; text-align:center;">${l.presentDays}</td>
        <td style="border: 1px solid #333; padding: 8px; text-align:center;">${l.halfDays}</td>
        <td style="border: 1px solid #333; padding: 8px; text-align:center;">${l.absentDays}</td>
        <td style="border: 1px solid #333; padding: 8px; text-align:right;">₹${l.grossWages}</td>
        <td style="border: 1px solid #333; padding: 8px; text-align:right;">₹${l.totalOvertime}</td>
        <td style="border: 1px solid #333; padding: 8px; text-align:right;">₹${l.totalMoneyGiven}</td>
        <td style="border: 1px solid #333; padding: 8px; text-align:right; font-weight:bold;">₹${l.payableAmount}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>KSS Labour Payroll Summary</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: 'Inter', Arial, sans-serif; color: #111; padding: 10px; }
          h2 { margin: 0 0 5px 0; }
          p { margin: 0 0 20px 0; font-size: 13px; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { border: 1px solid #333; padding: 10px; background: #f1f5f9; text-align: left; font-size: 12px; }
          td { font-size: 11px; }
        </style>
      </head>
      <body>
        <h2>Labour Payroll Summary Report</h2>
        <p>Report Period: ${dateRangeStr} | Printed on: ${new Date().toLocaleString('en-IN')}</p>
        <table>
          <thead>
            <tr>
              <th>Labour Name</th>
              <th style="text-align:center;">Mobile</th>
              <th style="text-align:center;">Present</th>
              <th style="text-align:center;">Half</th>
              <th style="text-align:center;">Absent</th>
              <th style="text-align:right;">Gross Wages</th>
              <th style="text-align:right;">Overtime</th>
              <th style="text-align:right;">Money Given</th>
              <th style="text-align:right;">Payable Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          }
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  },

  bindEvents() {
    // Optional events bindings if needed
  }
};
