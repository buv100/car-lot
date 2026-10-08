# car-lot

מגרש להשכרה ולמכירה של רכבים. השלב הזה מקים את כלי העבודה בלבד, בלי מסכים ובלי חוקי מוצר.

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
```

לקוח בפיתוח: `pnpm --filter client dev` על פורט 5173. שרת: `pnpm --filter server dev` על פורט 4000.
