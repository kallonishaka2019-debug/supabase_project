const CART_STORAGE_KEY = 'jerseyhub-cart';
const WISHLIST_STORAGE_KEY = 'jerseyhub-wishlist';

let cart = [];
let wishlist = [];

function loadCart() {
  try {
    const savedCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
    if (!Array.isArray(savedCart)) return [];
    return savedCart.filter(validateCartItem);
  } catch {
    return [];
  }
}

function validateCartItem(item) {
  if (item?.custom) {
    return SIZES.includes(item.size) && Number.isInteger(item.qty) && item.qty > 0 && typeof item.customTeam === 'string';
  }
  const product = PRODUCTS.find(candidate => candidate.id === item.productId);
  return product && isProductAvailable(product) && SIZES.includes(item.size) && Number.isInteger(item.qty) && item.qty > 0;
}

function persistCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Storage may be unavailable in private browsing
  }
}

function loadWishlist() {
  try {
    const saved = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY));
    return Array.isArray(saved) ? saved.filter(id => PRODUCTS.find(p => p.id === id)) : [];
  } catch {
    return [];
  }
}

function persistWishlist() {
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
  } catch {
    // Storage may be unavailable
  }
}

function addToCart(productId, size) {
  const existing = cart.find(i => i.productId === productId && i.size === size);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ productId, size, qty: 1 });
  }
  persistCart();
  updateCartCount();
  showSuccess('Added to cart!');
}

function addCustomJerseyToCart(config) {
  const customItem = {
    productId: `custom-${Date.now()}`,
    size: config.size,
    qty: 1,
    custom: true,
    customTeam: config.team,
    customKit: config.kit,
    customName: config.name,
    customNumber: config.number,
    customPrice: CUSTOMIZER_PRICE,
    color: getTeamPalette(config.team).color,
    stripe: getTeamPalette(config.team).stripe,
    customStyle: config.font,
    customNameColor: config.nameColor,
  };
  cart.push(customItem);
  persistCart();
  updateCartCount();
  showSuccess('Custom jersey added to cart!');
}

function updateQty(productId, size, delta) {
  const normalizedId = normalizeCartProductId(productId);
  const item = cart.find(i => i.productId === normalizedId && i.size === size);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i !== item);
  }
  persistCart();
  updateCartCount();
  renderDrawer();
}

function removeItem(productId, size) {
  const normalizedId = normalizeCartProductId(productId);
  cart = cart.filter(i => !(i.productId === normalizedId && i.size === size));
  persistCart();
  updateCartCount();
  renderDrawer();
}

function normalizeCartProductId(value) {
  if (typeof value === 'string' && value.startsWith('custom-')) return value;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : value;
}

function cartTotal() {
  return cart.reduce((sum, item) => {
    const p = getCartProduct(item);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}

function cartItemCount() {
  return cart.reduce((sum, i) => sum + i.qty, 0);
}

function deliveryCost() {
  const delivery = window.customer?.delivery || 'pickup';
  return DELIVERY_OPTIONS[delivery]?.cost || 0;
}

function grandTotal() {
  return cartTotal() + deliveryCost();
}

function updateCartCount() {
  const countEl = document.getElementById('cartCount');
  if (countEl) {
    countEl.textContent = cartItemCount();
    if (cartItemCount() > 0) {
      countEl.style.animation = 'pulse-count 0.3s ease';
      setTimeout(() => countEl.style.animation = '', 300);
    }
  }
}

function getCartProduct(item) {
  if (item?.custom) {
    return {
      id: item.productId,
      club: item.customTeam,
      kit: item.customKit,
      number: item.customNumber,
      price: item.customPrice ?? CUSTOMIZER_PRICE,
      color: item.color || '#A50044',
      stripe: item.stripe || '#FFFFFF',
      customName: item.customName,
      customStyle: item.customStyle,
      image: null,
      custom: true,
      available: true,
    };
  }
  return PRODUCTS.find(candidate => candidate.id === item.productId) || null;
}

function clearCart() {
  cart = [];
  persistCart();
  updateCartCount();
}

function toggleWishlist(productId) {
  const index = wishlist.indexOf(productId);
  if (index > -1) {
    wishlist.splice(index, 1);
    showInfo('Removed from wishlist');
  } else {
    wishlist.push(productId);
    showSuccess('Added to wishlist!');
  }
  persistWishlist();
  renderGrid();
}

function isInWishlist(productId) {
  return wishlist.includes(productId);
}

function getWishlistProducts() {
  return wishlist.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
}

cart = loadCart();
wishlist = loadWishlist();
