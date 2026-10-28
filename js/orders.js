const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  fulfilled: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned'
};

const PAYMENT_STATUS_LABELS = {
  paid: 'Paid',
  partial: 'Partially paid',
  unpaid: 'Unpaid',
  refunded: 'Refunded'
};

const ORDER_TIMELINE_STEPS = [
  { key: 'placed', label: 'Order Placed' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'fulfilled', label: 'Delivered' }
];

let myOrders = [];
let orderFilters = { search: '', status: 'all', from: '', to: '' };
let notificationPollTimer = null;

function ordersStepHtml() {
  const statusOptions = Object.entries(ORDER_STATUS_LABELS)
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');
  return `
    <div class="drawer-head">
      <h3 class="display">My Orders</h3>
      <button class="close-btn" id="closeBtn">×</button>
    </div>
    <div class="drawer-body" id="ordersContent">
      <button class="back-link" id="backToAccountBtn">← Back to account</button>
      <div class="ot-filters" id="orderFilters" hidden>
        <input type="search" id="orderSearchInput" placeholder="Search order number or product" aria-label="Search orders">
        <select id="orderStatusFilter" aria-label="Filter by status">
          <option value="all">All statuses</option>
          ${statusOptions}
        </select>
        <label>From <input type="date" id="orderFromDate" aria-label="From date"></label>
        <label>To <input type="date" id="orderToDate" aria-label="To date"></label>
      </div>
      <div id="ordersList" aria-live="polite"><p class="ot-muted">Loading your orders...</p></div>
    </div>`;
}

async function loadOrderHistory() {
  const list = document.getElementById('ordersList');
  if (!list) return;
  orderFilters = { search: '', status: 'all', from: '', to: '' };

  try {
    const response = await fetch(`${API_BASE}/orders`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load orders');
    const data = await response.json();
    myOrders = data.orders || [];
  } catch (error) {
    list.innerHTML = `
      <div class="ot-state ot-state-error" role="alert">
        <p>We couldn't load your orders. Please check your connection and try again.</p>
        <button class="ghost-btn" id="retryOrdersBtn" type="button">Try again</button>
      </div>`;
    document.getElementById('retryOrdersBtn')?.addEventListener('click', loadOrderHistory);
    return;
  }

  const filters = document.getElementById('orderFilters');
  if (filters) filters.hidden = myOrders.length === 0;
  bindOrderFilters();
  renderOrderList();
  checkOrderNotifications();
}

function bindOrderFilters() {
  const bind = (id, key, eventName) => {
    document.getElementById(id)?.addEventListener(eventName, (event) => {
      orderFilters[key] = event.target.value;
      renderOrderList();
    });
  };
  bind('orderSearchInput', 'search', 'input');
  bind('orderStatusFilter', 'status', 'change');
  bind('orderFromDate', 'from', 'change');
  bind('orderToDate', 'to', 'change');
}

function filterOrders(orders, filters) {
  const query = filters.search.trim().toLowerCase().replace(/^#/, '');
  const from = filters.from ? new Date(`${filters.from}T00:00:00`) : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`) : null;
  return orders.filter((order) => {
    if (filters.status !== 'all' && order.status !== filters.status) return false;
    const created = new Date(order.created_at);
    if (from && created < from) return false;
    if (to && created > to) return false;
    if (!query) return true;
    const haystack = [
      String(order.id),
      order.invoice_number || '',
      ...(order.items || []).map((item) => `${item.club || ''} ${item.kit || ''}`)
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });
}

function orderItemLinePrice(item) {
  return Number(item.unitPrice ?? item.unit_price ?? 0) * Number(item.quantity || 0);
}

function formatOrderDate(value, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

function formatEstimatedDelivery(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function orderTimelineHtml(order) {
  const history = order.history || [];
  const reached = new Set(['placed', ...history.map((entry) => entry.status)]);
  const terminal = ['cancelled', 'returned'].includes(order.status) ? order.status : null;
  const stepIndex = (key) => ORDER_TIMELINE_STEPS.findIndex((step) => step.key === key);
  let lastReached = 0;
  ORDER_TIMELINE_STEPS.forEach((step, index) => {
    if (reached.has(step.key)) lastReached = Math.max(lastReached, index);
  });
  const currentIndex = terminal || order.status === 'fulfilled' ? -1 : stepIndex(order.status === 'pending' ? 'pending' : order.status);

  const steps = ORDER_TIMELINE_STEPS.map((step, index) => {
    const state = index < lastReached || (index === lastReached && (terminal || index !== currentIndex))
      ? 'done'
      : index === currentIndex ? 'current' : 'upcoming';
    const entry = history.find((item) => item.status === step.key);
    return `<li class="ot-step ${state}"><span class="ot-dot" aria-hidden="true"></span><span class="ot-step-label">${step.label}</span>${entry ? `<time>${escapeHtml(formatOrderDate(entry.created_at))}</time>` : ''}</li>`;
  });
  if (terminal) {
    const entry = history.find((item) => item.status === terminal);
    steps.push(`<li class="ot-step terminal ${terminal}"><span class="ot-dot" aria-hidden="true"></span><span class="ot-step-label">${ORDER_STATUS_LABELS[terminal]}</span>${entry ? `<time>${escapeHtml(formatOrderDate(entry.created_at))}</time>` : ''}</li>`);
  }
  return `<ol class="ot-timeline" aria-label="Order progress">${steps.join('')}</ol>`;
}

function orderHistoryHtml(order) {
  const entries = order.history || [];
  if (!entries.length) return '';
  return `
    <details class="ot-history">
      <summary>Status history (${entries.length})</summary>
      <ul>
        ${entries.map((entry) => `
          <li>
            <strong>${escapeHtml(ORDER_STATUS_LABELS[entry.status] || entry.status)}</strong>
            <time>${escapeHtml(formatOrderDate(entry.created_at, true))}</time>
            ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
          </li>`).join('')}
      </ul>
    </details>`;
}

function orderCardHtml(order) {
  const items = order.items || [];
  const paymentStatus = order.payment_status || 'unpaid';
  const estimate = formatEstimatedDelivery(order.estimated_delivery);
  const stateNote = order.status === 'cancelled'
    ? '<p class="ot-banner cancelled">This order was cancelled.</p>'
    : order.status === 'returned'
      ? '<p class="ot-banner returned">This order was returned.</p>'
      : '';
  const delivery = order.delivery_method === 'delivery'
    ? `Delivery to ${escapeHtml(order.delivery_address || 'your address')}`
    : 'Pickup at the store';

  return `
    <article class="order-card" data-order-id="${order.id}">
      <div class="order-card-header">
        <span class="order-id">Order #${order.id}</span>
        <span class="order-date">${escapeHtml(formatOrderDate(order.created_at))}</span>
        <span class="order-status ${escapeHtml(order.status)}">${escapeHtml(ORDER_STATUS_LABELS[order.status] || order.status)}</span>
      </div>
      <div class="order-card-body">
        ${stateNote}
        ${orderTimelineHtml(order)}
        ${items.map((item) => `
          <div class="order-item">
            <span>${escapeHtml(item.club)} ${item.kit ? `(${escapeHtml(item.kit)})` : ''} - Size ${escapeHtml(item.size)} × ${Number(item.quantity)}${item.custom ? ` · ${escapeHtml(orderItemCustomLabel(item))}` : ''}</span>
            <span>${CURRENCY} ${orderItemLinePrice(item).toLocaleString()}</span>
          </div>`).join('')}
        ${Number(order.delivery_fee) > 0 ? `<div class="order-item"><span>Delivery fee</span><span>${CURRENCY} ${Number(order.delivery_fee).toLocaleString()}</span></div>` : ''}
        <div class="order-total"><span>Total</span><span>${CURRENCY} ${Number(order.total).toLocaleString()}</span></div>
        <div class="ot-meta">
          <span class="ot-pay ${escapeHtml(paymentStatus)}">${escapeHtml(PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus)}</span>
          <span>${delivery}</span>
          ${estimate ? `<span>Estimated delivery: ${escapeHtml(estimate)}</span>` : ''}
        </div>
        ${orderHistoryHtml(order)}
        <a class="ghost-btn ot-invoice-btn" href="invoice.html?order=${order.id}" target="_blank" rel="noopener">${paymentStatus === 'paid' ? 'View receipt' : 'View invoice'}${order.invoice_number ? ` · ${escapeHtml(order.invoice_number)}` : ''}</a>
      </div>
    </article>`;
}

function renderOrderList() {
  const list = document.getElementById('ordersList');
  if (!list) return;

  if (myOrders.length === 0) {
    list.innerHTML = `
      <div class="empty-orders">
        <div class="display">0-0</div>
        <p>You haven't placed any orders yet.</p>
      </div>`;
    return;
  }

  const visible = filterOrders(myOrders, orderFilters);
  list.innerHTML = visible.length
    ? visible.map(orderCardHtml).join('')
    : '<div class="ot-state"><p>No orders match your search or filters.</p></div>';
}

async function checkOrderNotifications() {
  if (!currentAccount) return;
  try {
    const response = await fetch(`${API_BASE}/notifications`, { credentials: 'include' });
    if (!response.ok) return;
    const { notifications = [] } = await response.json();
    if (!notifications.length) return;
    notifications.forEach((notification) => showSuccess(notification.message));
    await fetch(`${API_BASE}/notifications/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids: notifications.map((notification) => notification.id) })
    });
  } catch {
    // Notifications are best-effort; the order dashboard still shows current status.
  }
}

function startOrderNotificationPolling() {
  if (notificationPollTimer) return;
  checkOrderNotifications();
  notificationPollTimer = setInterval(checkOrderNotifications, 60000);
}
