# BabyGuard

Static website with a private shifts and business expense ledger at `/evidencija/`.

## Local preview

Requires Node.js, with no package installation:

```powershell
node scripts/serve-local.mjs
```

Open <http://127.0.0.1:4173/evidencija/> and sign in with your existing account.
Stop the server with Ctrl+C. An alternative port can be set through `PORT`.

**Local preview uses the same Supabase database as the live website.** Test entries
are shared between both accounts. Give temporary entries a clear test name and
remove them individually after testing. No changes are pushed or deployed by this server.

## Manual acceptance checks

1. Open **Troškovi**, add a paid expense with its date, name, category, amount,
   payment method and optional note. Reload and check that it remains saved.
2. Edit the expense, cancel an edit, and combine month/category/payment/search filters.
   The displayed total and CSV export must match the filtered rows.
3. Check the same month on **Početna** and **Statistika**. The result is collected
   revenue minus sitter payouts minus recorded business expenses. An expense-only
   month must appear in the monthly chart with a negative result.
4. Export a JSON backup and check that it contains both `shifts` and `expenses`.
   Import replaces the corresponding shared ledgers, so keep a current backup.
   A v1/shifts-only backup leaves expenses untouched. Restored records receive new
   IDs and creation metadata for the importing account.
5. Check the layout on a phone, then remove your temporary test expense. Verify
   that the original shift flow still works.

## Automated checks

```powershell
node --test tests/expenses.test.mjs tests/app.test.mjs
node --test tests/site-navigation.test.mjs
node --check evidencija/app.js
```

The app tests use an in-memory DOM and Supabase adapter; they do not write to the
shared database and do not replace a visual browser test.

## Database changes

`supabase/migrations/20261102160250_add_expense_ledger.sql` adds `expenses`, a
private membership list for the two existing team accounts, and the transactional
`restore_babyguard_backup` RPC. It has been applied to the connected project.
The migration deliberately leaves the existing `shifts` table and its policies intact.
The filename matches the migration version in the connected project. It assumes
the existing `shifts` schema and both team accounts; it is not a complete schema
for bootstrapping a new Supabase project. When applying it in another environment,
first set `babyguard.team_emails` in the migration transaction to a JSON array of
the two verified account addresses. The connected project already has its team
membership seeded; the public source omits those addresses. Do not apply the SQL
manually twice.

`supabase/tests/expenses_access.sql` tests team access, rejected writes, and atomic
backup restore. Run the **whole file** as postgres; it wraps its writes in a
transaction and ends with `ROLLBACK`.
