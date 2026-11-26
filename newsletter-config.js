/* Public settings only. Never put API keys here.
 * Activate only after the Brevo form, consent, CAPTCHA and emails are tested.
 * Changing a campaign: edit offer below AND its matching Brevo form/emails.
 */
window.BABYGUARD_NEWSLETTER = {
  enabled: false,
  campaignId: 'prvi-vodic',
  delayMs: 10000,
  dismissDays: 7,
  // Brevo hosted full-page form URL (https://….sibforms.com/serve/…).
  // Embed this protected form, not a public API key or custom POST endpoint.
  formUrl: 'https://bc08a302.sibforms.com/serve/MUIFAKJ6CKLfiyH70KTfDy1J_ZpNmdy3si0spELn21hKA3EUol2eYH8MvA4JEbhHkiih2ZMfDQ7lnRKRLefKh6pSry5jhRX9IXulJXqlocY-cuBVFYZAT5U7otwHKzsjxpTxFy028qbIKLna5ziwjHvfCwWv0mnyR2YGdHJZ8yiI9bRAhlZ39CLy3eFIPCBec0hWAcqijkQi3rcB7A==',
  offer: {
    eyebrow: 'BESPLATAN VODIČ ZA RODITELJE',
    title: 'Vaš besplatan vodič za mirnije čuvanje',
    description: '8 praktičnih saveta, pravo u Vaš inbox.',
    button: 'Želim besplatan vodič',
    note: 'Besplatno. Bez obaveze.'
  }
};
