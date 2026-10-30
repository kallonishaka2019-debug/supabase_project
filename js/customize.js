const customizeState = { clubName: null, productId: null, size: 'M', name: '', number: '', color: 'gold', font: 'classic' };

function customizeMode(state) {
  const hasName = state.name.trim() !== '';
  const hasNumber = state.number !== '';
  if (hasName && hasNumber) return 'both';
  return hasName ? 'name' : 'number';
}

function customizerKits() {
  return PRODUCTS.filter(p => p.club === customizeState.clubName);
}

function customizePreviewHtml(product) {
  const { name, number } = customizeState;
  if (product.image && product.backImage && product.backImage !== product.image) {
    const color = CUSTOM_COLORS[customizeState.color].value;
    const font = CUSTOM_FONTS[customizeState.font].family;
    return `<div class="cz-photo">
      <img src="${product.backImage}" alt="${escapeHtml(product.club)} ${escapeHtml(product.kit)} jersey back">
      <span class="cz-name" style="color:${color};font-family:${font}">${escapeHtml(name.toUpperCase())}</span>
      <span class="cz-number" style="color:${color};font-family:${font}">${escapeHtml(number)}</span>
    </div>`;
  }
  return jerseySvg({ ...product, customName: name, customNumber: number, customStyle: customizeState.font, customNameColor: CUSTOM_COLORS[customizeState.color].value });
}

function customizeSummary(product) {
  const item = { customized: true, customName: customizeState.name, customNumber: customizeState.number, customMode: customizeMode(customizeState) };
  const fee = itemCustomizationFee(item);
  return {
    breakdown: fee ? customizationBreakdownText(item) : `Name ${CURRENCY} ${CUSTOM_PRICE_PER_LETTER}/letter · Number ${CURRENCY} ${CUSTOM_PRICE_PER_DIGIT}/digit`,
    total: Number(product.price) + fee
  };
}

function refreshCustomizer() {
  const product = PRODUCTS.find(p => p.id === customizeState.productId);
  if (!product) return;
  document.getElementById('czPreview').innerHTML = customizePreviewHtml(product);
  const { breakdown, total } = customizeSummary(product);
  document.getElementById('czBreakdown').textContent = breakdown;
  document.getElementById('czTotal').textContent = `${CURRENCY} ${total}`;
}

function renderCustomizer() {
  const root = document.getElementById('customizerBody');
  if (!root || PRODUCTS.length === 0) return;

  if (!PRODUCTS.some(p => p.id === customizeState.productId)) {
    customizeState.clubName = PRODUCTS[0].club;
    customizeState.productId = PRODUCTS[0].id;
  }
  const clubs = [...new Set(PRODUCTS.map(p => p.club))];
  const chevron = '<svg class="icon icon--12" aria-hidden="true" focusable="false" viewBox="0 0 12 12"><path d="M1.5 4l4.5 4.5L10.5 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const numberOptions = Array.from({ length: 100 }, (_, n) => `<option value="${n}" ${String(n) === customizeState.number ? 'selected' : ''}>${n}</option>`).join('');

  root.innerHTML = `
    <div class="cz-layout">
      <div class="cz-preview" id="czPreview"></div>
      <div class="cz-form">
        <div class="cz-group">
          <label class="cz-label" for="czClub">Choose club</label>
          <span class="select"><select id="czClub">
            ${clubs.map(c => `<option value="${escapeHtml(c)}" ${c === customizeState.clubName ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          </select>${chevron}</span>
        </div>
        <div class="cz-group">
          <div class="cz-label">Choose kit</div>
          <div class="cz-kits" id="czKits">
            ${customizerKits().map(k => `<button type="button" class="cz-kit ${k.id === customizeState.productId ? 'active' : ''}" data-cz-kit="${k.id}" aria-pressed="${k.id === customizeState.productId}">
              <span class="cz-kit-img">${k.image ? `<img src="${k.image}" alt="" loading="lazy">` : jerseySvg(k)}</span>
              <span>${escapeHtml(k.kit)}</span>
            </button>`).join('')}
          </div>
        </div>
        <div class="cz-group">
          <div class="cz-label">Choose size</div>
          <div class="size-row" id="czSizes">
            ${SIZES.map(s => `<button type="button" class="size-btn ${s === customizeState.size ? 'active' : ''}" data-cz-size="${s}">${s}</button>`).join('')}
          </div>
        </div>
        <div class="cz-group">
          <div class="cz-label">Personalise this item</div>
          <div class="cz-fields">
            <span class="textbox"><input class="textbox__control" id="czName" type="text" maxlength="${CUSTOM_NAME_MAX_LENGTH}" placeholder="Add your name" aria-label="Name" autocomplete="off" value="${escapeHtml(customizeState.name)}"></span>
            <span class="select"><select id="czNumber" aria-label="Number"><option value="">Number</option>${numberOptions}</select>${chevron}</span>
          </div>
          <p class="li-custom-note" id="czBreakdown"></p>
        </div>
        <div class="cz-group">
          <div class="cz-label">Colour</div>
          <div class="cz-swatches" id="czColors">
            ${Object.entries(CUSTOM_COLORS).map(([key, c]) => `<button type="button" class="cz-swatch ${key === customizeState.color ? 'active' : ''}" data-cz-color="${key}" style="background:${c.value}" aria-label="${c.label}" aria-pressed="${key === customizeState.color}" title="${c.label}"></button>`).join('')}
          </div>
        </div>
        <div class="cz-group">
          <div class="cz-label">Font</div>
          <div class="cz-fonts" id="czFonts">
            ${Object.entries(CUSTOM_FONTS).map(([key, f]) => `<button type="button" class="cz-font ${key === customizeState.font ? 'active' : ''}" data-cz-font="${key}" style="font-family:${f.family}" aria-pressed="${key === customizeState.font}">${f.label}</button>`).join('')}
          </div>
        </div>
        <div class="cz-subtotal"><span>Subtotal</span><strong id="czTotal"></strong></div>
        <button type="button" class="btn btn--primary add-btn" id="czAddBtn">Add to cart</button>
      </div>
    </div>`;

  document.getElementById('czClub').addEventListener('change', (e) => {
    customizeState.clubName = e.target.value;
    customizeState.productId = customizerKits()[0]?.id ?? null;
    renderCustomizer();
  });
  document.getElementById('czKits').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cz-kit]');
    if (!btn) return;
    customizeState.productId = Number(btn.dataset.czKit);
    renderCustomizer();
  });
  document.getElementById('czSizes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cz-size]');
    if (!btn) return;
    customizeState.size = btn.dataset.czSize;
    document.querySelectorAll('#czSizes .size-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
  document.getElementById('czName').addEventListener('input', (e) => {
    customizeState.name = sanitizeCustomName(e.target.value);
    e.target.value = customizeState.name;
    refreshCustomizer();
  });
  document.getElementById('czNumber').addEventListener('change', (e) => {
    customizeState.number = e.target.value;
    refreshCustomizer();
  });
  document.getElementById('czColors').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cz-color]');
    if (!btn) return;
    customizeState.color = btn.dataset.czColor;
    document.querySelectorAll('#czColors .cz-swatch').forEach(b => b.classList.toggle('active', b === btn));
    refreshCustomizer();
  });
  document.getElementById('czFonts').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cz-font]');
    if (!btn) return;
    customizeState.font = btn.dataset.czFont;
    document.querySelectorAll('#czFonts .cz-font').forEach(b => b.classList.toggle('active', b === btn));
    refreshCustomizer();
  });
  document.getElementById('czAddBtn').addEventListener('click', addCustomizedToCart);

  refreshCustomizer();
}

function addCustomizedToCart() {
  const { productId, size, name, number, color, font } = customizeState;
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
      && (existing.customColor || 'gold') === color && (existing.customFont || 'classic') === font
      && (existing.customName || '') === customName && String(existing.customNumber ?? '') === customNumber;
    if (!same) {
      showError(`This kit in size ${size} is already in your cart. Remove it first or pick another size.`);
      return;
    }
    existing.qty += 1;
  } else {
    cart.push({ productId, size, qty: 1, customized: true, customName, customNumber, customMode: mode, customColor: color, customFont: font });
  }
  invalidatePendingMonimeOrder();
  persistCart();
  updateCartCount();
  showSuccess('Customized jersey added to cart');
}
