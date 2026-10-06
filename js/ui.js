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
  const numberVal = p.customNumber || p.number || '';
  const nameColor = p.customNameColor || p.stripe || '#000000';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 8 L10 22 L18 38 L28 32 L28 92 L72 92 L72 32 L82 38 L90 22 L70 8 L60 14 Q50 20 40 14 Z"
      fill="${p.color}" stroke="${p.stripe}" stroke-width="3"/>
    ${nameText ? `<text x="50" y="52" font-family="${fontFamily}" font-size="11" fill="${nameColor}" text-anchor="middle" letter-spacing="0.5">${nameText}</text>` : ''}
    ${numberVal ? `<text x="50" y="${nameText ? 68 : 60}" font-family="${fontFamily}" font-size="26" fill="${nameColor}" text-anchor="middle">${numberVal}</text>` : ''}
  </svg>`;
}

function jerseyVisual(p) {
  if (!p) return '<span class="unavailable-kit">Not available yet</span>';
  if (!p.image) return jerseySvg(p);
  if (p.backImage) {
    return `<span class="jersey-photo-wrap">
      <img class="jersey-photo jersey-photo-front" src="${p.image}" alt="${p.club} ${p.kit} jersey front" loading="lazy" onerror="this.replaceWith(document.createRange().createContextualFragment(jerseySvg(PRODUCTS.find(product => product.id === ${p.id}))))">
      <img class="jersey-photo jersey-photo-back" src="${p.backImage}" alt="${p.club} ${p.kit} jersey back" loading="lazy" onerror="this.remove()">
    </span>`;
  }
  return `<img class="jersey-photo" src="${p.image}" alt="${p.club} ${p.kit} jersey" loading="lazy" onerror="this.replaceWith(document.createRange().createContextualFragment(jerseySvg(PRODUCTS.find(product => product.id === ${p.id}))))">`;
}

function renderGrid() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  
  const { products } = getPaginatedProducts();
  
  grid.innerHTML = products.map(p => {
    const size = selectedSizeGlobal[p.id] || 'M';
    const availability = getProductAvailability(p);
    const isAvailable = isProductAvailable(p);
    const inWishlist = isInWishlist(p.id);
    
    return `
      <div class="card">
        <span class="card-num">#${String(p.id).padStart(2, '0')}</span>
        <span class="availability ${isAvailable ? 'available' : 'unavailable'}">${availability}</span>
        ${p.sale ? '<span class="card-sale">Sale</span>' : ''}
        <button class="wishlist-btn ${inWishlist ? 'active' : ''}" data-wishlist="${p.id}" title="${inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}">${inWishlist ? '♥' : '♡'}</button>
        <div class="jersey-art ${p.backImage ? 'has-back' : ''}">${jerseyVisual(p)}</div>
        <div class="card-body">
          <div>
            <div class="club">${p.club}</div>
            <div class="kit-type">${p.kit}</div>
          </div>
          <div class="size-row" data-product="${p.id}">
            ${SIZES.map(s => `<button class="size-btn ${s === size ? 'active' : ''}" data-size="${s}" data-product="${p.id}">${s}</button>`).join('')}
          </div>
          <div class="price-row">
            <span class="price">${CURRENCY} ${p.price}${p.sale ? `<span class="strike">${CURRENCY} ${p.sale}</span>` : ''}</span>
          </div>
          <button class="add-btn ${isAvailable ? '' : 'request-btn'}" data-add="${p.id}">${isAvailable ? 'Add to cart' : 'Order this kit'}</button>
        </div>
      </div>`;
  }).join('');
  
  grid.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSizeGlobal[btn.dataset.product] = btn.dataset.size;
      renderGrid();
    });
  });
  
  grid.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.add);
      const size = selectedSizeGlobal[id] || 'M';
      addToCart(id, size);
      btn.textContent = 'Added ✓';
      btn.classList.add('added');
      setTimeout(() => {
        btn.textContent = btn.classList.contains('request-btn') ? 'Order this kit' : 'Add to cart';
        btn.classList.remove('added');
      }, 1100);
    });
  });
  
  grid.querySelectorAll('[data-wishlist]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWishlist(Number(btn.dataset.wishlist));
    });
  });
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

function cartStepHtml() {
  if (cart.length === 0) {
    return `
      <div class="drawer-head">
        <h3 class="display">Your Cart</h3>
        <button class="close-btn" id="closeBtn">×</button>
      </div>
      <div class="empty-cart">
        <div class="display">0-0</div>
        <p>Nothing in the squad yet.<br>Add a jersey to get started.</p>
      </div>`;
  }
  
  const rows = cart.map(item => {
    const p = getCartProduct(item);
    const label = item.custom ? `${p.club} • Custom` : p.club;
    const isAvailable = isProductAvailable(p);
    const itemPrice = p ? p.price * item.qty : 0;
    return `
      <div class="line-item ${isAvailable ? '' : 'line-item-unavailable'}">
        <div class="li-thumb">${jerseyVisual(p)}</div>
        <div class="li-info">
          <div class="li-club">${label}</div>
          <div class="li-meta">Size ${item.size} · ${item.custom ? `${p.kit} · ${p.customName}` : p.kit}</div>
          <div class="li-status ${isAvailable ? 'available' : 'unavailable'}">${isAvailable ? 'Available' : 'order request'}</div>
          <div class="li-controls">
            <button class="qty-btn" data-qty-down="${item.productId}" data-size="${item.size}">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" data-qty-up="${item.productId}" data-size="${item.size}">+</button>
            <button class="li-remove" data-remove="${item.productId}" data-size="${item.size}">Remove</button>
          </div>
        </div>
        <div class="li-price">${CURRENCY} ${itemPrice}</div>
      </div>`;
  }).join('');
  
  return `
    <div class="drawer-head">
      <h3 class="display">Your Cart</h3>
      <button class="close-btn" id="closeBtn">×</button>
    </div>
    <div class="drawer-body">${rows}</div>
    <div class="drawer-foot">
      <div class="subtotal-row"><span>Items</span><span>${cartItemCount()}</span></div>
      <div class="subtotal-row"><span>Subtotal</span><span>${CURRENCY} ${cartTotal()}</span></div>
      ${window.customer?.delivery !== 'pickup' ? `<div class="subtotal-row"><span>Delivery</span><span>${CURRENCY} ${deliveryCost()}</span></div>` : ''}
      <div class="total-row"><span>Total</span><span class="display">${CURRENCY} ${grandTotal()}</span></div>
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
      <button class="back-link" id="backToCartBtn">← Back to cart</button>
      <span class="step-label">Step 1 of 3 — Your details</span>
      
      <div class="field">
        <label for="fName">Full name</label>
        <input id="fName" type="text" value="${window.customer?.name || ''}" placeholder="e.g. Ishaka Kallon">
      </div>
      <div class="field">
        <label for="fPhone">Phone</label>
        <input id="fPhone" type="tel" value="${window.customer?.phone || ''}" placeholder="e.g. 076 000 000">
      </div>
      <div class="field">
        <label>Delivery method</label>
        <div class="radio-row payment-row">
          ${deliveryOptionsHtml}
        </div>
      </div>
      <div class="field" id="tierField" style="${isDelivery ? '' : 'display:none;'}">
        <label for="fDeliveryTier">Delivery cost</label>
        <select id="fDeliveryTier">${deliveryTierHtml}</select>
      </div>
      <div class="field" id="addressField" style="${isDelivery ? '' : 'display:none;'}">
        <label for="fAddress">Delivery address</label>
        <textarea id="fAddress" placeholder="Street, area, landmark">${window.customer?.address || ''}</textarea>
      </div>
      <div class="field">
        <label for="fNote">Note (optional)</label>
        <textarea id="fNote" placeholder="Anything else — e.g. name/number to print">${window.customer?.note || ''}</textarea>
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
        <div class="confirm-icon">✓</div>
        <div class="order-num">#${lastOrderNumber}</div>
        <p style="color:var(--ink-soft); font-size:14px; margin-bottom:20px; line-height:1.6;">
          Your order has been placed and is now visible to our team for processing.
        </p>
        <div class="summary-block">
          ${cart.map(item => {
            const p = getCartProduct(item);
            const label = item.custom ? `${p.club} · ${p.customName}` : `${p.club}`;
            return `<div class="li-row"><span>${label} (${item.size}) ×${item.qty}</span><span>${CURRENCY} ${p.price * item.qty}</span></div>`;
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
      <button class="back-link" id="backToDetailsBtn">← Back to details</button>
      <span class="step-label">Step 2 of 3 — Review</span>
      <div class="summary-block">
        ${cart.map(item => {
          const p = getCartProduct(item);
          const label = item.custom ? `${p.club} · ${p.customName}` : `${p.club}`;
          return `<div class="li-row"><span>${label} (${item.size}) ×${item.qty}</span><span>${CURRENCY} ${p.price * item.qty}</span></div>`;
        }).join('')}
        <div class="li-row" style="font-weight:800; border-top:1px solid var(--line); margin-top:6px; padding-top:8px;">
          <span>Total</span><span>${CURRENCY} ${grandTotal()}</span>
        </div>
      </div>
      <div class="summary-block">
        <div class="li-row"><span>Name</span><span>${window.customer?.name || '—'}</span></div>
        <div class="li-row"><span>Phone</span><span>${window.customer?.phone || '—'}</span></div>
        <div class="li-row"><span>Delivery</span><span style="text-transform:capitalize;">${window.customer?.delivery || 'pickup'}</span></div>
        ${window.customer?.delivery !== 'pickup' ? `<div class="li-row"><span>Address</span><span>${window.customer?.address || '—'}</span></div>` : ''}
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
      <button class="back-link" id="backToReviewBtn">← Back to review</button>
      <span class="step-label">Step 3 of 3 — Make payment</span>
      <div class="field">
        <label>Payment method</label>
        <div class="radio-row">
          ${Object.entries(PAYMENT_METHODS).map(([value, label]) => `
            <label class="radio-opt ${window.customer?.paymentMethod === value ? 'active' : ''}">
              <input type="radio" name="paymentMethod" value="${value}" ${window.customer?.paymentMethod === value ? 'checked' : ''}> ${label}
            </label>`).join('')}
        </div>
      </div>
    </div>
    <div class="drawer-foot">
      <div class="total-row"><span>Total</span><span class="display">${CURRENCY} ${grandTotal()}</span></div>
      <button class="primary-btn" id="placeOrderBtn">Make payment</button>
    </div>`;
}

