import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { EndedLessonReviewView } from "@/features/catalog/components/ended-lesson-review";
import {
  getStudentEndedLessonReview,
  getStudentEndedSessionLessons,
} from "@/features/catalog/server/queries";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "long",
  timeStyle: "short",
});

export default async function StudentEndedLessonReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ lessonId?: string }>;
}) {
  const { sessionId } = await params;
  const { lessonId } = await searchParams;
  const [review, sessionLessons] = await Promise.all([
    getStudentEndedLessonReview(sessionId, lessonId),
    getStudentEndedSessionLessons(sessionId),
  ]);
  if (!review) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 sm:py-14 lg:px-12">
      <BackLink
        href={`/learn/subjects/${review.subjectId}/sections/${review.courseSectionId}`}
        label="Lớp học phần"
      />
      <header className="mt-10 border-b border-black/10 pb-8">
        <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">MINCLASS · LESSON REVIEW</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{review.title}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-base text-[var(--muted)]">
          <span className="rounded-full bg-red-100 px-4 py-2 text-sm font-bold text-red-800">Đã kết thúc</span>
          <span>Kết thúc: {dateFormatter.format(new Date(review.endedAt))}</span>
        </div>
        <p className="mt-5 w-fit rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-base text-emerald-950">
          MSSV: <strong className="ml-1 text-lg font-bold tracking-wide">{review.mssv}</strong>
        </p>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--muted)]">
          Nội dung ôn tập chỉ đọc. Bạn có thể xem toàn bộ Section và đáp án Quiz của buổi học đã kết thúc.
        </p>
      </header>

      {sessionLessons.length > 1 ? (
        <nav aria-label="Các Lesson trong chương" className="mt-7 flex gap-2 overflow-x-auto pb-3">
          {sessionLessons.map((lesson) => (
            <Link
              aria-current={lesson.lesson_id === review.lessonId ? "page" : undefined}
              className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${lesson.lesson_id === review.lessonId ? "border-emerald-700 bg-emerald-700 text-white" : "border-black/10 bg-white hover:border-emerald-400 hover:text-[var(--accent)]"}`}
              href={`/learn/review/${sessionId}?lessonId=${lesson.lesson_id}`}
              key={lesson.lesson_id}
            >
              {lesson.lesson_title}
            </Link>
          ))}
        </nav>
      ) : null}

      <EndedLessonReviewView review={review} />
    </main>
  );
}
