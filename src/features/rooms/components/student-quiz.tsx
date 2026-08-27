"use client";

import { useEffect, useState } from "react";

import type { StudentQuizSnapshot } from "@/features/rooms/quiz";
import { fetchStudentQuizSnapshot, submitQuiz } from "@/features/rooms/quiz-client";

type AnswerState = Record<string, string[]>;
type ScoreResult = { score: number; totalQuestions: number };

export function StudentQuiz({ roomId, sectionId, readOnly }: { roomId: string; sectionId: string; readOnly: boolean }) {
  const [quiz, setQuiz] = useState<StudentQuizSnapshot | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetchStudentQuizSnapshot(roomId, sectionId)
      .then((snapshot) => {
        if (!active) return;
        setQuiz(snapshot);
        setResult(snapshot.attempt
          ? { score: snapshot.attempt.score, totalQuestions: snapshot.attempt.totalQuestions }
          : null);
      })
      .catch(() => {
        if (active) setError("Không thể tải Quiz. Hãy thử lại.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [roomId, sectionId]);

  function chooseSingle(questionId: string, optionId: string) {
    setAnswers((current) => ({ ...current, [questionId]: [optionId] }));
    setError(null);
  }

  function toggleMultiple(questionId: string, optionId: string) {
    setAnswers((current) => {
      const selected = current[questionId] ?? [];
      return {
        ...current,
        [questionId]: selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId],
      };
    });
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quiz || result || isSubmitting) return;

    const submission = quiz.questions.map((question) => ({
      question_id: question.id,
      selected_option_ids: answers[question.id] ?? [],
    }));
    if (submission.some((answer) => answer.selected_option_ids.length === 0)) {
      setError("Hãy trả lời tất cả câu hỏi trước khi submit.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const submitted = await submitQuiz(roomId, quiz.quizId, submission);
      setResult({ score: submitted.score, totalQuestions: submitted.total_questions });
      try {
        const latest = await fetchStudentQuizSnapshot(roomId, sectionId);
        setQuiz(latest);
      } catch {
        setError("Đã nộp Quiz nhưng chưa thể tải phần xem lại đáp án. Hãy mở lại section này.");
      }
    } catch {
      try {
        const latest = await fetchStudentQuizSnapshot(roomId, sectionId);
        setQuiz(latest);
        if (latest.attempt) {
          setResult({ score: latest.attempt.score, totalQuestions: latest.attempt.totalQuestions });
        } else {
          setError("Không thể submit Quiz. Hãy kiểm tra câu trả lời và thử lại.");
        }
      } catch {
        setError("Không thể submit Quiz. Hãy thử lại.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="rounded-2xl bg-black/3 p-5 text-[var(--muted)]">Đang tải Quiz…</p>;
  }

  if (!quiz) {
    return <p className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">{error ?? "Quiz không khả dụng."}</p>;
  }

  if (result) {
    const percentage = Math.round((result.score / result.totalQuestions) * 100);
    return (
      <section>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-base font-bold text-emerald-800">ĐÃ SUBMIT</p>
          <p className="mt-3 text-6xl font-bold text-emerald-950">{result.score}/{result.totalQuestions}</p>
          <p className="mt-3 text-lg text-emerald-900">{percentage}% câu trả lời chính xác</p>
          <p className="mt-4 text-sm text-emerald-800">Mỗi Student chỉ submit Quiz một lần.</p>
        </div>

        {quiz.attempt?.answers.length ? (
          <div className="mt-6 space-y-5">
            <h3 className="text-2xl font-semibold">Xem lại đáp án</h3>
            {quiz.questions.map((question) => {
              const review = quiz.attempt?.answers.find((answer) => answer.questionId === question.id);
              if (!review) return null;

              return (
                <article className="rounded-2xl border border-black/10 bg-white p-6" key={question.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h4 className="text-lg font-semibold leading-8">{question.position + 1}. {question.questionText}</h4>
                    <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${review.isCorrect ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}`}>
                      {review.isCorrect ? "Đúng" : "Sai"}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {question.options.map((option) => {
                      const selected = review.selectedOptionIds.includes(option.id);
                      const correct = review.correctOptionIds.includes(option.id);
                      return (
                        <div
                          className={`flex items-start justify-between gap-4 rounded-xl border px-5 py-4 text-base ${
                            correct
                              ? "border-emerald-300 bg-emerald-50"
                              : selected
                                ? "border-red-200 bg-red-50"
                                : "border-black/10 bg-white"
                          }`}
                          key={option.id}
                        >
                          <span className="min-w-0 break-words">{option.content}</span>
                          {selected ? <span className="shrink-0 whitespace-nowrap text-xs font-semibold">Bạn đã chọn</span> : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {error ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">{error}</p> : null}
      </section>
    );
  }

  if (readOnly) {
    return (
      <p className="rounded-2xl border border-black/10 bg-black/3 p-5 text-[var(--muted)]">
        Buổi học đã kết thúc. Quiz này không còn nhận bài submit mới.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-7">
        {quiz.questions.map((question) => {
          const allowsMultiple = question.type === "MULTIPLE_CHOICE";
          return (
            <fieldset className="rounded-2xl border border-black/10 p-6" disabled={isSubmitting} key={question.id}>
              <legend className="px-2 text-lg font-semibold leading-8">{question.position + 1}. {question.questionText}</legend>
              <p className="mb-4 text-sm text-[var(--muted)]">{allowsMultiple ? "Chọn tất cả đáp án đúng" : "Chọn một đáp án"}</p>
              <div className="space-y-2">
                {question.options.map((option) => {
                  const selected = (answers[question.id] ?? []).includes(option.id);
                  return (
                    <label className={`flex cursor-pointer items-start gap-4 rounded-xl border px-5 py-4 text-base transition ${selected ? "border-[var(--accent)] bg-emerald-50" : "border-black/10 hover:border-black/30"}`} key={option.id}>
                      <input
                        checked={selected}
                        className="mt-1"
                        name={`question-${question.id}`}
                        onChange={() => allowsMultiple ? toggleMultiple(question.id, option.id) : chooseSingle(question.id, option.id)}
                        type={allowsMultiple ? "checkbox" : "radio"}
                      />
                      <span className="min-w-0 break-words">{option.content}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</p> : null}
      <button className="mt-7 w-full rounded-xl bg-[var(--accent)] px-6 py-4 text-lg font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Đang chấm điểm…" : "Submit Quiz"}
      </button>
    </form>
  );
}
