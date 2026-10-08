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
    if (paymentParam === 'success') {
      clearCart();
      showSuccess('Payment confirmed! Your order has been placed.');
    } else if (paymentParam === 'cancelled') {
      showInfo('Payment was cancelled. Your order is still pending.');
    } else {
      showInfo('Payment is not confirmed yet. Please check again shortly.');
    }
    window.history.replaceState({}, '', window.location.pathname);
  }
});
