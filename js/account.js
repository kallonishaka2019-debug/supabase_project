let accountView = 'login';
let accountMessage = '';
let currentAccount = null;
let pendingVerificationEmail = '';
let accountDraft = { name: '', email: '', phone: '' };
let customerOrders = [];
let orderNotifications = [];
const loadedInvoices = new Map();

const PAYMENT_PLANS = {
  full: { label: 'Pay in full', due: 1 },
  deposit: { label: '50% deposit', due: 0.5 },
  pickup: { label: 'Pay on pickup', due: 0 }
};

const PAYMENT_METHODS = {
  monime: 'Monime — Mobile Money, Card or Bank'
};

window.customer = {
  name: '',
  phone: '',
  address: '',
  delivery: 'pickup',
  deliveryTier: 'standard',
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
  if (!accountButton) return;

  accountButton.replaceChildren();
  const avatarUrl = getAccountAvatarUrl(currentAccount);
  const accountLabel = currentAccount
    ? `Open ${currentAccount.name}'s profile`
    : 'Open account';
  if (currentAccount && avatarUrl) {
    const avatar = document.createElement('img');
    avatar.className = 'account-avatar';
    avatar.src = avatarUrl;
    avatar.alt = '';
    avatar.referrerPolicy = 'no-referrer';
    accountButton.appendChild(avatar);
    accountButton.setAttribute('aria-label', accountLabel);
    accountButton.title = accountLabel;
    accountButton.classList.add('has-avatar');
    return;
  }

  accountButton.classList.remove('has-avatar');
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  const head = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  head.setAttribute('cx', '12');
  head.setAttribute('cy', '8');
  head.setAttribute('r', '4');
  const shoulders = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shoulders.setAttribute('d', 'M4 21a8 8 0 0 1 16 0');
  icon.append(head, shoulders);
  accountButton.appendChild(icon);
  accountButton.setAttribute('aria-label', accountLabel);
  accountButton.title = accountLabel;
}

function getAccountAvatarUrl(account) {
  const value = account?.avatar_url || account?.picture;
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function accountStepHtml() {
  if (currentAccount) {
    const isDarkTheme = document.documentElement.dataset.theme === 'dark';
    return `
      <div class="drawer-head">
        <h3 class="display">Your Account</h3>
        <button class="close-btn" id="closeBtn">×</button>
      </div>
      <div class="account-body">
        <div class="account-status">
          ${getAccountAvatarUrl(currentAccount) ? `<img class="account-profile-avatar" src="${escapeHtml(getAccountAvatarUrl(currentAccount))}" alt="" referrerpolicy="no-referrer">` : ''}
          <div class="account-profile-details">
          <strong>${escapeHtml(currentAccount.name)}</strong>
          <span>${escapeHtml(currentAccount.email || currentAccount.phone || '')}</span>
          </div>
        </div>
        <p class="account-intro">Your account keeps your details ready for faster checkout.</p>
        <button class="theme-toggle account-theme-toggle" id="themeToggle" type="button" aria-label="Enable ${isDarkTheme ? 'light' : 'dark'} theme" aria-pressed="${isDarkTheme}">
          <span class="theme-toggle-icon" aria-hidden="true">${isDarkTheme ? '☀' : '☾'}</span>
          <span class="theme-toggle-label">${isDarkTheme ? 'Light' : 'Dark'}</span>
        </button>
        <button class="ghost-btn" id="viewOrdersBtn">My Orders</button>
        <button class="primary-btn" id="logoutBtn" style="margin-top: 12px;">Log out</button>
      </div>`;
  }

  return `
    <div class="drawer-head">
      <h3 class="display">Welcome</h3>
      <button class="close-btn" id="closeBtn">×</button>
    </div>
    <div class="account-body">
      ${accountMessage ? `<p class="account-error" role="alert">${escapeHtml(accountMessage)}</p>` : ''}
      <p class="account-intro">Sign in with your Google account to track orders and checkout faster.</p>
      <a class="primary-btn" id="googleSignInBtn" href="${API_BASE}/auth/google" style="text-align:center;text-decoration:none;display:block;">Continue with Google</a>
    </div>`;
}

function ordersStepHtml() {
  return `
    <div class="drawer-head">
      <h3 class="display">My Orders</h3>
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
    const [ordersResponse, notificationsResponse] = await Promise.all([
      fetch(`${API_BASE}/orders`, { credentials: 'include' }),
      fetch(`${API_BASE}/orders/notifications`, { credentials: 'include' })
    ]);
    if (!ordersResponse.ok) throw new Error('Failed to load orders');
    const [ordersData, notificationsData] = await Promise.all([
      ordersResponse.json(),
      notificationsResponse.ok ? notificationsResponse.json() : Promise.resolve({ notifications: [] })
    ]);
    renderOrderHistory(content, ordersData.orders || [], notificationsData.notifications || []);
  } catch (error) {
    content.innerHTML = `
      <button class="back-link" id="backToAccountBtn">← Back to account</button>
      <p style="color: var(--error); font-size: 13px;" role="alert">Unable to load orders. Please try again.</p>
      <button class="ghost-btn" id="retryOrdersBtn" type="button">Retry</button>`;
    content.onclick = (event) => {
      if (event.target.closest('#retryOrdersBtn')) loadOrderHistory();
      if (event.target.closest('#backToAccountBtn')) {
        drawerMode = 'account';
        renderDrawer();
      }
    };
  }
}

function orderTimelineHtml(order) {
  const stages = [
    ['pending', 'Order placed'],
    ['confirmed', 'Confirmed'],
    ['processed', 'Processing'],
    ['shipped', 'Shipped'],
    ['delivered', 'Delivered']
  ];
  const history = order.status_history || [];
  const normalStages = stages.map(([status]) => status);
  let activeIndex = normalStages.indexOf(order.status);
  if (activeIndex < 0) {
    const latestStage = [...history].reverse().find(entry => normalStages.includes(entry.to_status));
    activeIndex = normalStages.indexOf(latestStage?.to_status || 'pending');
  }
  const specialStatus = ['cancelled', 'returned', 'refunded'].includes(order.status)
    ? `<p class="order-terminal-status ${escapeHtml(order.status)}" role="status">${escapeHtml(order.status[0].toUpperCase() + order.status.slice(1))}</p>`
    : '';
  return `
    ${specialStatus}
    <ol class="order-timeline" aria-label="Order status timeline">
      ${stages.map(([status, label], index) => `
        <li class="${index < activeIndex ? 'complete' : ''} ${index === activeIndex ? 'current' : ''}">
          <span aria-hidden="true">${index < activeIndex ? '✓' : index + 1}</span>
          <span>${label}</span>
        </li>`).join('')}
    </ol>
    <div class="order-history">
      <strong>Status history</strong>
      ${history.map(entry => `
        <p><span>${escapeHtml(entry.to_status)}</span>
          <time datetime="${escapeHtml(entry.created_at)}">${new Date(entry.created_at).toLocaleString()}</time>
          ${entry.note ? `<span class="order-history-note">${escapeHtml(entry.note)}</span>` : ''}
        </p>`).join('')}
    </div>`;
}

function renderOrderCards() {
  const list = document.getElementById('ordersList');
  if (!list) return;
  const query = document.getElementById('orderSearch')?.value.trim().toLowerCase() || '';
  const status = document.getElementById('orderStatusFilter')?.value || 'all';
  const from = document.getElementById('orderDateFrom')?.value || '';
  const to = document.getElementById('orderDateTo')?.value || '';
  const orders = customerOrders.filter(order => {
    const content = [
      order.id,
      order.invoice_number,
      order.status,
      order.customer_name,
      order.delivery_address,
      ...(order.items || []).map(item => `${item.club} ${item.kit} ${item.size} ${orderItemCustomLabel(item)}`)
    ].join(' ').toLowerCase();
    const created = String(order.created_at || '').slice(0, 10);
    return (!query || content.includes(query))
      && (status === 'all' || order.status === status)
      && (!from || created >= from)
      && (!to || created <= to);
  });
  if (!orders.length) {
    list.innerHTML = `<div class="empty-orders"><div class="display">0-0</div><p>${customerOrders.length ? 'No orders match these filters.' : "You haven't placed any orders yet."}</p></div>`;
    return;
  }
  list.innerHTML = orders.map(order => `
    <article class="order-card">
      <div class="order-card-header">
        <strong class="order-id">Order #${escapeHtml(order.id)}</strong>
        <span class="order-date">${new Date(order.created_at).toLocaleDateString()}</span>
        <span class="order-status ${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
      </div>
      <p class="order-delivery">
        ${escapeHtml(order.delivery_method === 'pickup' ? 'Pickup' : 'Delivery')}
        ${order.delivery_address ? ` · ${escapeHtml(order.delivery_address)}` : ''}
        ${order.estimated_delivery_at ? ` · Estimated ${new Date(order.estimated_delivery_at).toLocaleDateString()}` : ''}
      </p>
      <div class="order-card-body">
        ${(order.items || []).map(item => `
          <div class="order-item">
            <span>${escapeHtml(item.club)} ${item.kit ? `(${escapeHtml(item.kit)})` : ''} · Size ${escapeHtml(item.size)} × ${escapeHtml(item.quantity)}${item.custom ? ` · ${escapeHtml(orderItemCustomLabel(item))}` : ''}</span>
            <span>${CURRENCY} ${Number((item.unitPrice ?? item.unit_price) * item.quantity).toLocaleString()}</span>
          </div>`).join('')}
        <div class="order-total"><span>Total</span><strong>${CURRENCY} ${Number(order.total).toLocaleString()}</strong></div>
        <p class="order-payment">Payment: ${escapeHtml(order.payment_method)} · ${escapeHtml(order.payment_plan)} · ${escapeHtml(order.payment_status || 'unknown')} · Paid ${CURRENCY} ${Number(order.paid_amount || 0).toLocaleString()}</p>
        ${order.invoice_number ? `<p class="order-invoice-number">Invoice: ${escapeHtml(order.invoice_number)}</p>` : ''}
      </div>
      ${orderTimelineHtml(order)}
      <div class="order-actions">
        <button class="ghost-btn" type="button" data-invoice="${escapeHtml(order.id)}">Preview invoice</button>
        <button class="ghost-btn" type="button" data-share="whatsapp" data-order-id="${escapeHtml(order.id)}">WhatsApp</button>
        <button class="ghost-btn" type="button" data-share="facebook" data-order-id="${escapeHtml(order.id)}">Facebook</button>
        <button class="ghost-btn" type="button" data-share="x" data-order-id="${escapeHtml(order.id)}">X</button>
        <button class="ghost-btn" type="button" data-share="telegram" data-order-id="${escapeHtml(order.id)}">Telegram</button>
        <button class="ghost-btn" type="button" data-share="copy" data-order-id="${escapeHtml(order.id)}">Copy link</button>
        <button class="ghost-btn" type="button" data-share="native" data-order-id="${escapeHtml(order.id)}">Share…</button>
        <div class="order-share-result" id="shareResult-${escapeHtml(order.id)}" aria-live="polite"></div>
      </div>
    </article>`).join('');
}

function invoiceMarkup(invoice) {
  const money = value => `Le ${Number(value || 0).toLocaleString()}`;
  const rows = invoice.items.map(item => `
    <tr>
      <td>${escapeHtml(item.club)} ${escapeHtml(item.kit)}${item.size ? ` · ${escapeHtml(item.size)}` : ''}</td>
      <td>${escapeHtml(item.quantity)}</td>
      <td>${money(item.unitPrice ?? item.unit_price)}</td>
      <td>${money(Number(item.quantity) * Number(item.unitPrice ?? item.unit_price))}</td>
    </tr>`).join('');
  return `
    <div class="invoice-paper">
      <header><div><h2>${escapeHtml(invoice.store.name)}</h2><p>${escapeHtml(invoice.store.location)}</p></div>
        <div class="invoice-title"><strong>${escapeHtml(invoice.documentType.toUpperCase())}</strong><span>${escapeHtml(invoice.invoiceNumber)}</span></div></header>
      <div class="invoice-customer"><strong>Bill to</strong><p>${escapeHtml(invoice.customer.name)} · ${escapeHtml(invoice.customer.phone)}</p>
        <p>${escapeHtml(invoice.delivery.method)} ${invoice.delivery.address ? `· ${escapeHtml(invoice.delivery.address)}` : ''}</p>
        <p>Issued ${new Date(invoice.issuedAt).toLocaleDateString()}</p></div>
      <table><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <dl class="invoice-totals">
        <div><dt>Subtotal</dt><dd>${money(invoice.subtotal)}</dd></div>
        <div><dt>Discount</dt><dd>− ${money(invoice.discount)}</dd></div>
        <div><dt>Delivery</dt><dd>${money(invoice.shipping)}</dd></div>
        <div><dt>Tax</dt><dd>${money(invoice.tax)}</dd></div>
        <div class="invoice-grand-total"><dt>Total</dt><dd>${money(invoice.total)}</dd></div>
        <div><dt>Paid (${escapeHtml(invoice.paymentStatus)})</dt><dd>${money(invoice.paidAmount)}</dd></div>
        <div><dt>Balance due</dt><dd>${money(invoice.balanceDue)}</dd></div>
      </dl>
      <p>Payment method: ${escapeHtml(invoice.payment.method)} · ${escapeHtml(invoice.payment.plan)}</p>
    </div>`;
}

async function previewOrderInvoice(orderId) {
  const panel = document.getElementById('invoicePreview');
  panel.hidden = false;
  panel.innerHTML = '<p>Loading invoice…</p>';
  try {
    const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/invoice`, { credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to load invoice');
    loadedInvoices.set(String(orderId), data.invoice);
    panel.innerHTML = `
      <div class="invoice-preview-header"><h3>Invoice preview</h3>
        <button class="ghost-btn" type="button" data-print-invoice="${escapeHtml(orderId)}">Print / Save PDF</button>
        <button class="close-btn" type="button" data-close-invoice aria-label="Close invoice preview">×</button></div>
      ${invoiceMarkup(data.invoice)}
      <p class="invoice-share-preview">Share preview: ${escapeHtml(data.invoice.invoiceNumber)} · ${escapeHtml(data.invoice.paymentStatus)} · Le ${Number(data.invoice.total).toLocaleString()}</p>`;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    panel.innerHTML = `<p role="alert">${escapeHtml(error.message)}</p>`;
    showError(error.message);
  }
}

function printOrderInvoice(orderId) {
  const invoice = loadedInvoices.get(String(orderId));
  if (!invoice) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showError('Allow pop-ups to print or save the invoice as a PDF.');
    return;
  }
  printWindow.opener = null;
  printWindow.document.title = invoice.invoiceNumber;
  printWindow.document.write(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(invoice.invoiceNumber)}</title><style>body{font:14px Arial,sans-serif;color:#17212b;margin:28px}.invoice-paper{max-width:760px;margin:auto}.invoice-paper header{display:flex;justify-content:space-between;border-bottom:2px solid #087f68;padding-bottom:16px}.invoice-paper h2{color:#087f68}.invoice-customer{margin:22px 0}.invoice-paper table{width:100%;border-collapse:collapse}.invoice-paper th,.invoice-paper td{text-align:left;padding:9px;border-bottom:1px solid #ddd}.invoice-totals{width:300px;margin:18px 0 18px auto}.invoice-totals div{display:flex;justify-content:space-between;padding:5px}.invoice-totals dd{margin:0}.invoice-grand-total{font-weight:bold;border-top:2px solid #087f68}@media print{body{margin:0}}</style><main>${invoiceMarkup(invoice)}</main></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function copyInvoiceLink(url) {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const temporaryInput = document.createElement('textarea');
    temporaryInput.value = url;
    temporaryInput.setAttribute('readonly', '');
    temporaryInput.style.position = 'fixed';
    temporaryInput.style.opacity = '0';
    document.body.appendChild(temporaryInput);
    temporaryInput.select();
    document.execCommand('copy');
    temporaryInput.remove();
  }
}

async function shareOrderInvoice(orderId, target) {
  const result = document.getElementById(`shareResult-${orderId}`);
  const socialTarget = ['whatsapp', 'facebook', 'x', 'telegram'].includes(target);
  const shareWindow = socialTarget ? window.open('about:blank', '_blank') : null;
  if (shareWindow) shareWindow.opener = null;
  if (result) result.textContent = 'Creating secure, expiring link…';
  try {
    const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/share-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ expiresInHours: 24 })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not create a share link');
    const { url, expiresAt, id } = data.shareLink;
    const preview = `JerseyHub invoice for order #${orderId}. Secure link expires ${new Date(expiresAt).toLocaleString()}: ${url}`;
    if (result) {
      result.innerHTML = `Link expires ${escapeHtml(new Date(expiresAt).toLocaleString())}. <button class="ghost-btn" type="button" data-revoke-share="${escapeHtml(orderId)}:${escapeHtml(id)}">Revoke link</button>`;
    }
    if (target === 'native' && navigator.share) {
      await navigator.share({ title: 'JerseyHub invoice', text: `Invoice summary for order #${orderId}`, url });
    } else if (target === 'whatsapp') {
      if (shareWindow) shareWindow.location = `https://wa.me/?text=${encodeURIComponent(preview)}`;
      else await copyInvoiceLink(url);
    } else if (target === 'facebook') {
      if (shareWindow) shareWindow.location = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      else await copyInvoiceLink(url);
    } else if (target === 'x') {
      if (shareWindow) shareWindow.location = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`JerseyHub invoice #${orderId}`)}&url=${encodeURIComponent(url)}`;
      else await copyInvoiceLink(url);
    } else if (target === 'telegram') {
      if (shareWindow) shareWindow.location = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`JerseyHub invoice #${orderId}`)}`;
      else await copyInvoiceLink(url);
    } else {
      await copyInvoiceLink(url);
      showSuccess('Secure invoice link copied.');
    }
    if (socialTarget && !shareWindow) showInfo('Pop-ups are blocked; the secure link was copied instead.');
  } catch (error) {
    shareWindow?.close();
    if (error.name !== 'AbortError') showError(error.message || 'Unable to share invoice.');
    if (result && error.name !== 'AbortError') result.textContent = error.message;
  }
}

async function revokeOrderShare(orderId, shareId, result) {
  const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/share-links/${encodeURIComponent(shareId)}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Could not revoke share link.');
  if (result) result.textContent = 'Share link revoked.';
  showSuccess('Share link revoked.');
}

function renderOrderHistory(container, orders, notifications = []) {
  customerOrders = orders;
  orderNotifications = notifications;
  container.innerHTML = `
    <button class="back-link" id="backToAccountBtn">← Back to account</button>
    <div class="order-filters">
      <label>Search orders <input type="search" id="orderSearch" placeholder="Order, product or invoice number"></label>
      <label>Status <select id="orderStatusFilter">
        <option value="all">All statuses</option>
        ${['pending', 'confirmed', 'processed', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'].map(status => `<option value="${status}">${status[0].toUpperCase() + status.slice(1)}</option>`).join('')}
      </select></label>
      <label>From <input type="date" id="orderDateFrom"></label>
      <label>To <input type="date" id="orderDateTo"></label>
    </div>
    <section class="order-notifications" aria-label="Order updates">
      <h3>Order updates</h3>
      ${orderNotifications.length ? orderNotifications.map(notification => `
        <p class="${notification.read_at ? '' : 'unread'}">${escapeHtml(notification.message)}
          <time datetime="${escapeHtml(notification.created_at)}">${new Date(notification.created_at).toLocaleString()}</time>
          ${notification.read_at ? '' : `<button class="ghost-btn" type="button" data-read-notification="${escapeHtml(notification.id)}">Mark read</button>`}</p>`).join('') : '<p>No new order updates.</p>'}
    </section>
    <section id="invoicePreview" class="invoice-preview" aria-label="Invoice preview" hidden></section>
    <div id="ordersList" aria-live="polite"></div>`;
  container.oninput = renderOrderCards;
  container.onchange = renderOrderCards;
  container.onclick = async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.id === 'backToAccountBtn') {
      drawerMode = 'account';
      renderDrawer();
    } else if (target.dataset.invoice) {
      previewOrderInvoice(target.dataset.invoice);
    } else if (target.dataset.printInvoice) {
      printOrderInvoice(target.dataset.printInvoice);
    } else if (target.hasAttribute('data-close-invoice')) {
      document.getElementById('invoicePreview').hidden = true;
    } else if (target.dataset.share) {
      shareOrderInvoice(target.dataset.orderId, target.dataset.share);
    } else if (target.dataset.revokeShare) {
      const [orderId, shareId] = target.dataset.revokeShare.split(':');
      try {
        await revokeOrderShare(orderId, shareId, document.getElementById(`shareResult-${orderId}`));
      } catch (error) {
        showError(error.message);
      }
    } else if (target.dataset.readNotification) {
      try {
        const response = await fetch(`${API_BASE}/orders/notifications/${encodeURIComponent(target.dataset.readNotification)}/read`, {
          method: 'POST',
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Could not mark update as read.');
        const notification = orderNotifications.find(item => String(item.id) === target.dataset.readNotification);
        if (notification) notification.read_at = new Date().toISOString();
        renderOrderHistory(container, customerOrders, orderNotifications);
      } catch (error) {
        showError(error.message);
      }
    }
  };
  renderOrderCards();
}

async function saveCheckoutOrder() {
  const items = cart.map(item => {
    const product = getCartProduct(item);
    return {
      product_id: product.id,
      club: product.club,
      kit: product.kit,
      size: item.size,
      quantity: item.qty,
      unit_price: product.price,
      custom: Boolean(item.customized),
      custom_name: item.customized && customMode(item) !== 'number' ? sanitizeCustomName(item.customName).trim() || null : null,
      custom_number: item.customized && customMode(item) !== 'name' ? sanitizeCustomNumber(item.customNumber) || null : null,
      custom_mode: item.customized ? customMode(item) : null
    };
  });

  const payload = {
    customerName: window.customer.name.trim(),
    customerPhone: window.customer.phone.trim(),
    deliveryMethod: window.customer.delivery === 'pickup' ? 'pickup' : window.customer.deliveryTier,
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
  return grandTotal();
}

function paymentMethodLabel() {
  return PAYMENT_METHODS[window.customer.paymentMethod] || 'Monime';
}

function orderItemCustomLabel(item) {
  const name = String(item.customName ?? item.custom_name ?? '').trim();
  const number = String(item.customNumber ?? item.custom_number ?? '').trim();
  return [name, number ? `#${number}` : ''].filter(Boolean).join(' ');
}
