document.addEventListener('DOMContentLoaded', async () => {
  setupGlobalEvents();
  setupCatalogFilters();
  setupPagination();
  setupSizeGuide();

  // Show the bundled catalog immediately; the API result (slow on a cold start) only refreshes it.
  renderGrid();
  updatePagination();
  updateCartCount();
  updateAccountButton();

  const sessionRestore = restoreServerSession();
  await loadProductsFromApi();

  renderGrid();
  updatePagination();

  await sessionRestore;

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
