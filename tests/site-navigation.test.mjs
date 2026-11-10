import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
const blogFiles = readdirSync(path.join(root, 'blog')).filter(file => file.endsWith('.html')).map(file => `blog/${file}`);
const pages = ['index.html', 'en.html', 'ru.html', ...blogFiles];

test('public pages have valid local navigation targets, assets and structured data', () => {
  for (const file of pages) {
    const html = read(file);
    const base = new URL(file, 'https://babyguard.rs/');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${file}: duplicate ID`);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${file}: exactly one main heading`);
    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const url = new URL(match[1], base);
      if (url.origin !== base.origin) continue;
      let target = decodeURIComponent(url.pathname).replace(/^\//, '');
      if (!target || statSync(path.join(root, target)).isDirectory()) target += 'index.html';
      assert.ok(statSync(path.join(root, target)).isFile(), `${file}: missing ${match[1]}`);
      if (url.hash && target.endsWith('.html')) {
        const id = decodeURIComponent(url.hash.slice(1));
        assert.ok(read(target).includes(`id="${id}"`), `${file}: missing anchor ${match[1]}`);
      }
    }
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(match[1]), `${file}: invalid structured data`);
    }
    assert.equal([...html.matchAll(/<script src="(?:\.\.\/)?navigation.js"><\/script>/g)].length, 1, `${file}: load shared navigation once`);
    assert.match(html, /aria-controls="mobile-navigation"/);
    assert.match(html, /class="mobile-nav" id="mobile-navigation" aria-hidden="true" inert/);
  }
});

test('every blog page uses the home-page footer and the same header links', () => {
  const home = read('index.html');
  const footer = home.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0].replace(/href="#/g, 'href="/#');
  const homeHeader = home.match(/<header[\s\S]*?<\/header>/)[0].replace(/href="#/g, 'href="/#');
  const links = html => [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  for (const file of blogFiles) {
    const html = read(file);
    assert.equal(html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0], footer, `${file}: footer must match home`);
    assert.deepEqual(links(html.match(/<header[\s\S]*?<\/header>/)[0]), links(homeHeader), `${file}: header destinations must match home`);
    assert.doesNotMatch(html, /mobile-header|nav-menu|animated-section|class="btn"|<style>|blog\.js/);
    assert.match(html, /<a id="whatsapp-float"[^>]+aria-label=/);
    if (file !== 'blog/index.html') {
      assert.match(html, /class="btn-primary" target="_blank" rel="noopener noreferrer"/);
      assert.match(html, /class="blog-back-link" href="\/blog\/"/);
    }
  }
  const cards = [...read('blog/index.html').matchAll(/class="btn-read-more"/g)];
  assert.equal(cards.length, blogFiles.length - 1, 'the blog lists every article');
});

test('blog HTML has balanced elements', () => {
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const file of blogFiles) {
    const html = read(file).replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    const stack = [];
    for (const match of html.matchAll(/<(\/?)([a-z][\w:-]*)(?:\s[^>]*?)?\s*(\/?)>/gi)) {
      const [, closing, name, selfClosing] = match;
      if (closing) assert.equal(stack.pop(), name.toLowerCase(), `${file}: unexpected closing ${name}`);
      else if (!selfClosing && !voidTags.has(name.toLowerCase())) stack.push(name.toLowerCase());
    }
    assert.deepEqual(stack, [], `${file}: unclosed elements`);
  }
});

// Small event fixture: exercises the shipped script's state transitions without a browser.
function navigationFixture() {
  function element() {
    const classes = new Set();
    const listeners = new Map();
    return {
      attrs: {}, children: [], focused: false, inert: false,
      classList: {
        contains: value => classes.has(value),
        toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value),
      },
      setAttribute(name, value) { this.attrs[name] = value; },
      addEventListener(name, callback) {
        const callbacks = listeners.get(name) || [];
        callbacks.push(callback);
        listeners.set(name, callbacks);
      },
      dispatch(name, event = {}) { for (const callback of listeners.get(name) || []) callback(event); },
      contains(target) { return this === target || this.children.some(child => child.contains(target)); },
      focus() { this.focused = true; },
    };
  }
  const document = element();
  const hamburger = element();
  const menu = element();
  const link = element();
  const dropdown = element();
  const languageButton = element();
  const layout = element();
  const header = element();
  menu.children.push(link);
  dropdown.children.push(languageButton);
  menu.querySelectorAll = () => [link];
  dropdown.querySelector = () => languageButton;
  header.querySelector = selector => ({ '.hamburger': hamburger, '.mobile-nav': menu, '.lang-dropdown': dropdown })[selector];
  document.querySelector = () => header;
  const window = { matchMedia: () => layout };
  runInNewContext(read('navigation.js'), { document, window });
  const click = target => { target.dispatch('click', { target }); document.dispatch('click', { target }); };
  const escape = () => document.dispatch('keydown', { key: 'Escape' });
  return { document, hamburger, menu, link, dropdown, languageButton, layout, click, escape };
}

test('mobile menu stays in sync with accessibility state and closes after selecting a link', () => {
  const f = navigationFixture();
  assert.equal(f.menu.inert, true);
  assert.equal(f.menu.attrs['aria-hidden'], 'true');
  f.click(f.hamburger);
  assert.equal(f.hamburger.attrs['aria-expanded'], 'true');
  assert.equal(f.menu.attrs['aria-hidden'], 'false');
  assert.equal(f.menu.inert, false);
  assert.equal(f.menu.classList.contains('open'), true);
  f.click(f.link);
  assert.equal(f.menu.inert, true);
  assert.equal(f.hamburger.attrs['aria-expanded'], 'false');
  f.click(f.hamburger);
  f.click(f.hamburger);
  assert.equal(f.menu.classList.contains('open'), false);
});

test('Escape restores focus and outside clicks and layout changes close the menu', () => {
  const f = navigationFixture();
  f.click(f.hamburger);
  f.escape();
  assert.equal(f.menu.inert, true);
  assert.equal(f.hamburger.focused, true);
  f.click(f.hamburger);
  f.document.dispatch('click', { target: {} });
  assert.equal(f.menu.inert, true);
  f.click(f.hamburger);
  f.layout.dispatch('change');
  assert.equal(f.menu.inert, true);
});

test('language dropdown supports touch, Escape, outside clicks and layout changes', () => {
  const f = navigationFixture();
  f.click(f.languageButton);
  assert.equal(f.languageButton.attrs['aria-expanded'], 'true');
  f.escape();
  assert.equal(f.languageButton.attrs['aria-expanded'], 'false');
  assert.equal(f.languageButton.focused, true);
  f.click(f.languageButton);
  f.document.dispatch('click', { target: {} });
  assert.equal(f.dropdown.classList.contains('open'), false);
  f.click(f.languageButton);
  f.layout.dispatch('change');
  assert.equal(f.languageButton.attrs['aria-expanded'], 'false');
});
