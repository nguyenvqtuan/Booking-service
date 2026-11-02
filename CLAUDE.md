# Booking-service — project rules

## Code language

- **All identifiers (variables, functions, classes, files), code comments, log messages and test names must be in English.**
- User-facing UI copy and seed/demo data may be in Vietnamese (the product targets Vietnamese salons).
- Docs (README), commit messages and PR descriptions may be in Vietnamese.

## Conventions

- Monorepo: pnpm workspace — `apps/api` (NestJS 12, ESM), `apps/web` (React + Vite), `packages/shared`.
- API is ESM: relative imports use the `.js` extension; wrap relation property types in `Relation<>`.
- TypeORM: explicit column `type` on every column; schema changes only through migrations
  (`pnpm --filter @booking/api migration:generate ...`), and `migration:check` must report no drift.
- Times are stored in UTC (`timestamptz`) and converted with the salon timezone (default `Asia/Ho_Chi_Minh`).
- Tests: Vitest (`*.spec.ts` unit, `test/*.e2e-spec.ts` e2e against a real Postgres).
- Branch per Jira ticket: `feature/BS-<n>-<slug>`; commit messages reference the ticket, e.g. `feat(api): ... (BS-12)`.
