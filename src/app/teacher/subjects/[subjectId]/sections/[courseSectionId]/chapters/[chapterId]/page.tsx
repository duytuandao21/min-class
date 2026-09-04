import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LessonReviewPlayer } from "@/features/lessons/components/lesson-review-player";
import { parseLessonMarkdown } from "@/features/lessons/markdown/parser";
import { getCourseSectionChapterHistory } from "@/features/subjects/server/queries";

export default async function CourseSectionChapterHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string; courseSectionId: string; chapterId: string }>;
  searchParams: Promise<{ lessonId?: string }>;
}) {
  const { subjectId, courseSectionId, chapterId } = await params;
  const { lessonId } = await searchParams;
  const detail = await getCourseSectionChapterHistory(subjectId, courseSectionId, chapterId);
  if (!detail) notFound();

  const selectedLesson = detail.lessons.find((lesson) => lesson.id === lessonId) ?? detail.lessons[0] ?? null;
  const normalizedLesson = selectedLesson ? parseLessonMarkdown(selectedLesson.markdown_source) : null;
  const chapterHref = `/teacher/subjects/${detail.subject.id}/sections/${detail.courseSection.id}/chapters/${detail.chapter.id}`;
  const courseSectionHref = `/teacher/subjects/${detail.subject.id}/sections/${detail.courseSection.id}`;
  const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
      <BackLink href={courseSectionHref} label={detail.courseSection.section_code} />

      <header className="mt-10 border-b border-black/10 pb-8">
        <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">CHAPTER REVIEW</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{detail.chapter.name}</h1>
            <p className="mt-3 text-[var(--muted)]">{detail.lessons.length} Lesson · {detail.sessions.length} Session</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">
            {detail.courseSection.section_code}
          </span>
        </div>
      </header>

      <section className="mt-8" aria-labelledby="chapter-content-title">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent)]">NỘI DUNG CHƯƠNG</p>
          <h2 className="mt-2 text-3xl font-semibold" id="chapter-content-title">Các Lesson trong chương</h2>
        </div>

        {detail.lessons.length === 0 ? (
          <p className="mt-5 rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">
            Chương này chưa có Lesson.
          </p>
        ) : (
          <>
            <nav aria-label="Các Lesson trong chương" className="mt-5 flex gap-2 overflow-x-auto pb-3">
              {detail.lessons.map((lesson) => (
                <Link
                  aria-current={lesson.id === selectedLesson?.id ? "page" : undefined}
                  className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${lesson.id === selectedLesson?.id ? "border-sky-700 bg-sky-700 text-white" : "border-black/10 bg-white hover:border-sky-400 hover:text-sky-800"}`}
                  href={`${chapterHref}?lessonId=${lesson.id}`}
                  key={lesson.id}
                >
                  {lesson.title}
                </Link>
              ))}
            </nav>

            {selectedLesson && normalizedLesson ? (
              <article className="mt-3 rounded-3xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm sm:p-8">
                <div className="mb-6 border-b border-black/10 pb-5">
                  <p className="text-xs font-bold tracking-[0.16em] text-sky-800">LESSON</p>
                  <h3 className="mt-2 text-3xl font-semibold">{selectedLesson.title}</h3>
                </div>
                <LessonReviewPlayer key={selectedLesson.id} lesson={normalizedLesson} />
              </article>
            ) : null}
          </>
        )}
      </section>

      <section className="mt-10 border-t border-black/10 pt-9" aria-labelledby="chapter-session-history-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent)]">SESSION HISTORY</p>
            <h2 className="mt-2 text-3xl font-semibold" id="chapter-session-history-title">Lịch sử giảng dạy</h2>
          </div>
          <span className="rounded-2xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950">{detail.sessions.length} Session</span>
        </div>

        {detail.sessions.length === 0 ? (
          <p className="mt-5 rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">
            Chương này chưa có Session.
          </p>
        ) : (
          <ol className="mt-5 space-y-3">
            {detail.sessions.map((session, index) => (
              <li className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between" key={session.id}>
                <div>
                  <p className="text-xl font-black text-black">SESSION {detail.sessions.length - index}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Bắt đầu: {dateTimeFormatter.format(new Date(session.started_at))}</p>
                  {session.ended_at ? <p className="mt-1 text-sm text-[var(--muted)]">Kết thúc: {dateTimeFormatter.format(new Date(session.ended_at))}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${session.status === "ACTIVE" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}`}>
                    {session.status === "ACTIVE" ? "ĐANG LIVE" : "ĐÃ KẾT THÚC"}
                  </span>
                  <Link
                    className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800"
                    href={session.status === "ACTIVE" ? `/teacher/rooms/${session.id}` : `/teacher/rooms/${session.id}/summary`}
                  >
                    {session.status === "ACTIVE" ? "Dashboard" : "Xem tổng kết"}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
