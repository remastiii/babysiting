
    // Animacija prilikom skrolovanja
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('section').forEach(section => {
      observer.observe(section);
    });

    // Forma
    document.getElementById('contactForm').addEventListener('submit', async function(e) {
      e.preventDefault();

      // Honeypot provera
      if (document.querySelector('input[name="_gotcha"]').value) {
        document.getElementById('successModal').style.display = 'flex';
        document.querySelector('.modal-content h3').textContent = '✅ Poruka poslata!';
        document.querySelector('.modal-content p').textContent = 'Hvala na poruci!';
        this.reset();
        return;
      }

      const ime = document.getElementById('ime').value.trim();
      const email = document.getElementById('email').value.trim();
      const telefon = document.getElementById('telefon').value.trim();
      const poruka = document.getElementById('poruka').value.trim();

      if (ime.length < 3) {
        alert('Ime mora imati najmanje 3 karaktera.');
        return;
      }
      if (poruka.length < 10) {
        alert('Poruka mora imati najmanje 10 karaktera.');
        return;
      }
      if (!email && !telefon) {
        alert('Morate uneti email ILI broj telefona.');
        return;
      }
      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        alert('Unesite ispravnu email adresu.');
        return;
      }
      if (telefon && !/^\+?[0-9\s\-()]{7,}$/.test(telefon)) {
        alert('Unesite ispravan broj telefona (npr. +381 60 123 4567).');
        return;
      }

      const formData = new FormData();
      formData.append('ime', ime);
      if (email) formData.append('email', email);
      if (telefon) formData.append('telefon', telefon);
      formData.append('poruka', poruka);

      try {
        const response = await fetch('https://formspree.io/f/mrbyrdrj', {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          document.getElementById('successModal').style.display = 'flex';
          this.reset();
        } else {
          const error = await response.json();
          alert('Greška: ' + (error.error || 'Neuspešno slanje. Pokušajte kasnije.'));
        }
      } catch (err) {
        alert('Došlo je do greške. Proverite internet konekciju.');
      }
    });

    document.getElementById('closeModal').addEventListener('click', function() {
      document.getElementById('successModal').style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Glavni meni - skrol SAMO za unutrašnje linkove (#...)
document.querySelectorAll('nav a').forEach(anchor => {
  const href = anchor.getAttribute('href');
  // Proveri da li je link unutrašnji (počinje sa #)
  if (href && href.startsWith('#')) {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetSection = document.querySelector(href);
      if (targetSection) {
        window.scrollTo({
          top: targetSection.offsetTop - 80,
          behavior: 'smooth'
        });
      }
    });
  }
  // Ako link NIJE unutrašnji (npr. en.html), NIŠTA ne radi – nešto što pregledač radi automatski
});
      
  
    document.addEventListener('DOMContentLoaded', () => {
      const menuToggle = document.querySelector('.menu-toggle');
      const navMenu = document.querySelector('.nav-menu');

      menuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        menuToggle.classList.toggle('active'); // ← ovo pravi X
      });
    });

  document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('.animated-section');

    const observerOptions = {
      root: null, // viewport
      rootMargin: '0px 0px -100px 0px', // pokreni animaciju ranije (kada je 100px do dna)
      threshold: 0.1 // 10% elementa mora biti u vidnom polju
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        } else {
          // Ukloni klasu kad izađe iz vidljivosti – omogućava ponavljanje
          entry.target.classList.remove('animate-in');
        }
      });
    }, observerOptions);

    sections.forEach(section => {
      observer.observe(section);
    });
  });
window.addEventListener('load', function() {
  document.body.classList.remove('loading');
});

  /*
  // Funkcija koja osvežava koja je sekcija trenutno "aktivna"
  function osveziAktivnuSekciju() {
    const sekcije = document.querySelectorAll('.scroll-sekcija');
    let aktivna = null;
    let najblizaRazlika = Infinity;

    sekcije.forEach(sekcija => {
      sekcija.classList.remove('aktivna-sekcija');
      const sredinaSekcije = sekcija.offsetTop + sekcija.offsetHeight / 2;
      const sredinaProzora = window.scrollY + window.innerHeight / 2;
      const razlika = Math.abs(sredinaProzora - sredinaSekcije);

      if (razlika < najblizaRazlika) {
        najblizaRazlika = razlika;
        aktivna = sekcija;
      }
    });

    if (aktivna) {
      aktivna.classList.add('aktivna-sekcija');
    }
  }

  // Pokreni pri svakom skrolu
  window.addEventListener('scroll', osveziAktivnuSekciju);

  // Pokreni odmah na učitavanju stranice
  window.addEventListener('load', osveziAktivnuSekciju);

*/
  


