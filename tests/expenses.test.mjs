import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExpense, normalizeShift, financialTotals, expenseTotal, filterExpenses,
  monthlyFinance, parseBackup, expensesCsv, localDate } from '../evidencija/model.mjs';

const expense = (overrides = {}) => ({ date: '2026-11-02', title: 'Obnova domena', category: 'domen_hosting',
  amount: 2500, payment_method: 'kartica', description: 'Za narednih godinu dana', ...overrides });
const shift = (overrides = {}) => ({ date: '2026-11-02', family: 'Test porodica', sitter: 'Test dadilja',
  hours: 2, charged: 10000, paid: 6000, ...overrides });

test('validates expenses and rejects invalid dates, amounts, categories and payment methods', () => {
  assert.equal(normalizeExpense(expense({ title: '  Domen  ', amount: '2500.50' })).amount, 2500.5);
  assert.equal(normalizeExpense(expense({ title: '  Domen  ' })).title, 'Domen');
  for (const change of [{ date: '2026-02-30' }, { amount: 0 }, { amount: -1 }, { amount: '1.001' },
    { amount: Infinity }, { amount: null }, { amount: '10000000000' }, { category: 'invalid' },
    { category: '__proto__' }, { payment_method: 'invalid' }, { title: '   ' }, { title: 'x'.repeat(101) }]) {
    assert.throws(() => normalizeExpense(expense(change)));
  }
});

test('money totals use cents, avoid duplicate sitter payouts and allow a negative result', () => {
  assert.deepEqual(financialTotals([shift()], [expense({ amount: 1000 })]),
    { revenue: 10000, paid: 6000, profit: 4000, expenses: 1000, net: 3000, hours: 2, count: 1 });
  assert.equal(expenseTotal([expense({ amount: 0.1 }), expense({ amount: 0.2 })]), 0.3);
  assert.equal(financialTotals([], [expense({ amount: 300 })]).net, -300);
});

test('all expense filters compose and sorting is stable without mutating the source', () => {
  const source = [expense({ id: '1', created: '2026-11-01' }),
    expense({ id: '2', created: '2026-11-02', description: 'Ćirilica i latinica' }),
    expense({ id: '3', date: '2026-10-01', category: 'marketing', payment_method: 'gotovina' })];
  assert.deepEqual(filterExpenses(source).map(e => e.id), ['2', '1', '3']);
  assert.deepEqual(source.map(e => e.id), ['1', '2', '3']);
  assert.equal(filterExpenses(source, { query: ' ćIRILICA ', month: '2026-11', category: 'domen_hosting', payment: 'kartica' })[0].id, '2');
  assert.equal(filterExpenses(source, { payment: 'racun' }).length, 0);
});

test('monthly finance includes expense-only months and keeps both ledgers in the same period', () => {
  const months = monthlyFinance([shift({ date: '2026-10-20' })], [expense({ date: '2026-11-01' })]);
  assert.equal(months.length, 2);
  assert.equal(months[0].net, 4000);
  assert.equal(months[1].net, -2500);
  assert.equal(months[1].count, 0);
  assert.equal(monthlyFinance([], []).length, 0);
});

test('v2 backup validates both ledgers and deliberately empty expenses replace expenses', () => {
  const parsed = parseBackup({ app: 'BabyGuard Interna Evidencija', version: 2, shifts: [shift()], expenses: [expense()] });
  assert.equal(parsed.shifts[0].shift_type, 'povremeno');
  assert.equal(parsed.expenses[0].amount, 2500);
  assert.deepEqual(parseBackup({ version: 2, shifts: [], expenses: [] }), { shifts: [], expenses: [] });
  assert.throws(() => parseBackup({ version: 2, shifts: [], expenses: [expense({ amount: -1 })] }));
  assert.throws(() => parseBackup({ version: 2, shifts: [] }));
  assert.throws(() => parseBackup({ version: 3, shifts: [], expenses: [] }));
});

test('legacy backups preserve expenses and invalid shifts fail before any replacement', () => {
  assert.equal(parseBackup([shift()]).expenses, null);
  assert.equal(parseBackup({ version: 1, shifts: [shift()] }).expenses, null);
  assert.throws(() => parseBackup({ shifts: [shift({ hours: 'abc' })] }));
  assert.throws(() => parseBackup({ shifts: [shift({ charged: -10 })] }));
  assert.equal(normalizeShift(shift()).shift_type, 'povremeno');
});

test('CSV supports Serbian text, multiline notes, quotes and prevents spreadsheet formulas', () => {
  const csv = expensesCsv([expense({ title: '=HYPERLINK("test")', description: 'Račun; "domen"\nnovi red' })]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.ok(csv.includes('"\'=HYPERLINK(""test"")"'));
  assert.ok(csv.includes('"Račun; ""domen""\nnovi red"'));
  assert.ok(csv.includes('"Domen i hosting";"2500";"Kartica"'));
});

test('default date uses the device calendar, including near midnight', () => {
  const clock = { getFullYear: () => 2026, getMonth: () => 10, getDate: () => 2 };
  assert.equal(localDate(clock), '2026-11-02');
});
