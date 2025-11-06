
    
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

    // Glavni meni - skrol
    document.querySelectorAll('nav a').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        window.scrollTo({
          top: targetSection.offsetTop - 80,
          behavior: 'smooth'
        });
      });
    });
  