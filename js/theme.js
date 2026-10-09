const THEME_STORAGE_KEY = 'jerseyhub-theme';

function applyTheme(theme, persist = false) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';

  document.querySelectorAll('#themeToggle').forEach(toggle => {
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', `Enable ${isDark ? 'light' : 'dark'} theme`);
    toggle.querySelector('.theme-toggle-icon').textContent = isDark ? '☀' : '☾';
    toggle.querySelector('.theme-toggle-label').textContent = isDark ? 'Light' : 'Dark';
  });

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // The theme still applies for this page if storage is unavailable.
    }
  }
}

let savedTheme = 'light';
try {
  savedTheme = localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
} catch {
  // Use the light theme when browser storage is unavailable.
}
applyTheme(savedTheme);

document.addEventListener('click', event => {
  if (!event.target.closest('#themeToggle')) return;
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme, true);
});
