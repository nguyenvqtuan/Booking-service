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

## Quy ước

- Nhánh: `feature/BS-<số>-<mô-tả>`; commit message có mã ticket, ví dụ `feat(api): ... (BS-12)`.
- Thời gian lưu UTC (`timestamptz`), hiển thị theo múi giờ của tiệm (mặc định `Asia/Ho_Chi_Minh`).
