# Booking-service

Web app đặt lịch và nhắc hẹn tự động cho tiệm (salon). Mục tiêu: giảm no-show.
Jira: project **BS**.

## Stack

| Phần              | Công nghệ                                          |
| ----------------- | -------------------------------------------------- |
| `apps/web`        | React 19 + Vite + TypeScript (cổng 5173)           |
| `apps/api`        | NestJS 12 (ESM) + TypeORM + PostgreSQL (cổng 3000) |
| `packages/shared` | Enum, hằng số, util dùng chung FE/BE               |
| Hạ tầng dev       | Docker Compose: PostgreSQL 16, Redis 7             |

Monorepo dùng **pnpm workspace**. Test dùng **Vitest** (mặc định của NestJS 12).

## Yêu cầu

- Node.js >= 20 (khuyến nghị 24, xem `.nvmrc`)
- pnpm 11 (`corepack enable`)
- Docker (cho PostgreSQL/Redis)

## Chạy dev

```bash
pnpm install
cp .env.example .env        # chỉnh nếu cần
pnpm db:up                  # PostgreSQL + Redis
pnpm dev                    # web :5173 + api :3000 (+ shared watch)
```

## Worker gửi nhắc hẹn (BS-27)

Cron trong API (mỗi phút) đưa các `reminder_jobs` đến hạn vào hàng đợi BullMQ (Redis); worker là
process riêng, tiêu thụ hàng đợi và gửi tin (ZNS/SMS). Ở dev, `MESSAGE_PROVIDER=fake` chỉ ghi log.

```bash
pnpm dev                                      # API (đã gồm cron) + web
pnpm --filter @booking/api dev:worker         # worker (chạy từ dist do `nest start --watch` biên dịch)
pnpm --filter @booking/api start:worker       # production
```

## Lệnh thường dùng

| Lệnh             | Tác dụng                             |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Chạy FE + BE cùng lúc ở chế độ watch |
| `pnpm build`     | Build toàn bộ workspace              |
| `pnpm lint`      | ESLint toàn repo                     |
| `pnpm format`    | Prettier format toàn repo            |
| `pnpm typecheck` | Kiểm tra kiểu cho mọi package        |
| `pnpm test`      | Unit test mọi package                |

## Database & migration (apps/api)

TypeORM với `synchronize: false` — mọi thay đổi schema đi qua migration trong `apps/api/src/database/migrations`.

```bash
pnpm --filter @booking/api migration:run       # chạy migration còn thiếu
pnpm --filter @booking/api migration:revert    # lùi 1 migration
pnpm --filter @booking/api migration:show      # xem trạng thái
pnpm --filter @booking/api migration:generate src/database/migrations/<Ten>   # sinh từ entity
pnpm --filter @booking/api test:e2e            # e2e (cần DB đang chạy)
```

Health check: `GET /health` → 200 khi DB sống, 503 khi mất kết nối.

Pre-commit hook (Husky + lint-staged) chạy ESLint và Prettier trên file được stage; commit vi phạm lint sẽ bị chặn.

## Kiểm thử

| Lệnh                                  | Phạm vi                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm test`                           | Unit: `shared` (chạy 2 lần với `TZ=UTC` và `TZ=America/New_York`), api, web |
| `pnpm --filter @booking/api test:e2e` | Integration với Postgres + Redis thật                                       |
| `pnpm --filter @booking/api test:cov` | Như trên, kèm ngưỡng coverage 85% (dùng trong CI)                           |

CI chạy cho mỗi PR: lint, format, typecheck, unit, build, migration + `migration:check`, e2e (2 múi giờ).

Các ca lõi và nơi kiểm tra:

| Yêu cầu / bug                                     | Test                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| Tính slot (BS-36, BS-67)                          | `packages/shared/src/slots.spec.ts`, `test/slots.e2e-spec.ts`     |
| Trùng giờ, race khi đặt (BS-22, BS-63)            | `test/appointments.e2e-spec.ts`, `test/schema.e2e-spec.ts`        |
| Sinh reminder theo offset, huỷ/dời (BS-26, BS-68) | `test/reminders.e2e-spec.ts`                                      |
| Múi giờ (BS-24, BS-62)                            | `packages/shared/src/time.spec.ts`, `test/schema.e2e-spec.ts`     |
| ZNS lỗi → SMS (BS-31, BS-65)                      | `test/reminder-queue.e2e-spec.ts`                                 |
| Retry có backoff (BS-32)                          | `test/reminder-queue.e2e-spec.ts`                                 |
| Mỗi job gửi 1 lần với nhiều worker (BS-33, BS-61) | `test/reminder-queue.e2e-spec.ts`                                 |
| Cô lập dữ liệu tiệm (BS-16, BS-64)                | `test/tenancy.e2e-spec.ts` và từng suite CRUD                     |
| Chuẩn hoá SĐT (BS-20, BS-66)                      | `packages/shared/src/phone.spec.ts`, `test/customers.e2e-spec.ts` |

## Quy ước

- Nhánh: `feature/BS-<số>-<mô-tả>`; commit message có mã ticket, ví dụ `feat(api): ... (BS-12)`.
- Thời gian lưu UTC (`timestamptz`), hiển thị theo múi giờ của tiệm (mặc định `Asia/Ho_Chi_Minh`).
