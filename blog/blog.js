// BabyGuard Blog – minimalni JS (bez kontakt forme)

document.addEventListener('DOMContentLoaded', () => {

  // --- Hamburger meni ---
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu    = document.querySelector('.nav-menu');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      menuToggle.classList.toggle('active');
    });

    // Zatvori meni klikom na link
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        menuToggle.classList.remove('active');
      });
    });
  }

  // --- Animacija sekcija pri skrolu ---
  const animObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in', 'visible');
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.animated-section, section').forEach(el => {
    animObs.observe(el);
  });

  // --- Language dropdown ---
  document.querySelectorAll('.lang-dropdown').forEach(dropdown => {
    const btn = dropdown.querySelector('.lang-dropdown-btn');
    if (btn) {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
    }
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.lang-dropdown.open')
      .forEach(d => d.classList.remove('open'));
  });

});
