import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../newsletter.js', import.meta.url), 'utf8');
const config = readFileSync(new URL('../newsletter-config.js', import.meta.url), 'utf8');
function boot({ hostname = 'babyguard.rs', search = '', lang = 'sr', overrides = {} } = {}) {
  const context = { window: {}, URL, URLSearchParams, location: { hostname, search },
    document: { documentElement: { lang }, createElement() { throw new Error('UI reached'); } } };
  vm.runInNewContext(config, context);
  Object.assign(context.window.BABYGUARD_NEWSLETTER, overrides);
  vm.runInNewContext(code, context);
}
test('disabled public signup stays off, including when local-only preview parameters are supplied', () => {
  for (const search of ['', '?newsletter-preview=1', '?newsletter-preview=live']) {
    assert.doesNotThrow(() => boot({ search, overrides: { enabled: false } }));
  }
});

test('production signup remains disabled while CAPTCHA and delivery are unverified', () => {
  const context = { window: {} };
  vm.runInNewContext(config, context);
  assert.equal(context.window.BABYGUARD_NEWSLETTER.enabled, false);
});

test('explicit activation renders the real form, including with preview parameters', () => {
  for (const search of ['', '?newsletter-preview=1', '?newsletter-preview=live']) {
    assert.throws(() => boot({ search, overrides: { enabled: true } }), /UI reached/);
  }
});
test('activation rejects insecure, unrelated and credential-bearing embed URLs', () => {
  for (const formUrl of ['http://example.sibforms.com/serve/a', 'https://sibforms.com.evil.test/', 'https://evil.test/', 'https://user:pass@example.sibforms.com/']) {
    assert.doesNotThrow(() => boot({ overrides: { enabled: true, formUrl } }));
  }
});
test('valid activated Brevo form and explicit local preview reach rendering', () => {
  assert.throws(() => boot({ overrides: { enabled: true, formUrl: 'https://example.sibforms.com/serve/a' } }), /UI reached/);
  assert.throws(() => boot({ hostname: '127.0.0.1', search: '?newsletter-preview=1' }), /UI reached/);
  assert.throws(() => boot({ hostname: '127.0.0.1', search: '?newsletter-preview=live' }), /UI reached/);
});
test('other languages remain unchanged', () => {
  assert.doesNotThrow(() => boot({ lang: 'en', hostname: 'localhost', search: '?newsletter-preview=1' }));
});
