import ReactMarkdown, { type Components } from "react-markdown";

import type { NormalizedLesson } from "@/features/lessons/markdown/schema";

const markdownComponents: Components = {
  a: ({ children, ...props }) => (
    <a {...props} className="font-medium text-[var(--accent)] underline underline-offset-4" rel="noreferrer noopener" target="_blank">
      {children}
    </a>
  ),
  code: ({ children, className, ...props }) => (
    <code {...props} className={`${className ?? ""} rounded bg-black/6 px-1.5 py-0.5 font-mono text-[0.9em]`}>
      {children}
    </code>
  ),
  img: ({ alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={alt ?? ""} className="my-5 max-h-[28rem] w-auto max-w-full rounded-xl border border-black/10" loading="lazy" />
  ),
};

export function MarkdownContent({ source }: { source: string }) {
  return (
    <div className="lesson-markdown leading-7 text-[#263129]">
      <ReactMarkdown components={markdownComponents}>{source}</ReactMarkdown>
    </div>
  );
}

export function MarkdownPreview({
  lesson,
  showHeader = true,
}: {
  lesson: NormalizedLesson;
  showHeader?: boolean;
}) {
  return (
    <article className="space-y-8">
      {showHeader ? (
        <header className="border-b border-black/10 pb-6">
          <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">LESSON PREVIEW</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">{lesson.title}</h2>
          {lesson.description ? <p className="mt-3 leading-7 text-[var(--muted)]">{lesson.description}</p> : null}
        </header>
      ) : null}

      {lesson.sections.map((section) => (
        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-7" key={section.id}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-[var(--accent)]">{String(section.position + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 text-xl font-semibold">{section.title}</h3>
            </div>
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium">{section.type}</span>
          </div>

          {section.type === "QUIZ" ? (
            <div className="space-y-6">
              {section.quiz.questions.map((question) => (
                <div key={question.id}>
                  <p className="font-medium leading-7">{question.questionText}</p>
                  <ul className="mt-3 space-y-2">
                    {question.options.map((option) => (
                      <li className="flex gap-3 rounded-xl border border-black/10 px-4 py-3" key={option.id}>
                        <span aria-hidden className={option.isCorrect ? "text-[var(--accent)]" : "text-black/25"}>
                          {option.isCorrect ? "✓" : "○"}
                        </span>
                        <span className="min-w-0 break-words">{option.content}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <MarkdownContent source={section.contentMd} />
          )}
        </section>
      ))}
    </article>
  );
}
