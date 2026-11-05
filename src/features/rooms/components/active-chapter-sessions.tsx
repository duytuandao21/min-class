import Link from "next/link";

import type { ActiveChapterSession } from "@/features/rooms/active-chapter-sessions";

export function ActiveChapterSessions({
  sessions, currentSessionId,
}: { sessions: readonly ActiveChapterSession[]; currentSessionId?: string }) {
  if (sessions.length === 0) return null;
  return (
    <section aria-label="Các chương đang LIVE trong lớp" className="my-6 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-base font-bold text-emerald-900">
          <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" />
          Chương đang LIVE
        </h2>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-900 ring-1 ring-emerald-200">{sessions.length} chương</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Mỗi chương có Dashboard, điểm danh và tổng kết riêng. Bạn có thể mở LIVE thêm chương khác.
      </p>
      <nav aria-label="Chuyển Dashboard chương" className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => {
          const current = session.id === currentSessionId;
          return (
            <Link
              aria-current={current ? "page" : undefined}
              className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${current ? "border-sky-600 bg-sky-600 text-white shadow-sm" : "border-emerald-200 bg-white text-emerald-950 hover:border-sky-300 hover:bg-sky-50"}`}
              href={`/teacher/rooms/${session.id}`}
              key={session.id}
              title={session.title}
            >
              <span className="min-w-0 truncate">{session.title}</span>
              <span className={`shrink-0 text-xs ${current ? "text-sky-100" : "text-sky-800"}`}>{current ? "Đang xem" : "Dashboard →"}</span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
