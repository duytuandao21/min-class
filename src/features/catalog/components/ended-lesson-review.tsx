"use client";

import { useState } from "react";

import { MarkdownContent } from "@/features/lessons/components/markdown-preview";
import type { EndedLessonReview } from "@/features/catalog/schemas";

function QuizReview({ quiz }: { quiz: NonNullable<EndedLessonReview["sections"][number]["quiz"]> }) {
  return (
    <div className="space-y-6">
      {quiz.attempt ? (
        <div className="rounded-xl bg-emerald-50 px-5 py-4 text-base text-emerald-950">
          Kết quả của bạn: <strong>{quiz.attempt.score}/{quiz.attempt.totalQuestions}</strong>
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 px-5 py-4 text-base text-slate-700">
          Bạn chưa làm Quiz trong buổi học này. Đáp án đúng được hiển thị để ôn tập.
        </p>
      )}

      {quiz.questions.map((question) => (
        <section className="rounded-2xl border border-black/10 bg-white p-6" key={question.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h4 className="text-lg font-semibold leading-8">
              Câu {question.position + 1}. {question.questionText}
            </h4>
            {question.isCorrect !== null ? (
              <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${question.isCorrect ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}`}>
                {question.isCorrect ? "Đúng" : "Sai"}
              </span>
            ) : null}
          </div>

          <ul className="mt-4 space-y-2">
            {question.options.map((option) => (
              <li
                className={`flex items-start justify-between gap-4 rounded-xl border px-5 py-4 text-base ${
                  option.isCorrect
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : option.isSelected
                      ? "border-red-200 bg-red-50 text-red-900"
                      : "border-black/10 bg-white"
                }`}
                key={option.id}
              >
                <span className="min-w-0 break-words">{option.content}</span>
                {option.isSelected ? (
                  <span className="shrink-0 whitespace-nowrap text-xs font-semibold">Bạn đã chọn</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function EndedLessonReviewView({ review }: { review: EndedLessonReview }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentSection = review.sections[currentIndex];

  return (
    <div className="mx-auto mt-10 w-full max-w-5xl">
      <article className="rounded-3xl border border-blue-300 bg-blue-100/75 p-7 shadow-sm sm:p-10 lg:p-12">
        <header className="mb-8 border-b border-black/10 pb-6">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-sm font-bold text-[var(--accent)]">
              SECTION {currentIndex + 1} / {review.sections.length}
            </p>
            <span className="rounded-full bg-black/5 px-4 py-1.5 text-sm font-semibold">
              {currentSection.type}
            </span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{currentSection.title}</h2>
        </header>

        {currentSection.type === "QUIZ" && currentSection.quiz ? (
          <QuizReview quiz={currentSection.quiz} />
        ) : (
          <MarkdownContent className="text-lg leading-8 sm:text-xl sm:leading-9" source={currentSection.contentMd} />
        )}
      </article>

      <nav className="mt-6 flex items-center justify-between gap-4" aria-label="Điều hướng section bài học">
        <button
          className="min-h-12 rounded-xl border border-black/15 bg-white px-6 py-3 text-base font-bold transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          type="button"
        >
          ← Previous
        </button>
        <button
          className="min-h-12 rounded-xl border border-black/15 bg-white px-6 py-3 text-base font-bold transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
          disabled={currentIndex === review.sections.length - 1}
          onClick={() => setCurrentIndex((index) => Math.min(review.sections.length - 1, index + 1))}
          type="button"
        >
          Next →
        </button>
      </nav>

      {review.sessionReflection ? (
        <section className="mt-10 rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-white to-emerald-50/60 p-7 shadow-sm sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">TỔNG KẾT CÁ NHÂN</p>
              <h2 className="mt-2 text-3xl font-semibold">Điều bạn đã ghi lại sau buổi học</h2>
            </div>
            <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">Đã gửi</span>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-[14rem_1fr]">
            <div className="rounded-2xl border border-emerald-900/10 bg-white p-6">
              <p className="text-base text-[var(--muted)]">Số lần phát biểu</p>
              <p className="mt-2 text-4xl font-semibold text-[var(--accent)]">{review.sessionReflection.speakingCount}</p>
            </div>
            <div className="rounded-2xl border border-emerald-900/10 bg-white p-6">
              <p className="text-base text-[var(--muted)]">Review buổi học</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-lg leading-8">
                {review.sessionReflection.reviewBody ?? "Bạn không viết review."}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
