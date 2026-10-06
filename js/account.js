let accountView = 'login';
let accountMessage = '';
let currentAccount = null;
let pendingVerificationEmail = '';
let accountDraft = { name: '', email: '', phone: '' };

const PAYMENT_PLANS = {
  full: { label: 'Pay in full', due: 1 },
  deposit: { label: '50% deposit', due: 0.5 },
  pickup: { label: 'Pay on pickup', due: 0 }
};

const PAYMENT_METHODS = {
  monime: 'Monime',
  cash: 'Cash on pickup'
};

window.customer = {
  name: '',
  phone: '',
  address: '',
  delivery: 'pickup',
  paymentPlan: 'full',
  paymentMethod: 'monime',
  note: ''
};

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getAuthErrorMessage(error) {
  const message = String(error?.message || 'Authentication failed');
  if (message.toLowerCase().includes('rate limit')) {
    return 'Too many attempts. Please wait a while and try again.';
  }
  return message;
}

async function requestAuth(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallback = response.status === 404
      ? 'Authentication endpoint not found (HTTP 404). The backend route may not be deployed.'
      : response.status >= 500
        ? `Authentication service unavailable (HTTP ${response.status}). Please try again.`
        : `Authentication request failed (HTTP ${response.status}).`;
    throw new Error(data.error || fallback);
  }
  return data;
}

async function restoreServerSession() {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (!response.ok) {
      currentAccount = null;
      updateAccountButton();
      return;
    }
    const data = await response.json();
    currentAccount = data.user;
    window.customer.name = window.customer.name || currentAccount.name;
    updateAccountButton();
  } catch {
    currentAccount = null;
    updateAccountButton();
  }
}

function updateAccountButton() {
  const accountButton = document.getElementById('openAccountBtn');
  if (accountButton) {
    accountButton.textContent = currentAccount ? currentAccount.name.split(' ')[0] : 'Account';
  }
}

function accountStepHtml() {
  if (currentAccount) {
    return `
      <div class="drawer-head">
        <h3 class="display">Your Account</h3>
        <button class="close-btn" id="closeBtn">×</button>
      </div>
      <div class="account-body">
        <div class="account-status">
          <strong>${escapeHtml(currentAccount.name)}</strong>
          <span>${escapeHtml(currentAccount.email || currentAccount.phone || '')}</span>
        </div>
        <p class="account-intro">Your account keeps your details ready for faster checkout.</p>
        <button class="ghost-btn" id="viewOrdersBtn">View Order History</button>
        <button class="primary-btn" id="logoutBtn" style="margin-top: 12px;">Log out</button>
      </div>`;
  }

  return `
    <div class="drawer-head">
      <h3 class="display">${accountView === 'register' ? 'Create Account' : accountView === 'verify-sent' ? 'Confirm Your Email' : 'Welcome Back'}</h3>
      <button class="close-btn" id="closeBtn">×</button>
    </div>
    <form class="account-body" id="accountForm">
      ${accountMessage ? `<p class="account-error" role="alert">${escapeHtml(accountMessage)}</p>` : ''}
      ${accountView === 'register' ? `
        <p class="account-intro">Create your account to track orders and checkout faster.</p>
        <div class="field"><label for="accountName">Full name</label><input id="accountName" type="text" autocomplete="name" value="${escapeHtml(accountDraft.name)}" placeholder="e.g. Ishaka Kallon" required></div>
        <div class="field"><label for="accountEmail">Email</label><input id="accountEmail" type="email" autocomplete="email" value="${escapeHtml(accountDraft.email)}" placeholder="e.g. abu@example.com" required></div>
        <div class="field"><label for="accountPhone">Phone number</label><input id="accountPhone" type="tel" autocomplete="tel" value="${escapeHtml(accountDraft.phone)}" placeholder="e.g. 076 000 000" required></div>
        <div class="field"><label for="accountPassword">Create password</label><input id="accountPassword" type="password" autocomplete="new-password" minlength="6" placeholder="At least 6 characters" required></div>
        <button class="primary-btn" type="submit" id="accountSubmitBtn">Create Account</button>
        <a class="ghost-btn" id="googleSignInBtn" href="${API_BASE}/auth/google" style="text-align:center;text-decoration:none;display:block;">Continue with Google</a>
        <button class="account-switch" id="accountSwitchBtn" type="button">Already have an account? Log in</button>
      ` : accountView === 'verify-sent' ? `
          <p class="account-intro">Your account is awaiting email confirmation for <strong>${escapeHtml(pendingVerificationEmail)}</strong>. Check your inbox and spam folder for the confirmation link. If it hasn’t arrived, request another below.</p>
        <button class="primary-btn" type="button" id="resendVerificationBtn">Resend confirmation email</button>
        <button class="account-switch" id="accountSwitchBtn" type="button">Back to log in</button>
      ` : `
        <p class="account-intro">Log in with your email to continue.</p>
        <div class="field"><label for="accountEmail">Email</label><input id="accountEmail" type="email" autocomplete="username" value="${escapeHtml(accountDraft.email)}" placeholder="e.g. abu@example.com" required></div>
        <div class="field"><label for="accountPassword">Password</label><input id="accountPassword" type="password" autocomplete="current-password" placeholder="Your password" required></div>
        <button class="primary-btn" type="submit" id="accountSubmitBtn">Log In</button>
        <a class="ghost-btn" id="googleSignInBtn" href="${API_BASE}/auth/google" style="text-align:center;text-decoration:none;display:block;">Continue with Google</a>
        <button class="account-switch" id="accountSwitchBtn" type="button">New here? Create account</button>
      `}
    </form>`;
}

function ordersStepHtml() {
  return `
    <div class="drawer-head">
      <h3 class="display">Order History</h3>
      <button class="close-btn" id="closeBtn">×</button>
    </div>
    <div class="drawer-body" id="ordersContent">
      <button class="back-link" id="backToAccountBtn">← Back to account</button>
      <p style="color: var(--ink-soft); font-size: 13px;">Loading your orders...</p>
    </div>`;
}

async function loadOrderHistory() {
  const content = document.getElementById('ordersContent');
  if (!content) return;

  try {
    const response = await fetch(`${API_BASE}/orders`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load orders');
    const data = await response.json();
    renderOrderHistory(content, data.orders || []);
  } catch (error) {
    content.innerHTML = `
      <button class="back-link" id="backToAccountBtn">← Back to account</button>
      <p style="color: var(--error); font-size: 13px;">Unable to load orders. Please try again later.</p>`;
  }
}

function renderOrderHistory(container, orders) {
  if (orders.length === 0) {
    container.innerHTML = `
      <button class="back-link" id="backToAccountBtn">← Back to account</button>
      <div class="empty-orders">
        <div class="display">0-0</div>
        <p>You haven't placed any orders yet.</p>
      </div>`;
    return;
  }
  
  const ordersHtml = orders.map(order => {
    const items = order.items || [];
    const statusClass = order.status || 'pending';
    
    return `
      <div class="order-card">
        <div class="order-card-header">
          <span class="order-id">#${order.id}</span>
          <span class="order-date">${new Date(order.created_at).toLocaleDateString()}</span>
          <span class="order-status ${statusClass}">${order.status || 'pending'}</span>
        </div>
        <div class="order-card-body">
          ${items.map(item => `
            <div class="order-item">
              <span>${item.club} ${item.kit ? `(${item.kit})` : ''} - Size ${item.size} × ${item.quantity}</span>
              <span>${CURRENCY} ${item.unit_price * item.quantity}</span>
            </div>
          `).join('')}
          <div class="order-total">
            <span>Total</span>
            <span>${CURRENCY} ${order.total}</span>
          </div>
        </div>
      </div>`;
  }).join('');
  
  container.innerHTML = `
    <button class="back-link" id="backToAccountBtn">← Back to account</button>
    ${ordersHtml}`;
}

async function saveCheckoutOrder() {
  const items = cart.map(item => {
    const product = getCartProduct(item);
    return {
      product_id: item.custom ? null : product.id,
      club: product.club,
      kit: product.kit,
      size: item.size,
      quantity: item.qty,
      unit_price: product.price,
      custom: Boolean(item.custom),
      custom_name: item.custom ? product.customName || '' : null,
      custom_number: item.custom ? product.number || null : null
    };
  });

  const payload = {
    customerName: window.customer.name.trim(),
    customerPhone: window.customer.phone.trim(),
    deliveryMethod: window.customer.delivery,
    deliveryAddress: window.customer.delivery !== 'pickup' ? window.customer.address.trim() : '',
    paymentMethod: window.customer.paymentMethod,
    paymentPlan: window.customer.paymentPlan,
    note: window.customer.note.trim() || '',
    items
  };

  const response = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save order');
  }

  return await response.json();
}

function paymentPlanLabel() {
  return PAYMENT_PLANS[window.customer.paymentPlan]?.label || 'Full payment';
}

function paymentDue() {
  const dueRate = PAYMENT_PLANS[window.customer.paymentPlan]?.due ?? 1;
  return Math.ceil(grandTotal() * dueRate);
}

function paymentMethodLabel() {
  return PAYMENT_METHODS[window.customer.paymentMethod] || 'Monime';
}
