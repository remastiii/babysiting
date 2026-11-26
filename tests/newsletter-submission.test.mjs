import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

function signupFixture(origin = 'https://babyguard.rs') {
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.listeners = new Map();
      this.parts = new Map();
      this.dataset = {};
      this.attrs = {};
      this.hidden = false;
      this.open = false;
      this.isConnected = true;
      this.src = '';
      this.contentWindow = {};
      const classes = new Set();
      this.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) };
    }
    set innerHTML(html) {
      for (const selector of ['.newsletter-eyebrow', 'h2', '.newsletter-description', '.newsletter-note', '.newsletter-content', '.newsletter-close', 'button']) {
        const present = selector.startsWith('.') ? html.includes(`class="${selector.slice(1)}"`) : html.includes(`<${selector}`);
        if (present) this.parts.set(selector, new Element(selector === 'button' || selector === '.newsletter-close' ? 'button' : 'div'));
      }
    }
    querySelector(selector) {
      if (selector === 'iframe') return this.children.find(child => child.tag === 'iframe') || null;
      return this.parts.get(selector) || null;
    }
    append(...elements) { this.children.push(...elements); }
    appendChild(element) { this.append(element); }
    setAttribute(name, value) { this.attrs[name] = value; }
    addEventListener(name, handler) {
      const handlers = this.listeners.get(name) || [];
      handlers.push(handler);
      this.listeners.set(name, handlers);
    }
    fire(name, event = {}) { for (const handler of this.listeners.get(name) || []) handler(event); }
    focus() { this.focused = true; }
    matches() { return false; }
    showModal() { this.open = true; }
    close() { this.open = false; this.fire('close'); }
  }
  const body = new Element('body');
  const root = new Element('html');
  root.lang = 'sr';
  const previousFocus = new Element('button');
  const footer = { before: section => { footer.section = section; } };
  const listeners = new Map();
  const timers = new Map();
  const storage = new Map();
  let timerId = 0;
  const context = {
    URL, URLSearchParams,
    location: { origin, hostname: new URL(origin).hostname, search: '' },
    document: { body, documentElement: root, activeElement: previousFocus, hidden: false,
      createElement: tag => new Element(tag), querySelector: selector => selector === '.site-footer' ? footer : null },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    window: { addEventListener: (name, handler) => listeners.set(name, handler),
      setTimeout: handler => { timers.set(++timerId, handler); return timerId; }, clearTimeout: id => timers.delete(id) }
  };
  vm.runInNewContext(read('newsletter-config.js'), context);
  context.window.BABYGUARD_NEWSLETTER.enabled = true;
  vm.runInNewContext(read('newsletter.js'), context);
  const dialog = body.children.find(element => element.tag === 'dialog');
  const frame = dialog.querySelector('.newsletter-content').querySelector('iframe');
  const feedback = body.children.find(element => element.className === 'newsletter-feedback');
  const trigger = footer.section.children.at(-1);
  trigger.fire('click');
  return { dialog, frame, feedback, trigger, root, previousFocus, timers, storage,
    message: event => listeners.get('message')(event) };
}

test('provider events, other windows and unrelated messages cannot close the signup', () => {
  const f = signupFixture();
  const valid = { origin: 'https://babyguard.rs', source: f.frame.contentWindow, data: { type: 'babyguard:newsletter-submitted' } };
  for (const changes of [
    { origin: 'https://bc08a302.sibforms.com' }, { origin: 'https://evil.example' },
    { source: {} }, { source: null }, { data: null }, { data: 'success' }, { data: { type: 'error' } }
  ]) {
    f.message({ ...valid, ...changes });
    assert.equal(f.dialog.open, true);
    assert.equal(f.feedback.hidden, true);
  }
});

test('our confirmation in the signup iframe closes the popup and restores the page', () => {
  const f = signupFixture();
  assert.equal(f.root.classList.contains('newsletter-open'), true);
  f.message({ origin: 'https://babyguard.rs', source: f.frame.contentWindow, data: { type: 'babyguard:newsletter-submitted' } });
  assert.equal(f.dialog.open, false);
  assert.equal(f.root.classList.contains('newsletter-open'), false);
  assert.equal(f.previousFocus.focused, true);
  assert.equal(f.feedback.hidden, false);
  assert.equal(f.timers.size, 0);
  assert.ok(Number(f.storage.get('babyguard.newsletter.dismissed.v1')) > Date.now());
  f.feedback.querySelector('button').fire('click');
  assert.equal(f.feedback.hidden, true);
  f.trigger.fire('click');
  assert.equal(f.dialog.open, false, 'the completed form must not reopen');
  assert.equal(f.feedback.hidden, false);
});

test('local live previews accept the production confirmation from their own signup frame', () => {
  const f = signupFixture('http://127.0.0.1:4173');
  f.message({ origin: 'https://babyguard.rs', source: f.frame.contentWindow, data: { type: 'babyguard:newsletter-submitted' } });
  assert.equal(f.dialog.open, false);
});

test('the confirmation bridge only notifies an embedding parent using explicit origins', () => {
  const messages = [];
  const parent = { postMessage: (data, origin) => messages.push({ data, origin }) };
  vm.runInNewContext(read('newsletter-success.js'), { window: { parent } });
  assert.ok(messages.some(message => message.origin === 'https://babyguard.rs'));
  assert.ok(messages.some(message => message.origin === 'http://127.0.0.1:4173'));
  assert.ok(messages.every(message => message.origin !== '*' && Object.keys(message.data).join() === 'type'));
  assert.ok(messages.every(message => message.data.type === 'babyguard:newsletter-submitted'));
  const standalone = {};
  standalone.parent = standalone;
  assert.doesNotThrow(() => vm.runInNewContext(read('newsletter-success.js'), { window: standalone }));
});
