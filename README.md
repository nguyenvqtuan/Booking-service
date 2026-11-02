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

## Lệnh thường dùng

| Lệnh             | Tác dụng                             |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Chạy FE + BE cùng lúc ở chế độ watch |
| `pnpm build`     | Build toàn bộ workspace              |
| `pnpm lint`      | ESLint toàn repo                     |
| `pnpm format`    | Prettier format toàn repo            |
| `pnpm typecheck` | Kiểm tra kiểu cho mọi package        |
| `pnpm test`      | Unit test mọi package                |

Pre-commit hook (Husky + lint-staged) chạy ESLint và Prettier trên file được stage; commit vi phạm lint sẽ bị chặn.

## Quy ước

- Nhánh: `feature/BS-<số>-<mô-tả>`; commit message có mã ticket, ví dụ `feat(api): ... (BS-12)`.
- Thời gian lưu UTC (`timestamptz`), hiển thị theo múi giờ của tiệm (mặc định `Asia/Ho_Chi_Minh`).
