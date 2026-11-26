(function () {
  'use strict';
  var c = window.BABYGUARD_NEWSLETTER;
  if (!c || document.documentElement.lang !== 'sr') return;
  var local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  var previewMode = local && new URLSearchParams(location.search).get('newsletter-preview');
  var preview = previewMode === '1';
  var liveTest = previewMode === 'live';
  var formUrl;
  try {
    var parsed = new URL(c.formUrl);
    if (parsed.protocol === 'https:' && (parsed.hostname === 'sibforms.com' || parsed.hostname.endsWith('.sibforms.com')) && !parsed.username && !parsed.password) formUrl = parsed.href;
  } catch (_) { /* Unconfigured stays off on the public website. */ }
  if (!preview && (!formUrl || (!c.enabled && !liveTest))) return;
  var key = 'babyguard.newsletter.dismissed.v1';
  var previousFocus;
  var offer = c.offer;
  var dialog = document.createElement('dialog');
  dialog.className = 'newsletter-dialog';
  dialog.setAttribute('aria-labelledby', 'newsletter-title');
  dialog.innerHTML = '<div class="newsletter-header"><span class="newsletter-brand" id="newsletter-header-title">BabyGuard</span>' +
    '<button type="button" class="newsletter-close" aria-label="Zatvorite prijavu">×</button></div>' +
    '<div class="newsletter-body"><p class="newsletter-eyebrow"></p><h2 id="newsletter-title"></h2>' +
    '<p class="newsletter-description"></p><div class="newsletter-content"></div><p class="newsletter-note"></p></div>';
  dialog.querySelector('.newsletter-eyebrow').textContent = offer.eyebrow;
  dialog.querySelector('h2').textContent = offer.title;
  dialog.querySelector('.newsletter-description').textContent = offer.description;
  dialog.querySelector('.newsletter-note').textContent = offer.note;
  document.body.appendChild(dialog);
  var content = dialog.querySelector('.newsletter-content');
  if (preview) {
    content.innerHTML = '<p class="newsletter-preview">Pregled izgleda · prijave još nisu aktivne</p>' +
      '<form class="newsletter-demo"><label for="newsletter-email">Vaša email adresa</label>' +
      '<input id="newsletter-email" type="email" name="email" autocomplete="email" placeholder="ime@primer.com" required maxlength="254">' +
      '<label class="newsletter-consent"><input type="checkbox" name="marketing" aria-describedby="newsletter-consent-note">' +
      '<span>Želim i BabyGuard savete i ponude emailom.</span></label>' +
      '<p class="newsletter-consent-note" id="newsletter-consent-note">Opciono. Vodič dobijate i bez newslettera. Odjava je moguća u svakom trenutku.</p>' +
      '<button class="newsletter-button" type="submit"></button>' +
      '<p class="newsletter-status" role="status" aria-live="polite"></p></form>';
    content.querySelector('button').textContent = offer.button;
    content.querySelector('form').addEventListener('submit', function (event) {
      event.preventDefault();
      content.querySelector('.newsletter-status').textContent = 'Ovo je pregled: adresa nije sačuvana i email nije poslat. Prijava će biti dostupna nakon povezivanja servisa.';
    });
  } else {
    dialog.classList.add('newsletter-dialog--hosted');
    dialog.setAttribute('aria-labelledby', 'newsletter-header-title');
    // Provider validates the CAPTCHA and handles email delivery/consent.
    // Loading only on open avoids contacting Brevo before a visitor sees the form.
    var frame = document.createElement('iframe');
    frame.title = 'Zatražite vodič i izaberite prijavu na BabyGuard newsletter';
    // Use Brevo's iframe URL; /serve/ is the full-page sharing link.
    var embedUrl = new URL(formUrl);
    embedUrl.pathname = embedUrl.pathname.replace(/^\/serve\//, '/v2/serve/');
    frame.dataset.src = embedUrl.href;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    content.appendChild(frame);
    var fallback = document.createElement('a');
    fallback.href = formUrl;
    fallback.textContent = 'Otvorite prijavu u novoj kartici';
    fallback.target = '_blank';
    fallback.rel = 'noopener noreferrer';
    content.appendChild(fallback);
  }
  var section = document.createElement('section');
  section.className = 'newsletter-invite';
  section.setAttribute('aria-label', 'Besplatan vodič za roditelje');
  var heading = document.createElement('h2');
  heading.textContent = offer.title;
  var description = document.createElement('p');
  description.textContent = offer.description;
  var trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'newsletter-button';
  trigger.textContent = offer.button;
  trigger.setAttribute('aria-haspopup', 'dialog');
  section.append(heading, description, trigger);
  var footer = document.querySelector('.site-footer');
  if (footer) footer.before(section); else document.body.appendChild(section);
  function suppressed() {
    // Local previews must remain repeatable after closing and reloading.
    if (preview || liveTest) return false;
    try {
      var until = Number(localStorage.getItem(key));
      return Number.isFinite(until) && until > Date.now();
    } catch (_) { return false; }
  }
  function open() {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    var frame = content.querySelector('iframe');
    if (frame && !frame.src) frame.src = frame.dataset.src;
    dialog.showModal();
    document.documentElement.classList.add('newsletter-open');
  }
  dialog.querySelector('.newsletter-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (event) {
    var rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', function () {
    document.documentElement.classList.remove('newsletter-open');
    if (!preview && !liveTest) {
      try { localStorage.setItem(key, String(Date.now() + c.dismissDays * 86400000)); } catch (_) { /* Storage optional. */ }
    }
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  });
  trigger.addEventListener('click', open);
  function autoOpen() {
    if (suppressed() || dialog.open) return;
    if (document.hidden || document.querySelector('dialog[open], .modal.active') || document.activeElement.matches('input, textarea, select')) {
      timer = window.setTimeout(autoOpen, 1000);
      return;
    }
    open();
  }
  var timer = window.setTimeout(autoOpen, c.delayMs);
  trigger.addEventListener('click', function () { window.clearTimeout(timer); });
  window.addEventListener('storage', function (event) {
    if (event.key === key && suppressed()) window.clearTimeout(timer);
  });
})();
