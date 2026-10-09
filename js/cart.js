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
  const product = PRODUCTS.find(candidate => candidate.id === item.productId);
  return product && SIZES.includes(item.size) && Number.isInteger(item.qty) && item.qty > 0;
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
  invalidatePendingMonimeOrder();
  const product = PRODUCTS.find(candidate => candidate.id === productId);
  const existing = cart.find(i => i.productId === productId && i.size === size);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ productId, size, qty: 1 });
  }
  persistCart();
  updateCartCount();
  showSuccess(product && isProductAvailable(product) ? '✓ Added to cart' : '✓ Order request added');
}

function sanitizeCustomName(value) {
  return String(value || '').replace(/[^A-Za-z0-9 .'-]/g, '').slice(0, CUSTOM_NAME_MAX_LENGTH);
}

function sanitizeCustomNumber(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 2);
}

function findCartItem(productId, size) {
  const normalizedId = normalizeCartProductId(productId);
  return cart.find(i => i.productId === normalizedId && i.size === size);
}

function setItemCustomization(productId, size, enabled) {
  const item = findCartItem(productId, size);
  if (!item) return;
  invalidatePendingMonimeOrder();
  item.customized = enabled;
  if (enabled) {
    item.customName = item.customName || '';
    item.customNumber = item.customNumber ?? '';
  }
  persistCart();
  renderDrawer();
}

function updateItemCustomization(productId, size, field, value) {
  const item = findCartItem(productId, size);
  if (!item) return '';
  invalidatePendingMonimeOrder();
  const cleaned = field === 'customNumber' ? sanitizeCustomNumber(value) : sanitizeCustomName(value);
  item[field] = cleaned;
  persistCart();
  return cleaned;
}

function isItemCustomizationComplete(item) {
  return !item.customized || (Boolean(String(item.customName || '').trim()) && String(item.customNumber ?? '') !== '');
}

function updateQty(productId, size, delta) {
  invalidatePendingMonimeOrder();
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
  invalidatePendingMonimeOrder();
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
  const delivery = window.customer?.delivery === 'delivery' ? (window.customer.deliveryTier || 'standard') : 'pickup';
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
  const product = PRODUCTS.find(candidate => candidate.id === item.productId);
  if (!product) return null;
  return item.customized ? { ...product, price: CUSTOM_KIT_PRICE } : product;
}

function clearCart() {
  invalidatePendingMonimeOrder();
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
