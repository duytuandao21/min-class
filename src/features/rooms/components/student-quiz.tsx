"use client";

import { useEffect, useState } from "react";

import type { StudentQuizSnapshot } from "@/features/rooms/quiz";
import { fetchStudentQuizSnapshot, submitQuiz } from "@/features/rooms/quiz-client";

type AnswerState = Record<string, string[]>;
type ScoreResult = { score: number; totalQuestions: number };

export function StudentQuiz({ sectionId, readOnly }: { sectionId: string; readOnly: boolean }) {
  const [quiz, setQuiz] = useState<StudentQuizSnapshot | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetchStudentQuizSnapshot(sectionId)
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
  }, [sectionId]);

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
      const submitted = await submitQuiz(quiz.quizId, submission);
      setResult({ score: submitted.score, totalQuestions: submitted.total_questions });
    } catch {
      try {
        const latest = await fetchStudentQuizSnapshot(sectionId);
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
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-sm font-semibold text-emerald-800">ĐÃ SUBMIT</p>
        <p className="mt-3 text-5xl font-bold text-emerald-950">{result.score}/{result.totalQuestions}</p>
        <p className="mt-2 text-emerald-900">{percentage}% câu trả lời chính xác</p>
        <p className="mt-4 text-sm text-emerald-800">Mỗi Student chỉ submit Quiz một lần.</p>
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
            <fieldset className="rounded-2xl border border-black/10 p-5" disabled={isSubmitting} key={question.id}>
              <legend className="px-2 font-semibold leading-7">{question.position + 1}. {question.questionText}</legend>
              <p className="mb-3 text-xs text-[var(--muted)]">{allowsMultiple ? "Chọn tất cả đáp án đúng" : "Chọn một đáp án"}</p>
              <div className="space-y-2">
                {question.options.map((option) => {
                  const selected = (answers[question.id] ?? []).includes(option.id);
                  return (
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${selected ? "border-[var(--accent)] bg-emerald-50" : "border-black/10 hover:border-black/30"}`} key={option.id}>
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
      <button className="mt-6 w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Đang chấm điểm…" : "Submit Quiz"}
      </button>
    </form>
  );
}
