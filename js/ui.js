let selectedSize = {};
let checkoutStep = 'cart';
let drawerMode = 'cart';
let lastOrderNumber = null;

const selectedSizeGlobal = {};

const overlay = document.getElementById('overlay');
const drawer = document.getElementById('drawer');

function openDrawer() {
  drawerMode = 'cart';
  checkoutStep = 'cart';
  renderDrawer();
  overlay.classList.add('open');
  drawer.classList.add('open');
}

function openAccountDrawer() {
  drawerMode = 'account';
  accountMessage = '';
  renderDrawer();
  overlay.classList.add('open');
  drawer.classList.add('open');
}

function closeDrawer() {
  overlay.classList.remove('open');
  drawer.classList.remove('open');
}

function checkoutProgress(activeStep) {
  const steps = [
    ['cart', 'Cart'],
    ['details', 'Details'],
    ['confirm', 'Review / Pay']
  ];
  const activeIndex = steps.findIndex(([step]) => step === activeStep);
  return `<nav class="checkout-progress" aria-label="Checkout progress">
    ${steps.map(([step, label], index) => `<span class="checkout-progress-step ${index < activeIndex ? 'complete' : ''} ${index === activeIndex ? 'active' : ''}" ${index === activeIndex ? 'aria-current="step"' : ''}>
      <span class="checkout-progress-number">${index < activeIndex ? '✓' : index + 1}</span>${label}
    </span>`).join('')}
  </nav>`;
}

function jerseySvg(p, size = 64) {
  const nameText = p.customName ? String(p.customName).slice(0, 12).toUpperCase() : '';
  const fontMap = {
    classic: 'Anton, sans-serif',
    modern: 'Inter, sans-serif',
    bold: 'Anton, sans-serif',
    serif: 'Playfair Display, serif',
    italic: 'Lora, serif',
    script: 'Caveat, cursive',
    sans: 'Roboto, sans-serif'
  };
  const fontFamily = fontMap[p.customStyle] || 'Anton, sans-serif';
  const numberVal = p.customNumber ?? p.number ?? '';
  const nameColor = p.customNameColor || p.stripe || '#000000';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 8 L10 22 L18 38 L28 32 L28 92 L72 92 L72 32 L82 38 L90 22 L70 8 L60 14 Q50 20 40 14 Z"
      fill="${p.color}" stroke="${p.stripe}" stroke-width="3"/>
    ${nameText ? `<text x="50" y="52" font-family="${fontFamily}" font-size="11" fill="${nameColor}" text-anchor="middle" letter-spacing="0.5">${nameText}</text>` : ''}
    ${numberVal !== '' ? `<text x="50" y="${nameText ? 68 : 60}" font-family="${fontFamily}" font-size="26" fill="${nameColor}" text-anchor="middle">${numberVal}</text>` : ''}
  </svg>`;
}

function jerseyVisual(p) {
  if (!p) return '<span class="unavailable-kit">Not available yet</span>';
  if (!p.image) return jerseySvg(p);
  if (p.backImage) {
    return `<span class="jersey-photo-wrap" data-side="front" role="button" tabindex="0" aria-label="Show back view">
      <img class="jersey-photo jersey-photo-front" src="${p.image}" alt="${p.club} ${p.kit} jersey front" loading="lazy" decoding="async" onerror="this.replaceWith(document.createRange().createContextualFragment(jerseySvg(PRODUCTS.find(product => product.id === ${p.id}))))">
      <img class="jersey-photo jersey-photo-back" src="${p.backImage}" alt="${p.club} ${p.kit} jersey back" loading="lazy" decoding="async" onerror="this.remove()">
      <span class="jersey-photo-hint" aria-hidden="true">Tap to see back</span>
    </span>`;
  }
  return `<img class="jersey-photo" src="${p.image}" alt="${p.club} ${p.kit} jersey" loading="lazy" decoding="async" onerror="this.replaceWith(document.createRange().createContextualFragment(jerseySvg(PRODUCTS.find(product => product.id === ${p.id}))))">`;
}

function renderGrid() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  
  const { products } = getPaginatedProducts();
  
  grid.innerHTML = products.map(p => {
    const size = selectedSizeGlobal[p.id] || '';
    const isAvailable = isProductAvailable(p);
    
    return `
      <div class="card">
        ${p.sale ? '<span class="card-sale">Sale</span>' : ''}
        <div class="jersey-art ${p.backImage ? 'has-back' : ''}">${jerseyVisual(p)}</div>
        <div class="card-body">
          <div class="card-title">
            <div class="club" title="${escapeHtml(p.club)}">${escapeHtml(p.club)}</div>
            <div class="kit-type" title="${escapeHtml(p.kit)}">${escapeHtml(p.kit)}</div>
          </div>
          ${isAvailable ? '' : '<span class="availability unavailable">Not available</span>'}
          <div class="size-row" data-product="${p.id}" role="group" aria-label="Choose a size for ${escapeHtml(p.club)} ${escapeHtml(p.kit)}">
            ${SIZES.map(s => `<button class="size-btn ${s === size ? 'active' : ''}" type="button" aria-pressed="${s === size}" data-size="${s}" data-product="${p.id}">${s}</button>`).join('')}
          </div>
          <p class="size-error" data-size-error="${p.id}" aria-live="polite"></p>
          <div class="price-row">
            <span class="price">${CURRENCY} ${p.price}${p.sale ? `<span class="strike">${CURRENCY} ${p.sale}</span>` : ''}</span>
          </div>
          <button class="add-btn ${isAvailable ? '' : 'request-btn'}" type="button" data-add="${p.id}">${isAvailable ? 'Add to cart' : 'Order this kit'}</button>
        </div>
      </div>`;
  }).join('');
  
}

function renderDrawer() {
  const content = document.getElementById('drawerContent');
  if (!content) return;
  
  if (drawerMode === 'account') {
    content.innerHTML = accountStepHtml();
  } else if (drawerMode === 'orders') {
    content.innerHTML = ordersStepHtml();
  } else if (checkoutStep === 'cart') {
    content.innerHTML = cartStepHtml();
  } else if (checkoutStep === 'details') {
    content.innerHTML = detailsStepHtml();
  } else if (checkoutStep === 'confirm') {
    content.innerHTML = confirmStepHtml();
  } else if (checkoutStep === 'payment') {
    content.innerHTML = paymentStepHtml();
  }
  
  bindDrawerEvents();
}

function refreshCartTotals() {
  cart.forEach(item => {
    const p = getCartProduct(item);
    const linePrice = document.querySelector(`[data-line-price="${item.productId}"][data-size="${item.size}"]`);
    if (p && linePrice) linePrice.textContent = `${CURRENCY} ${p.price * item.qty}`;
  });
  const subtotal = document.getElementById('cartSubtotal');
  if (subtotal) subtotal.textContent = `${CURRENCY} ${cartTotal()}`;
  const total = document.getElementById('cartGrandTotal');
  if (total) total.textContent = `${CURRENCY} ${grandTotal()}`;
}

function cartStepHtml() {
  if (cart.length === 0) {
    return `
      <div class="drawer-head">
        <h3 class="display">Your Cart</h3>
        <button class="close-btn" id="closeBtn">×</button>
      </div>
      ${checkoutProgress('cart')}
      <div class="empty-cart">
        <div class="display">0-0</div>
        <p>Nothing in the squad yet.<br>Add a jersey to get started.</p>
      </div>`;
  }
  
  const rows = cart.map(item => {
    const p = getCartProduct(item);
    const isAvailable = isProductAvailable(p);
    const itemPrice = p ? p.price * item.qty : 0;
    const mode = customMode(item);
    const modeKey = `${item.productId}-${item.size}`;
    const modeOptions = [['name', 'Name only'], ['number', 'Number only'], ['both', 'Name &amp; number']].map(([value, label]) => `
                <label class="radio-opt ${mode === value ? 'active' : ''}">
                  <input type="radio" name="customMode-${modeKey}" value="${value}" ${mode === value ? 'checked' : ''} data-custom-mode="${item.productId}" data-size="${item.size}"> ${label}
                </label>`).join('');
    return `
      <div class="line-item ${isAvailable ? '' : 'line-item-unavailable'}">
        <div class="li-thumb">${jerseyVisual(p)}</div>
        <div class="li-info">
          <div class="li-club">${p.club}</div>
          <div class="li-meta">Size ${item.size} · ${p.kit}</div>
          <div class="li-status ${isAvailable ? 'available' : 'unavailable'}">${isAvailable ? 'Available' : 'order request'}</div>
          <div class="li-controls">
            <button class="qty-btn" data-qty-down="${item.productId}" data-size="${item.size}">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" data-qty-up="${item.productId}" data-size="${item.size}">+</button>
            <button class="li-remove" data-remove="${item.productId}" data-size="${item.size}">Remove</button>
          </div>
        </div>
        <div class="li-price" data-line-price="${item.productId}" data-size="${item.size}">${CURRENCY} ${itemPrice}</div>
        <div class="li-custom ${item.customized ? 'active' : ''}">
          <button class="li-custom-toggle-btn" type="button" data-customize-toggle="${item.productId}" data-size="${item.size}">
            ${item.customized ? 'Remove customization' : `Customize with name &amp; number (${CURRENCY} ${CUSTOM_PRICE_PER_LETTER} per letter · ${CURRENCY} ${CUSTOM_PRICE_PER_DIGIT} per digit)`}
          </button>
          ${item.customized ? `
            <div class="radio-row li-custom-modes">${modeOptions}
            </div>
            <div class="li-custom-fields">
              ${mode !== 'number' ? `<div class="li-custom-field">
                <label for="customName-${item.productId}-${item.size}">Name</label>
                <input id="customName-${item.productId}-${item.size}" type="text" maxlength="${CUSTOM_NAME_MAX_LENGTH}" placeholder="e.g. KAMARA" value="${escapeHtml(item.customName)}" data-custom-field="customName" data-custom-id="${item.productId}" data-size="${item.size}" autocomplete="off">
              </div>` : ''}
              ${mode !== 'name' ? `<div class="li-custom-field li-custom-number">
                <label for="customNumber-${item.productId}-${item.size}">Number</label>
                <input id="customNumber-${item.productId}-${item.size}" type="text" inputmode="numeric" maxlength="${CUSTOM_NUMBER_MAX_LENGTH}" placeholder="0-99" value="${escapeHtml(item.customNumber)}" data-custom-field="customNumber" data-custom-id="${item.productId}" data-size="${item.size}" autocomplete="off">
              </div>` : ''}
            </div>
            <p class="li-custom-note" data-custom-breakdown="${item.productId}" data-size="${item.size}">${escapeHtml(customizationBreakdownText(item))}</p>
            ${item.qty > 1 ? `<p class="li-custom-note">Applies to all ${item.qty} jerseys on this line.</p>` : ''}` : ''}
        </div>
      </div>`;
  }).join('');
  
  return `
    <div class="drawer-head">
      <h3 class="display">Your Cart</h3>
      <button class="close-btn" id="closeBtn">×</button>
    </div>
    ${checkoutProgress('cart')}
    <div class="drawer-body">${rows}</div>
    <div class="drawer-foot">
      <div class="subtotal-row"><span>Items</span><span>${cartItemCount()}</span></div>
      <div class="subtotal-row"><span>Subtotal</span><span id="cartSubtotal">${CURRENCY} ${cartTotal()}</span></div>
      ${window.customer?.delivery !== 'pickup' ? `<div class="subtotal-row"><span>Delivery</span><span>${CURRENCY} ${deliveryCost()}</span></div>` : ''}
      <div class="total-row"><span>Total</span><span class="display" id="cartGrandTotal">${CURRENCY} ${grandTotal()}</span></div>
      <button class="primary-btn" id="toDetailsBtn">Checkout</button>
    </div>`;
}

function detailsStepHtml() {
  const isDelivery = window.customer?.delivery === 'delivery';
  const deliveryOptionsHtml = `
    <label class="radio-opt ${!isDelivery ? 'active' : ''}">
      <input type="radio" name="deliveryType" value="pickup" ${!isDelivery ? 'checked' : ''}> Pickup (Free)
    </label>
    <label class="radio-opt ${isDelivery ? 'active' : ''}">
      <input type="radio" name="deliveryType" value="delivery" ${isDelivery ? 'checked' : ''}> Delivery
    </label>`;
  const deliveryTierHtml = Object.entries(DELIVERY_OPTIONS)
    .filter(([key]) => key !== 'pickup')
    .sort((a, b) => a[1].cost - b[1].cost)
    .map(([key, opt]) => `<option value="${key}" ${window.customer?.deliveryTier === key ? 'selected' : ''}>${key.charAt(0).toUpperCase() + key.slice(1)} — ${CURRENCY} ${opt.cost} (${opt.estimatedDays})</option>`)
    .join('');
  
  return `
    <div class="drawer-head">
      <h3 class="display">Checkout</h3>
      <button class="close-btn" id="closeBtn">×</button>
    </div>
    <div class="drawer-body">
      ${checkoutProgress('details')}
      <button class="back-link" id="backToCartBtn">← Back to cart</button>
      
      <div class="field">
        <label for="fName">Full name</label>
        <input id="fName" type="text" autocomplete="name" value="${escapeHtml(window.customer?.name || '')}" placeholder="Full name" required>
      </div>
      <div class="field">
        <label for="fPhone">Phone</label>
        <input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" value="${escapeHtml(window.customer?.phone || '')}" placeholder="e.g. 076 000 000" required>
      </div>
      <div class="field">
        <label>Delivery method</label>
        <div class="radio-row payment-row">
          ${deliveryOptionsHtml}
        </div>
      </div>
      <div class="field" id="pickupField" style="${isDelivery ? 'display:none;' : ''}">
        <label>Pickup address</label>
        <div class="payment-action"><span>${DELIVERY_OPTIONS.pickup.address}</span></div>
      </div>
      <div class="field" id="tierField" style="${isDelivery ? '' : 'display:none;'}">
        <label for="fDeliveryTier">Delivery cost</label>
        <select id="fDeliveryTier">${deliveryTierHtml}</select>
      </div>
      <div class="field" id="addressField" style="${isDelivery ? '' : 'display:none;'}">
        <label for="fAddress">Delivery address *</label>
        <textarea id="fAddress" autocomplete="street-address" placeholder="Street, area, landmark">${escapeHtml(window.customer?.address || '')}</textarea>
      </div>
      <div class="summary-block checkout-order-summary">
        <strong>Order summary</strong>
        ${cart.map(item => {
          const p = getCartProduct(item);
          return `<div class="li-row"><span>${escapeHtml(p.club)} (${item.size}) ×${item.qty}</span><span>${CURRENCY} ${p.price * item.qty}</span></div>`;
        }).join('')}
        <div class="li-row"><span>Subtotal</span><span>${CURRENCY} ${cartTotal()}</span></div>
        <div class="li-row"><span>Delivery</span><span>${CURRENCY} ${deliveryCost()}</span></div>
        <div class="li-row summary-total"><span>Total</span><span>${CURRENCY} ${grandTotal()}</span></div>
      </div>
    </div>
    <div class="drawer-foot">
      <div class="total-row"><span>Total</span><span class="display">${CURRENCY} ${grandTotal()}</span></div>
      <button class="primary-btn" id="toConfirmBtn">Review order</button>
    </div>`;
}

function confirmStepHtml() {
  if (lastOrderNumber) {
    return `
      <div class="drawer-head">
        <h3 class="display">Order added</h3>
        <button class="close-btn" id="closeBtn">×</button>
      </div>
      <div class="drawer-body">
        ${checkoutProgress('confirm')}
        <div class="confirm-icon">✓</div>
        <div class="order-num">#${lastOrderNumber}</div>
        <p style="color:var(--ink-soft); font-size:14px; margin-bottom:20px; line-height:1.6;">
          Your order has been placed and is now visible to our team for processing.
        </p>
        <div class="summary-block">
          ${cart.map(item => {
            const p = getCartProduct(item);
            const label = item.customized ? `${p.club} · ${escapeHtml(customizationLabel(item))}` : `${p.club}`;
            const fee = itemCustomizationFee(item);
            return `<div class="li-row"><span>${label} (${item.size}) ×${item.qty}${fee ? ` · incl. customization ${CURRENCY} ${fee * item.qty}` : ''}</span><span>${CURRENCY} ${p.price * item.qty}</span></div>`;
          }).join('')}
          <div class="li-row" style="font-weight:800; border-top:1px solid var(--line); margin-top:6px; padding-top:8px;">
            <span>Total</span><span>${CURRENCY} ${grandTotal()}</span>
          </div>
          <div class="li-row"><span>Payment method</span><span>${paymentMethodLabel()}</span></div>
        </div>
        ${window.customer?.paymentMethod === 'monime' ? `<div class="payment-action"><span>Transfer to ${MONIME_RECIPIENT}</span><button class="copy-recipient-btn" id="copyRecipientBtn" type="button">Copy number</button></div>` : ''}
      </div>
      <div class="drawer-foot">
        <button class="ghost-btn" id="newOrderBtn">Start a new order</button>
      </div>`;
  }
  
  return `
    <div class="drawer-head">
      <h3 class="display">Review Order</h3>
      <button class="close-btn" id="closeBtn">×</button>
    </div>
    <div class="drawer-body">
      ${checkoutProgress('confirm')}
      <button class="back-link" id="backToDetailsBtn">← Back to details</button>
      <div class="summary-block">
        ${cart.map(item => {
          const p = getCartProduct(item);
          const label = item.customized ? `${p.club} · ${escapeHtml(customizationLabel(item))}` : `${p.club}`;
            const fee = itemCustomizationFee(item);
          return `<div class="li-row"><span>${label} (${item.size}) ×${item.qty}${fee ? ` · incl. customization ${CURRENCY} ${fee * item.qty}` : ''}</span><span>${CURRENCY} ${p.price * item.qty}</span></div>`;
        }).join('')}
        <div class="li-row" style="font-weight:800; border-top:1px solid var(--line); margin-top:6px; padding-top:8px;">
          <span>Total</span><span>${CURRENCY} ${grandTotal()}</span>
        </div>
      </div>
      <div class="summary-block">
        <div class="li-row"><span>Name</span><span>${escapeHtml(window.customer?.name || '—')}</span></div>
        <div class="li-row"><span>Phone</span><span>${escapeHtml(window.customer?.phone || '—')}</span></div>
        <div class="li-row"><span>Delivery</span><span style="text-transform:capitalize;">${window.customer?.delivery || 'pickup'}</span></div>
        ${window.customer?.delivery !== 'pickup' ? `<div class="li-row"><span>Address</span><span>${escapeHtml(window.customer?.address || '—')}</span></div>` : `<div class="li-row"><span>Pickup address</span><span>${escapeHtml(DELIVERY_OPTIONS.pickup.address)}</span></div>`}
        ${window.customer?.delivery === 'delivery' ? `<div class="li-row"><span>Delivery cost</span><span>${CURRENCY} ${deliveryCost()}</span></div>` : ''}
      </div>
    </div>
    <div class="drawer-foot">
      <button class="primary-btn" id="toPaymentBtn">Continue to payment</button>
    </div>`;
}

function paymentStepHtml() {
  if (lastOrderNumber) return confirmStepHtml();

  return `
    <div class="drawer-head">
      <h3 class="display">Make Payment</h3>
      <button class="close-btn" id="closeBtn">×</button>
    </div>
    <div class="drawer-body">
      ${checkoutProgress('confirm')}
      <button class="back-link" id="backToReviewBtn">← Back to review</button>
      <div class="field">
        <label>Payment method</label>
        <div class="payment-method-card">
          <span class="payment-method-mark" aria-hidden="true">M</span>
          <span>
            <strong>Monime</strong>
            <small>Mobile Money, card or bank</small>
          </span>
          <span class="payment-method-check" aria-label="Selected">✓</span>
        </div>
      </div>
      <p class="payment-error" id="paymentError" role="alert" aria-live="assertive"></p>
    </div>
    <div class="drawer-foot">
      <div class="total-row"><span>Total</span><span class="display">${CURRENCY} ${grandTotal()}</span></div>
      <button class="primary-btn" id="placeOrderBtn">Make payment</button>
    </div>`;
}
