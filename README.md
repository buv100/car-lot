# car-lot

מגרש להשכרה ולמכירה של רכבים.

האפיון והבנייה:

- [docs/SPEC.md](docs/SPEC.md) — מה המערכת עושה
- [docs/Rules.md](docs/Rules.md) — איך בונים
- [docs/CHANGES.md](docs/CHANGES.md) — מה השתנה

דרוש Node 22. מנהל החבילות הוא pnpm.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm db:migrate
pnpm db:seed
```

PostgreSQL 16. `DATABASE_URL` והמנהל הראשון נקראים מ-`.env` שבשורש, לפי `.env.example`.

לקוח בפיתוח: `pnpm --filter client dev` על פורט 5173. שרת: `pnpm --filter server dev` על פורט 4000.
