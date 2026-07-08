/* ============================================
   BuildMate Authentication Module
   ============================================ */

var AuthPage = {
  render() {
    return `
      <div class="login-page" id="login-page">
        <div class="login-card slide-up">
          <div class="login-brand">
            <div class="brand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div>
              <h1>KSS</h1>
              <p>Construction Materials</p>
            </div>
          </div>

          <div class="login-title">
            <h2>Welcome back</h2>
            <p>Sign in to your account to continue</p>
          </div>

          <div class="login-error" id="login-error">
            Invalid email or password. Please try again.
          </div>

          <form id="login-form" onsubmit="AuthPage.handleLogin(event)">
            <div class="form-group">
              <label for="login-email">Email Address</label>
              <input type="email" id="login-email" class="form-control" placeholder="admin@kss.com" value="admin@kss.com" required>
            </div>
            <div class="form-group">
              <label for="login-password">Password</label>
              <input type="password" id="login-password" class="form-control" placeholder="Enter your password" value="admin123" required>
            </div>
            <div class="form-group" style="margin-bottom: 24px;">
              <label for="login-role">Login as</label>
              <select id="login-role" class="form-control" onchange="AuthPage.onRoleChange(this.value)">
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Staff">Staff</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary w-full" style="height: 42px; font-size: 0.9375rem;">
              Sign In
            </button>
          </form>

          <div class="login-footer">
            <p>Demo: admin@kss.com / admin123</p>
          </div>
        </div>
      </div>
    `;
  },

  handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const user = Store.Auth.login(email, password);
    if (user) {
      document.getElementById('login-error').classList.remove('show');
      App.init();
    } else {
      document.getElementById('login-error').classList.add('show');
    }
  },

  onRoleChange(role) {
    const emailInput = document.getElementById('login-email');
    const pwdInput = document.getElementById('login-password');
    if (!emailInput || !pwdInput) return;

    if (role === 'Admin') {
      emailInput.value = 'admin@kss.com';
      pwdInput.value = 'admin123';
    } else if (role === 'Manager') {
      emailInput.value = 'manager@kss.com';
      pwdInput.value = 'manager123';
    } else if (role === 'Staff') {
      emailInput.value = 'staff@kss.com';
      pwdInput.value = 'staff123';
    }
  }
};
