(function () {
  'use strict';
  if (window.parent === window) return;
  // No email address or subscription data is sent to the parent window.
  var parents = [
    'https://babyguard.rs',
    'https://www.babyguard.rs',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
    'http://[::1]:4173'
  ];
  parents.forEach(function (origin) {
    window.parent.postMessage({ type: 'babyguard:newsletter-submitted' }, origin);
  });
})();
