import ReactMarkdown, { type Components } from "react-markdown";

import type {
  NormalizedLesson,
  NormalizedLessonSection,
} from "@/features/lessons/markdown/schema";
import { resolveVideoSource, videoTitleFromLink } from "@/features/lessons/video-link";

function VideoEmbed({ title, originalUrl }: { title: string; originalUrl: string }) {
  const source = resolveVideoSource(originalUrl);
  if (!source) return null;

  return (
    <figure className="overflow-hidden rounded-2xl border border-emerald-100 bg-[#f3faf6] shadow-sm">
      <div className="aspect-video w-full bg-[#17201b]">
        {source.kind === "file" ? (
          <video aria-label={title} className="h-full w-full" controls playsInline preload="metadata" src={source.url} />
        ) : (
          <iframe
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            src={source.url}
            title={title}
          />
        )}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-5">
        <span className="font-semibold text-[#17201b]">{title}</span>
        <a className="font-medium text-[var(--accent)] underline underline-offset-4" href={originalUrl} rel="noreferrer noopener" target="_blank">
          Mở video gốc nếu không phát được
        </a>
      </figcaption>
    </figure>
  );
}

const markdownComponents: Components = {
  p: ({ node, children }) => {
    const child = node?.children.length === 1 ? node.children[0] : null;
    if (child?.type === "element" && child.tagName === "a" && child.children.length === 1 && child.children[0].type === "text") {
      const title = videoTitleFromLink(child.children[0].value);
      const url = child.properties.href;
      if (title && typeof url === "string" && resolveVideoSource(url)) {
        return <VideoEmbed originalUrl={url} title={title} />;
      }
    }
    return <p>{children}</p>;
  },
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

export function MarkdownContent({ source, className = "" }: { source: string; className?: string }) {
  return (
    <div className={`lesson-markdown leading-7 text-[#263129] ${className}`}>
      <ReactMarkdown components={markdownComponents}>{source}</ReactMarkdown>
    </div>
  );
}

export function LessonSectionContent({ section }: { section: NormalizedLessonSection }) {
  if (section.type !== "QUIZ") {
    return <MarkdownContent source={section.contentMd} />;
  }

  return (
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

          <LessonSectionContent section={section} />
        </section>
      ))}
    </article>
  );
}
