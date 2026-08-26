import { MarkdownContent } from "@/features/lessons/components/markdown-preview";
import type { EndedLessonReview } from "@/features/catalog/schemas";

function QuizReview({ quiz }: { quiz: NonNullable<EndedLessonReview["sections"][number]["quiz"]> }) {
  return (
    <div className="space-y-6">
      {quiz.attempt ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Kết quả của bạn: <strong>{quiz.attempt.score}/{quiz.attempt.totalQuestions}</strong>
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Bạn chưa làm Quiz trong buổi học này. Đáp án đúng được hiển thị để ôn tập.
        </p>
      )}

      {quiz.questions.map((question) => (
        <section className="rounded-2xl border border-black/10 p-5" key={question.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h4 className="font-semibold leading-7">
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
                className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
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
  return (
    <article className="mt-10 space-y-8">
      {review.sections.map((section) => (
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8" key={section.id}>
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-5">
            <div>
              <p className="font-mono text-xs font-semibold text-[var(--accent)]">SECTION {section.position + 1}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{section.title}</h2>
            </div>
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold">{section.type}</span>
          </header>

          {section.type === "QUIZ" && section.quiz ? (
            <QuizReview quiz={section.quiz} />
          ) : (
            <MarkdownContent source={section.contentMd} />
          )}
        </section>
      ))}
    </article>
  );
}
