/* ============================================
   BuildMate Site Stock / Inventory Page
   ============================================ */

var ReturnsPage = {
  render() {
    const materials = Store.Materials.getAll();
    const sites = Store.Sites.getAll().filter(s => s.status !== 'Archived');

    // Calculate sum totals across all sites for each material
    const materialSumTotals = {};
    materials.forEach(m => {
      materialSumTotals[m.id] = 0;
    });

    const siteData = sites.map(site => {
      let totalSent = 0;
      let totalReturned = 0;
      let siteMatData = [];

      materials.forEach(m => {
        const sent = Store.Inventory.getSiteTotalSent(m.id, site.id);
        const returned = Store.Inventory.getSiteReturns(m.id, site.id);
        const available = sent - returned;

        if (sent > 0 || returned > 0) {
          siteMatData.push({
            material: m,
            sent: sent,
            returned: returned,
            available: available
          });

          totalSent += sent;
          totalReturned += returned;

          // Accumulate available across all sites for global totals if needed
          materialSumTotals[m.id] += available;
        }
      });

      return {
        ...site,
        totalSent,
        totalReturned,
        totalAvailable: totalSent - totalReturned,
        materials: siteMatData
      };
    });

    return `
      <div class="page-header">
        <div class="page-header-title">
          <h2>Site Stock</h2>
          <p>View current material balances across all active sites</p>
        </div>
        <div class="page-header-actions">
           <!-- "Log Return" button removed, use Incoming Stock to log returns -->
           <button class="btn btn-outline" onclick="ReturnsPage.refresh()">
             ${Icons.refreshCw} Refresh
           </button>
        </div>
      </div>

      <!-- Site Accordion List -->
      <div style="margin-bottom: 30px;">
        <h3 style="margin-bottom: 15px; font-size: 1.15rem; color: var(--text-primary);">Inventory by Site</h3>
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${siteData.length === 0 ? `
            <div class="card" style="padding: 40px; text-align: center; color: var(--text-tertiary);">
              No active sites found.
            </div>
          ` : siteData.map((site, index) => {
            return `
              <div class="card site-accordion-item" style="overflow: hidden; border: 1px solid var(--border-color); border-radius: 8px;">
                <div class="card-header" style="padding: 16px 20px; background: var(--bg-card); cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="const body = this.nextElementSibling; body.style.display = body.style.display === 'none' ? 'block' : 'none';">
                  <div>
                    <h4 style="margin: 0; color: var(--text-primary); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                      ${site.name} 
                      <span class="badge ${site.status === 'Completed' ? 'badge-info' : 'badge-success'}">${site.status}</span>
                    </h4>
                    <div style="font-size: 0.85rem; color: var(--text-tertiary); margin-top: 4px;">
                      Token: ${site.tokenNumber || '-'} | Customer: ${site.customerName || '-'} | Total Available Items: <strong style="color:var(--text-primary);">${site.totalAvailable.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                  <div class="text-tertiary" style="padding: 8px; border-radius: 50%; background: var(--bg-body);">
                    ${Icons.list || Icons.menu}
                  </div>
                </div>
                
                <div class="card-body" style="display: none; padding: 0; border-top: 1px solid var(--border-color); background: var(--bg-body);">
                  ${site.materials.length === 0 ? `
                    <div style="padding: 20px; text-align: center; color: var(--text-tertiary); font-style: italic;">
                      No materials have been dispatched to this site yet.
                    </div>
                  ` : `
                    <div class="table-container" style="margin: 0; box-shadow: none; border-radius: 0;">
                      <table class="data-table" style="margin: 0; border: none;">
                        <thead>
                          <tr style="background: rgba(0,0,0,0.02);">
                            <th style="padding-left: 20px;">Material</th>
                            <th style="text-align: right; width: 20%;">Input by User</th>
                            <th style="text-align: right; width: 20%;">Returned</th>
                            <th style="text-align: right; width: 20%; padding-right: 20px;">Available</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${site.materials.map(matData => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                              <td style="padding-left: 20px;">
                                <div style="font-weight: 500; color: var(--text-primary);">${matData.material.name}</div>
                                <div style="font-size: 0.75rem; color: var(--text-tertiary);">${matData.material.sku || '-'}</div>
                              </td>
                              <td style="text-align: right; font-weight: 500; color: var(--text-secondary);">${matData.sent.toLocaleString('en-IN')} ${matData.material.unit}</td>
                              <td style="text-align: right; font-weight: 500; color: var(--danger);">${matData.returned.toLocaleString('en-IN')} ${matData.material.unit}</td>
                              <td style="text-align: right; font-weight: 700; color: var(--success); font-size: 1.05rem; padding-right: 20px;">${matData.available.toLocaleString('en-IN')} ${matData.material.unit}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  init() {},

  refresh() {
    const container = document.getElementById('page-container');
    if (container && window.location.hash === '#site-returns') {
      container.innerHTML = this.render();
      this.init();
    }
  }
};
