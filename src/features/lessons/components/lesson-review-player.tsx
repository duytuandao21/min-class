"use client";

import { useState } from "react";

import { LessonSectionContent } from "@/features/lessons/components/markdown-preview";
import type { NormalizedLesson } from "@/features/lessons/markdown/schema";

export function LessonReviewPlayer({ lesson }: { lesson: NormalizedLesson }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentSection = lesson.sections[currentIndex];

  return (
    <div>
      <article
        aria-live="polite"
        className="rounded-3xl border border-blue-300 bg-blue-100/75 p-6 shadow-sm sm:p-10"
      >
        <header className="mb-7 border-b border-black/10 pb-5">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-xs font-semibold text-[var(--accent)]">
              SECTION {currentIndex + 1} / {lesson.sections.length}
            </p>
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium">
              {currentSection.type}
            </span>
          </div>
          <h3 className="mt-3 text-3xl font-semibold tracking-tight">{currentSection.title}</h3>
        </header>

        <LessonSectionContent section={currentSection} />
      </article>

      <nav className="mt-5 flex items-center justify-between gap-4" aria-label="Điều hướng section bài học">
        <button
          className="rounded-xl border border-black/15 bg-white px-4 py-2.5 font-semibold transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          type="button"
        >
          ← Previous
        </button>
        <button
          className="rounded-xl border border-black/15 bg-white px-4 py-2.5 font-semibold transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
          disabled={currentIndex === lesson.sections.length - 1}
          onClick={() => setCurrentIndex((index) => Math.min(lesson.sections.length - 1, index + 1))}
          type="button"
        >
          Next →
        </button>
      </nav>
    </div>
  );
}
