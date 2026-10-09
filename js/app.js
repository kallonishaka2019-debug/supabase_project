(function loadStorefrontModules() {
  const modules = [
    'config.js',
    'data.js',
    'notifications.js',
    'cart.js',
    'search.js',
    'account.js',
    'ui.js',
    'events.js',
    'main.js'
  ];

  // document.write preserves the original parser order and global scope.
  if (document.readyState === 'loading') {
    modules.forEach((module) => {
      document.write(`<script src="js/${module}"><\/script>`);
    });
    return;
  }

  let index = 0;
  const loadNext = () => {
    if (index >= modules.length) return;
    const script = document.createElement('script');
    script.src = `js/${modules[index++]}`;
    script.onload = loadNext;
    document.head.appendChild(script);
  };
  loadNext();
})();
