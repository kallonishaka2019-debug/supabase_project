let toastContainer = null;

function initToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
}

function showToast(message, type = 'info', duration = 4000) {
  initToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showSuccess(message) {
  showToast(message, 'success');
}

function showError(message) {
  showToast(message, 'error', 6000);
}

function showInfo(message) {
  showToast(message, 'info');
}

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  
  let errorEl = field.parentElement.querySelector('.field-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'field-error';
    field.parentElement.appendChild(errorEl);
  }
  
  errorEl.textContent = message;
  field.classList.add('error');
}

function clearFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  
  const errorEl = field.parentElement.querySelector('.field-error');
  if (errorEl) errorEl.remove();
  field.classList.remove('error');
}

function clearAllFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('.field.error').forEach(el => el.classList.remove('error'));
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[c]);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isSierraLeonePhone(phone) {
  const normalized = phone.trim().replace(/[\s()-]/g, '');
  return /^(?:0(?:2[2-9]|[3-9]\d)\d{6}|\+?232(?:2[2-9]|[3-9]\d)\d{6})$/.test(normalized);
}

function validateCheckoutForm() {
  clearAllFieldErrors();
  let isValid = true;
  
  const name = document.getElementById('fName')?.value?.trim();
  if (!name || name.length < 2) {
    setFieldError('fName', 'Please enter your full name (at least 2 characters)');
    isValid = false;
  }
  
  const phone = document.getElementById('fPhone')?.value?.trim();
  if (!phone || !isSierraLeonePhone(phone)) {
    setFieldError('fPhone', 'Please enter a valid Sierra Leone phone number (e.g. 076 000 000 or +232 76 000 000)');
    isValid = false;
  }
  
  const address = document.getElementById('fAddress')?.value?.trim();
  const delivery = document.querySelector('input[name="delivery"]:checked')?.value;
  if (delivery === 'delivery' && !address) {
    setFieldError('fAddress', 'Please enter your delivery address');
    isValid = false;
  }
  
  return isValid;
}
