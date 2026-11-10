/* Shared navigation for the home pages and blog. */
'use strict';

(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;

  var hamburger = header.querySelector('.hamburger');
  var mobileNav = header.querySelector('.mobile-nav');
  var dropdown = header.querySelector('.lang-dropdown');
  var languageButton = dropdown && dropdown.querySelector('.lang-btn');
  var mobileLayout = window.matchMedia('(max-width: 1024px)');

  function setMenuOpen(open) {
    if (!hamburger || !mobileNav) return;
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    mobileNav.classList.toggle('open', open);
    mobileNav.setAttribute('aria-hidden', String(!open));
    mobileNav.inert = !open;
  }

  function setLanguageOpen(open) {
    if (!dropdown || !languageButton) return;
    dropdown.classList.toggle('open', open);
    languageButton.setAttribute('aria-expanded', String(open));
  }

  if (hamburger && mobileNav) {
    setMenuOpen(false);
    hamburger.addEventListener('click', function () {
      setMenuOpen(!mobileNav.classList.contains('open'));
    });
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setMenuOpen(false); });
    });
  }

  if (languageButton) {
    languageButton.addEventListener('click', function () {
      setLanguageOpen(!dropdown.classList.contains('open'));
    });
  }

  document.addEventListener('click', function (event) {
    if (hamburger && mobileNav && !mobileNav.contains(event.target) && !hamburger.contains(event.target)) {
      setMenuOpen(false);
    }
    if (dropdown && !dropdown.contains(event.target)) setLanguageOpen(false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (mobileNav && mobileNav.classList.contains('open')) {
      setMenuOpen(false);
      hamburger.focus();
    }
    if (dropdown && dropdown.classList.contains('open')) {
      setLanguageOpen(false);
      languageButton.focus();
    }
  });

  mobileLayout.addEventListener('change', function () {
    setMenuOpen(false);
    setLanguageOpen(false);
  });
})();
