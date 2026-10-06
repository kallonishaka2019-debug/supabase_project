function bindDrawerEvents() {
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  
  const accountSwitchBtn = document.getElementById('accountSwitchBtn');
  if (accountSwitchBtn) {
    accountSwitchBtn.addEventListener('click', () => {
      accountView = accountView === 'login' ? 'register' : 'login';
      accountMessage = '';
      renderDrawer();
    });
  }
  
  const accountForm = document.getElementById('accountForm');
  if (accountForm) {
    accountForm.addEventListener('submit', handleAccountSubmit);
  }
  
  const resendVerificationBtn = document.getElementById('resendVerificationBtn');
  if (resendVerificationBtn) {
    resendVerificationBtn.addEventListener('click', handleResendVerification);
  }
  
  const viewOrdersBtn = document.getElementById('viewOrdersBtn');
  if (viewOrdersBtn) {
    viewOrdersBtn.addEventListener('click', () => {
      drawerMode = 'orders';
      renderDrawer();
      loadOrderHistory();
    });
  }
  
  const backToAccountBtn = document.getElementById('backToAccountBtn');
  if (backToAccountBtn) {
    backToAccountBtn.addEventListener('click', () => {
      drawerMode = 'account';
      renderDrawer();
    });
  }
  
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  document.querySelectorAll('[data-qty-down]').forEach(btn => {
    btn.addEventListener('click', () => updateQty(btn.dataset.qtyDown, btn.dataset.size, -1));
  });
  document.querySelectorAll('[data-qty-up]').forEach(btn => {
    btn.addEventListener('click', () => updateQty(btn.dataset.qtyUp, btn.dataset.size, 1));
  });
  document.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeItem(btn.dataset.remove, btn.dataset.size));
  });
  
  const toDetailsBtn = document.getElementById('toDetailsBtn');
  if (toDetailsBtn) {
    toDetailsBtn.addEventListener('click', () => {
      if (cart.length === 0) {
        showError('Your cart is empty');
        return;
      }
      checkoutStep = 'details';
      renderDrawer();
    });
  }
  
  const backToCartBtn = document.getElementById('backToCartBtn');
  if (backToCartBtn) {
    backToCartBtn.addEventListener('click', () => {
      checkoutStep = 'cart';
      renderDrawer();
    });
  }
  
  const backToDetailsBtn = document.getElementById('backToDetailsBtn');
  if (backToDetailsBtn) {
    backToDetailsBtn.addEventListener('click', () => {
      checkoutStep = 'details';
      lastOrderNumber = null;
      renderDrawer();
    });
  }
  
  bindFormEvents();
  
  const toPaymentBtn = document.getElementById('toPaymentBtn');
  if (toPaymentBtn) {
    toPaymentBtn.addEventListener('click', () => {
      checkoutStep = 'payment';
      lastOrderNumber = null;
      renderDrawer();
    });
  }

  const backToReviewBtn = document.getElementById('backToReviewBtn');
  if (backToReviewBtn) {
    backToReviewBtn.addEventListener('click', () => {
      checkoutStep = 'confirm';
      renderDrawer();
    });
  }

  const toConfirmBtn = document.getElementById('toConfirmBtn');
  if (toConfirmBtn) {
    toConfirmBtn.addEventListener('click', () => {
      if (!validateCheckoutForm()) return;
      checkoutStep = 'confirm';
      lastOrderNumber = null;
      renderDrawer();
    });
  }
  
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', handlePlaceOrder);
  }
  
  const newOrderBtn = document.getElementById('newOrderBtn');
  if (newOrderBtn) {
    newOrderBtn.addEventListener('click', () => {
      clearCart();
      window.customer = {
        name: '', phone: '', address: '',
        delivery: 'pickup', deliveryTier: 'standard', paymentPlan: 'full',
        paymentMethod: 'monime', note: ''
      };
      lastOrderNumber = null;
      checkoutStep = 'cart';
      closeDrawer();
    });
  }
}

function bindFormEvents() {
  const fName = document.getElementById('fName');
  if (fName) {
    fName.addEventListener('input', (e) => {
      window.customer.name = e.target.value;
      clearFieldError('fName');
    });
  }
  
  const fPhone = document.getElementById('fPhone');
  if (fPhone) {
    fPhone.addEventListener('input', (e) => {
      window.customer.phone = e.target.value;
      clearFieldError('fPhone');
    });
  }
  
  const fAddress = document.getElementById('fAddress');
  if (fAddress) {
    fAddress.addEventListener('input', (e) => {
      window.customer.address = e.target.value;
      clearFieldError('fAddress');
    });
  }
  
  const fNote = document.getElementById('fNote');
  if (fNote) {
    fNote.addEventListener('input', (e) => {
      window.customer.note = e.target.value;
    });
  }
  
  const copyRecipientBtn = document.getElementById('copyRecipientBtn');
  if (copyRecipientBtn) {
    copyRecipientBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(MONIME_RECIPIENT);
      copyRecipientBtn.textContent = 'Copied!';
      setTimeout(() => copyRecipientBtn.textContent = 'Copy number', 1400);
    });
  }
  
  document.querySelectorAll('input[name="deliveryType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      window.customer.delivery = e.target.value;
      renderDrawer();
    });
  });
  
  const fDeliveryTier = document.getElementById('fDeliveryTier');
  if (fDeliveryTier) {
    fDeliveryTier.addEventListener('change', (e) => {
      window.customer.deliveryTier = e.target.value;
      renderDrawer();
    });
  }

  document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      window.customer.paymentMethod = e.target.value;
      renderDrawer();
    });
  });
}

async function handleAccountSubmit(event) {
  event.preventDefault();

  const submitButton = document.getElementById('accountSubmitBtn');
  if (submitButton?.disabled) return;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Please wait...';
  }
  
  const email = document.getElementById('accountEmail').value.trim();
  const password = document.getElementById('accountPassword').value;
  const isRegister = accountView === 'register';
  accountDraft = {
    name: isRegister ? document.getElementById('accountName').value.trim() : accountDraft.name,
    email,
    phone: isRegister ? document.getElementById('accountPhone').value.trim() : accountDraft.phone
  };
  
  try {
    const data = await requestAuth(
      isRegister ? '/auth/register' : '/auth/login',
      isRegister
        ? {
            name: accountDraft.name,
            email: accountDraft.email,
            phone: accountDraft.phone,
            password
          }
        : { email: accountDraft.email, password }
    );

    if (data.needsVerification) {
      pendingVerificationEmail = data.email;
      accountView = 'verify-sent';
      accountMessage = '';
      renderDrawer();
      return;
    }

    currentAccount = data.user;
    window.customer.name = window.customer.name || data.user.name;
    window.customer.phone = window.customer.phone || data.user.phone;
    accountMessage = '';
    accountDraft = { name: '', email: '', phone: '' };
    updateAccountButton();
    renderDrawer();
    showSuccess(accountView === 'register' ? 'Account created!' : 'Logged in!');
  } catch (error) {
    if (error instanceof TypeError) {
      accountMessage = 'Backend unavailable. Start the server and try again.';
    } else {
      accountMessage = getAuthErrorMessage(error);
    }
    renderDrawer();
  }
}

async function handleResendVerification() {
  const resendButton = document.getElementById('resendVerificationBtn');
  if (resendButton?.disabled) return;
  if (resendButton) {
    resendButton.disabled = true;
    resendButton.textContent = 'Sending...';
  }

  try {
    await requestAuth('/auth/resend', { email: pendingVerificationEmail });
    accountMessage = '';
    showInfo('Confirmation request accepted. Check your inbox and spam folder.');
  } catch (error) {
    accountMessage = getAuthErrorMessage(error);
  }
  renderDrawer();
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // Clear UI even when server unavailable
  }
  currentAccount = null;
  updateAccountButton();
  renderDrawer();
  showInfo('Logged out successfully');
}

async function createMonimeCheckoutSession(orderId = null) {
  const total = Math.max(0, Math.round(grandTotal()));
  const payload = {
    orderId: orderId ?? `jerseyhub-${Date.now()}`,
    amount: total,
    email: (currentAccount?.email || window.customer?.email || 'customer@example.com').trim(),
    name: (window.customer?.name || currentAccount?.name || 'Customer').trim(),
  };

  const response = await fetch(`${API_BASE}/payments/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Monime checkout could not be created.');
  }

  const checkoutUrl = data.checkoutUrl || data.checkout_url || data.url || data.redirectUrl || data.redirect_url || data.paymentUrl || data.payment_url || data?.data?.checkoutUrl || data?.data?.url || '';
  return { ...data, checkoutUrl };
}

async function handlePlaceOrder() {
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  if (!placeOrderBtn) return;
  
  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = 'Placing order...';
  
  try {
    if (window.customer.paymentMethod === 'monime') {
      const savedOrder = await saveCheckoutOrder();
      const orderId = savedOrder?.order?.id ?? savedOrder?.id ?? null;
      lastOrderNumber = Number(orderId) || null;
      try {
        const monimeCheckout = await createMonimeCheckoutSession(orderId);
        const checkoutUrl = monimeCheckout.checkoutUrl || monimeCheckout.url || monimeCheckout.redirectUrl || monimeCheckout.data?.checkoutUrl;
        if (checkoutUrl) {
          window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
          showSuccess('Monime checkout opened. Complete the payment to finish your order.');
          placeOrderBtn.disabled = false;
          placeOrderBtn.textContent = 'Make payment';
          return;
        }
        throw new Error('Monime checkout URL was not returned by the payment provider.');
      } catch (error) {
        showError(error.message || 'Monime checkout is not ready yet.');
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = 'Make payment';
        return;
      }
    }

    const savedOrder = await saveCheckoutOrder();
    lastOrderNumber = Number(savedOrder?.order?.id ?? savedOrder?.id ?? Math.floor(1000 + Math.random() * 9000));
    renderDrawer();
    showSuccess('✓ Order added');
  } catch (error) {
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = 'Make payment';
    showError(error.message || 'Could not save your order.');
  }
}

function setupSizeGuide() {
  const sizeGuideBtn = document.getElementById('sizeGuideBtn');
  const sizeGuideModal = document.getElementById('sizeGuideModal');
  const closeSizeGuide = document.getElementById('closeSizeGuide');
  
  if (sizeGuideBtn && sizeGuideModal) {
    sizeGuideBtn.addEventListener('click', () => {
      sizeGuideModal.classList.add('open');
    });
  }
  
  if (closeSizeGuide && sizeGuideModal) {
    closeSizeGuide.addEventListener('click', () => {
      sizeGuideModal.classList.remove('open');
    });
    sizeGuideModal.addEventListener('click', (e) => {
      if (e.target === sizeGuideModal) {
        sizeGuideModal.classList.remove('open');
      }
    });
  }
}

function setupGlobalEvents() {
  const overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.addEventListener('click', closeDrawer);
  }
  
  const openCartBtn = document.getElementById('openCartBtn');
  if (openCartBtn) {
    openCartBtn.addEventListener('click', openDrawer);
  }
  
  const openAccountBtn = document.getElementById('openAccountBtn');
  if (openAccountBtn) {
    openAccountBtn.addEventListener('click', openAccountDrawer);
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      const sizeGuideModal = document.getElementById('sizeGuideModal');
      if (sizeGuideModal) sizeGuideModal.classList.remove('open');
    }
  });
}
