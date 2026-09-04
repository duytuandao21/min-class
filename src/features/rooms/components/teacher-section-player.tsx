"use client";

import { useState, useTransition } from "react";

import { MarkdownContent } from "@/features/lessons/components/markdown-preview";
import { TeacherLiveFeedback } from "@/features/rooms/components/teacher-live-feedback";
import type { TeacherFeedbackSnapshot } from "@/features/rooms/feedback";
import {
  getAdjacentSectionPosition,
  getTeacherSectionViewMode,
  type LessonSection,
} from "@/features/rooms/lesson-flow";
import { advanceTeacherSection } from "@/features/rooms/lifecycle-client";

export function TeacherSectionPlayer({
  initialFeedback,
  initialReleasedThrough,
  initialTeachingSection,
  lessonId,
  lessonTitle,
  roomId,
  sections,
}: {
  initialFeedback: TeacherFeedbackSnapshot;
  initialReleasedThrough: number;
  initialTeachingSection: number;
  lessonId: string;
  lessonTitle: string;
  roomId: string;
  sections: LessonSection[];
}) {
  const initialPosition = sections.some((section) => section.position === initialTeachingSection)
    ? initialTeachingSection
    : (sections[0]?.position ?? 0);
  const [teachingPosition, setTeachingPosition] = useState(initialPosition);
  const [releasedThrough, setReleasedThrough] = useState(initialReleasedThrough);
  const [viewingPosition, setViewingPosition] = useState(initialPosition);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentIndex = sections.findIndex((section) => section.position === viewingPosition);
  const currentSection = currentIndex >= 0 ? sections[currentIndex] : null;
  const teachingSection = sections.find((section) => section.position === teachingPosition) ?? null;
  const viewMode = getTeacherSectionViewMode(viewingPosition, teachingPosition);
  const previousPosition = getAdjacentSectionPosition(sections, viewingPosition, -1);
  const nextPosition = getAdjacentSectionPosition(sections, viewingPosition, 1);
  const hasTeachingSectionAfterCurrent = sections.some((section) => section.position > teachingPosition);

  function moveTo(position: number | null) {
    if (position === null || isPending) return;
    setError(null);
    setViewingPosition(position);
  }

  function releaseCurrentSection() {
    if (viewMode !== "TEACHING" || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await advanceTeacherSection(roomId, lessonId);
        setTeachingPosition(result.teachingSection);
        setReleasedThrough(result.releasedThrough);
        setViewingPosition(result.teachingSection);
      } catch (releaseError) {
        setError(releaseError instanceof Error ? releaseError.message : "Không thể chuyển sang Section tiếp theo.");
        return;
      }
    });
  }

  return (
    <>
      <section className="mt-7">
        {!currentSection ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-7 text-red-900">
            Không tìm thấy section của Lesson này.
          </div>
        ) : (
          <>
            <article className="rounded-3xl border border-blue-300 bg-blue-100/75 p-7 shadow-sm sm:p-10">
              <header className="mb-7 flex flex-col justify-between gap-5 border-b border-black/10 pb-6 sm:flex-row sm:items-start">
                <div>
                  <p className="font-mono text-xs font-semibold text-[var(--accent)]">
                    {viewMode === "TEACHING" ? "SECTION ĐANG DẠY" : viewMode === "REVIEW" ? "ĐANG XEM LẠI" : "ĐANG XEM TRƯỚC"}
                    {" · "}{currentIndex + 1} / {sections.length}
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight">{currentSection.title}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {currentSection.position <= releasedThrough ? (
                    <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">ĐÃ HIỂN THỊ CHO SINH VIÊN</span>
                  ) : (
                    <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">CHƯA RELEASE</span>
                  )}
                  <span className="w-fit rounded-full bg-black/5 px-3 py-1 text-xs font-medium">{currentSection.type}</span>
                </div>
              </header>

              {currentSection.type === "QUIZ" ? (
                <p className="rounded-2xl bg-sky-50 p-5 leading-7 text-sky-950">
                  {currentSection.position <= releasedThrough
                    ? "Student đang làm Quiz trên thiết bị của mình. Theo dõi tiến độ ở Quiz Analytics bên dưới."
                    : "Quiz này chưa được hiển thị cho sinh viên."}
                </p>
              ) : (
                <MarkdownContent source={currentSection.contentMd} />
              )}
            </article>

            <nav aria-label="Điều hướng section dành cho giảng viên" className="mt-5 flex items-center justify-between gap-3">
              <button
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-black/15 bg-white px-5 py-3 font-bold transition hover:-translate-y-0.5 hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transform-none"
                disabled={previousPosition === null || isPending}
                onClick={() => moveTo(previousPosition)}
                type="button"
              >
                <span aria-hidden className="mr-2 text-xl leading-none">←</span> Bài trước
              </button>
              <p className="hidden text-center text-sm font-semibold text-[var(--muted)] sm:block">
                Section {currentIndex + 1} / {sections.length}
              </p>
              <button
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-black/15 bg-white px-5 py-3 font-bold transition hover:-translate-y-0.5 hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transform-none"
                disabled={nextPosition === null || isPending}
                onClick={() => moveTo(nextPosition)}
                type="button"
              >
                Bài tiếp <span aria-hidden className="ml-2 text-xl leading-none">→</span>
              </button>
            </nav>

            <div className="mt-5 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              {viewMode !== "TEACHING" ? (
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    Section đang dạy là <strong className="text-black">{teachingSection?.title ?? `Section ${teachingPosition + 1}`}</strong>. Quay lại section này để thao tác Done.
                  </p>
                  <button
                    className="shrink-0 rounded-xl bg-sky-100 px-5 py-3 font-bold text-sky-900 transition hover:bg-sky-200"
                    onClick={() => moveTo(teachingPosition)}
                    type="button"
                  >
                    Về section đang dạy
                  </button>
                </div>
              ) : hasTeachingSectionAfterCurrent ? (
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    Done Section {currentIndex + 1} để hiển thị section tiếp theo cho sinh viên.
                  </p>
                  <button
                    className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] px-6 py-3 font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none"
                    disabled={isPending}
                    onClick={releaseCurrentSection}
                    type="button"
                  >
                    {isPending ? "Đang hoàn tất…" : `Done Section ${currentIndex + 1}`}
                  </button>
                </div>
              ) : (
                <p className="rounded-xl bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-900">
                  Đây là section cuối. Khi hoàn tất, hãy kết thúc buổi học.
                </p>
              )}
              {error ? <p className="mt-4 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
            </div>
          </>
        )}
      </section>

      <TeacherLiveFeedback
        currentSectionId={teachingSection?.id ?? null}
        initialSnapshot={initialFeedback}
        lessonId={lessonId}
        lessonTitle={lessonTitle}
        roomId={roomId}
        sectionIds={sections.map((section) => section.id)}
      />
    </>
  );
}
