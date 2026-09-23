// Theme initialization script — runs before React hydration to prevent FOUC.
// Reads the user's saved theme preference from localStorage and applies
// the appropriate class/attribute to <html> immediately.
(function() {
  try {
    var saved = localStorage.getItem('dossara_theme');
    var isDark = true;
    if (saved === 'light') {
      isDark = false;
    } else if (saved === 'dark') {
      isDark = true;
    } else if (saved === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (e) {}
})();
