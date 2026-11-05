# Booking-service — project rules

## Code language

- **All identifiers (variables, functions, classes, files), code comments, log messages and test names must be in English.**
- User-facing UI text lives only in `apps/web/src/locales/{vi,en}/*.json` (i18next, BS-69) — never hard-code
  it in components; `i18n/locales.test.ts` fails on Vietnamese text outside locale files and on missing keys.
  Seed/demo data may be in Vietnamese.
- Docs (README), commit messages and PR descriptions may be in Vietnamese.

## Conventions

- Monorepo: pnpm workspace — `apps/api` (NestJS 12, ESM), `apps/web` (React + Vite), `packages/shared`.
- API is ESM: relative imports use the `.js` extension.
- **No relations in the ORM and no foreign keys in the DB (BS-70).** Entities only have `*_id` columns
  (indexed, documented as "Implicit relation to <table>.id"). Services must check that referenced ids exist
  _and_ belong to the same salon before writing, and delete dependent rows themselves (e.g. `staff_services`).
  Register every new `*_id` column in `src/database/implicit-relations.ts`; delete salons only through
  `SalonDeletionService`. The schema e2e test fails on unregistered `*_id` columns, any FK, or orphaned rows.
- TypeORM: explicit column `type` on every column; schema changes only through migrations
  (`pnpm --filter @booking/api migration:generate ...`), and `migration:check` must report no drift.
- Multi-tenancy: every authenticated handler takes `@CurrentSalon() salonId` and filters every query
  by it (use `findOwnedOrFail` → 404 for other salons' records). Handlers that intentionally have no
  salon scope must be marked `@TenantAgnostic('<reason>')`; `test/tenancy.e2e-spec.ts` fails otherwise.
- Salon context comes from the JWT; a user reaches several salons through `user_salons` and
  `POST /auth/switch-salon` issues a token for another salon they belong to (BS-42).
- API errors are `{ statusCode, code, message, fields? }` with a stable `ErrorCode` from `@booking/shared`;
  the web app shows messages based on `code`, never on `message`.
- Times are stored in UTC (`timestamptz`) and converted with the salon timezone (default `Asia/Ho_Chi_Minh`).
- Tests: Vitest (`*.spec.ts` unit, `test/*.e2e-spec.ts` e2e against a real Postgres).
- Branch per Jira ticket: `feature/BS-<n>-<slug>`; commit messages reference the ticket, e.g. `feat(api): ... (BS-12)`.
