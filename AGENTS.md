# MINCLASS — Agent Instructions

## Product

Tên chính thức của ứng dụng là **MINCLASS**.

MINCLASS là classroom companion cho lớp học trực tiếp, **không phải LMS**. Giá trị cốt lõi:

1. Giảng viên điều khiển flow bài học theo từng section.
2. Sinh viên chỉ xem section sau khi giảng viên bấm **Done**.
3. Sinh viên phản hồi bằng reaction hoặc comment ngay trên section.
4. Quiz được làm trực tiếp trong MINCLASS.
5. Giảng viên thấy phản hồi gần realtime và xem tổng kết sau buổi học.

## Bắt buộc đọc trước khi code

- Scope: `docs/01_MVP_SCOPE.md`
- Stack: `docs/02_TECH_STACK.md`
- Architecture: `docs/03_ARCHITECTURE.md`
- Database/RLS: `docs/04_DATABASE_RLS.md`
- Markdown: `docs/05_MARKDOWN_SPEC.md`
- Coding rules: `docs/06_CODING_STANDARDS.md`
- Security: `docs/07_SECURITY.md`
- Tests: `docs/08_TEST_PLAN.md`
- Phase plan: `docs/09_PHASE_PLAN.md`
- UI/UX: `docs/10_UI_UX.md`
- Review: `CODE_REVIEW.md`

Task lớn phải đọc `PLANS.md` và lập execution plan trước.

## MVP — Không được tự mở rộng

MVP chỉ gồm:

- Teacher tạo Room.
- Teacher upload lesson Markdown và preview.
- Student join bằng Room Code + MSSV.
- Teacher Start Room.
- Teacher dạy từng section và bấm Done để release.
- Student xem released section theo micro-learning.
- Reaction: `UNDERSTAND`, `UNSURE`, `QUESTION`.
- Comment, có lựa chọn Anonymous.
- Quiz: single choice, multiple choice, true/false.
- Teacher Live Dashboard.
- End Session.
- Post-class Summary.
- Class Voices / Comment Wall.
- Delete Room và dữ liệu liên quan.

Không tự triển khai email/password, subject/class persistent, video, slide, assignment, LMS features, AI, chat, code runner, gamification, gradebook, QR/GPS/face attendance.

## Stack cố định

- Next.js App Router.
- React + TypeScript strict.
- Tailwind CSS.
- Supabase Postgres.
- Supabase Anonymous Auth.
- Supabase RLS.
- Supabase Realtime.
- Zod.
- pnpm.
- Vitest.
- Playwright.

Không thêm backend framework riêng như NestJS trong MVP.

## Coding rules bắt buộc

- Server Components mặc định; Client Components chỉ khi cần browser API, interaction hoặc realtime.
- Không query Supabase rải rác trong UI component.
- Data access nằm trong feature/server layer hoặc `lib/`.
- Validate mọi input bên ngoài bằng Zod hoặc database constraint.
- Không dùng `any` trừ khi thật sự cần và phải có lý do.
- Không để business logic trong JSX.
- Không duplicate domain constants/enums.
- Không sửa migration đã apply; tạo migration mới.
- Không sửa schema trên Dashboard mà không có migration tương ứng.
- Không expose service-role key ra client.
- Không dùng service role để né RLS.
- Không disable RLS để sửa lỗi nhanh.
- Không gửi quiz answer key xuống client trước khi submit.
- Markdown/comment phải render an toàn, chống XSS.

## Source of truth

- Postgres = trạng thái thật.
- Realtime = thông báo thay đổi.
- React state = UI/cache tạm thời.

Sau reconnect phải fetch lại state từ database.

## Trước khi implement

1. Inspect file liên quan.
2. Xác định phase hiện tại.
3. Kiểm tra dependency với phase trước.
4. Nêu file dự kiến thay đổi.
5. Với task lớn, tạo plan theo `PLANS.md`.

## Sau khi implement

1. Chạy format nếu có.
2. Chạy lint.
3. Chạy typecheck.
4. Chạy relevant tests.
5. Chạy build nếu thay đổi đáng kể.
6. Chạy E2E nếu thay đổi user flow.
7. Review diff theo `CODE_REVIEW.md`.
8. Báo cáo file đã đổi và risk còn lại.

## Commands mục tiêu

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Definition of Done

Một task chưa xong nếu chỉ có UI nhưng backend/RLS chưa đúng, happy path chạy nhưng negative path chưa test, có lỗi TypeScript/lint/build, có permission leak, thiếu loading/error/empty state, hoặc có feature ngoài MVP.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
