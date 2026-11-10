/* ================================================================
   BabyGuard – Main page JS
   script.js  |  branch: feature/babyguard-premium-redesign
   Navigation is shared via navigation.js; this file handles home-page features.
================================================================ */
'use strict';

/* ---------------------------------------------------------------
   3. SMOOTH SCROLL – subtract sticky header height
--------------------------------------------------------------- */
(function () {
  document.addEventListener('click', function (e) {
    var anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    var href = anchor.getAttribute('href');
    if (!href || href === '#') return;

    var target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();
    var header = document.querySelector('.site-header');
    var offset = header ? header.offsetHeight : 72;
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset - 16;
    window.scrollTo({ top: top, behavior: 'smooth' });
  });
})();

/* ---------------------------------------------------------------
   4. REVEAL ANIMATION – single IntersectionObserver
--------------------------------------------------------------- */
(function () {
  var els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  els.forEach(function (el) { observer.observe(el); });
})();

/* ---------------------------------------------------------------
   5. NEED CARDS – keyboard accessibility (Enter / Space)
--------------------------------------------------------------- */
(function () {
  document.querySelectorAll('.need-card[tabindex]').forEach(function (card) {
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
})();

/* ---------------------------------------------------------------
   6. CONTACT FORM – validation + Formspree submit + success modal
--------------------------------------------------------------- */
(function () {
  var form = document.getElementById('contactForm');
  if (!form) return;

  var successModal = document.getElementById('successModal');
  var closeBtn     = document.getElementById('closeModal');

  // Rate limiting: max 3 submissions per session, 60s cooldown
  var submitCount    = 0;
  var MAX_SUBMITS    = 3;
  var COOLDOWN_MS    = 60 * 1000;
  var lastSubmitTime = 0;

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE_RE = /^[0-9+\s\-()/]{7,20}$/;

  function showError(input, msg) {
    var group = input.closest('.form-group');
    if (!group) return;
    var old = group.querySelector('.field-error');
    if (old) old.remove();
    input.style.borderColor = '#c0392b';
    var span = document.createElement('span');
    span.className = 'field-error form-note';
    span.style.color = '#c0392b';
    span.textContent = msg;
    group.appendChild(span);
  }

  function clearErrors() {
    form.querySelectorAll('.field-error').forEach(function (el) { el.remove(); });
    form.querySelectorAll('input,textarea').forEach(function (el) { el.style.borderColor = ''; });
  }

  function validate() {
    clearErrors();
    var ok = true;

    var ime     = form.querySelector('[name="ime"]');
    var email   = form.querySelector('[name="email"]');
    var telefon = form.querySelector('[name="telefon"]');
    var poruka  = form.querySelector('[name="poruka"]');

    if (ime && ime.value.trim().length < 3) {
      showError(ime, 'Unesite ime (min. 3 znaka).');
      ok = false;
    }

    var hasEmail   = email   && email.value.trim().length   > 0;
    var hasPhone   = telefon && telefon.value.trim().length > 0;

    if (!hasEmail && !hasPhone) {
      if (email) showError(email, 'Unesite email ili telefon.');
      ok = false;
    } else {
      if (hasEmail && !EMAIL_RE.test(email.value.trim())) {
        showError(email, 'Nevažeća email adresa.');
        ok = false;
      }
      if (hasPhone && !PHONE_RE.test(telefon.value.trim())) {
        showError(telefon, 'Nevažeći format telefona.');
        ok = false;
      }
    }

    if (poruka && poruka.value.trim().length < 10) {
      showError(poruka, 'Poruka mora imati min. 10 znakova.');
      ok = false;
    }

    return ok;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Honeypot check
    var honeypot = form.querySelector('[name="_honey"]');
    if (honeypot && honeypot.value) return;

    if (!validate()) return;

    // Rate limit check
    var now = Date.now();
    var elapsed = now - lastSubmitTime;
    if (lastSubmitTime > 0 && elapsed < COOLDOWN_MS) {
      var wait = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      var porukaCd = form.querySelector('[name="poruka"]');
      if (porukaCd) showError(porukaCd, 'Sačekajte još ' + wait + 's pre sledećeg slanja.');
      return;
    }
    if (submitCount >= MAX_SUBMITS) {
      var porukaCd = form.querySelector('[name="poruka"]');
      if (porukaCd) showError(porukaCd, 'Dostigli ste maksimalan broj poruka. Kontaktirajte nas direktno.');
      return;
    }

    var submitBtn = form.querySelector('[type="submit"]');
    var origText  = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Šalje se...'; }

    var data = new FormData(form);

    fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' }
    })
    .then(function (res) {
      if (!res.ok) throw new Error('Network error');
      return res.json();
    })
    .then(function () {
      // Google Ads conversion
      if (typeof gtag === 'function') {
        gtag('event', 'conversion', {
          send_to: 'AW-18274328782/hWxfCJHN_cYcEM7B8IlE'
        });
      }

      submitCount++;
      lastSubmitTime = Date.now();

      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText; }
      form.reset();
      clearErrors();

      if (successModal) {
        successModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }
    })
    .catch(function () {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText; }
      alert('Greška pri slanju. Pokušajte ponovo ili nas kontaktirajte direktno.');
    });
  });

  // Close modal
  function closeModal() {
    if (successModal) {
      successModal.style.display = 'none';
      document.body.style.overflow = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  if (successModal) {
    successModal.addEventListener('click', function (e) {
      if (e.target === successModal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && successModal.style.display === 'flex') closeModal();
    });
  }
})();

/* ---------------------------------------------------------------
   7. CHAT WIDGET – FAQ bot with WhatsApp CTA
--------------------------------------------------------------- */
(function () {
  var panel      = document.getElementById('chat-panel');
  var toggleBtn  = document.getElementById('chat-toggle-btn');
  var closeBtn   = document.querySelector('.chat-close-btn');
  var messagesEl = document.getElementById('chatMessages');
  var quickEl    = document.getElementById('chatQuick');
  var badge      = document.getElementById('chatBadge');
  var iconMsg    = toggleBtn && toggleBtn.querySelector('.chat-icon-msg');
  var iconX      = toggleBtn && toggleBtn.querySelector('.chat-icon-x');

  if (!panel || !toggleBtn) return;

  var isOpen    = false;
  var initiated = false;

  // Language-aware content
  var lang = (document.documentElement.lang || 'sr').split('-')[0].toLowerCase();

  var CHAT_CONTENT = {
    sr: {
      waUrl:   'https://wa.me/381613166770?text=Pozdrav%2C%20zainteresovani%20smo%20za%20BabyGuard%20usluge%20%C4%8Duvanja%20dece.',
      welcome: 'Zdravo! 👋 Ja sam BabyGuard asistent. Odaberite pitanje ili nas kontaktirajte direktno.',
      backBtn: '⬅ Još pitanja',
      waBtn:   '💬 Pišite nam na WhatsApp',
      qa: [
        { q: '🔍 Kako funkcioniše usluga?',      a: 'Kontaktirate nas, opišete potrebe (uzrast dece, termini, lokacija). Mi predlažemo overene dadilje, vi birate i ugovarate termin. Brzo i jednostavno! 🤝' },
        { q: '📅 Imate li slobodnih dadilja?',    a: 'Dostupnost varira po lokaciji i terminu. Za aktuelne slobodne termine — napišite nam direktno i odgovaramo u roku od par minuta.' },
        { q: '🛡️ Kako proveravate dadilje?',      a: 'Svaka dadilja prolazi kroz proveru dokumenata i referenci, lični razgovor i testni period. Sarađujemo isključivo sa pouzdanim i iskusnim osobama.' },
        { q: '📍 Koje gradove pokrivate?',         a: 'Pokrivamo Beograd i okolinu i Novi Sad. Za ostale gradove nas kontaktirajte — trudimo se da pomognemo i van ovih lokacija.' },
        { q: '✨ Šta je uključeno u uslugu?',      a: 'Čuvanje dece, pomoć oko obroka i edukativne igre prema uzrastu. Sve se dogovara unapred prema vašim specifičnim potrebama.' },
        { q: '💰 Koliko košta čuvanje?',           a: 'Cena zavisi od termina, broja dece, trajanja i lokacije. Pošaljite nam upit i odmah ćemo vam dati konkretnu ponudu bez obaveze.' },
        { q: '⚡ Možete li organizovati isti dan?', a: 'Da! Za hitna čuvanja možemo u kratkom roku obezbediti dadilju. Pišite nam odmah i rešavamo zajedno.' },
        { q: '🌙 Da li radite i noću?',            a: 'Da, imamo dadilje za noćna dežurstva. Idealno za novorođenčad ili roditelje koji rade u noćnoj smeni.' }
      ]
    },
    en: {
      waUrl:   'https://wa.me/381613166770?text=Hello%2C%20we%20are%20interested%20in%20BabyGuard%20childcare%20services.%20Our%20children%20are%20___%20years%20old.',
      welcome: 'Hello! 👋 I\'m the BabyGuard assistant. Choose a question or contact us directly.',
      backBtn: '⬅ More questions',
      waBtn:   '💬 Write to us on WhatsApp',
      qa: [
        { q: '🔍 How does the service work?',       a: 'You contact us, describe your needs (child\'s age, schedule, location). We suggest verified sitters, you choose and book. Fast and easy! 🤝' },
        { q: '📅 Do you have available sitters?',   a: 'Availability varies by location and time. For current openings — write to us directly and we\'ll reply within minutes.' },
        { q: '🛡️ How do you verify sitters?',       a: 'Every sitter goes through document & reference checks, a personal interview, and a trial period. We only work with reliable, experienced people.' },
        { q: '📍 Which areas do you cover?',        a: 'We cover Belgrade and the surrounding area, as well as Novi Sad. Contact us for other cities — we\'ll do our best to help.' },
        { q: '✨ What\'s included in the service?',  a: 'Childcare, help with meals, and age-appropriate activities. Everything is agreed in advance based on your specific needs.' },
        { q: '💰 How much does it cost?',           a: 'Price depends on timing, number of children, duration and location. Send us a request and we\'ll give you a concrete quote with no obligation.' },
        { q: '⚡ Can you arrange same-day care?',   a: 'Yes! For urgent care we can find a sitter on short notice. Message us now and we\'ll sort it out together.' },
        { q: '🌙 Do you work nights?',              a: 'Yes, we have sitters available for overnight shifts — ideal for newborns or parents working night shifts.' }
      ]
    },
    ru: {
      waUrl:   'https://wa.me/381613166770?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5%2C%20%D0%BD%D0%B0%D1%81%20%D0%B8%D0%BD%D1%82%D0%B5%D1%80%D0%B5%D1%81%D1%83%D1%8E%D1%82%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B8%20BabyGuard.',
      welcome: 'Здравствуйте! 👋 Я ассистент BabyGuard. Выберите вопрос или свяжитесь с нами напрямую.',
      backBtn: '⬅ Ещё вопросы',
      waBtn:   '💬 Написать в WhatsApp',
      qa: [
        { q: '🔍 Как работает услуга?',             a: 'Вы связываетесь с нами, описываете потребности (возраст детей, расписание, локация). Мы предлагаем проверенных нянь, вы выбираете и бронируете. Быстро и просто! 🤝' },
        { q: '📅 Есть ли свободные няни?',          a: 'Доступность зависит от локации и времени. Для актуальных свободных мест — напишите нам напрямую, ответим в течение нескольких минут.' },
        { q: '🛡️ Как вы проверяете нянь?',          a: 'Каждая няня проходит проверку документов и рекомендаций, личное собеседование и испытательный срок. Мы работаем только с надёжными и опытными людьми.' },
        { q: '📍 Какие города вы охватываете?',     a: 'Мы работаем в Белграде и окрестностях, а также в Нови-Саде. Для других городов свяжитесь с нами — постараемся помочь.' },
        { q: '✨ Что входит в услугу?',              a: 'Присмотр за детьми, помощь с едой и развивающие игры по возрасту. Всё согласовывается заранее под ваши конкретные потребности.' },
        { q: '💰 Сколько стоит услуга?',            a: 'Цена зависит от времени, количества детей, продолжительности и локации. Отправьте нам запрос, и мы сразу дадим конкретное предложение без обязательств.' },
        { q: '⚡ Можно ли организовать в тот же день?', a: 'Да! Для срочного присмотра мы можем найти няню в короткие сроки. Пишите нам прямо сейчас — решим вместе.' },
        { q: '🌙 Вы работаете ночью?',              a: 'Да, у нас есть няни для ночных дежурств. Идеально для новорождённых или родителей, работающих в ночную смену.' }
      ]
    }
  };

  var C   = CHAT_CONTENT[lang] || CHAT_CONTENT.sr;
  var WA_URL = C.waUrl;
  var QA     = C.qa;

  function addMsg(text, type) {
    var el = document.createElement('div');
    el.className = 'chat-msg ' + type;
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping(cb, delay) {
    var typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    setTimeout(function () {
      typing.remove();
      cb();
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, delay || 700);
  }

  function clearQuick() { quickEl.innerHTML = ''; }

  function showMainMenu() {
    clearQuick();
    QA.forEach(function (item, i) {
      var chip = document.createElement('button');
      chip.className = 'chat-chip';
      chip.textContent = item.q;
      chip.addEventListener('click', function () { handleQuestion(i); });
      quickEl.appendChild(chip);
    });
  }

  function showEndOptions() {
    clearQuick();

    var back = document.createElement('button');
    back.className = 'chat-chip';
    back.textContent = C.backBtn;
    back.addEventListener('click', showMainMenu);

    var wa = document.createElement('button');
    wa.className = 'chat-chip wa';
    wa.textContent = C.waBtn;
    wa.addEventListener('click', function () {
      if (typeof gtag === 'function') {
        gtag('event', 'conversion', { send_to: 'AW-18274328782/hWxfCJHN_cYcEM7B8IlE' });
      }
      window.open(WA_URL, '_blank', 'noopener,noreferrer');
    });

    quickEl.appendChild(back);
    quickEl.appendChild(wa);
  }

  function handleQuestion(index) {
    clearQuick();
    addMsg(QA[index].q, 'user');
    showTyping(function () {
      addMsg(QA[index].a, 'bot');
      showEndOptions();
    }, 700);
  }

  function initChat() {
    if (initiated) return;
    initiated = true;
    showTyping(function () {
    addMsg(C.welcome, 'bot');
      setTimeout(showMainMenu, 300);
    }, 600);
  }

  function openChat() {
    isOpen = true;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    toggleBtn.setAttribute('aria-expanded', 'true');
    if (iconMsg) iconMsg.style.display = 'none';
    if (iconX)   iconX.style.display   = '';
    if (badge)   badge.classList.add('hidden');
    initChat();
  }

  function closeChat() {
    isOpen = false;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    toggleBtn.setAttribute('aria-expanded', 'false');
    if (iconMsg) iconMsg.style.display = '';
    if (iconX)   iconX.style.display   = 'none';
  }

  toggleBtn.addEventListener('click', function () {
    if (isOpen) closeChat(); else openChat();
  });

  if (closeBtn) closeBtn.addEventListener('click', closeChat);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closeChat();
  });
})();
