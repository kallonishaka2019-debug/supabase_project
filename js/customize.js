const customizeState = { productId: null, size: 'M', name: '', number: '' };

function customizeMode(state) {
  const hasName = state.name.trim() !== '';
  const hasNumber = state.number !== '';
  if (hasName && hasNumber) return 'both';
  return hasName ? 'name' : 'number';
}

function customizePreviewHtml(product) {
  const { name, number } = customizeState;
  if (product.image && product.backImage && product.backImage !== product.image) {
    const color = product.textColor || product.stripe || '#ffffff';
    return `<div class="cz-photo">
      <img src="${product.backImage}" alt="${escapeHtml(product.club)} ${escapeHtml(product.kit)} jersey back">
      <span class="cz-name" style="color:${color}">${escapeHtml(name.toUpperCase())}</span>
      <span class="cz-number" style="color:${color}">${escapeHtml(number)}</span>
    </div>`;
  }
  return jerseySvg({ ...product, customName: name, customNumber: number });
}

function customizeSummary(product) {
  const item = { customized: true, customName: customizeState.name, customNumber: customizeState.number, customMode: customizeMode(customizeState) };
  const fee = itemCustomizationFee(item);
  return {
    breakdown: fee ? customizationBreakdownText(item) : `Name ${CURRENCY} ${CUSTOM_PRICE_PER_LETTER}/letter · Number ${CURRENCY} ${CUSTOM_PRICE_PER_DIGIT}/digit`,
    total: Number(product.price) + fee
  };
}

function refreshCustomizeModal() {
  const product = PRODUCTS.find(p => p.id === customizeState.productId);
  if (!product) return;
  document.getElementById('czPreview').innerHTML = customizePreviewHtml(product);
  const { breakdown, total } = customizeSummary(product);
  document.getElementById('czBreakdown').textContent = breakdown;
  document.getElementById('czTotal').textContent = `${CURRENCY} ${total}`;
}

function openCustomizeModal(productId, size) {
  const product = PRODUCTS.find(p => p.id === productId);
  const modal = document.getElementById('customizeModal');
  if (!product || !modal) return;
  Object.assign(customizeState, { productId, size: size || 'M', name: '', number: '' });

  const numberOptions = Array.from({ length: 100 }, (_, n) => `<option value="${n}">${n}</option>`).join('');
  document.getElementById('customizeBody').innerHTML = `
    <div class="cz-layout">
      <div class="cz-preview" id="czPreview"></div>
      <div class="cz-form">
        <div>
          <div class="club">${escapeHtml(product.club)}</div>
          <div class="kit-type">${escapeHtml(product.kit)}</div>
        </div>
        <div>
          <div class="cz-label">Size</div>
          <div class="size-row" id="czSizes">
            ${SIZES.map(s => `<button type="button" class="size-btn ${s === customizeState.size ? 'active' : ''}" data-cz-size="${s}">${s}</button>`).join('')}
          </div>
        </div>
        <label class="cz-label" for="czName">Name
          <span class="textbox"><input class="textbox__control" id="czName" type="text" maxlength="${CUSTOM_NAME_MAX_LENGTH}" placeholder="e.g. KAMARA" autocomplete="off"></span>
        </label>
        <label class="cz-label" for="czNumber">Number
          <span class="select"><select id="czNumber"><option value="">Select number</option>${numberOptions}</select><svg class="icon icon--12" aria-hidden="true" focusable="false" viewBox="0 0 12 12"><path d="M1.5 4l4.5 4.5L10.5 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span>
        </label>
        <p class="li-custom-note" id="czBreakdown"></p>
        <div class="total-row"><span>Total</span><span class="display" id="czTotal"></span></div>
        <button type="button" class="btn btn--primary add-btn" id="czAddBtn">Add to cart</button>
      </div>
    </div>`;

  document.getElementById('czSizes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cz-size]');
    if (!btn) return;
    customizeState.size = btn.dataset.czSize;
    document.querySelectorAll('#czSizes .size-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
  document.getElementById('czName').addEventListener('input', (e) => {
    customizeState.name = sanitizeCustomName(e.target.value);
    e.target.value = customizeState.name;
    refreshCustomizeModal();
  });
  document.getElementById('czNumber').addEventListener('change', (e) => {
    customizeState.number = e.target.value;
    refreshCustomizeModal();
  });
  document.getElementById('czAddBtn').addEventListener('click', addCustomizedToCart);

  refreshCustomizeModal();
  modal.classList.add('open');
}

function closeCustomizeModal() {
  document.getElementById('customizeModal')?.classList.remove('open');
}

function addCustomizedToCart() {
  const { productId, size, name, number } = customizeState;
  if (name.trim() === '' && number === '') {
    showError('Enter a name and/or select a number');
    return;
  }
  const mode = customizeMode(customizeState);
  const customName = mode === 'number' ? '' : name.trim();
  const customNumber = mode === 'name' ? '' : number;

  const existing = findCartItem(productId, size);
  if (existing) {
    const same = existing.customized && customMode(existing) === mode
      && (existing.customName || '') === customName && String(existing.customNumber ?? '') === customNumber;
    if (!same) {
      showError(`This kit in size ${size} is already in your cart. Remove it first or pick another size.`);
      return;
    }
    existing.qty += 1;
  } else {
    cart.push({ productId, size, qty: 1, customized: true, customName, customNumber, customMode: mode });
  }
  invalidatePendingMonimeOrder();
  persistCart();
  updateCartCount();
  showSuccess('✓ Customized jersey added to cart');
  closeCustomizeModal();
}

function setupCustomizeModal() {
  const modal = document.getElementById('customizeModal');
  if (!modal) return;
  document.getElementById('closeCustomize')?.addEventListener('click', closeCustomizeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeCustomizeModal();
  });
}
