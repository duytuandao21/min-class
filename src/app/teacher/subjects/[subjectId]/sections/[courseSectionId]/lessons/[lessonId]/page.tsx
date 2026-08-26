import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { MarkdownPreview } from "@/features/lessons/components/markdown-preview";
import { parseLessonMarkdown } from "@/features/lessons/markdown/parser";
import { getPersistentLessonDetail } from "@/features/subjects/server/queries";

const statusStyle = {
  UPCOMING: "bg-amber-100 text-amber-900",
  LIVE: "bg-emerald-100 text-emerald-900",
  ENDED: "bg-slate-100 text-slate-800",
} as const;

export default async function TeacherLessonHistoryPage({
  params,
}: {
  params: Promise<{ subjectId: string; courseSectionId: string; lessonId: string }>;
}) {
  const { subjectId, courseSectionId, lessonId } = await params;
  const detail = await getPersistentLessonDetail(subjectId, courseSectionId, lessonId);
  if (!detail) notFound();

  const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const normalizedLesson = parseLessonMarkdown(detail.lesson.markdown_source);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
      <BackLink
        href={`/teacher/subjects/${detail.subject.id}/sections/${detail.courseSection.id}`}
        label={detail.courseSection.section_code}
      />

      <header className="mt-10 border-b border-black/10 pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">LESSON REVIEW</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[detail.status]}`}>
            {detail.status}
          </span>
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{detail.lesson.title}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Tạo lúc {dateTimeFormatter.format(new Date(detail.lesson.created_at))}
        </p>
      </header>

      <section className="mt-8 rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-9" aria-labelledby="lesson-content-title">
        <div className="mb-6 border-b border-black/10 pb-5">
          <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent)]">MARKDOWN CONTENT</p>
          <h2 className="mt-2 text-2xl font-semibold" id="lesson-content-title">Nội dung Lesson</h2>
        </div>
        <MarkdownPreview lesson={normalizedLesson} showHeader={false} />
      </section>

      <section className="mt-8" aria-labelledby="session-history-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-semibold" id="session-history-title">Session History</h2>
          <p className="rounded-2xl bg-emerald-100 px-5 py-2.5 text-lg font-bold text-emerald-950">
            {detail.sessions.length} Session
          </p>
        </div>

        {detail.sessions.length === 0 ? (
          <p className="mt-5 rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">
            Lesson này chưa có Session.
          </p>
        ) : (
          <ol className="mt-5 space-y-4">
            {detail.sessions.map((session, index) => (
              <li className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6" key={session.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[var(--muted)]">SESSION {detail.sessions.length - index}</p>
                    <h3 className="mt-1 font-mono text-xl font-semibold tracking-[0.12em]">{session.code}</h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Bắt đầu: {dateTimeFormatter.format(new Date(session.started_at))}
                    </p>
                    {session.ended_at ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Kết thúc: {dateTimeFormatter.format(new Date(session.ended_at))}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${session.status === "ACTIVE" ? statusStyle.LIVE : statusStyle.ENDED}`}>
                      {session.status === "ACTIVE" ? "LIVE" : "ENDED"}
                    </span>
                    <Link
                      className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                      href={session.status === "ACTIVE" ? `/teacher/rooms/${session.id}` : `/teacher/rooms/${session.id}/summary`}
                    >
                      Xem Lesson Review
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
