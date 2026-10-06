document.addEventListener('DOMContentLoaded', async () => {
  setupGlobalEvents();
  setupSearch();
  setupCatalogFilters();
  setupPagination();
  setupSizeGuide();

  await loadProductsFromApi();
  
  renderGrid();
  updateResultsCount();
  updatePagination();
  
  await initializeCustomizer();
  
  updateCartCount();
  updateAccountButton();
  await restoreServerSession();

  const verifiedParam = new URLSearchParams(window.location.search).get('verified');
  if (verifiedParam) {
    showSuccess(verifiedParam === '1' ? 'Email confirmed! You are now logged in.' : 'Verification link is invalid or expired.');
    window.history.replaceState({}, '', window.location.pathname);
  }

  const googleParam = new URLSearchParams(window.location.search).get('google');
  if (googleParam) {
    showSuccess(googleParam === '1' ? 'Signed in with Google!' : 'Google sign-in failed. Please try again.');
    window.history.replaceState({}, '', window.location.pathname);
  }

  const paymentParam = new URLSearchParams(window.location.search).get('payment');
  if (paymentParam) {
    const paymentMessage = paymentParam === 'success'
      ? 'Payment received! Your order has been confirmed.'
      : 'Payment was not completed. Please retry or contact support.';
    showSuccess(paymentMessage);
    window.history.replaceState({}, '', window.location.pathname);
  }
});
