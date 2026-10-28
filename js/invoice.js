const INVOICE_CURRENCY = 'Le';
const invoiceParams = new URLSearchParams(window.location.search);
const invoiceOrderId = /^\d+$/.test(invoiceParams.get('order') || '') ? invoiceParams.get('order') : null;
const sharedToken = (/^#share=([A-Za-z0-9_-]{43})$/.exec(window.location.hash) || [])[1] || null;
let currentInvoice = null;

function invMoney(value) {
  return `${INVOICE_CURRENCY} ${Number(value || 0).toLocaleString()}`;
}

function invDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function invoiceApiPath(suffix = '') {
  return sharedToken
    ? `${API_BASE}/invoices/shared/${sharedToken}${suffix}`
    : `${API_BASE}/orders/${invoiceOrderId}/invoice${suffix}`;
}

function showInvoiceState(message, isError = false) {
  document.getElementById('invoiceRoot').innerHTML = `<p class="inv-state ${isError ? 'error' : ''}" role="${isError ? 'alert' : 'status'}">${escapeHtml(message)}</p>`;
}

function renderInvoice(invoice) {
  const isReceipt = invoice.documentType === 'receipt';
  const paymentLabels = { paid: 'PAID', partial: 'PARTIALLY PAID', unpaid: 'UNPAID', refunded: 'REFUNDED' };
  const status = invoice.payment.status;
  const rows = invoice.lines.map((line) => `
    <tr>
      <td>${escapeHtml(line.description)}${line.size ? ` · Size ${escapeHtml(line.size)}` : ''}${line.customization ? `<br><small>${escapeHtml(line.customization)}</small>` : ''}</td>
      <td>${line.quantity}</td>
      <td>${invMoney(line.unitPrice)}</td>
      <td>${invMoney(line.lineTotal)}</td>
    </tr>`).join('');
  const store = invoice.store;

  document.title = `${isReceipt ? 'Receipt' : 'Invoice'} ${invoice.invoiceNumber} · JerseyHub`;
  document.getElementById('invoiceRoot').innerHTML = `
    <article class="inv-sheet">
      <div class="inv-head">
        <div class="inv-store">
          <h1 class="display">${escapeHtml(store.name)}</h1>
          <p>${escapeHtml(store.address)}</p>
          <p>${escapeHtml(store.phone)}</p>
          ${store.email ? `<p>${escapeHtml(store.email)}</p>` : ''}
        </div>
        <div class="inv-meta">
          <h1 class="display">${isReceipt ? 'RECEIPT' : 'INVOICE'}</h1>
          <p><strong>${escapeHtml(invoice.invoiceNumber)}</strong></p>
          <p>Issued: ${escapeHtml(invDate(invoice.issuedAt))}</p>
          ${invoice.paidAt ? `<p>Paid: ${escapeHtml(invDate(invoice.paidAt))}</p>` : ''}
          <span class="inv-badge ${escapeHtml(status)}">${escapeHtml(paymentLabels[status] || status)}</span>
        </div>
      </div>
      <div class="inv-parties">
        <div>
          <h2>Billed to</h2>
          <p><strong>${escapeHtml(invoice.customer.name)}</strong></p>
          ${invoice.customer.phone ? `<p>${escapeHtml(invoice.customer.phone)}</p>` : ''}
        </div>
        <div>
          <h2>Order</h2>
          <p>${invoice.orderId ? `Order #${escapeHtml(invoice.orderId)} · ` : ''}${escapeHtml(invDate(invoice.orderDate))}</p>
          <p>${invoice.delivery.method === 'delivery' ? 'Home delivery' : 'Pickup'}${invoice.delivery.address ? ` · ${escapeHtml(invoice.delivery.address)}` : ''}</p>
          ${invoice.delivery.estimatedDelivery ? `<p>Estimated delivery: ${escapeHtml(invDate(`${invoice.delivery.estimatedDelivery}T00:00:00`))}</p>` : ''}
        </div>
      </div>
      <div class="inv-table-wrap">
        <table class="inv-table">
          <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="inv-totals">
        <div><span>Subtotal</span><span>${invMoney(invoice.subtotal)}</span></div>
        ${invoice.discount > 0 ? `<div><span>Discount</span><span>- ${invMoney(invoice.discount)}</span></div>` : ''}
        <div><span>Delivery fee</span><span>${invMoney(invoice.deliveryFee)}</span></div>
        ${invoice.tax > 0 ? `<div><span>Tax</span><span>${invMoney(invoice.tax)}</span></div>` : ''}
        <div class="grand"><span>Total</span><span>${invMoney(invoice.total)}</span></div>
        <div><span>Amount paid</span><span>${invMoney(invoice.payment.amountPaid)}</span></div>
        <div><span>Balance due</span><span>${invMoney(invoice.payment.balanceDue)}</span></div>
      </div>
      <p class="inv-note">${isReceipt ? 'Thank you for your payment.' : 'Payment is pending. Please settle the balance due to complete your order.'}</p>
    </article>`;
}

async function loadInvoice() {
  if (!invoiceOrderId && !sharedToken) {
    showInvoiceState('No invoice was specified.', true);
    return;
  }
  try {
    const response = await fetch(invoiceApiPath(), { credentials: sharedToken ? 'omit' : 'include' });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      showInvoiceState('Please log in on the JerseyHub store, then reopen this invoice from My Orders.', true);
      return;
    }
    if (!response.ok) {
      showInvoiceState(data.error || 'We could not load this invoice.', true);
      return;
    }
    currentInvoice = data.invoice;
    renderInvoice(currentInvoice);
    document.getElementById('invToolbar').hidden = false;
    if (!sharedToken) initSharePanel();
  } catch {
    showInvoiceState('We could not load this invoice. Please check your connection and try again.', true);
  }
}

async function downloadInvoicePdf() {
  const button = document.getElementById('downloadBtn');
  button.disabled = true;
  try {
    const response = await fetch(invoiceApiPath('/pdf'), { credentials: sharedToken ? 'omit' : 'include' });
    if (!response.ok) throw new Error('PDF failed');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentInvoice.invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showSuccess('Invoice PDF downloaded.');
  } catch {
    showError('Could not download the PDF. Please try again.');
  } finally {
    button.disabled = false;
  }
}

// --- Sharing (owner only) ---

function shareSummaryText(invoice) {
  const status = { paid: 'paid', partial: 'partially paid', unpaid: 'unpaid', refunded: 'refunded' }[invoice.payment.status] || '';
  return `JerseyHub ${invoice.documentType} ${invoice.invoiceNumber} - total ${invMoney(invoice.total)} (${status})`;
}

function socialShareLinks(url, text) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['X', `https://x.com/intent/post?text=${t}&url=${u}`],
    ['Telegram', `https://t.me/share/url?url=${u}&text=${t}`]
  ];
}

function initSharePanel() {
  const panel = document.getElementById('sharePanel');
  panel.hidden = false;
  panel.innerHTML = `
    <h2 class="display">Share invoice</h2>
    <p class="inv-privacy">Sharing creates a private link that shows this invoice without your phone number or address. It expires automatically and you can revoke it at any time.</p>
    <div class="inv-share-row">
      <label for="shareExpiry">Link expires in</label>
      <select id="shareExpiry">
        <option value="1">1 hour</option>
        <option value="24" selected>24 hours</option>
        <option value="72">3 days</option>
        <option value="168">7 days</option>
        <option value="720">30 days</option>
      </select>
      <button class="primary-btn" id="createShareBtn" type="button">Create secure link</button>
    </div>
    <div id="shareResult"></div>
    <div id="shareLinks"></div>`;
  document.getElementById('createShareBtn').addEventListener('click', createShareLink);
  loadShareLinks();
}

async function createShareLink() {
  const button = document.getElementById('createShareBtn');
  const result = document.getElementById('shareResult');
  button.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/orders/${invoiceOrderId}/invoice/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ expiresInHours: Number(document.getElementById('shareExpiry').value) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not create the link');
    renderSharePreview(data.share);
    loadShareLinks();
    showSuccess('Secure share link created.');
  } catch (error) {
    result.innerHTML = '';
    showError(error.message);
  } finally {
    button.disabled = false;
  }
}

function renderSharePreview(share) {
  const text = shareSummaryText(currentInvoice);
  const socials = socialShareLinks(share.url, text)
    .map(([name, href]) => `<a class="share-btn" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${name}</a>`)
    .join('');
  const result = document.getElementById('shareResult');
  result.innerHTML = `
    <div class="inv-preview">
      <strong>Preview</strong>
      <p>${escapeHtml(text)}</p>
      <p>Link valid until ${escapeHtml(new Date(share.expires_at).toLocaleString())}</p>
    </div>
    <div class="inv-share-row">
      <input type="text" id="shareUrl" readonly value="${escapeHtml(share.url)}" aria-label="Share link">
      <button type="button" id="copyShareBtn">Copy link</button>
      ${typeof navigator.share === 'function' ? '<button type="button" id="nativeShareBtn">Share…</button>' : ''}
    </div>
    <div class="inv-share-row">${socials}</div>`;

  document.getElementById('copyShareBtn').addEventListener('click', async () => {
    const input = document.getElementById('shareUrl');
    try {
      await navigator.clipboard.writeText(share.url);
      showSuccess('Link copied to clipboard.');
    } catch {
      input.focus();
      input.select();
      showInfo('Press Ctrl+C (or long-press) to copy the selected link.');
    }
  });
  document.getElementById('nativeShareBtn')?.addEventListener('click', async () => {
    try {
      await navigator.share({ title: `Invoice ${currentInvoice.invoiceNumber}`, text, url: share.url });
    } catch {
      // The user dismissed the share sheet; the copy and social buttons remain available.
    }
  });
}

async function loadShareLinks() {
  const container = document.getElementById('shareLinks');
  try {
    const response = await fetch(`${API_BASE}/orders/${invoiceOrderId}/invoice/shares`, { credentials: 'include' });
    if (!response.ok) throw new Error('failed');
    const { shares } = await response.json();
    container.innerHTML = shares.length
      ? `<p><strong>Active links</strong></p>
         <ul class="inv-links">${shares.map((share) => `
           <li><span>Expires ${escapeHtml(new Date(share.expires_at).toLocaleString())} · opened ${Number(share.access_count)}×</span>
           <button type="button" data-revoke="${escapeHtml(share.id)}">Revoke</button></li>`).join('')}</ul>
         <button type="button" id="revokeAllBtn">Revoke all links</button>`
      : '';
    container.querySelectorAll('[data-revoke]').forEach((button) => {
      button.addEventListener('click', () => revokeShare(button.dataset.revoke));
    });
    document.getElementById('revokeAllBtn')?.addEventListener('click', () => revokeShare(''));
  } catch {
    container.innerHTML = '<p class="inv-state error">Could not load your share links.</p>';
  }
}

async function revokeShare(shareId) {
  try {
    const response = await fetch(`${API_BASE}/orders/${invoiceOrderId}/invoice/shares${shareId ? `/${shareId}` : ''}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('failed');
    document.getElementById('shareResult').innerHTML = '';
    showSuccess('Share link revoked.');
    loadShareLinks();
  } catch {
    showError('Could not revoke the link. Please try again.');
  }
}

document.getElementById('printBtn').addEventListener('click', () => window.print());
document.getElementById('downloadBtn').addEventListener('click', downloadInvoicePdf);
loadInvoice();
