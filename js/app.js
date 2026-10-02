/* ============================================
   BuildMate App — Router & Shell
   ============================================ */

var App = (() => {
  const pages = {
    dashboard: { title: 'Operations Dashboard', subtitle: 'Real-time overview of stock, sites and recent movements.', icon: 'home', module: 'DashboardPage' },
    sites: { title: 'Sites', subtitle: 'Manage customer sites', icon: 'mapPin', module: 'SitesPage' },
    labour: { title: 'Labour Log', subtitle: 'Manage labour, logs and wages', icon: 'users', module: 'LabourPage' },
    'labour-contracts': { title: 'Labour Contracts', subtitle: 'Manage Monthly & Square Feet Wise Labour Contracts', icon: 'fileText', module: 'LabourContractsPage' },
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
    if (window.LabourPage && window.LabourPage.isDirty) {
      return true;
    }
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
    // 1. Initialize Store from local storage instantly
    if (Store.initFromLocal) Store.initFromLocal();

    // 2. Render UI immediately (0ms wait)
    if (!Store.Auth.isLoggedIn()) {
      document.getElementById('app-root').innerHTML = AuthPage.render();
      return;
    }

    renderShell();
    if (!App.eventsBound) {
      bindEvents();
      App.eventsBound = true;

      // Trigger immediate background cloud sync on app load
      Store.init();

      // Trigger background sync when tab becomes visible (user unlocks phone or switches back to app tab)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !document.querySelector('.modal-backdrop.active') && !document.querySelector('.modal.active') && !isPageDirty()) {
          Store.init();
        }
      });

      // Silent background cloud sync every 15 seconds for real-time cross-device sync
      setInterval(async () => {
        if (document.querySelector('.modal-backdrop.active') || document.querySelector('.modal.active') || isPageDirty()) {
          return;
        }
        try {
          await Store.init();
        } catch (e) {}
      }, 15000);
    }
    navigate(getHash());
  }

  function getViewMode() {
    return localStorage.getItem('kss_view_mode') || 'auto';
  }

  function setViewMode(mode) {
    if (!['auto', 'mobile', 'desktop'].includes(mode)) mode = 'auto';
    localStorage.setItem('kss_view_mode', mode);
    document.documentElement.setAttribute('data-view-mode', mode);
    updateViewModeBadges();
    if (window.showToast) {
      const modeNames = { mobile: '📱 Phone / Mobile Mode', desktop: '💻 Laptop / Desktop Mode', auto: '🔄 Auto Mode' };
      window.showToast('Display mode set to ' + modeNames[mode]);
    }
  }

  function updateViewModeBadges() {
    const mode = getViewMode();
    const modeLabels = {
      mobile: '📱 Mobile',
      desktop: '💻 Laptop',
      auto: '🔄 Auto'
    };
    document.querySelectorAll('.view-mode-badge-label').forEach(el => {
      el.textContent = modeLabels[mode] || '🔄 Auto';
    });
  }

  function showViewModeModal() {
    let modal = document.getElementById('view-mode-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'view-mode-modal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    const currentMode = getViewMode();

    modal.innerHTML = `
      <div class="modal" style="max-width:440px; border-radius:16px;">
        <div class="modal-header" style="border-bottom:1px solid var(--border-color); padding:16px 20px;">
          <h3 style="margin:0; font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:8px;">
            <span>🖥️</span> View Mode Options / Display
          </h3>
          <button class="btn-icon btn-ghost" id="close-view-mode-modal">${Icons.x}</button>
        </div>
        <div class="modal-body" style="padding:20px; display:flex; flex-direction:column; gap:12px;">
          <p style="font-size:0.85rem; color:var(--text-tertiary); margin:0 0 4px 0;">
            Choose interface mode according to your screen preference:
          </p>

          <label class="view-mode-option ${currentMode === 'mobile' ? 'selected' : ''}" data-mode="mobile">
            <input type="radio" name="view_mode_choice" value="mobile" ${currentMode === 'mobile' ? 'checked' : ''} style="accent-color:var(--primary-500);">
            <div class="view-mode-opt-icon">📱</div>
            <div class="view-mode-opt-info">
              <div class="opt-title">Mobile Mode (Phone View)</div>
              <div class="opt-desc">Optimized single-column view, quick bottom bar, swipeable cards & bottom sheets.</div>
            </div>
          </label>

          <label class="view-mode-option ${currentMode === 'desktop' ? 'selected' : ''}" data-mode="desktop">
            <input type="radio" name="view_mode_choice" value="desktop" ${currentMode === 'desktop' ? 'checked' : ''} style="accent-color:var(--primary-500);">
            <div class="view-mode-opt-icon">💻</div>
            <div class="view-mode-opt-info">
              <div class="opt-title">Laptop Mode (Desktop View)</div>
              <div class="opt-desc">Full widescreen view with left menu sidebar and horizontal table overview.</div>
            </div>
          </label>

          <label class="view-mode-option ${currentMode === 'auto' ? 'selected' : ''}" data-mode="auto">
            <input type="radio" name="view_mode_choice" value="auto" ${currentMode === 'auto' ? 'checked' : ''} style="accent-color:var(--primary-500);">
            <div class="view-mode-opt-icon">🔄</div>
            <div class="view-mode-opt-info">
              <div class="opt-title">Auto Detect (Default)</div>
              <div class="opt-desc">Automatically adjusts layout based on your device screen resolution.</div>
            </div>
          </label>
        </div>
        <div class="modal-footer" style="padding:14px 20px; border-top:1px solid var(--border-color); display:flex; justify-content:flex-end;">
          <button class="btn btn-primary" id="save-view-mode-btn" style="width:100%;">Apply Mode</button>
        </div>
      </div>
    `;

    modal.classList.add('active');

    modal.querySelectorAll('.view-mode-option').forEach(opt => {
      opt.addEventListener('click', () => {
        modal.querySelectorAll('.view-mode-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        const radio = opt.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    document.getElementById('close-view-mode-modal')?.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });

    document.getElementById('save-view-mode-btn')?.addEventListener('click', () => {
      const selected = modal.querySelector('input[name="view_mode_choice"]:checked')?.value || 'auto';
      setViewMode(selected);
      modal.classList.remove('active');
    });
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

    // Update bottom nav active
    document.querySelectorAll('.bottom-nav-item').forEach(el => {
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
    const mode = getViewMode();
    const modeLabels = { mobile: '📱 Mobile', desktop: '💻 Laptop', auto: '🔄 Auto' };

    const navItems = [
      { key: 'dashboard', label: 'Dashboard', icon: 'home' },
      { key: 'sites', label: 'Sites', icon: 'mapPin' },
      { key: 'labour', label: 'Labour Log', icon: 'users' },
      { key: 'labour-contracts', label: 'Labour Contracts', icon: 'fileText' },
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
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="view-mode-badge-btn" id="view-mode-sidebar-btn" title="Switch View Mode">
                <span class="view-mode-badge-label">${modeLabels[mode] || '🔄 Auto'}</span>
              </button>
              <a class="sidebar-logout" href="https://github.com/avikmasanta/KSS33" target="_blank" rel="noopener noreferrer" title="GitHub Repository" style="display:inline-flex; align-items:center; text-decoration:none;">
                ${Icons.github}
              </a>
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
            <button class="menu-toggle" id="menu-toggle" aria-label="Open Menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div class="mobile-header-title">KSS 33</div>
            <div style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
              <button class="view-mode-badge-btn" id="view-mode-header-btn" title="Switch Mobile / Laptop Mode">
                <span class="view-mode-badge-label">${modeLabels[mode] || '🔄 Auto'}</span>
              </button>
              <button class="btn-icon btn-ghost" id="theme-toggle-header" title="Toggle Dark Mode" style="width:36px; height:36px;">
                ${document.documentElement.getAttribute('data-theme') === 'dark' ? Icons.sun : Icons.moon}
              </button>
            </div>
          </header>
          
          <main class="content-area" id="app-content"></main>

          <!-- Mobile Bottom Navigation Bar -->
          <nav class="mobile-bottom-nav" id="mobile-bottom-nav">
            <a class="bottom-nav-item" data-page="dashboard" href="#dashboard">
              ${Icons.home}
              <span>Dashboard</span>
            </a>
            <a class="bottom-nav-item" data-page="sites" href="#sites">
              ${Icons.mapPin}
              <span>Sites</span>
            </a>
            <a class="bottom-nav-item" data-page="labour" href="#labour">
              ${Icons.users}
              <span>Labour</span>
            </a>
            <a class="bottom-nav-item" data-page="rentals" href="#rentals">
              ${Icons.truck}
              <span>Rentals</span>
            </a>
            <button class="bottom-nav-item" id="bottom-nav-menu-btn">
              ${Icons.menu}
              <span>Menu</span>
            </button>
          </nav>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    // Hash change navigation
    window.addEventListener('hashchange', () => navigate(getHash()));

    // Sidebar & Bottom nav clicks
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item[data-page], .bottom-nav-item[data-page]');
      if (navItem) {
        e.preventDefault();
        navigate(navItem.dataset.page);
      }
    });

    // View mode clicks
    document.addEventListener('click', (e) => {
      if (e.target.closest('#view-mode-header-btn') || e.target.closest('#view-mode-sidebar-btn')) {
        showViewModeModal();
      }
    });

    // Mobile menu toggles
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebar-overlay').classList.toggle('active');
    });

    document.getElementById('bottom-nav-menu-btn')?.addEventListener('click', () => {
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
    const toggleTheme = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      if (currentTheme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        document.querySelectorAll('#theme-toggle-btn, #theme-toggle-header').forEach(el => el.innerHTML = Icons.moon);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        document.querySelectorAll('#theme-toggle-btn, #theme-toggle-header').forEach(el => el.innerHTML = Icons.sun);
      }
    };

    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
    document.getElementById('theme-toggle-header')?.addEventListener('click', toggleTheme);
  }

  return { init, navigate, getViewMode, setViewMode, showViewModeModal, eventsBound: false };
})();

// Boot & PWA ServiceWorker Registration
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] ServiceWorker registered:', reg.scope))
      .catch(err => console.warn('[PWA] ServiceWorker registration failed:', err));
  }

  // Check iOS installation prompt
  checkIosInstallPrompt();
});

// iOS Safari PWA Installation Guidance Banner
function checkIosInstallPrompt() {
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  const hasDismissed = localStorage.getItem('iosPwaBannerDismissed');

  if (isIos && !isStandalone && !hasDismissed && !document.getElementById('ios-install-banner')) {
    const banner = document.createElement('div');
    banner.id = 'ios-install-banner';
    banner.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;z-index:99999;background:var(--card-bg);border:1px solid var(--primary-500);border-radius:14px;padding:14px 18px;box-shadow:0 10px 30px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--text-primary);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:rgba(37,99,235,0.15);color:var(--primary-500);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">📱</div>
        <div>
          <div style="font-weight:700;font-size:0.9rem;">Install KSS App on iPhone</div>
          <div style="font-size:0.78rem;color:var(--text-tertiary);margin-top:2px;">Tap <span style="font-weight:700;color:var(--primary-500);">Share ⎋</span> then select <span style="font-weight:700;color:var(--text-primary);">"Add to Home Screen"</span></div>
        </div>
      </div>
      <button id="ios-close-btn" style="border:none;background:rgba(255,255,255,0.1);color:var(--text-secondary);cursor:pointer;padding:6px 10px;border-radius:8px;font-size:0.85rem;font-weight:600;">Got it</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('ios-close-btn')?.addEventListener('click', () => {
      localStorage.setItem('iosPwaBannerDismissed', 'true');
      banner.remove();
    });
  }
}

// PWA Deferred Install Prompt Listener (Android / Desktop)
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!document.getElementById('pwa-install-banner')) {
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:var(--card-bg);border:1px solid var(--primary-500);border-radius:12px;padding:12px 18px;box-shadow:0 10px 25px rgba(0,0,0,0.3);display:flex;align-items:center;gap:12px;color:var(--text-primary);';
    banner.innerHTML = `
      <div style="width:36px;height:36px;background:rgba(37,99,235,0.15);color:var(--primary-500);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;">📲</div>
      <div>
        <div style="font-weight:600;font-size:0.9rem;">Install KSS App</div>
        <div style="font-size:0.75rem;color:var(--text-tertiary);">Fast access on mobile & desktop</div>
      </div>
      <button id="pwa-install-btn" class="btn btn-sm btn-primary" style="margin-left:8px;">Install</button>
      <button id="pwa-close-btn" style="border:none;background:transparent;color:var(--text-tertiary);cursor:pointer;padding:4px;font-size:1.1rem;">×</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        console.log('[PWA] User choice:', choice);
        deferredInstallPrompt = null;
        banner.remove();
      }
    });

    document.getElementById('pwa-close-btn')?.addEventListener('click', () => banner.remove());
  }
});
