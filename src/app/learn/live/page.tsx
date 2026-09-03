import Link from "next/link";

import { BackLink } from "@/components/back-link";
import { getPublicLiveSessions } from "@/features/catalog/server/queries";

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

export default async function PublicLiveSessionsPage() {
  const sessions = await getPublicLiveSessions();
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
      <BackLink href="/" label="MINCLASS" />
      <header className="my-10 max-w-3xl">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">ĐANG DIỄN RA</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Các bài học đang live</h1>
        <p className="mt-4 text-lg leading-8 text-[var(--muted)]">Chọn đúng lớp và chương, sau đó nhập MSSV một lần để vào toàn bộ Lesson của buổi học.</p>
      </header>

      {sessions.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-black/15 bg-white p-9 text-center text-[var(--muted)]">Hiện chưa có buổi học nào đang LIVE.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {sessions.map((session) => (
            <li key={session.session_id}>
              <Link className="group block h-full rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md motion-reduce:transform-none" href={`/learn/lessons/${session.first_lesson_id}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-[var(--accent)]">{session.section_code}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900"><span className="size-2 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" /> LIVE</span>
                </div>
                <h2 className="mt-4 text-xl font-bold">{session.chapter_name}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{session.subject_name}{session.section_display_name ? ` · ${session.section_display_name}` : ""}</p>
                <p className="mt-5 text-sm font-semibold text-emerald-800">{session.lesson_count} Lesson · Bắt đầu {timeFormatter.format(new Date(session.started_at))}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
