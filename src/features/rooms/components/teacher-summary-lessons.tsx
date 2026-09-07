"use client";

import { useState } from "react";

import { fetchTeacherRoomLessonSummary } from "@/features/rooms/summary-client";
import type {
  TeacherLessonSummary,
  TeacherRoomSummaryLessonList,
} from "@/features/rooms/summary";

function LessonResult({ lesson }: { lesson: TeacherLessonSummary }) {
  return (
    <div className="grid gap-6 border-t border-black/10 bg-black/[0.015] p-5 sm:p-7 lg:grid-cols-2">
      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h4 className="text-lg font-semibold">Reaction theo section</h4>
        {lesson.reactions.length === 0 ? (
          <p className="mt-4 rounded-xl bg-black/3 p-4 text-sm text-[var(--muted)]">Lesson này chưa có section được release.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {lesson.reactions.map((reaction) => (
              <article className="rounded-xl border border-black/10 p-4" key={reaction.sectionId}>
                <p className="text-xs text-[var(--muted)]">SECTION {reaction.sectionPosition + 1}</p>
                <h5 className="mt-1 font-semibold">{reaction.sectionTitle}</h5>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5">👍 {reaction.understand}</span>
                  <span className="rounded-full bg-amber-50 px-3 py-1.5">🤔 {reaction.unsure}</span>
                  <span className="rounded-full bg-sky-50 px-3 py-1.5">❓ {reaction.question}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h4 className="text-lg font-semibold">Quiz summary</h4>
        {lesson.quizzes.length === 0 ? (
          <p className="mt-4 rounded-xl bg-black/3 p-4 text-sm text-[var(--muted)]">Lesson này không có Quiz đã release.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {lesson.quizzes.map((quiz) => (
              <article className="rounded-xl border border-black/10 p-4" key={quiz.quizId}>
                <h5 className="font-semibold">{quiz.title}</h5>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <span>Completion: <strong>{quiz.submittedCount}/{quiz.participantCount} ({quiz.completionRate}%)</strong></span>
                  <span>Average score: <strong>{quiz.averageScore}/{quiz.totalQuestions}</strong></span>
                </div>
                <div className="mt-4 space-y-2">
                  {quiz.questions.map((question) => (
                    <section className="rounded-xl bg-black/3 px-4 py-3 text-sm" key={question.questionId}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>Câu {question.position + 1}: {question.questionText}</span>
                        <strong>{question.correctPercentage}% đúng</strong>
                      </div>
                      <div className="mt-3 space-y-2" aria-label={`Phân bố câu trả lời câu ${question.position + 1}`}>
                        {question.options.map((option) => (
                          <div className="flex items-center justify-between gap-4 rounded-lg bg-white/80 px-3 py-2" key={option.optionId}>
                            <span className="min-w-0 break-words">{option.content}</span>
                            <span className="shrink-0 font-semibold">{option.selectionCount} chọn</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function TeacherSummaryLessons({ lessons, roomId }: {
  lessons: TeacherRoomSummaryLessonList;
  roomId: string;
}) {
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TeacherLessonSummary>>({});
  const [loadingLessonId, setLoadingLessonId] = useState<string | null>(null);
  const [errorLessonId, setErrorLessonId] = useState<string | null>(null);

  async function toggleLesson(lessonId: string) {
    if (openLessonId === lessonId) {
      setOpenLessonId(null);
      return;
    }
    setOpenLessonId(lessonId);
    setErrorLessonId(null);
    if (results[lessonId]) return;

    setLoadingLessonId(lessonId);
    try {
      const result = await fetchTeacherRoomLessonSummary(roomId, lessonId);
      setResults((current) => ({ ...current, [lessonId]: result }));
    } catch {
      setErrorLessonId(lessonId);
    } finally {
      setLoadingLessonId((current) => current === lessonId ? null : current);
    }
  }

  if (lessons.length === 0) {
    return <p className="mt-5 rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">Không có dữ liệu Lesson trong buổi học.</p>;
  }

  return (
    <div className="mt-5 space-y-4">
      {lessons.map((lesson, lessonIndex) => {
        const open = openLessonId === lesson.lessonId;
        const result = results[lesson.lessonId];
        const loading = loadingLessonId === lesson.lessonId;
        const failed = errorLessonId === lesson.lessonId;
        return (
          <section className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm" key={lesson.lessonId}>
            <button
              aria-expanded={open}
              className="group flex w-full cursor-pointer flex-wrap items-center justify-between gap-4 px-6 py-5 text-left sm:px-8"
              onClick={() => void toggleLesson(lesson.lessonId)}
              type="button"
            >
              <span>
                <span className="block text-xs font-bold tracking-[0.14em] text-[var(--accent)]">LESSON {lessonIndex + 1}</span>
                <span className="mt-1 block text-xl font-bold">{lesson.lessonTitle}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900">{lesson.sectionCount} Section · {lesson.quizCount} Quiz</span>
                <span className={`flex size-8 items-center justify-center rounded-full border bg-black/[0.025] text-[#526057] transition-[transform,background-color,border-color] duration-300 ease-out motion-reduce:transition-none ${open ? "rotate-180 border-emerald-300 bg-white text-[var(--accent)]" : "border-black/10"}`}>
                  <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                    <path d="m6.5 9 5.5 5.5L17.5 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
                  </svg>
                </span>
              </span>
            </button>

            {open ? (
              loading ? (
                <div className="grid gap-6 border-t border-black/10 bg-black/[0.015] p-5 sm:p-7 lg:grid-cols-2" aria-busy="true">
                  <div className="h-64 animate-pulse rounded-2xl bg-black/5 motion-reduce:animate-none" />
                  <div className="h-64 animate-pulse rounded-2xl bg-black/5 motion-reduce:animate-none" />
                  <span className="sr-only">Đang tải kết quả Lesson</span>
                </div>
              ) : failed ? (
                <div className="border-t border-red-100 bg-red-50 p-6 text-sm font-semibold text-red-800">
                  Không thể tải kết quả Lesson. Nhấn vào Lesson để đóng rồi thử lại.
                </div>
              ) : result ? <LessonResult lesson={result} /> : null
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
