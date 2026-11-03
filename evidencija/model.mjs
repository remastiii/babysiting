export const EXPENSE_TYPES = Object.freeze({
  domen_hosting: 'Domen i hosting', marketing: 'Marketing', oprema: 'Oprema',
  softver: 'Softver i pretplate', administracija: 'Administracija', prevoz: 'Prevoz', ostalo: 'Ostalo'
});
export const PAYMENT_METHODS = Object.freeze({ kartica: 'Kartica', racun: 'Račun', gotovina: 'Gotovina' });
export const SHIFT_TYPES = Object.freeze({
  povremeno: 'Povremeno čuvanje', nocno: 'Noćno čuvanje', hotelsko: 'Hotelsko čuvanje',
  hitno: 'Hitno čuvanje', proslave: 'Čuvanje na proslavama'
});

export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function cents(value) {
  const amount = Number(value);
  const result = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(result)) throw new Error('Neispravan iznos.');
  return result;
}

function amount(value, positive = false) {
  if (!['number', 'string'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value))) {
    throw new Error('Iznos mora imati najviše dve decimale.');
  }
  const minor = cents(value);
  if (minor < (positive ? 1 : 0) || minor > 999999999999) throw new Error('Iznos je van dozvoljenog opsega.');
  return minor / 100;
}

function text(value, max, required = false) {
  if (value != null && typeof value !== 'string') throw new Error('Neispravan tekst.');
  const result = (value || '').trim();
  if ((required && !result) || result.length > max) throw new Error(`Proveri tekst (najviše ${max} znakova).`);
  return result;
}

export function normalizeExpense(value) {
  if (!value || !validDate(value.date)) throw new Error('Proveri datum troška.');
  if (!Object.hasOwn(EXPENSE_TYPES, value.category)) throw new Error('Izaberi vrstu troška.');
  if (!Object.hasOwn(PAYMENT_METHODS, value.payment_method)) throw new Error('Izaberi način plaćanja.');
  return {
    date: value.date, title: text(value.title, 100, true), category: value.category,
    amount: amount(value.amount, true), payment_method: value.payment_method,
    description: text(value.description, 500) || null
  };
}

export function normalizeShift(value) {
  if (!value || !validDate(value.date)) throw new Error('Proveri datum smene.');
  const hours = Number(value.hours);
  if (!Number.isFinite(hours) || hours < 0.25 || hours > 100 || !Number.isInteger(hours * 4)) {
    throw new Error('Broj sati mora biti od 0,25 do 100, u koracima od 0,25.');
  }
  const shiftType = value.shift_type ?? 'povremeno';
  if (!Object.hasOwn(SHIFT_TYPES, shiftType)) throw new Error('Proveri vrstu smene.');
  return {
    date: value.date, family: text(value.family, 100, true), sitter: text(value.sitter, 100, true),
    shift_type: shiftType, hours, charged: amount(value.charged), paid: amount(value.paid),
    description: text(value.description, 500) || null
  };
}

export function expenseTotal(list) {
  return list.reduce((total, item) => total + cents(item.amount), 0) / 100;
}

export function financialTotals(shifts, expenses) {
  const revenue = shifts.reduce((sum, shift) => sum + cents(shift.charged), 0);
  const paid = shifts.reduce((sum, shift) => sum + cents(shift.paid), 0);
  const costs = expenses.reduce((sum, expense) => sum + cents(expense.amount), 0);
  return { revenue: revenue / 100, paid: paid / 100, profit: (revenue - paid) / 100,
    expenses: costs / 100, net: (revenue - paid - costs) / 100,
    hours: shifts.reduce((sum, shift) => sum + Number(shift.hours), 0), count: shifts.length };
}

export function inMonth(list, month) {
  return list.filter(item => !month || item.date.startsWith(month));
}

export function filterExpenses(list, { query = '', month = '', category = '', payment = '' } = {}) {
  const search = query.trim().toLocaleLowerCase('sr');
  return list.filter(item => (!search || `${item.title} ${item.description || ''}`.toLocaleLowerCase('sr').includes(search))
    && (!month || item.date.startsWith(month)) && (!category || item.category === category)
    && (!payment || item.payment_method === payment))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.created || '').localeCompare(String(a.created || '')) || String(a.id || '').localeCompare(String(b.id || '')));
}

export function monthlyFinance(shifts, expenses, limit = 6) {
  const months = [...new Set([...shifts, ...expenses].map(item => item.date.slice(0, 7)))].sort().slice(-limit);
  return months.map(month => ({ month, ...financialTotals(inMonth(shifts, month), inMonth(expenses, month)) }));
}

export function parseBackup(value) {
  if (!value || typeof value !== 'object') throw new Error('Neispravna rezervna kopija.');
  const legacyArray = Array.isArray(value);
  const version = legacyArray ? 1 : value.version ?? 1;
  if (![1, 2].includes(version)) throw new Error('Verzija rezervne kopije nije podržana.');
  if (!legacyArray && value.app && value.app !== 'BabyGuard Interna Evidencija') throw new Error('Ovo nije BabyGuard rezervna kopija.');
  const shifts = legacyArray ? value : value.shifts;
  if (!Array.isArray(shifts) || (version === 2 && !Array.isArray(value.expenses))) throw new Error('Nedostaje evidencija u rezervnoj kopiji.');
  // null means leave expenses untouched when restoring an older shifts-only backup.
  return { shifts: shifts.map(normalizeShift), expenses: version === 2 ? value.expenses.map(normalizeExpense) : null };
}

export function csvCell(value) {
  let result = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+\-@\t\r\n]/.test(result)) result = "'" + result;
  return '"' + result.replace(/"/g, '""') + '"';
}

export function expensesCsv(list) {
  const rows = [['Datum', 'Naziv', 'Vrsta troška', 'Iznos RSD', 'Način plaćanja', 'Napomena'],
    ...list.map(item => [item.date, item.title, EXPENSE_TYPES[item.category], item.amount,
      PAYMENT_METHODS[item.payment_method], item.description])];
  return '\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
}
