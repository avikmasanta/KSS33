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
  isDirty: false,

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
    const container = document.getElementById('page-container');
    if (container && window.location.hash === '#labour') {
      container.innerHTML = this.render();
      this.bindEvents();
    }
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
      const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5000/api'
        : '/api';

      try {
        const [laboursRes, logsRes] = await Promise.all([
          fetch(`${API_URL}/labours`),
          fetch(`${API_URL}/labourLogs`)
        ]);
        if (laboursRes.ok) {
          const lData = await laboursRes.json();
          if (Array.isArray(lData) && Store.Labours.setAll) {
            Store.Labours.setAll(lData);
          }
        }
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          if (Array.isArray(logsData) && Store.LabourLogs.setAll) {
            Store.LabourLogs.setAll(logsData);
          }
        }
      } catch (e) {}

      let query = `?startDate=${this.reportStartDate}&endDate=${this.reportEndDate}`;
      if (this.reportSiteId) query += `&siteId=${this.reportSiteId}`;
      if (this.reportLabourId) query += `&labourId=${this.reportLabourId}`;
      if (this.reportAttendance) query += `&attendance=${this.reportAttendance}`;

      const res = await fetch(`${API_URL}/labours-summary${query}`);
      if (res.ok) {
        this.summaryData = await res.json();
      }

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
      <div class="page-header" style="background: var(--card-bg); padding: 24px; border-radius: var(--card-radius); margin-bottom: 24px; border: 1px solid var(--card-border); box-shadow: var(--card-shadow); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div class="page-header-title" style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 48px; height: 48px; background: rgba(37, 99, 235, 0.15); color: var(--primary-500); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            ${Icons.users}
          </div>
          <div>
            <h2 style="margin: 0; font-size: 1.5rem; color: var(--text-primary);">Labour Log & Payroll</h2>
            <p style="margin: 4px 0 0 0; color: var(--text-tertiary);">Manage workforce, daily logs, wages and payroll</p>
          </div>
        </div>
        <div class="page-header-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-success" onclick="LabourPage.openAdvanceModal()" style="background:#047857; border-color:#047857; color:white; display:inline-flex; align-items:center; gap:6px; font-weight:600;">
            💵 Add Advance Payment
          </button>
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
        <button class="btn btn-ghost" onclick="window.location.hash = '#labour-contracts'" style="border: 1px dashed var(--primary-500); color: var(--primary-500);">
          ${Icons.fileText} &nbsp; Labour Contracts
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
              <div class="form-row" style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                <div class="form-group" style="flex: 1; margin: 0; min-width: 180px;">
                  <label for="labour-previous-balance">Previous Money / Opening Balance (₹)</label>
                  <input type="number" id="labour-previous-balance" class="form-control" placeholder="0" min="0" step="any">
                </div>
                <div class="form-group" style="flex: 1; margin: 0; min-width: 180px;">
                  <label for="labour-previous-type">Balance Nature</label>
                  <select id="labour-previous-type" class="form-control">
                    <option value="payable">🔴 Pending Dues (Udhari / Owner Owes Labour)</option>
                    <option value="advance">🟢 Advance Paid (Labour Owes Owner)</option>
                  </select>
                </div>
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

      <!-- Adjust / Add Advance Payment Modal -->
      <div class="modal-backdrop" id="advance-modal-backdrop" onclick="LabourPage.closeAdvanceModal()">
        <div class="modal" id="advance-modal" style="max-width: 480px;" onclick="event.stopPropagation()">
          <div class="modal-header" style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); color: white; border-top-left-radius: 12px; border-top-right-radius: 12px; padding: 16px 20px;">
            <h3 id="advance-modal-title" style="margin: 0; font-size: 1.15rem; color: white;">💵 Add / Adjust Advance Payment</h3>
            <button type="button" class="modal-close" onclick="LabourPage.closeAdvanceModal()" style="color: white; opacity: 0.8;">${Icons.x}</button>
          </div>
          <div class="modal-body" style="padding: 20px;">
            <form id="advance-form" onsubmit="LabourPage.handleAdvanceSubmit(event)">
              <div class="form-group" style="margin-bottom: 16px;">
                <label for="adv-labour-id" style="font-weight: 600;">Select Labour / Worker <span style="color:var(--danger)">*</span></label>
                <select id="adv-labour-id" class="form-control" required>
                  <option value="">-- Select Labour --</option>
                  ${Store.Labours.getAll().filter(l => l.status === 'Active').map(l => `<option value="${l.id}">${l.name} ${l.nickname ? '(' + l.nickname + ')' : ''}</option>`).join('')}
                </select>
              </div>
              
              <div class="form-group" style="margin-bottom: 16px;">
                <label for="adv-type" style="font-weight: 600;">Adjustment Action</label>
                <select id="adv-type" class="form-control">
                  <option value="payment">💵 Add New Advance Payment (Given On Date)</option>
                  <option value="set_exact">✏️ Edit / Set Exact Advance Amount On Date (Fix Typo)</option>
                  <option value="opening">⚙️ Set / Adjust Opening Advance Balance</option>
                  <option value="delete">🗑️ Delete / Clear Advance Payment On Date</option>
                </select>
              </div>

              <div class="form-group" id="adv-date-group" style="margin-bottom: 16px;">
                <label for="adv-date" style="font-weight: 600;">Advance Payment Date <span style="color:var(--danger)">*</span></label>
                <input type="date" id="adv-date" class="form-control" value="${window.localDateStr()}" required>
              </div>

              <div class="form-group" style="margin-bottom: 16px;">
                <label for="adv-amount" style="font-weight: 600;">Advance Amount (₹) <span style="color:var(--danger)">*</span></label>
                <input type="number" id="adv-amount" class="form-control" placeholder="e.g. 1000" min="1" step="any" required style="font-size: 1.1rem; font-weight: 700; color: #047857;">
              </div>

              <div class="form-group" style="margin-bottom: 24px;">
                <label for="adv-notes" style="font-weight: 600;">Remarks / Purpose of Advance</label>
                <input type="text" id="adv-notes" class="form-control" placeholder="e.g. Festival Advance, Loan, Emergency Cash">
              </div>

              <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button type="button" class="btn btn-outline" onclick="LabourPage.closeAdvanceModal()">Cancel</button>
                <button type="submit" class="btn btn-success" style="background: #047857; border-color: #047857;">Save Advance</button>
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
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = this.render();
      this.bindEvents();
    }
    this.fetchData().then(() => {
      const updatedContainer = document.getElementById('page-container');
      if (updatedContainer && window.location.hash === '#labour') {
        updatedContainer.innerHTML = this.render();
        this.bindEvents();
      }
    }).catch(e => console.error("Tab background sync error:", e));
  },

  // ==========================================
  // DASHBOARD TAB
  // ==========================================
  renderDashboard() {
    const s = this.summaryData.summary;
    const formatCurrency = (v) => '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <div class="card" style="padding: 20px; background: var(--card-bg); border: 1px solid var(--card-border); border-left: 5px solid var(--primary-500); display:flex; align-items:center; justify-content:space-between; box-shadow: var(--card-shadow); border-radius: var(--card-radius);">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Total Labour (Active)</div>
            <h2 style="margin: 8px 0 0 0; font-size: 2rem; color: var(--text-primary); font-family: var(--font-family-heading);">${s.totalLabour || 0}</h2>
          </div>
          <div style="color: var(--primary-500); opacity: 0.9;">${Icons.users}</div>
        </div>
        <div class="card" style="padding: 20px; background: var(--card-bg); border: 1px solid var(--card-border); border-left: 5px solid var(--success); display:flex; align-items:center; justify-content:space-between; box-shadow: var(--card-shadow); border-radius: var(--card-radius);">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Present Today</div>
            <h2 style="margin: 8px 0 0 0; font-size: 2rem; color: var(--success); font-family: var(--font-family-heading);">${s.presentToday || 0}</h2>
          </div>
          <div style="color: var(--success); opacity: 0.9;">${Icons.check}</div>
        </div>
        <div class="card" style="padding: 20px; background: var(--card-bg); border: 1px solid var(--card-border); border-left: 5px solid var(--warning); display:flex; align-items:center; justify-content:space-between; box-shadow: var(--card-shadow); border-radius: var(--card-radius);">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Half Day Today</div>
            <h2 style="margin: 8px 0 0 0; font-size: 2rem; color: var(--warning); font-family: var(--font-family-heading);">${s.halfDayToday || 0}</h2>
          </div>
          <div style="color: var(--warning); opacity: 0.9;">${Icons.activity}</div>
        </div>
        <div class="card" style="padding: 20px; background: var(--card-bg); border: 1px solid var(--card-border); border-left: 5px solid var(--danger); display:flex; align-items:center; justify-content:space-between; box-shadow: var(--card-shadow); border-radius: var(--card-radius);">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Absent Today</div>
            <h2 style="margin: 8px 0 0 0; font-size: 2rem; color: var(--danger); font-family: var(--font-family-heading);">${s.absentToday || 0}</h2>
          </div>
          <div style="color: var(--danger); opacity: 0.9;">${Icons.x}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <div class="card" style="padding: 24px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--card-radius); box-shadow: var(--card-shadow);">
          <h4 style="margin:0 0 8px 0; color: var(--text-secondary); font-weight:600;">Total Payable Wages</h4>
          <h2 style="margin:0; font-size: 2.25rem; color: var(--text-primary); font-weight:700;">${formatCurrency(s.totalPayable || 0)}</h2>
          <p style="margin: 8px 0 0 0; font-size: 0.85rem; color: var(--text-tertiary);">Outstanding wages due for payment</p>
        </div>
        <div class="card" style="padding: 24px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--card-radius); box-shadow: var(--card-shadow);">
          <h4 style="margin:0 0 8px 0; color: var(--text-secondary); font-weight:600;">Total Advance Paid</h4>
          <h2 style="margin:0; font-size: 2.25rem; color: var(--success); font-weight:700;">${formatCurrency(s.totalAdvancePaid || 0)}</h2>
          <p style="margin: 8px 0 0 0; font-size: 0.85rem; color: var(--text-tertiary);">Advance salary/balances given to labour</p>
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
                <th style="text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.summaryData.labours.slice(0, 8).map(l => {
                let balBadge = '';
                if (l.payableAmount > 0) {
                  balBadge = `<span class="badge badge-warning">Payable: ₹${l.payableAmount}</span>`;
                } else if (l.advanceBalance > 0) {
                  balBadge = `<span class="badge badge-success">Advance: ₹${l.advanceBalance}</span>`;
                } else {
                  balBadge = `<span class="badge" style="background:var(--border-light);color:var(--text-secondary)">Clear</span>`;
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
                    <td style="text-align:center;">
                      <button class="btn btn-sm btn-outline" style="padding: 3px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" onclick="LabourPage.printPDF('${l.id || l._id}')" title="Print Payroll Statement">
                        ${Icons.fileText} Slip
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
              ${this.summaryData.labours.length === 0 ? '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-tertiary);">No labour data found. Add labour in the Labour Master tab.</td></tr>' : ''}
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
    let allLabours = Store.Labours ? Store.Labours.getAll() : [];
    if ((!allLabours || allLabours.length === 0) && this.summaryData && this.summaryData.labours && this.summaryData.labours.length > 0) {
      allLabours = this.summaryData.labours;
    }

    let filteredLabours = allLabours;

    // Filter by search
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase().trim();
      filteredLabours = filteredLabours.filter(l => 
        (l.name || '').toLowerCase().includes(q) || 
        (l.nickname || '').toLowerCase().includes(q) || 
        (l.phone || '').includes(q)
      );
    }

    // Filter by status (case-insensitive)
    if (this.statusFilter) {
      const sf = this.statusFilter.toLowerCase().trim();
      filteredLabours = filteredLabours.filter(l => {
        const st = (l.status || 'Active').toLowerCase().trim();
        return st === sf;
      });
    }

    // Fallback: If status filtering filtered out everything, fall back to allLabours so user never sees an empty screen!
    if (filteredLabours.length === 0 && allLabours.length > 0 && !this.searchTerm) {
      filteredLabours = allLabours;
    }

    if (!this.selectedLabourId && filteredLabours.length > 0) {
      this.selectedLabourId = String(filteredLabours[0].id || filteredLabours[0]._id);
    }

    let selectedLabour = this.selectedLabourId ? Store.Labours.getById(this.selectedLabourId) : null;
    if (!selectedLabour && filteredLabours.length > 0) {
      selectedLabour = filteredLabours.find(l => String(l.id || l._id) === String(this.selectedLabourId)) || filteredLabours[0];
      if (selectedLabour) {
        this.selectedLabourId = String(selectedLabour.id || selectedLabour._id);
      }
    }

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
            ${filteredLabours.map(l => {
              const lId = String(l.id || l._id);
              const isActive = String(this.selectedLabourId) === lId;
              return `
                <div class="list-item ${isActive ? 'active' : ''}" style="cursor: pointer; position: relative;" onclick="LabourPage.selectLabour('${lId}')">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight: 600; color: var(--text-primary);">${l.name}</div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span class="badge ${l.status === 'Active' ? 'badge-success' : 'badge-danger'}">${l.status}</span>
                      <button class="btn btn-icon btn-sm text-danger" style="padding: 2px; color: var(--danger); border: none; background: transparent; display: inline-flex; align-items: center;" onclick="event.stopPropagation(); LabourPage.deleteLabour('${lId}')" title="Delete Labour">
                        ${Icons.trash}
                      </button>
                    </div>
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                    Nickname: ${l.nickname || '-'} • Phone: ${l.phone || '-'}
                  </div>
                </div>
              `;
            }).join('')}
            ${filteredLabours.length === 0 ? '<div style="padding:24px; text-align:center; color: var(--text-tertiary);">No labour matching filters</div>' : ''}
          </div>
        </div>

        <!-- Right Pane: details drawer -->
        <div class="card detail-panel">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <h3>Labour Profile & Ledger</h3>
            ${selectedLabour ? `
              <div style="display:flex; gap:6px;">
                <button class="btn btn-sm btn-primary" style="display:inline-flex; align-items:center; gap:4px;" onclick="LabourPage.printPDF('${selectedLabour.id || selectedLabour._id}')">${Icons.fileText} Print Statement</button>
                <button class="btn btn-sm btn-outline" onclick="LabourPage.openEditLabourModal('${selectedLabour.id || selectedLabour._id}')">${Icons.edit} Edit</button>
                <button class="btn btn-sm btn-danger" style="background:var(--danger);color:white" onclick="LabourPage.deleteLabour('${selectedLabour.id || selectedLabour._id}')">${Icons.trash} Delete</button>
              </div>
            ` : ''}
          </div>
          <div class="card-body" id="labour-detail-body">
            ${selectedLabour ? this.renderLabourProfile(selectedLabour) : `
              <div style="text-align: center; padding: 80px 20px; color: var(--text-tertiary);">
                ${Icons.user}
                <h4 style="margin-top: 12px; margin-bottom: 6px;">No Labour Selected</h4>
                <p style="margin: 0; font-size: 0.9rem;">Select a labour from the left list to see personal details, ledger and payment histories.</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  },

  selectLabour(id) {
    if (!id || id === 'undefined' || id === 'null') return;
    this.selectedLabourId = String(id);
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
    const lId = String(labour.id || labour._id || '');
    const summary = (this.summaryData && this.summaryData.labours)
      ? (this.summaryData.labours.find(l => String(l.id || l._id || '') === lId) || {
          presentDays: 0, halfDays: 0, absentDays: 0, grossWages: 0, totalOvertime: 0, totalMoneyGiven: 0, totalEarnings: 0, payableAmount: 0, advanceBalance: 0
        })
      : { presentDays: 0, halfDays: 0, absentDays: 0, grossWages: 0, totalOvertime: 0, totalMoneyGiven: 0, totalEarnings: 0, payableAmount: 0, advanceBalance: 0 };

    return `
      <!-- Worker Header & Actions -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
        <div>
          <h3 style="margin:0; font-size:1.35rem; color:var(--text-primary); font-weight:800;">${labour.name}</h3>
          <p style="margin:2px 0 0 0; color:var(--text-tertiary); font-size:0.85rem;">Registered Worker Profile & Financial Ledger</p>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-success" onclick="LabourPage.openAdvanceModal('${lId}')" style="background:#047857; color:white; border-color:#047857; display:inline-flex; align-items:center; gap:6px; font-weight:600;">
            💵 Add / Adjust Advance
          </button>
          <button class="btn btn-primary" onclick="LabourPage.printPDF('${lId}')" style="display:inline-flex; align-items:center; gap:6px;">
            ${Icons.printer || Icons.fileText} Print Worker Statement / Payslip
          </button>
          <button class="btn btn-outline" onclick="LabourPage.openEditLabourModal('${lId}')" style="display:inline-flex; align-items:center; gap:6px;">
            ${Icons.edit} Edit Details
          </button>
        </div>
      </div>

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
        ${this.renderProfileTabContent(lId)}
      </div>
    `;
  },

  switchProfileTab(tab) {
    this.profileTab = tab;
    const body = document.getElementById('labour-detail-body');
    if (body && this.selectedLabourId) {
      const labour = Store.Labours.getById(this.selectedLabourId) || (this.summaryData && this.summaryData.labours ? this.summaryData.labours.find(l => String(l.id || l._id) === String(this.selectedLabourId)) : null);
      if (labour) {
        body.innerHTML = this.renderLabourProfile(labour);
      }
    }
  },

  renderProfileTabContent(labourId) {
    // We will render chronological logs for this labour
    // Fetch logs from store (filtered by labourId)
    let logs = Store.LabourLogs.getAll()
      .filter(l => String(l.labourId || '') === String(labourId || ''))
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

        const wageDisplay = gross === l.dailyWage ? `₹${l.dailyWage}` : `₹${l.dailyWage} (Earned ₹${gross})`;

        return `
          <tr>
            <td>${l.date}</td>
            <td><span class="badge ${statusClass}">${l.attendance}</span></td>
            <td>${site ? site.name : '-'}</td>
            <td>${wageDisplay}</td>
            <td>${otDisplay}</td>
            <td>₹${given}${given > 0 ? ` <button class="btn btn-xs btn-outline" style="padding:1px 6px; font-size:10px; color:#047857; border-color:#a7f3d0; margin-left:4px; border-radius:4px; font-weight:600;" onclick="LabourPage.openAdvanceModal('${labourId}', '${l.date}', ${given}, '${(l.notes || '').replace(/'/g, "\\'")}', 'set_exact')" title="Edit/Fix Advance Amount">✏️ Fix</button>` : ''}</td>
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
    if (document.getElementById('labour-previous-balance')) document.getElementById('labour-previous-balance').value = '0';
    if (document.getElementById('labour-previous-type')) document.getElementById('labour-previous-type').value = 'payable';
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
    const prevBal = l.previousBalance !== undefined ? l.previousBalance : (l.openingBalance || 0);
    const prevType = l.previousBalanceType || l.openingBalanceType || 'payable';
    if (document.getElementById('labour-previous-balance')) document.getElementById('labour-previous-balance').value = prevBal;
    if (document.getElementById('labour-previous-type')) document.getElementById('labour-previous-type').value = prevType;
    document.getElementById('labour-status').value = l.status;
    document.getElementById('labour-modal-title').textContent = 'Edit Labour details';
    document.getElementById('labour-modal-backdrop').classList.add('active');
  },

  closeLabourModal() {
    document.getElementById('labour-modal-backdrop').classList.remove('active');
  },

  openAdvanceModal(labourId = null, targetDate = null, currentAmount = null, currentNotes = null, actionType = 'payment') {
    const backdrop = document.getElementById('advance-modal-backdrop');
    if (!backdrop) return;
    const select = document.getElementById('adv-labour-id');
    if (select && labourId) select.value = labourId;
    else if (select && this.selectedLabourId) select.value = this.selectedLabourId;
    
    const typeSelect = document.getElementById('adv-type');
    if (typeSelect) typeSelect.value = actionType || 'payment';

    document.getElementById('adv-date').value = targetDate || window.localDateStr();
    document.getElementById('adv-amount').value = (currentAmount !== null && currentAmount !== undefined) ? currentAmount : '';
    document.getElementById('adv-notes').value = currentNotes || '';
    
    const titleEl = document.getElementById('advance-modal-title');
    if (titleEl) {
      if (actionType === 'set_exact') titleEl.textContent = '✏️ Edit / Set Exact Advance Amount';
      else if (actionType === 'opening') titleEl.textContent = '⚙️ Set / Adjust Opening Advance Balance';
      else if (actionType === 'delete') titleEl.textContent = '🗑️ Delete Advance Payment';
      else titleEl.textContent = '💵 Add / Adjust Advance Payment';
    }

    backdrop.classList.add('active');
  },

  closeAdvanceModal() {
    const backdrop = document.getElementById('advance-modal-backdrop');
    if (backdrop) backdrop.classList.remove('active');
  },

  async handleAdvanceSubmit(e) {
    e.preventDefault();
    const labourId = document.getElementById('adv-labour-id').value;
    const advType = document.getElementById('adv-type').value;
    const date = document.getElementById('adv-date').value;
    const amount = parseFloat(document.getElementById('adv-amount').value) || 0;
    const notes = document.getElementById('adv-notes').value.trim();

    if (!labourId) {
      alert('Please select a valid labour / worker.');
      return;
    }

    const labour = Store.Labours.getById(labourId);
    if (!labour) return;

    if (advType === 'opening') {
      await Store.Labours.update(labourId, {
        previousBalance: amount,
        previousBalanceType: 'advance',
        openingBalance: amount,
        openingBalanceType: 'advance'
      });
      alert(`Opening Advance Balance set to ₹${amount.toLocaleString('en-IN')} for ${labour.name}.`);
    } else if (advType === 'set_exact') {
      const allLogs = Store.LabourLogs.getAll();
      const existingLogs = allLogs.filter(l => String(l.labourId) === String(labourId) && l.date === date);

      if (existingLogs.length > 0) {
        const primary = existingLogs[0];
        await Store.LabourLogs.update(primary.id, {
          ...primary,
          moneyGiven: amount,
          notes: notes || primary.notes || `Advance Payment: ₹${amount}`
        });
        for (let i = 1; i < existingLogs.length; i++) {
          const delId = existingLogs[i].id || existingLogs[i]._id;
          if (delId) {
            await Store.LabourLogs.remove(delId);
          }
        }
      } else {
        const payload = {
          date: date,
          labourId: labourId,
          siteId: '',
          attendance: 'Absent',
          dailyWage: labour.defaultWage !== undefined ? labour.defaultWage : 500,
          overtimeHours: 0,
          overtimeTime: '',
          overtime: 0,
          moneyGiven: amount,
          notes: notes || `Advance Payment: ₹${amount}`
        };
        await Store.LabourLogs.addAsync(payload);
      }
      alert(`Advance payment for ${labour.name} on ${date} successfully updated to ₹${amount.toLocaleString('en-IN')}.`);
    } else if (advType === 'delete') {
      const allLogs = Store.LabourLogs.getAll();
      const existingLogs = allLogs.filter(l => String(l.labourId) === String(labourId) && l.date === date);

      if (existingLogs.length > 0) {
        for (const log of existingLogs) {
          const targetId = log.id || log._id;
          if (log.attendance === 'Absent' && (parseFloat(log.overtimeHours) || 0) === 0) {
            await Store.LabourLogs.remove(targetId);
          } else {
            await Store.LabourLogs.update(targetId, { ...log, moneyGiven: 0 });
          }
        }
        alert(`Advance payment for ${labour.name} on ${date} deleted successfully.`);
      } else {
        alert(`No advance payment record found on ${date}.`);
      }
    } else {
      const allLogs = Store.LabourLogs.getAll();
      const existingLogs = allLogs.filter(l => String(l.labourId) === String(labourId) && l.date === date);

      if (existingLogs.length > 0) {
        const primary = existingLogs[0];
        const primaryId = primary.id || primary._id;
        const currentMoney = parseFloat(primary.moneyGiven) || 0;
        const newMoney = currentMoney + amount;
        const existingNotes = primary.notes ? primary.notes + ' | ' : '';
        const newNotes = existingNotes + (notes || `Advance: ₹${amount}`);
        await Store.LabourLogs.update(primaryId, {
          ...primary,
          moneyGiven: newMoney,
          notes: newNotes
        });
        for (let i = 1; i < existingLogs.length; i++) {
          const delId = existingLogs[i].id || existingLogs[i]._id;
          if (delId) {
            await Store.LabourLogs.remove(delId);
          }
        }
      } else {
        const payload = {
          date: date,
          labourId: labourId,
          siteId: '',
          attendance: 'Absent',
          dailyWage: labour.defaultWage !== undefined ? labour.defaultWage : 500,
          overtimeHours: 0,
          overtimeTime: '',
          overtime: 0,
          moneyGiven: amount,
          notes: notes || `Advance Payment: ₹${amount}`
        };
        await Store.LabourLogs.addAsync(payload);
      }
      alert(`Advance payment of ₹${amount.toLocaleString('en-IN')} successfully saved for ${labour.name} on ${date}.`);
    }

    this.closeAdvanceModal();
    this.refresh();
  },

  async handleLabourSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('labour-id').value;
    const prevBalEl = document.getElementById('labour-previous-balance');
    const prevTypeEl = document.getElementById('labour-previous-type');
    const prevBal = prevBalEl ? (parseFloat(prevBalEl.value) || 0) : 0;
    const prevType = prevTypeEl ? prevTypeEl.value : 'payable';

    const payload = {
      name: document.getElementById('labour-name').value,
      nickname: document.getElementById('labour-nickname').value,
      phone: document.getElementById('labour-phone').value,
      defaultWage: parseFloat(document.getElementById('labour-default-wage').value) || 500,
      previousBalance: prevBal,
      previousBalanceType: prevType,
      openingBalance: prevBal,
      openingBalanceType: prevType,
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
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-outline" onclick="LabourPage.printDailyAttendanceSheet()" style="height:42px; display:inline-flex; align-items:center; gap:6px;">
              ${Icons.printer || Icons.fileText} Print Daily Attendance Sheet
            </button>
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
                
                // Resolve wage: current log wage -> master defaultWage -> most recent past log -> 500
                const masterLabour = Store.Labours.getById(l.id) || l;
                let wage = log.dailyWage;
                if (wage === undefined) {
                  if (masterLabour && masterLabour.defaultWage !== undefined && masterLabour.defaultWage > 0) {
                    wage = masterLabour.defaultWage;
                  } else {
                    const pastLogs = Store.LabourLogs.getAll()
                      .filter(pl => pl.labourId === l.id && pl.dailyWage !== undefined && pl.dailyWage > 0)
                      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                    wage = pastLogs.length > 0 ? pastLogs[0].dailyWage : 500;
                  }
                }

                const overtimeHours = log.overtimeHours !== undefined ? log.overtimeHours : 0;
                const otTime = log.overtimeTime || '';
                const money = log.moneyGiven || 0;
                const note = log.notes || '';
                const siteId = log.siteId || this.globalSiteId || '';
                const otPay = overtimeHours > 0 ? ((wage / 8) * overtimeHours).toFixed(0) : 0;

                return `
                  <tr data-labour-id="${l.id}">
                    <td>
                      <strong>${l.name}</strong>
                      ${l.nickname ? `<br><span style="font-size:11px;color:var(--text-tertiary);">(${l.nickname})</span>` : ''}
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
                      <select class="form-control log-site" style="height:36px; padding:0 8px;" onchange="LabourPage.markDirty()">
                        <option value="">-- Select --</option>
                        ${sites.map(s => `<option value="${s.id}" ${siteId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                      </select>
                    </td>
                    <td>
                      <input type="number" class="form-control log-wage" value="${wage || ''}" style="height:36px; text-align:right; font-weight:600;" min="0" oninput="LabourPage.updateOtDisplay(this)" onfocus="if(this.value==='0') this.value=''; this.select()">
                    </td>
                    <td>
                      <div style="display:flex; flex-direction:column; gap:2px;">
                        <input type="number" class="form-control log-ot-hours" value="${overtimeHours || ''}" style="height:36px; text-align:right; font-weight:600;" min="0" step="0.5" placeholder="0" oninput="LabourPage.updateOtDisplay(this)" onfocus="if(this.value==='0') this.value=''; this.select()">
                        <input type="hidden" class="log-ot-time" value="${otTime}">
                        <span class="log-ot-calc" style="font-size:11px; font-weight:600; color:#7c3aed; text-align:right; display:${overtimeHours > 0 ? 'block' : 'none'};">= ₹${otPay}</span>
                      </div>
                    </td>
                    <td>
                      <input type="number" class="form-control log-money" value="${money || ''}" style="height:36px; text-align:right; font-weight:600;" min="0" placeholder="0" oninput="LabourPage.markDirty()" onfocus="if(this.value==='0') this.value=''; this.select()">
                    </td>
                    <td>
                      <input type="text" class="form-control log-notes" value="${note}" placeholder="Optional notes" style="height:36px;" oninput="LabourPage.markDirty()">
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
    this.isDirty = false;
    this.logDate = e.target.value;
    this.fetchData().then(() => {
      const container = document.getElementById('page-container');
      if (container && window.location.hash === '#labour') {
        container.innerHTML = this.render();
        if (typeof this.bindEvents === 'function') this.bindEvents();
      }
    });
  },

  onGlobalSiteChange(e) {
    this.isDirty = true;
    this.globalSiteId = e.target.value;
    // Update all dropdowns that don't have overrides
    document.querySelectorAll('tr[data-labour-id]').forEach(tr => {
      const select = tr.querySelector('.log-site');
      if (select) {
        select.value = this.globalSiteId;
      }
    });
  },

  markDirty() {
    this.isDirty = true;
  },

  setAttStatus(button, status) {
    this.isDirty = true;
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
    this.isDirty = true;
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
    const saveBtn = document.querySelector('button[onclick="LabourPage.saveDailyLogs()"]');
    if (saveBtn) {
      if (saveBtn.disabled) return;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '⌛ Saving Attendance...';
    }

    try {
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

        // Auto-update defaultWage on the master labour so it carries forward for future days
        const labour = Store.Labours.getById(labourId);
        if (labour && dailyWage > 0 && (labour.defaultWage !== dailyWage || labour.defaultWage === undefined)) {
          labour.defaultWage = dailyWage;
          await Store.Labours.update(labourId, { ...labour, defaultWage: dailyWage });
        }

        // Check if existing log(s) for this date & labour exist
        const allLogs = Store.LabourLogs.getAll();
        const existingLogs = allLogs.filter(l => String(l.labourId) === String(labourId) && l.date === this.logDate);

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

        if (existingLogs.length > 0) {
          const primary = existingLogs[0];
          await Store.LabourLogs.update(primary.id, payload);
          for (let i = 1; i < existingLogs.length; i++) {
            const delId = existingLogs[i].id || existingLogs[i]._id;
            if (delId) {
              await Store.LabourLogs.remove(delId);
            }
          }
        } else {
          await Store.LabourLogs.addAsync(payload);
        }
        count++;
      }

      alert(`Saved logs for ${count} labours successfully!`);
      this.isDirty = false;
      this.fetchData().then(() => {
        const container = document.getElementById('page-container');
        if (container) {
          container.innerHTML = this.render();
        }
      });
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '💾 Save Attendance Log Sheet';
      }
    }
  },

  printDailyAttendanceSheet() {
    const activeLabours = Store.Labours.getAll().filter(l => l.status === 'Active');
    const sites = Store.Sites.getAll();
    const globalSite = this.globalSiteId ? Store.Sites.getById(this.globalSiteId) : null;
    const printDate = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let totalGrossWage = 0;
    let totalPaid = 0;
    let totalOtHours = 0;

    let rowsHtml = activeLabours.map((l, idx) => {
      const log = this.dailyLogsData[l.id] || {};
      const att = log.attendance || 'Absent';

      if (att === 'Present') presentCount++;
      else if (att === 'Half Day') halfDayCount++;
      else absentCount++;

      const masterLabour = Store.Labours.getById(l.id) || l;
      let wage = log.dailyWage;
      if (wage === undefined) {
        wage = masterLabour.defaultWage || 500;
      }

      const attVal = att === 'Present' ? 1.0 : (att === 'Half Day' ? 0.5 : 0);
      const earnedWage = Math.round(wage * attVal);
      const otHours = parseFloat(log.overtimeHours) || 0;
      const otPay = otHours > 0 ? Math.round((wage / 8) * otHours) : 0;
      const moneyPaid = Math.round(log.moneyGiven || 0);
      const netEarned = earnedWage + otPay;

      totalGrossWage += netEarned;
      totalPaid += moneyPaid;
      totalOtHours += otHours;

      const siteObj = log.siteId ? Store.Sites.getById(log.siteId) : globalSite;
      const siteName = siteObj ? siteObj.name : '—';

      let attBadgeBg = '#dcfce7'; let attColor = '#15803d';
      if (att === 'Half Day') { attBadgeBg = '#fef9c3'; attColor = '#a16207'; }
      if (att === 'Absent') { attBadgeBg = '#fee2e2'; attColor = '#b91c1c'; }

      return `
        <tr>
          <td style="text-align:center; padding:8px; border:1px solid #cbd5e1;">${idx + 1}</td>
          <td style="padding:8px; border:1px solid #cbd5e1;">
            <strong style="color:#0f172a; font-size:13px;">${l.name}</strong>
            ${l.nickname ? `<span style="font-size:11px; color:#64748b;">(${l.nickname})</span>` : ''}
            <div style="font-size:10px; color:#64748b;">📞 ${l.phone || 'N/A'}</div>
          </td>
          <td style="text-align:center; padding:8px; border:1px solid #cbd5e1;">
            <span style="background:${attBadgeBg}; color:${attColor}; padding:3px 8px; border-radius:4px; font-weight:700; font-size:11px;">
              ${att}
            </span>
          </td>
          <td style="padding:8px; border:1px solid #cbd5e1; font-size:12px;">${siteName}</td>
          <td style="text-align:right; padding:8px; border:1px solid #cbd5e1; font-weight:600;">₹${wage.toLocaleString('en-IN')}</td>
          <td style="text-align:center; padding:8px; border:1px solid #cbd5e1; color:#6b21a8; font-weight:600;">${otHours > 0 ? otHours + ' hrs (₹' + otPay + ')' : '—'}</td>
          <td style="text-align:right; padding:8px; border:1px solid #cbd5e1; font-weight:700; color:#059669;">₹${moneyPaid.toLocaleString('en-IN')}</td>
          <td style="text-align:right; padding:8px; border:1px solid #cbd5e1; font-weight:800; color:#1e40af;">₹${netEarned.toLocaleString('en-IN')}</td>
          <td style="border:1px solid #cbd5e1; width:100px;"></td>
        </tr>
      `;
    }).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>KSS Labour Daily Attendance Sheet - ${this.logDate}</title>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap");
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: 'Inter', sans-serif; color: #0f172a; padding: 10px; background: #fff; line-height: 1.4; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 22px; font-weight: 800; color: #1e40af; text-transform: uppercase; }
          .sub { font-size: 11px; color: #475569; margin-top: 4px; }
          .metrics-bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
          .m-box { text-align: center; border-right: 1px solid #e2e8f0; }
          .m-box:last-child { border-right: none; }
          .m-lbl { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; }
          .m-num { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background: #0f172a; color: white; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; border: 1px solid #0f172a; }
          td { border: 1px solid #cbd5e1; }
          .footer-sig { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #475569; }
          .sig-line { border-top: 1px solid #94a3b8; width: 180px; text-align: center; padding-top: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">KSS CONSTRUCTION MATERIALS</div>
            <div class="sub">Daily Labour Attendance & Wage Log | Date: <strong>${this.logDate}</strong> ${globalSite ? '| Site: ' + globalSite.name : ''}</div>
          </div>
          <div style="text-align:right; font-size:10px; color:#64748b;">
            <div>Printed on: ${printDate}</div>
            <div>Daily Muster Roll</div>
          </div>
        </div>

        <div class="metrics-bar">
          <div class="m-box">
            <div class="m-lbl">Total Workers</div>
            <div class="m-num">${activeLabours.length}</div>
          </div>
          <div class="m-box">
            <div class="m-lbl" style="color:#15803d;">Present</div>
            <div class="m-num" style="color:#15803d;">${presentCount}</div>
          </div>
          <div class="m-box">
            <div class="m-lbl" style="color:#a16207;">Half Day</div>
            <div class="m-num" style="color:#a16207;">${halfDayCount}</div>
          </div>
          <div class="m-box">
            <div class="m-lbl" style="color:#b91c1c;">Absent</div>
            <div class="m-num" style="color:#b91c1c;">${absentCount}</div>
          </div>
          <div class="m-box">
            <div class="m-lbl" style="color:#2563eb;">Total Net Earned</div>
            <div class="m-num" style="color:#2563eb;">₹${totalGrossWage.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">S.No</th>
              <th>Labour Name</th>
              <th style="width: 110px; text-align: center;">Status</th>
              <th style="width: 120px;">Site Location</th>
              <th style="width: 100px; text-align: right;">Wage Rate</th>
              <th style="width: 110px; text-align: center;">Overtime</th>
              <th style="width: 110px; text-align: right;">Money Paid</th>
              <th style="width: 110px; text-align: right;">Net Wage</th>
              <th style="width: 100px; text-align: center;">Signature</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="9" style="text-align:center; padding:20px;">No labour attendance recorded for this date</td></tr>'}
          </tbody>
        </table>

        <div class="footer-sig">
          <div class="sig-line">Supervisor Signature</div>
          <div class="sig-line">Authorized Signatory</div>
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
          ${Icons.printer || Icons.fileText} Print Payroll Summary Report
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
            const uniquePresent = [...new Set(l.presentDates || [])].sort();
            const uniqueHalf = [...new Set(l.halfDayDates || [])].sort();
            const uniqueAbsent = [...new Set(l.absentDates || [])].sort();

            const presentDates = uniquePresent.map(d => `<span style="background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;">${fmt(d)}</span>`).join(' ');
            const halfDates = uniqueHalf.map(d => `<span style="background:#fef9c3;color:#a16207;border:1px solid #fef08a;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;">${fmt(d)}</span>`).join(' ');
            const absentDates = uniqueAbsent.map(d => `<span style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;">${fmt(d)}</span>`).join(' ');
            
            const otMap = {};
            (l.overtimeLogs || []).forEach(o => {
              if (!o.date) return;
              if (!otMap[o.date]) otMap[o.date] = { date: o.date, hours: parseFloat(o.hours) || 0, pay: parseFloat(o.pay) || 0, time: o.time || '' };
              else {
                otMap[o.date].hours += (parseFloat(o.hours) || 0);
                otMap[o.date].pay += (parseFloat(o.pay) || 0);
              }
            });
            const otLogs = Object.values(otMap).sort((a,b) => (a.date || '').localeCompare(b.date || '')).map(o => {
              const timeStr = o.time ? ` (${o.time})` : '';
              const hrsNum = Number(parseFloat(o.hours).toFixed(1));
              return `<span style="background:#f3e8ff;color:#6b21a8;border:1px solid #e9d5ff;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;">${fmt(o.date)}: ${hrsNum}h${timeStr} = ₹${Math.round(o.pay)}</span>`;
            }).join(' ');

            const payMap = {};
            let rawPayLogs = (l.paymentLogs || []);
            if (rawPayLogs.length === 0 && (l.totalMoneyGiven || 0) > 0 && Store.LabourLogs) {
              rawPayLogs = Store.LabourLogs.getAll()
                .filter(log => String(log.labourId) === String(l.id) && (parseFloat(log.moneyGiven) || 0) > 0)
                .map(log => ({ date: log.date, amount: parseFloat(log.moneyGiven) || 0, notes: log.notes || '' }));
            }
            rawPayLogs.forEach(p => {
              if (!p.date) return;
              if (!payMap[p.date]) payMap[p.date] = { date: p.date, amount: parseFloat(p.amount) || 0, notes: p.notes || '' };
              else {
                payMap[p.date].amount += (parseFloat(p.amount) || 0);
                if (p.notes && !payMap[p.date].notes.includes(p.notes)) {
                  payMap[p.date].notes = payMap[p.date].notes ? (payMap[p.date].notes + ' | ' + p.notes) : p.notes;
                }
              }
            });
            const payLogs = Object.values(payMap).sort((a,b) => (a.date || '').localeCompare(b.date || '')).map(p => {
              const notesStr = p.notes ? ` (${p.notes})` : '';
              const safeNotes = (p.notes || '').replace(/'/g, "\\'");
              const lId = l.id || l._id;
              return `<span style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                ${fmt(p.date)}: ₹${Math.round(p.amount)}${notesStr}
                <span onclick="event.stopPropagation(); LabourPage.openAdvanceModal('${lId}', '${p.date}', ${Math.round(p.amount)}, '${safeNotes}', 'set_exact')" title="Edit/Fix Wrong Advance Amount" style="cursor:pointer;background:rgba(4,120,87,0.15);border-radius:4px;padding:1px 5px;font-size:10px;color:#047857;font-weight:700;">✏️ Edit</span>
              </span>`;
            }).join(' ');
            
            const rawOtHours = parseFloat(l.totalOvertimeHours) || 0;
            const otHours = Number(rawOtHours.toFixed(1));
            const otPay = Math.round(l.totalOvertime || 0);
            const payable = Math.round(l.payableAmount || 0);
            const advance = Math.round(l.advanceBalance || 0);

            return `
              <div style="border:1px solid var(--border-color); border-radius:14px; overflow:hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); background:var(--card-bg);">
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
                  <div style="display:flex; align-items:center; gap:12px;">
                    <button class="btn btn-sm btn-outline" style="background:rgba(255,255,255,0.12); color:#e2e8f0; border:1px solid rgba(255,255,255,0.25); display:inline-flex; align-items:center; gap:6px; cursor:pointer;" onclick="LabourPage.printPDF('${l.id || l._id}')">
                      ${Icons.fileText} Print Statement
                    </button>
                    <div style="text-align:right; background:rgba(255,255,255,0.06); padding:8px 16px; border-radius:10px; border:1px solid rgba(255,255,255,0.1);">
                      <div style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Net Payable</div>
                      <div style="font-size:1.65rem; font-weight:800; line-height:1.1; color:${payable > 0 ? '#fde047' : '#4ade80'};">
                        ₹${payable > 0 ? payable.toLocaleString('en-IN') : (advance > 0 ? '-' + advance.toLocaleString('en-IN') : '0')}
                      </div>
                      <div style="font-size:0.7rem; color:#cbd5e1; font-weight:500;">${payable > 0 ? 'amount to pay' : advance > 0 ? 'advance balance' : 'settled'}</div>
                    </div>
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
                  ${(l.paymentLogs && l.paymentLogs.length > 0) ? `
                  <div style="display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                    <span style="font-size:0.75rem; font-weight:700; color:#047857; min-width:90px; padding-top:2px;">💵 MONEY PAID</span>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">${payLogs}</div>
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
      ["Labour Name", "Mobile Number", "Present Days", "Half Days", "Absent Days", "Gross Wages (₹)", "Overtime (₹)", "Money Given (₹)", "Payable Amount (₹)", "Money Paid Dates & Breakdown"]
    ];

    this.summaryData.labours.forEach(l => {
      let rawPayLogs = (l.paymentLogs || []);
      if (rawPayLogs.length === 0 && (l.totalMoneyGiven || 0) > 0 && Store.LabourLogs) {
        rawPayLogs = Store.LabourLogs.getAll()
          .filter(log => String(log.labourId) === String(l.id) && (parseFloat(log.moneyGiven) || 0) > 0)
          .map(log => ({ date: log.date, amount: parseFloat(log.moneyGiven) || 0, notes: log.notes || '' }));
      }

      const payStr = rawPayLogs
        .slice()
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .map(p => `${p.date}: ₹${Math.round(p.amount)}${p.notes ? ' (' + p.notes + ')' : ''}`)
        .join(' | ');

      rows.push([
        l.name,
        l.phone || '',
        l.presentDays,
        l.halfDays,
        l.absentDays,
        l.grossWages,
        l.totalOvertime,
        l.totalMoneyGiven,
        l.payableAmount,
        payStr || 'None'
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
  printPDF(targetLabourId = null) {
    const summaryLabours = (this.summaryData && this.summaryData.labours && this.summaryData.labours.length > 0)
      ? this.summaryData.labours
      : [];
    const storeLabours = Store.Labours ? Store.Labours.getAll() : [];

    let rawLabours = summaryLabours.length > 0 ? summaryLabours : storeLabours;

    if (targetLabourId) {
      const targetStr = String(targetLabourId).trim();
      let match = summaryLabours.find(l => String(l.id || l._id || '').trim() === targetStr);
      if (!match) {
        match = storeLabours.find(l => String(l.id || l._id || '').trim() === targetStr);
      }
      if (!match && targetStr !== 'undefined' && targetStr !== 'null') {
        match = summaryLabours.find(l => String(l.name || '').trim() === targetStr) || storeLabours.find(l => String(l.name || '').trim() === targetStr);
      }

      if (match) {
        rawLabours = [match];
      } else {
        alert("No labour record found to print.");
        return;
      }
    }

    if (!rawLabours || rawLabours.length === 0) {
      alert("No labour record found to print.");
      return;
    }

    const allLogs = Store.LabourLogs ? Store.LabourLogs.getAll() : [];

    const laboursToPrint = rawLabours.map(labour => {
      const lId = String(labour.id || labour._id);
      const masterLabour = Store.Labours ? Store.Labours.getById(lId) : labour;
      const prevBal = masterLabour ? (masterLabour.previousBalance !== undefined ? masterLabour.previousBalance : (masterLabour.openingBalance || 0)) : (labour.previousBalance || 0);
      const prevType = masterLabour ? (masterLabour.previousBalanceType || masterLabour.openingBalanceType || 'payable') : (labour.previousBalanceType || 'payable');
      
      const openingAdvance = prevType === 'advance' ? (parseFloat(prevBal) || 0) : 0;
      const openingPayable = prevType === 'payable' ? (parseFloat(prevBal) || 0) : 0;

      // Filter raw logs strictly by reportStartDate, reportEndDate, and reportSiteId
      let logs = allLogs.filter(log => String(log.labourId) === lId);
      if (this.reportStartDate) logs = logs.filter(log => log.date >= this.reportStartDate);
      if (this.reportEndDate) logs = logs.filter(log => log.date <= this.reportEndDate);
      if (this.reportSiteId) logs = logs.filter(log => String(log.siteId) === String(this.reportSiteId));

      // If labour came from summaryData (already filtered & aggregated for this exact date window)
      if (labour.presentDays !== undefined && labour.grossWages !== undefined) {
        const totalMoneyGiven = Math.round(labour.totalMoneyGiven || 0);
        const totalAdvanceTaken = Math.round(openingAdvance + totalMoneyGiven);
        const netEarnings = Math.round((labour.grossWages || 0) + (labour.totalOvertime || 0) + openingPayable);
        const payableAmount = netEarnings > totalAdvanceTaken ? (netEarnings - totalAdvanceTaken) : 0;
        const advanceBalance = totalAdvanceTaken > netEarnings ? (totalAdvanceTaken - netEarnings) : 0;

        return {
          id: labour.id || labour._id,
          name: labour.name,
          nickname: labour.nickname || '',
          phone: labour.phone || '',
          openingAdvance,
          openingPayable,
          presentDays: labour.presentDays || 0,
          halfDays: labour.halfDays || 0,
          absentDays: labour.absentDays || 0,
          grossWages: Math.round(labour.grossWages || 0),
          totalOvertimeHours: Number((labour.totalOvertimeHours || 0).toFixed(1)),
          totalOvertime: Math.round(labour.totalOvertime || 0),
          totalMoneyGiven,
          totalAdvanceTaken,
          payableAmount: Math.round(payableAmount),
          advanceBalance: Math.round(advanceBalance),
          overtimeLogs: labour.overtimeLogs || [],
          paymentLogs: labour.paymentLogs || [],
          periodLogs: logs
        };
      }

      // Fallback calculation from filtered logs
      let presentDays = 0, halfDays = 0, absentDays = 0;
      let grossWages = 0, totalOtHours = 0, totalOtPay = 0, totalMoneyGiven = 0;
      const overtimeLogs = [], paymentLogs = [];

      logs.forEach(log => {
        const att = log.attendance || 'Absent';
        if (att === 'Present') presentDays++;
        else if (att === 'Half Day') halfDays++;
        else absentDays++;

        const attVal = att === 'Present' ? 1.0 : (att === 'Half Day' ? 0.5 : 0);
        const wage = parseFloat(log.dailyWage) || (labour.defaultWage || 500);
        grossWages += wage * attVal;

        const otH = parseFloat(log.overtimeHours) || 0;
        const otP = parseFloat(log.overtime) || 0;
        const otPay = otH > 0 ? (wage / 8) * otH : otP;
        totalOtHours += otH;
        totalOtPay += otPay;

        if (otH > 0 || otP > 0) {
          overtimeLogs.push({ date: log.date, hours: otH, pay: otPay, time: log.overtimeTime || '' });
        }

        const mg = parseFloat(log.moneyGiven) || 0;
        totalMoneyGiven += mg;
        if (mg > 0) {
          paymentLogs.push({ date: log.date, amount: mg, notes: log.notes || '' });
        }
      });

      const totalAdvanceTaken = openingAdvance + totalMoneyGiven;
      const netEarnings = grossWages + totalOtPay + openingPayable;
      const payableAmount = netEarnings > totalAdvanceTaken ? (netEarnings - totalAdvanceTaken) : 0;
      const advanceBalance = totalAdvanceTaken > netEarnings ? (totalAdvanceTaken - netEarnings) : 0;

      return {
        id: labour.id || labour._id,
        name: labour.name,
        nickname: labour.nickname || '',
        phone: labour.phone || '',
        openingAdvance,
        openingPayable,
        presentDays,
        halfDays,
        absentDays,
        grossWages: Math.round(grossWages),
        totalOvertimeHours: Number(totalOtHours.toFixed(1)),
        totalOvertime: Math.round(totalOtPay),
        totalMoneyGiven: Math.round(totalMoneyGiven),
        totalAdvanceTaken: Math.round(totalAdvanceTaken),
        payableAmount: Math.round(payableAmount),
        advanceBalance: Math.round(advanceBalance),
        overtimeLogs,
        paymentLogs,
        periodLogs: logs
      };
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to export printable PDF.");
      return;
    }

    const dateRangeStr = `${this.reportStartDate} to ${this.reportEndDate}`;
    const printDate = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    const formatFullDate = (dateStr) => {
      if (!dateStr) return '—';
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
          return `${parts[2]}/${parts[1]}/${parts[0]} (${dayName})`;
        }
      } catch(e) {}
      return dateStr;
    };

    const labourSections = laboursToPrint.map((l, lIdx) => {
      const labourIdStr = String(l.id || l._id || '');
      const rawOtHours = parseFloat(l.totalOvertimeHours) || 0;
      const otHours = Number(rawOtHours.toFixed(1));
      const otPay = Math.round(l.totalOvertime || 0);

      const grossWages = Math.round(l.grossWages || 0);
      const totalMoneyGiven = Math.round(l.totalMoneyGiven || 0);
      const openingAdvance = Math.round(l.openingAdvance || 0);
      const totalAdvanceTaken = Math.round(l.totalAdvanceTaken || (openingAdvance + totalMoneyGiven));

      const payable = l.payableAmount || 0;
      const advance = l.advanceBalance || 0;

      // 1. Overtime Logs Table
      const sortedOt = (l.overtimeLogs || []).slice().sort((a,b) => (a.date || '').localeCompare(b.date || ''));
      let otTableHtml = '';
      if (sortedOt.length > 0) {
        otTableHtml = `
          <div style="margin-top: 14px;">
            <h5 style="margin: 0 0 6px 0; color: #6b21a8; font-size: 11px; text-transform: uppercase;">⏰ Overtime Worked Logs (${otHours} hrs total = ₹${otPay.toLocaleString('en-IN')})</h5>
            <table class="sub-table" style="width:100%; border-collapse:collapse; margin-bottom:10px;">
              <thead>
                <tr style="background:#f3e8ff; color:#6b21a8;">
                  <th style="width:35px; text-align:center;">#</th>
                  <th style="width:150px; text-align:left;">Date Worked</th>
                  <th style="width:100px; text-align:center;">OT Hours</th>
                  <th style="text-align:left;">Time Slot / Notes</th>
                  <th style="width:120px; text-align:right;">OT Pay (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${sortedOt.map((o, idx) => `
                  <tr>
                    <td style="text-align:center; color:#666;">${idx + 1}</td>
                    <td style="font-weight:600;">${formatFullDate(o.date)}</td>
                    <td style="text-align:center; font-weight:600; color:#6b21a8;">${Number(parseFloat(o.hours).toFixed(1))} hrs</td>
                    <td style="color:#555;">${o.time || 'Standard OT'}</td>
                    <td style="text-align:right; font-weight:700; color:#6b21a8;">₹${Math.round(o.pay).toLocaleString('en-IN')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      // 2. Date-Wise Payment & Advance History Table
      let sortedPayments = (l.paymentLogs || []).slice().sort((a,b) => (a.date || '').localeCompare(b.date || ''));
      if (sortedPayments.length === 0 && Store.LabourLogs) {
        const storeLogs = Store.LabourLogs.getAll().filter(log => String(log.labourId) === labourIdStr && (parseFloat(log.moneyGiven) || 0) > 0);
        sortedPayments = storeLogs.map(log => ({
          date: log.date,
          siteId: log.siteId || '',
          amount: parseFloat(log.moneyGiven) || 0,
          notes: log.notes || 'Payment / Advance',
          createdAt: log.createdAt || ''
        })).sort((a,b) => (a.date || '').localeCompare(b.date || ''));
      }
      
      let paymentTableHtml = '';
      if (sortedPayments.length > 0 || openingAdvance > 0) {
        paymentTableHtml = `
          <div style="margin-top: 14px;">
            <h5 style="margin: 0 0 6px 0; color: #047857; font-size: 11px; text-transform: uppercase;">
              💵 Date-Wise Payment & Advance History (Total Advance Owed/Paid: ₹${totalAdvanceTaken.toLocaleString('en-IN')})
            </h5>
            <table class="sub-table" style="width:100%; border-collapse:collapse; margin-bottom:10px;">
              <thead>
                <tr style="background:#ecfdf5; color:#047857;">
                  <th style="width:35px; text-align:center;">#</th>
                  <th style="width:160px; text-align:left;">Payment / Advance Date</th>
                  <th style="width:140px; text-align:left;">Site Assigned</th>
                  <th style="width:130px; text-align:right;">Advance Taken (₹)</th>
                  <th style="text-align:left;">Remarks / Payment Notes</th>
                </tr>
              </thead>
              <tbody>
                ${openingAdvance > 0 ? `
                  <tr style="background:#f0fdf4;">
                    <td style="text-align:center; font-weight:700; color:#047857;">*</td>
                    <td style="font-weight:700; color:#047857;">Opening Balance</td>
                    <td style="color:#64748b;">Opening Dues</td>
                    <td style="text-align:right; font-weight:800; color:#059669; font-size:12px;">₹${openingAdvance.toLocaleString('en-IN')}</td>
                    <td style="color:#166534; font-weight:600;">Opening Advance Owed by Worker</td>
                  </tr>
                ` : ''}
                ${sortedPayments.map((p, idx) => {
                  const siteObj = Store.Sites ? Store.Sites.getById(p.siteId) : null;
                  const siteName = siteObj ? siteObj.name : 'General / Unassigned';
                  return `
                    <tr>
                      <td style="text-align:center; color:#666;">${idx + 1}</td>
                      <td style="font-weight:700; color:#0f172a;">${formatFullDate(p.date)}</td>
                      <td style="color:#475569; font-weight:500;">${siteName}</td>
                      <td style="text-align:right; font-weight:800; color:#059669; font-size:12px;">₹${Math.round(p.amount).toLocaleString('en-IN')}</td>
                      <td style="color:#334155;">${p.notes || 'Payment / Advance'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        paymentTableHtml = `
          <div style="margin-top: 14px; padding: 10px 12px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; font-size:11px; color:#64748b;">
            💵 <strong>Money Given / Payments:</strong> No advance payments taken in this period.
          </div>
        `;
      }

      // 3. Complete Daily Attendance & Payment Ledger Table
      let dailyLedgerHtml = '';
      if (Store.LabourLogs) {
        const periodLogs = Store.LabourLogs.getAll()
          .filter(log => String(log.labourId) === labourIdStr)
          .filter(log => {
            if (this.reportStartDate && log.date < this.reportStartDate) return false;
            if (this.reportEndDate && log.date > this.reportEndDate) return false;
            if (this.reportSiteId && String(log.siteId) !== String(this.reportSiteId)) return false;
            return true;
          })
          .sort((a,b) => (a.date || '').localeCompare(b.date || ''));

        const dateLedgerMap = {};
        periodLogs.forEach(log => {
          if (!log.date) return;
          if (!dateLedgerMap[log.date]) {
            dateLedgerMap[log.date] = {
              date: log.date,
              siteId: log.siteId || '',
              attendance: log.attendance || 'Absent',
              dailyWage: parseFloat(log.dailyWage) || 0,
              overtimeHours: parseFloat(log.overtimeHours) || 0,
              overtime: parseFloat(log.overtime) || 0,
              moneyGiven: parseFloat(log.moneyGiven) || 0,
              notes: log.notes || ''
            };
          } else {
            const ex = dateLedgerMap[log.date];
            if (log.attendance === 'Present') ex.attendance = 'Present';
            else if (log.attendance === 'Half Day' && ex.attendance !== 'Present') ex.attendance = 'Half Day';

            if ((parseFloat(log.dailyWage) || 0) > ex.dailyWage) ex.dailyWage = parseFloat(log.dailyWage) || 0;
            ex.overtimeHours += (parseFloat(log.overtimeHours) || 0);
            ex.overtime += (parseFloat(log.overtime) || 0);
            ex.moneyGiven += (parseFloat(log.moneyGiven) || 0);
            if (log.notes && !ex.notes.includes(log.notes)) {
              ex.notes = ex.notes ? (ex.notes + ' | ' + log.notes) : log.notes;
            }
          }
        });
        const uniquePeriodLogs = Object.values(dateLedgerMap).sort((a,b) => (a.date || '').localeCompare(b.date || ''));

        if (uniquePeriodLogs.length > 0) {
          dailyLedgerHtml = `
            <div style="margin-top: 14px;">
              <h5 style="margin: 0 0 6px 0; color: #1e3a8a; font-size: 11px; text-transform: uppercase;">📅 Daily Work & Payment Ledger</h5>
              <table class="sub-table" style="width:100%; border-collapse:collapse; margin-bottom:10px;">
                <thead>
                  <tr style="background:#eff6ff; color:#1e40af;">
                    <th style="width:35px; text-align:center;">#</th>
                    <th style="width:140px; text-align:left;">Date</th>
                    <th style="width:90px; text-align:center;">Status</th>
                    <th style="width:130px; text-align:left;">Site</th>
                    <th style="width:90px; text-align:right;">Daily Wage</th>
                    <th style="width:90px; text-align:right;">OT Pay</th>
                    <th style="width:110px; text-align:right;">Money Taken (₹)</th>
                    <th style="text-align:left;">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${uniquePeriodLogs.map((log, idx) => {
                    const siteObj = Store.Sites ? Store.Sites.getById(log.siteId) : null;
                    const sName = siteObj ? siteObj.name : '—';
                    const attVal = log.attendance === 'Present' ? 1.0 : (log.attendance === 'Half Day' ? 0.5 : 0);
                    const wageEarned = Math.round((log.dailyWage || 0) * attVal);
                    const otH = parseFloat(log.overtimeHours) || 0;
                    const otP = parseFloat(log.overtime) || 0;
                    const dw = parseFloat(log.dailyWage) || 0;
                    const otEarned = otH > 0 ? Math.round((dw / 8) * otH) : Math.round(otP);
                    const mg = Math.round(log.moneyGiven || 0);

                    let badgeBg = '#dcfce7'; let badgeColor = '#15803d';
                    if (log.attendance === 'Half Day') { badgeBg = '#fef9c3'; badgeColor = '#a16207'; }
                    if (log.attendance === 'Absent') { badgeBg = '#fee2e2'; badgeColor = '#b91c1c'; }

                    return `
                      <tr>
                        <td style="text-align:center; color:#666;">${idx + 1}</td>
                        <td style="font-weight:600;">${formatFullDate(log.date)}</td>
                        <td style="text-align:center;"><span style="background:${badgeBg}; color:${badgeColor}; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">${log.attendance}</span></td>
                        <td style="color:#475569;">${sName}</td>
                        <td style="text-align:right;">₹${wageEarned}</td>
                        <td style="text-align:right; color:${otEarned > 0 ? '#6b21a8' : '#94a3b8'};">₹${otEarned}</td>
                        <td style="text-align:right; font-weight:${mg > 0 ? '800' : '400'}; color:${mg > 0 ? '#059669' : '#94a3b8'};">
                          ${mg > 0 ? '₹' + mg.toLocaleString('en-IN') : '—'}
                        </td>
                        <td style="color:#64748b; font-size:10px;">${log.notes || '—'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      }

      return `
        <div class="labour-section" style="${lIdx > 0 ? 'page-break-before: always; margin-top: 25px;' : ''}">
          <div class="labour-card">
            <!-- Header bar -->
            <div class="card-header">
              <div>
                <span class="labour-name">${l.name}</span>
                ${l.nickname ? `<span class="nickname">(${l.nickname})</span>` : ''}
                <span class="phone">📞 ${l.phone || 'No phone'}</span>
              </div>
              <div class="net-status">
                ${payable > 0 ? `Net Payable: ₹${payable.toLocaleString('en-IN')}` : advance > 0 ? `Advance Bal: ₹${advance.toLocaleString('en-IN')}` : 'Settled (₹0 Balance)'}
              </div>
            </div>

            <!-- Attendance Overview -->
            <div style="padding: 10px 14px; background: #f8fafc; font-size: 11px; border-bottom: 1px solid #e2e8f0; display:flex; gap:16px; flex-wrap:wrap;">
              <span>✅ <strong>Present:</strong> ${l.presentDays} days</span>
              <span>🌗 <strong>Half Days:</strong> ${l.halfDays} days</span>
              <span>❌ <strong>Absent:</strong> ${l.absentDays} days</span>
              <span>⏰ <strong>OT Hours:</strong> ${otHours} hrs</span>
            </div>

            <!-- Metrics Grid -->
            <div class="metrics-grid">
              <div class="metric-box">
                <div class="m-label">Gross Wages</div>
                <div class="m-val">₹${grossWages.toLocaleString('en-IN')}</div>
              </div>
              <div class="metric-box">
                <div class="m-label">Overtime Pay</div>
                <div class="m-val" style="color:#6b21a8;">₹${otPay.toLocaleString('en-IN')}</div>
                <div style="font-size:9px; color:#7c3aed;">(${otHours} hrs)</div>
              </div>
              <div class="metric-box">
                <div class="m-label">Advance / Money Paid</div>
                <div class="m-val" style="color:#059669;">₹${totalAdvanceTaken.toLocaleString('en-IN')}</div>
                ${openingAdvance > 0 ? `<div style="font-size:9px; color:#047857;">(Inc. Op. Adv ₹${openingAdvance})</div>` : ''}
              </div>
              <div class="metric-box" style="background:${payable > 0 ? '#fef2f2' : '#f0fdf4'}; border-color:${payable > 0 ? '#fecaca' : '#bbf7d0'};">
                <div class="m-label" style="color:${payable > 0 ? '#b91c1c' : '#15803d'}; font-weight:700;">
                  ${payable > 0 ? 'To Pay Balance' : advance > 0 ? 'Advance Balance' : 'Net Balance'}
                </div>
                <div class="m-val" style="color:${payable > 0 ? '#dc2626' : '#16a34a'}; font-weight:800;">
                  ₹${(payable > 0 ? payable : advance).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <!-- Date-wise Money Given Payment Table -->
            ${paymentTableHtml}

            <!-- Overtime Table -->
            ${otTableHtml}

            <!-- Complete Daily Ledger Table -->
            ${dailyLedgerHtml}
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>KSS Labour Payroll Printable Statement</title>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap");
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: 'Inter', sans-serif; color: #0f172a; padding: 10px; background: #fff; line-height: 1.4; }
          .report-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f3c7a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: 800; color: #0f3c7a; text-transform: uppercase; letter-spacing: 0.5px; }
          .subtitle { font-size: 11px; color: #475569; margin-top: 3px; font-weight: 500; }
          .labour-card { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
          .card-header { background: #0f172a; color: white; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
          .labour-name { font-size: 14px; font-weight: 700; }
          .nickname { font-size: 12px; color: #cbd5e1; margin-left: 6px; }
          .phone { font-size: 11px; color: #94a3b8; margin-left: 10px; }
          .net-status { font-size: 13px; font-weight: 800; color: #fde047; }
          .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 10px 14px; background: #ffffff; border-bottom: 1px solid #e2e8f0; }
          .metric-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; text-align: center; }
          .m-label { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px; }
          .m-val { font-size: 14px; font-weight: 800; color: #0f172a; }
          .sub-table { margin-top: 4px; font-size: 11px; }
          .sub-table th { padding: 6px 8px; font-size: 10px; text-transform: uppercase; border: 1px solid #cbd5e1; }
          .sub-table td { padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 11px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
            .labour-section { page-break-after: always; }
            .labour-section:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div>
            <div class="title">KSS Construction Materials</div>
            <div class="subtitle">Labour Payroll Detailed Statement | Period: <strong>${dateRangeStr}</strong></div>
          </div>
          <div style="text-align:right; font-size:10px; color:#64748b;">
            <div>Printed on: ${printDate}</div>
            <div>Prepared By: KSS System</div>
          </div>
        </div>

        ${labourSections}

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
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
