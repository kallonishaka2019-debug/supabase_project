function sanitizeCustomName(value) {
  const cleaned = String(value || '').replace(/[^A-Za-z0-9 .'-]/g, '').trim();
  return cleaned.slice(0, 12);
}

function sanitizeCustomNumber(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 2);
}

function normalizeCustomText(value) {
  return String(value || '').trim().toLowerCase();
}

function getDefaultTextColor(team, kit) {
  const product = getCustomizerProduct(team, kit);
  return product?.textColor || product?.stripe || getTeamPalette(team).stripe;
}

function getCustomizerProduct(team, kit) {
  const teamName = normalizeCustomText(team);
  const kitName = normalizeCustomText(kit);
  
  const exactMatch = PRODUCTS.find(item => {
    if (normalizeCustomText(item.club) !== teamName) return false;
    return normalizeCustomText(item.kit).includes(kitName);
  });
  
  if (exactMatch) return exactMatch;
  
  return PRODUCTS.find(item => normalizeCustomText(item.club) === teamName) || null;
}

async function getTeamBackImage(team, kit) {
  const product = getCustomizerProduct(team, kit);
  if (product?.backImage) return product.backImage;
  
  const clubProducts = PRODUCTS.filter(item => normalizeCustomText(item.club) === normalizeCustomText(team));
  if (!clubProducts.length) return '';
  
  const fallbackProduct = clubProducts.find(item => normalizeCustomText(item.kit).includes(normalizeCustomText(kit))) || clubProducts[0];
  return fallbackProduct?.backImage || '';
}

function getTeamFrontImage(team, kit) {
  const product = getCustomizerProduct(team, kit);
  if (product?.image) return product.image;
  
  const clubProduct = PRODUCTS.find(item => normalizeCustomText(item.club) === normalizeCustomText(team));
  return clubProduct?.image || '';
}

function getCustomizerConfig() {
  const team = document.getElementById('customTeam')?.value || 'Barcelona';
  const kit = document.getElementById('customKit')?.value || 'Home';
  const nameInput = document.getElementById('customName')?.value || '';
  const name = sanitizeCustomName(nameInput);
  const numberInput = document.getElementById('customNumber')?.value || '';
  const number = sanitizeCustomNumber(numberInput);
  const font = document.getElementById('customFont')?.value || 'modern';
  const nameColorInput = document.getElementById('customNameColor')?.value || '';
  const nameColor = nameColorInput || getDefaultTextColor(team, kit);
  const size = document.getElementById('customSize')?.value || 'M';
  
  return {
    team,
    kit,
    name,
    number,
    font,
    nameColor,
    size,
    stripe: getTeamPalette(team).stripe
  };
}

async function renderCustomizer() {
  const config = getCustomizerConfig();
  const preview = document.getElementById('customPreview');
  if (!preview) return;
  
  const teamPalette = getTeamPalette(config.team);
  const hasCustomization = Boolean(config.name) || config.number !== '';
  const previewImage = hasCustomization
    ? await getTeamBackImage(config.team, config.kit)
    : getTeamFrontImage(config.team, config.kit);
  const displayName = config.name ? config.name.toUpperCase() : '';
  
  const fontMap = {
    classic: 'Anton, sans-serif',
    modern: 'Inter, sans-serif',
    bold: 'Anton, sans-serif',
    serif: 'Playfair Display, serif',
    italic: 'Lora, serif',
    script: 'Caveat, cursive',
    sans: 'Roboto, sans-serif'
  };
  const fontFamily = fontMap[config.font] || 'Anton, sans-serif';
  
  if (previewImage) {
    preview.innerHTML = `
      <div class="custom-real-jersey">
        <img src="${previewImage}" alt="${config.team} ${config.kit} jersey ${hasCustomization ? 'back' : 'front'}" loading="eager" onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('beforeend', generateSvgPreview('${teamPalette.color}', '${teamPalette.stripe}', '${displayName}', '${config.number}', '${config.nameColor}', '${fontFamily}')">
        ${displayName ? `<div class="custom-nameplate" style="font-family:${fontFamily};color:${config.nameColor};">${displayName}</div>` : ''}
        ${config.number !== '' ? `<div class="custom-numberplate" style="font-family:${fontFamily};color:${config.nameColor};">${config.number}</div>` : ''}
      </div>`;
  } else {
    preview.innerHTML = generateSvgPreview(teamPalette.color, teamPalette.stripe, displayName, config.number, config.nameColor, fontFamily);
  }
  
  updateCustomizerMeta(config);
}

function generateSvgPreview(color, stripe, name, number, nameColor, fontFamily) {
  return `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" aria-label="Custom jersey preview">
    <path d="M34 18L16 30L22 50L36 44V128H84V44L98 50L104 30L86 18L72 28Q60 36 48 28Z" fill="${color}" stroke="${stripe}" stroke-width="3"/>
    <path d="M42 18L48 32H72L78 18" fill="${stripe}" opacity="0.86"/>
    <path d="M30 56H90" stroke="${stripe}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
    ${name ? `<text x="60" y="64" text-anchor="middle" fill="${nameColor}" font-family="${fontFamily}" font-size="9" font-weight="700" letter-spacing="0.8">${name}</text>` : ''}
    ${number !== '' ? `<text x="60" y="${name ? 96 : 77}" text-anchor="middle" fill="${nameColor}" font-family="${fontFamily}" font-size="14" font-weight="700">${number}</text>` : ''}
  </svg>`;
}

function updateCustomizerMeta(config) {
  const elements = {
    previewName: document.getElementById('previewName'),
    previewTeam: document.getElementById('previewTeam'),
    previewKit: document.getElementById('previewKit'),
    previewNumber: document.getElementById('previewNumber'),
    summaryTeam: document.getElementById('summaryTeam'),
    summaryKit: document.getElementById('summaryKit'),
    summaryName: document.getElementById('summaryName'),
    summarySize: document.getElementById('summarySize'),
    customSize: document.getElementById('customSize'),
    summaryPrice: document.getElementById('summaryPrice'),
    customAddBtn: document.getElementById('customAddBtn')
  };
  
  if (elements.previewName) elements.previewName.textContent = config.name || '—';
  if (elements.previewTeam) elements.previewTeam.textContent = config.team;
  if (elements.previewKit) elements.previewKit.textContent = config.kit;
  if (elements.previewNumber) elements.previewNumber.textContent = config.number !== '' ? `#${config.number}` : '—';
  if (elements.summaryTeam) elements.summaryTeam.textContent = config.team;
  if (elements.summaryKit) elements.summaryKit.textContent = config.kit;
  if (elements.summaryName) elements.summaryName.textContent = config.name || '—';
  if (elements.summarySize) elements.summarySize.textContent = config.size;
  if (elements.customSize) elements.customSize.value = config.size;
  if (elements.summaryPrice) elements.summaryPrice.textContent = `Le ${CUSTOMIZER_PRICE}`;
  if (elements.customAddBtn) {
    const product = getCustomizerProduct(config.team, config.kit);
    elements.customAddBtn.textContent = isProductAvailable(product) ? 'Add custom jersey' : 'Order this';
  }
}

function populateCustomTeamOptions() {
  const teamSelect = document.getElementById('customTeam');
  if (!teamSelect) return;
  
  const teams = [...new Set(PRODUCTS.map(product => product.club))].sort();
  teamSelect.innerHTML = teams.map(team => `<option value="${team}">${team}</option>`).join('');
  teamSelect.value = 'Barcelona';
}

function bindCustomizerEvents() {
  const teamElement = document.getElementById('customTeam');
  const kitElement = document.getElementById('customKit');
  const nameElement = document.getElementById('customName');
  const numberElement = document.getElementById('customNumber');
  const fontElement = document.getElementById('customFont');
  const nameColorElement = document.getElementById('customNameColor');
  const sizeElement = document.getElementById('customSize');
  const addBtn = document.getElementById('customAddBtn');
  
  [teamElement, kitElement, nameElement, numberElement, fontElement, nameColorElement, sizeElement].forEach(element => {
    if (!element) return;
    element.addEventListener('input', () => {
      if (element === numberElement) numberElement.value = sanitizeCustomNumber(numberElement.value);
      renderCustomizer();
    });
    element.addEventListener('change', () => renderCustomizer());
  });
  
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const config = getCustomizerConfig();
      addCustomJerseyToCart(config);
      openDrawer();
    });
  }
}

async function initializeCustomizer() {
  populateCustomTeamOptions();
  bindCustomizerEvents();
  await renderCustomizer();
}
