import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as model from '../evidencija/model.mjs';

const html = await readFile(new URL('../evidencija/index.html', import.meta.url), 'utf8');
const source = (await readFile(new URL('../evidencija/app.js', import.meta.url), 'utf8'))
  .replace(/^import[\s\S]*?from '\.\/model\.mjs';\r?\n/, '');
const sampleShift = { id: 's1', date: '2026-11-02', family: 'Test', sitter: 'Test', shift_type: 'povremeno',
  hours: 2, charged: 10000, paid: 6000, description: null, created: '2026-11-02T10:00:00Z' };
const sampleExpense = { id: 'e1', date: '2026-11-02', title: 'Domen', category: 'domen_hosting', amount: 1000,
  payment_method: 'kartica', description: null, created: '2026-11-02T10:00:00Z' };

async function app({ shifts = [sampleShift], expenses = [sampleExpense], expenseError = false } = {}) {
  const elements = new Map();
  const calls = [];
  const db = { shifts: structuredClone(shifts), expenses: structuredClone(expenses) };
  const failures = { expenses: expenseError };
  const listeners = {};
  let serial = 0;
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
    assert.ok(!elements.has(id), `duplicate HTML id: ${id}`);
    const classes = new Set(id === 'app' ? ['hidden'] : []);
    elements.set(id, { id, value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, style: {},
      listeners: {}, classList: { add: x => classes.add(x), remove: x => classes.delete(x),
        contains: x => classes.has(x), toggle: (x, enabled) => enabled ? classes.add(x) : classes.delete(x) },
      addEventListener(event, handler) { (this.listeners[event] ??= []).push(handler); },
      setAttribute(name, value) { this[name] = value; }, focus() {}, scrollIntoView() {},
      reset() {
        const names = id === 'expenseForm'
          ? ['expenseEditId', 'expenseDate', 'expenseTitle', 'expenseCategory', 'expenseAmount', 'expensePayment', 'expenseDescription']
          : ['editId', 'date', 'family', 'sitter', 'hours', 'charged', 'paid', 'description'];
        for (const name of names) elements.get(name).value = '';
        if (id === 'shiftForm') elements.get('shiftType').value = 'povremeno';
      }
    });
  }
  function element(id) { assert.ok(elements.has(id), `missing HTML id: ${id}`); return elements.get(id); }
  class Query {
    constructor(table) { this.table = table; this.action = 'read'; this.orders = []; this.filters = []; }
    select() { return this; }
    order(key, { ascending = true } = {}) { this.orders.push([key, ascending]); return this; }
    range(first, last) { this.first = first; this.last = last; return this; }
    eq(key, value) { this.filters.push(row => row[key] === value); return this; }
    in(key, values) { this.filters.push(row => values.includes(row[key])); return this; }
    insert(value) { this.action = 'insert'; this.payload = value; return this; }
    update(value) { this.action = 'update'; this.payload = value; return this; }
    delete() { this.action = 'delete'; return this; }
    single() { this.one = true; return this; }
    then(resolve, reject) { return Promise.resolve().then(() => {
      calls.push({ table: this.table, action: this.action, first: this.first });
      if (failures[this.table]) return { data: null, error: { message: 'Test connection failure' } };
      const matches = row => this.filters.every(filter => filter(row));
      let data = db[this.table].filter(matches);
      if (this.action === 'insert') {
        data = [this.payload].flat().map(row => ({ ...row, id: `new${++serial}`, created: '2026-11-02T12:00:00Z' }));
        db[this.table].push(...data);
      } else if (this.action === 'update') { data.forEach(row => Object.assign(row, this.payload)); }
      else if (this.action === 'delete') { db[this.table] = db[this.table].filter(row => !matches(row)); }
      for (const [key, ascending] of [...this.orders].reverse()) {
        data = [...data].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1));
      }
      if (this.first != null) data = data.slice(this.first, this.last + 1);
      if (this.one && data.length !== 1) return { data: null, error: { message: 'Record no longer exists' } };
      return { data: structuredClone(this.one ? data[0] : data), error: null };
    }).then(resolve, reject); }
  }
  const client = { from: table => new Query(table), rpc: async (name, payload) => {
    calls.push({ action: 'rpc', name, payload });
    db.shifts = payload.backup_shifts;
    if (payload.backup_expenses !== null) db.expenses = payload.backup_expenses;
    return { data: {}, error: null };
  }, auth: {
    getSession: async () => ({ data: { session: { user: { email: 'test@example.com', user_metadata: {} } } } }),
    onAuthStateChange: callback => { listeners.auth = callback; }, signOut: async () => { listeners.auth('SIGNED_OUT'); }
  } };
  const document = { getElementById: element, querySelectorAll: () => [],
    addEventListener: (event, handler) => { listeners[event] = handler; } };
  const context = vm.createContext({ ...model, document, window: { sessionStorage: {}, scrollTo() {} },
    supabase: { createClient: () => client }, SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'test',
    confirm: () => true, setTimeout: () => 1, clearTimeout() {}, setInterval() {}, console });
  vm.runInContext(source, context);
  const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
  await settle();
  const fire = async (id, event = 'click', extra = {}) => {
    for (const handler of element(id).listeners[event] || []) await handler({ preventDefault() {}, target: element(id), ...extra });
    await settle();
  };
  const run = code => vm.runInContext(code, context);
  return { element, fire, run, settle, calls, db, failures, listeners };
}

test('app loads both ledgers and updates overview and statistics for the same month', async () => {
  const a = await app();
  assert.match(a.element('kNet').textContent, /3[.\s]?000 RSD/);
  assert.match(a.element('sNet').textContent, /3[.\s]?000 RSD/);
  a.element('statsMonth').value = '2026-10'; await a.fire('statsMonth', 'change');
  assert.equal(a.element('sExpenses').textContent, '0 RSD');
  assert.equal(a.element('sNet').textContent, '0 RSD');
  assert.equal(a.element('dataStatus').hidden, true);
});

test('expense CRUD persists normalized data and refreshes totals and filters', async () => {
  const a = await app();
  for (const [id, value] of Object.entries({ expenseDate: '2026-11-02', expenseTitle: '  Hosting  ',
    expenseCategory: 'domen_hosting', expenseAmount: '250.50', expensePayment: 'racun', expenseDescription: '<script>test</script>' })) a.element(id).value = value;
  await a.fire('expenseForm', 'submit');
  assert.equal(a.db.expenses.length, 2);
  assert.equal(a.db.expenses[1].title, 'Hosting');
  assert.equal(a.db.expenses[1].amount, 250.5);
  assert.ok(a.element('expenseRows').innerHTML.includes('&lt;script&gt;'));
  assert.equal(a.element('expenseEditId').value, '');
  a.run("editExpense('new1')");
  a.element('expenseAmount').value = '500'; await a.fire('expenseForm', 'submit');
  assert.equal(a.db.expenses[1].amount, 500);
  a.element('expensePaymentFilter').value = 'racun'; await a.fire('expensePaymentFilter', 'change');
  assert.match(a.element('expenseTotals').textContent, /1 troškova.*500 RSD/);
  await a.run("deleteExpense('new1')"); await a.settle();
  assert.equal(a.db.expenses.length, 1);
  assert.equal(a.element('expensesEmpty').style.display, 'block');
});

test('failed expense loading never displays a zero cost or an invented financial result; retry recovers', async () => {
  const a = await app({ expenseError: true });
  assert.equal(a.element('kExpenses').textContent, '—');
  assert.equal(a.element('kNet').textContent, '—');
  assert.equal(a.element('sNet').textContent, '—');
  assert.equal(a.element('saveExpenseBtn').disabled, true);
  assert.equal(a.element('settingsExport').disabled, true);
  assert.equal(a.element('dataStatus').hidden, false);
  a.failures.expenses = false; await a.fire('retryLoad');
  assert.equal(a.element('dataStatus').hidden, true);
  assert.equal(a.element('saveExpenseBtn').disabled, false);
});

test('pagination loads all data, including rows after the first 500', async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({ ...sampleExpense, id: `e${index}`, amount: 1 }));
  const a = await app({ expenses: rows });
  assert.match(a.element('expenseTotals').textContent, /1001 troškova/);
  assert.deepEqual(a.calls.filter(c => c.table === 'expenses').map(c => c.first), [0, 500, 1000]);
});

test('backup import uses one RPC and a legacy backup leaves existing expenses intact', async () => {
  const a = await app();
  a.element('importFile').files = [{ text: async () => JSON.stringify({ version: 1, shifts: [sampleShift] }) }];
  await a.fire('importFile', 'change');
  assert.equal(a.calls.filter(c => c.action === 'rpc').length, 1);
  assert.equal(a.calls.find(c => c.action === 'rpc').payload.backup_expenses, null);
  assert.equal(a.db.expenses.length, 1);
  assert.equal(a.calls.filter(c => ['insert', 'delete'].includes(c.action)).length, 0);
});

test('logout clears expense data, edit forms and filters from memory and screen', async () => {
  const a = await app(); a.run("editExpense('e1')");
  a.element('expenseSearch').value = 'Domen';
  a.listeners.auth('SIGNED_OUT');
  assert.equal(a.element('expenseTitle').value, '');
  assert.equal(a.element('expenseEditId').value, '');
  assert.equal(a.element('expenseRows').innerHTML, '');
  assert.equal(a.element('expenseSearch').value, '');
  assert.equal(a.run('expenses.length'), 0);
  assert.equal(a.element('app').classList.contains('hidden'), true);
});
