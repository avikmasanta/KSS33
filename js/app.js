/* ============================================
   BuildMate App — Router & Shell
   ============================================ */

var App = (() => {
  const pages = {
    dashboard: { title: 'Operations Dashboard', subtitle: 'Real-time overview of stock, sites and recent movements.', icon: 'home', module: 'DashboardPage' },
    sites: { title: 'Sites', subtitle: 'Manage customer sites', icon: 'mapPin', module: 'SitesPage' },
    labour: { title: 'Labour Log', subtitle: 'Manage labour, logs and wages', icon: 'users', module: 'LabourPage' },
    materials: { title: 'Materials', subtitle: 'Manage all materials', icon: 'package', module: 'MaterialsPage' },

    incoming: { title: 'Incoming Stock', subtitle: 'Record new incoming stock', icon: 'arrowDownCircle', module: 'IncomingPage' },
    outgoing: { title: 'Outgoing Stock', subtitle: 'Record new outgoing stock', icon: 'arrowUpCircle', module: 'OutgoingPage' },
    reports: { title: 'Reports', subtitle: 'Generate and view reports', icon: 'barChart', module: 'ReportsPage' },
    ledger: { title: 'Stock Ledger', subtitle: 'View material stock ledger', icon: 'fileText', module: 'LedgerPage' },
    'site-details': { title: 'Site Details', subtitle: 'Detailed view of a site', icon: 'mapPin', module: 'SiteDetailsPage' },
    'site-returns': { title: 'Warehouse', subtitle: 'View and manually log materials returned from sites', icon: 'arrowDownCircle', module: 'ReturnsPage' },
    rentals: { title: 'Rental Sites', subtitle: 'Manage materials leased to customers on a daily rate', icon: 'truck', module: 'RentalsPage' },
    'separate-billing': { title: 'Separate Billing', subtitle: 'Independent billing — no customer or site setup required', icon: 'fileText', module: 'SeparateBillingPage' }
  };

  function isSearchInput(input) {
    return (
      input.type === 'search' ||
      (input.id && input.id.toLowerCase().includes('search')) ||
      (input.placeholder && input.placeholder.toLowerCase().includes('search'))
    );
  }

  function isPageDirty() {
    // 1. Check if user is currently focusing/editing any input, textarea, select
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
      return true;
    }

    // 2. Check if any text/number/date/textarea inputs have been modified (excluding search inputs)
    const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea');
    for (const input of inputs) {
      if (isSearchInput(input)) {
        continue;
      }
      if (input.value !== input.defaultValue) {
        return true;
      }
    }

    // 3. Check if any select elements have been changed from their initial selection
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      if (select.options.length === 0) continue;
      let defaultIndex = 0;
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].defaultSelected) {
          defaultIndex = i;
          break;
        }
      }
      if (select.selectedIndex !== defaultIndex) {
        return true;
      }
    }

    return false;
  }

  async function init() {
    // 1. Initialize Store and connect to cloud DB
    try {
      await Store.init();
    } catch (err) {
      console.error('Failed to initialize Store:', err);
    }

    // 2. Hide database loader overlay with a smooth fade-out animation
    const loader = document.getElementById('db-loader-screen');
    if (loader) {
      loader.style.opacity = '0';
      loader.style.visibility = 'hidden';
      setTimeout(() => {
        loader.style.display = 'none';
      }, 400);
    }

    if (!Store.Auth.isLoggedIn()) {
      document.getElementById('app-root').innerHTML = AuthPage.render();
      return;
    }

    renderShell();
    if (!App.eventsBound) {
      bindEvents();
      App.eventsBound = true;

      // 3. Set up periodic background auto-sync every 30 seconds
      setInterval(async () => {
        // Skip refresh if any modal is active to prevent losing user input
        if (document.querySelector('.modal-backdrop.active') || document.querySelector('.modal.active')) {
          return;
        }

        // Skip refresh if there are active edits or dirty forms on the page
        if (isPageDirty()) {
          return;
        }

        const hashBefore = getHash();
        await Store.init();
        const currentHash = getHash();
        if (currentHash === hashBefore) {
          const moduleName = pages[currentHash]?.module;
          if (window[moduleName] && typeof window[moduleName].refresh === 'function') {
            window[moduleName].refresh();
          } else {
            navigate(currentHash);
          }
        }
      }, 30000);
    }
    navigate(getHash());
  }

  function getHash() {
    return window.location.hash.replace('#', '') || 'dashboard';
  }

  function navigate(page, params = null) {
    if (!pages[page]) page = 'dashboard';
    window.location.hash = page;

    // Update sidebar active
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    const pageInfo = pages[page];
    const content = document.getElementById('app-content');
    content.innerHTML = '<div class="fade-in" id="page-container"></div>';
    const container = document.getElementById('page-container');

    const moduleName = pageInfo.module;
    if (window[moduleName] && typeof window[moduleName].render === 'function') {
      if (params && typeof window[moduleName].setParams === 'function') {
        window[moduleName].setParams(params);
      }
      try {
        container.innerHTML = window[moduleName].render();
        if (typeof window[moduleName].init === 'function') {
          window[moduleName].init();
        }
      } catch (err) {
        container.innerHTML = `<div class="empty-state"><h3>Error loading page</h3><p>${err.message}</p></div>`;
      }
    } else {
      container.innerHTML = `<div class="empty-state"><h3>Module not found</h3><p>The module ${moduleName} is not available.</p></div>`;
    }

    // Close mobile sidebar
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('active');
  }

  function renderShell() {
    const user = Store.Auth.getUser();
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();

    const navItems = [
      { key: 'dashboard', label: 'Dashboard', icon: 'home' },
      { key: 'sites', label: 'Sites', icon: 'mapPin' },
      { key: 'labour', label: 'Labour Log', icon: 'users' },
      { key: 'rentals', label: 'Rental Sites', icon: 'truck' },
      { key: 'materials', label: 'Materials', icon: 'package' },
      { key: 'site-returns', label: 'Warehouse', icon: 'arrowDownCircle' },
      { key: 'separate-billing', label: 'Separate Billing', icon: 'fileText', customIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>` },
      { key: 'reports', label: 'Reports', icon: 'barChart' }
    ];

    document.getElementById('app-root').innerHTML = `
      <div class="sidebar-overlay" id="sidebar-overlay"></div>
      <div class="app-shell">
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-brand">
            <div class="sidebar-brand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div class="sidebar-brand-text">
              <h2>KSS 33</h2>
            </div>
          </div>

          <nav class="sidebar-nav">
            ${navItems.map(item => `
              <a class="nav-item" data-page="${item.key}" href="#${item.key}">
                ${item.customIcon || Icons[item.icon]}
                <span>${item.label}</span>
              </a>
            `).join('')}
          </nav>

          <div class="sidebar-footer">
            <div class="sidebar-user">
              <div class="sidebar-avatar">${initials}</div>
              <div class="sidebar-user-info">
                <span class="name">${user.name}</span>
                <span class="role">${user.role}</span>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <div class="sidebar-logout" id="theme-toggle-btn" title="Toggle Dark Mode">
                ${document.documentElement.getAttribute('data-theme') === 'dark' ? Icons.sun : Icons.moon}
              </div>
              <div class="sidebar-logout" id="logout-btn" title="Logout">
                ${Icons.logout}
              </div>
            </div>
          </div>
        </aside>

        <!-- Main Area -->
        <div class="main-area">
          <!-- Mobile Header -->
          <header class="mobile-header">
            <button class="menu-toggle" id="menu-toggle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div class="mobile-header-title">KSS 33</div>
          </header>
          
          <main class="content-area" id="app-content"></main>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    // Hash change navigation
    window.addEventListener('hashchange', () => navigate(getHash()));

    // Sidebar nav clicks
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item[data-page]');
      if (navItem) {
        e.preventDefault();
        navigate(navItem.dataset.page);
      }
    });

    // Mobile menu toggle
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebar-overlay').classList.toggle('active');
    });

    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('active');
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      Store.Auth.logout();
      init();
    });

    // Theme Toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      if (currentTheme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        document.getElementById('theme-toggle-btn').innerHTML = Icons.moon;
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        document.getElementById('theme-toggle-btn').innerHTML = Icons.sun;
      }
    });
  }

  return { init, navigate, eventsBound: false };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
