"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildPresentationSteps,
  countSectionReactions,
  filterClassVoiceLessons,
  flattenClassVoices,
  groupClassVoicesByLesson,
  nextPresentationIndex,
  type ClassVoicesSnapshot,
  type PresentationStep,
} from "@/features/rooms/class-voices";

function ReactionOverview({ section, large = false }: {
  section: ClassVoicesSnapshot["sections"][number];
  large?: boolean;
}) {
  const total = countSectionReactions(section);
  return (
    <div className={`flex flex-wrap items-center gap-3 font-semibold ${large ? "justify-center text-3xl sm:gap-8 sm:text-5xl" : "text-sm"}`} aria-label={`${total} reaction ở section này`}>
      <span className={`rounded-full bg-emerald-50 ${large ? "px-5 py-3" : "px-3 py-1.5"}`}>👍 {section.reactions.understand}</span>
      <span className={`rounded-full bg-amber-50 ${large ? "px-5 py-3" : "px-3 py-1.5"}`}>🤔 {section.reactions.unsure}</span>
      <span className={`rounded-full bg-sky-50 ${large ? "px-5 py-3" : "px-3 py-1.5"}`}>❓ {section.reactions.question}</span>
    </div>
  );
}

function PresentationContent({ snapshot, step, meaningfulSectionCount, onReplay, onExit }: {
  snapshot: ClassVoicesSnapshot;
  step: PresentationStep;
  meaningfulSectionCount: number;
  onReplay: () => void;
  onExit: () => void;
}) {
  const commentCount = flattenClassVoices(snapshot).length;

  if (step.type === "INTRO") {
    return (
      <div className="text-center">
        <p className="text-sm font-bold tracking-[0.28em] text-[var(--accent)]">MINCLASS</p>
        <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-8">
          <div><p className="text-3xl font-semibold sm:text-5xl">{snapshot.participantCount}</p><p className="mt-2 text-xs text-[var(--muted)] sm:text-sm">students</p></div>
          <div><p className="text-3xl font-semibold sm:text-5xl">{commentCount}</p><p className="mt-2 text-xs text-[var(--muted)] sm:text-sm">reflections</p></div>
          <div><p className="text-3xl font-semibold sm:text-5xl">{meaningfulSectionCount}</p><p className="mt-2 text-xs text-[var(--muted)] sm:text-sm">sections</p></div>
        </div>
        <h2 className="mt-12 text-3xl font-medium tracking-tight sm:text-5xl">What did the class think today?</h2>
      </div>
    );
  }

  if (step.type === "LESSON_INTRO") {
    return (
      <div className="mx-auto w-full max-w-5xl text-center">
        <p className="text-sm font-bold tracking-[0.25em] text-[var(--accent)]">LESSON {String(step.lessonNumber).padStart(2, "0")}</p>
        <h2 className="mt-6 break-words text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">{step.lesson.lessonTitle}</h2>
        <p className="mt-8 text-lg text-[var(--muted)]">{step.lesson.sections.length} section có phản hồi</p>
      </div>
    );
  }

  if (step.type === "SECTION_INTRO") {
    return (
      <div className="mx-auto w-full max-w-5xl text-center">
        <p className="text-sm font-bold tracking-[0.25em] text-[var(--accent)]">{step.section.lessonTitle} · SECTION {String(step.section.sectionPosition + 1).padStart(2, "0")}</p>
        <h2 className="mt-6 break-words text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">{step.section.sectionTitle}</h2>
      </div>
    );
  }

  if (step.type === "REACTION_OVERVIEW") {
    const total = countSectionReactions(step.section);
    return (
      <div className="mx-auto w-full max-w-5xl text-center">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">{step.section.lessonTitle} · SECTION {step.section.sectionPosition + 1}</p>
        <h2 className="mt-3 break-words text-3xl font-semibold sm:text-5xl">{step.section.sectionTitle}</h2>
        <div className="mt-10"><ReactionOverview large section={step.section} /></div>
        <p className="mt-8 text-lg text-[var(--muted)]">{total} phản hồi reaction ở section này</p>
      </div>
    );
  }

  if (step.type === "COMMENT_SPOTLIGHT") {
    return (
      <article className="mx-auto w-full max-w-5xl text-center">
        <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">{step.section.lessonTitle} · SECTION {step.section.sectionPosition + 1} · {step.section.sectionTitle}</p>
        <p className="mt-8 whitespace-pre-wrap break-words text-2xl font-medium leading-[1.45] tracking-tight text-[#203027] sm:text-5xl lg:text-6xl">“{step.comment.body}”</p>
        <p className="mt-10 text-lg font-semibold text-[var(--accent)] sm:text-2xl">{step.comment.authorLabel}</p>
      </article>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl text-center">
      <div className="grid grid-cols-3 gap-3 sm:gap-8">
        <div><p className="text-3xl font-semibold sm:text-5xl">{snapshot.participantCount}</p><p className="mt-2 text-xs text-[var(--muted)] sm:text-sm">students</p></div>
        <div><p className="text-3xl font-semibold sm:text-5xl">{commentCount}</p><p className="mt-2 text-xs text-[var(--muted)] sm:text-sm">reflections</p></div>
        <div><p className="text-3xl font-semibold sm:text-5xl">{meaningfulSectionCount}</p><p className="mt-2 text-xs text-[var(--muted)] sm:text-sm">sections</p></div>
      </div>
      <p className="mt-8 text-lg text-[var(--muted)]">1 shared learning journey</p>
      <h2 className="mt-12 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Every question<br />moves the class forward.</h2>
      <p className="mt-8 text-sm font-bold tracking-[0.28em] text-[var(--accent)]">MINCLASS</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button className="rounded-xl border border-black/15 bg-white px-5 py-3 font-semibold" onClick={onReplay} type="button">Xem lại</button>
        <Link className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white" href={`/teacher/rooms/${snapshot.roomId}/summary`} onClick={onExit}>Quay về tổng kết</Link>
      </div>
    </div>
  );
}

export function ClassVoicesViewer({ snapshot, initialPresentation = false }: {
  snapshot: ClassVoicesSnapshot;
  initialPresentation?: boolean;
}) {
  const voices = flattenClassVoices(snapshot);
  const lessons = groupClassVoicesByLesson(snapshot);
  const steps = buildPresentationSteps(snapshot);
  const meaningfulSectionCount = snapshot.sections.filter(
    (section) => section.comments.length > 0 || countSectionReactions(section) > 0,
  ).length;
  const [lessonFilter, setLessonFilter] = useState(lessons[0]?.lessonId ?? "");
  const [isPresenting, setIsPresenting] = useState(initialPresentation && steps.length > 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isStepVisible, setIsStepVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLElement>(null);
  const enterButtonRef = useRef<HTMLButtonElement>(null);
  const exitButtonRef = useRef<HTMLButtonElement>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const showStep = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= steps.length || !isStepVisible) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setCurrentIndex(nextIndex);
      return;
    }
    setIsStepVisible(false);
    transitionTimerRef.current = window.setTimeout(() => {
      setCurrentIndex(nextIndex);
      setIsStepVisible(true);
      transitionTimerRef.current = null;
    }, 160);
  }, [isStepVisible, steps.length]);

  const exitPresentation = useCallback(() => {
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
    setIsStepVisible(true);
    setIsPresenting(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    window.setTimeout(() => enterButtonRef.current?.focus(), 0);
  }, []);

  function enterPresentation() {
    if (steps.length === 0) return;
    setCurrentIndex(0);
    setIsStepVisible(true);
    setIsPresenting(true);
    void containerRef.current?.requestFullscreen?.().catch(() => undefined);
  }

  useEffect(() => {
    if (isPresenting) window.setTimeout(() => exitButtonRef.current?.focus(), 0);
  }, [isPresenting]);

  useEffect(() => {
    if (!isPresenting) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Tab") {
        const controls = Array.from(
          presentationRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]") ?? [],
        );
        const activeIndex = controls.indexOf(document.activeElement as HTMLElement);
        const nextIndex = event.shiftKey
          ? (activeIndex <= 0 ? controls.length - 1 : activeIndex - 1)
          : (activeIndex === controls.length - 1 ? 0 : activeIndex + 1);
        if (controls[nextIndex]) {
          event.preventDefault();
          controls[nextIndex].focus();
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        showStep(nextPresentationIndex(currentIndex, -1, steps.length));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showStep(nextPresentationIndex(currentIndex, 1, steps.length));
      } else if (event.key === "Escape" && !document.fullscreenElement) {
        exitPresentation();
      }
    }

    function handleFullscreenChange() {
      if (!document.fullscreenElement) exitPresentation();
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [currentIndex, exitPresentation, isPresenting, showStep, steps.length]);

  useEffect(() => () => {
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
  }, []);

  const visibleLessons = filterClassVoiceLessons(snapshot, lessonFilter);
  const currentStep = steps[currentIndex] ?? null;

  return (
    <div ref={containerRef}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Lọc Class Voices theo Lesson">
          {lessons.map((lesson) => {
            const commentCount = lesson.sections.reduce((total, section) => total + section.comments.length, 0);
            const isSelected = lessonFilter === lesson.lessonId;
            return (
              <button
                aria-pressed={isSelected}
                className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-2 pl-4 text-sm font-semibold transition ${isSelected ? "bg-[var(--accent)] text-white" : "border border-black/10 bg-white hover:border-emerald-300"}`}
                key={lesson.lessonId}
                onClick={() => setLessonFilter(lesson.lessonId)}
                type="button"
              >
                <span>{lesson.lessonTitle}</span>
                <span className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-1 text-xs font-black ${isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-900"}`}>
                  {commentCount}
                </span>
              </button>
            );
          })}
        </div>
        <button className="shrink-0 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={steps.length === 0} onClick={enterPresentation} ref={enterButtonRef} type="button">Trình chiếu Class Voices ✨</button>
      </div>

      {voices.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-black/15 bg-white px-6 py-12 text-center">
          <h2 className="text-2xl font-semibold">Chưa có comment trong buổi học này.</h2>
          <p className="mt-3 text-[var(--muted)]">Các reaction của lớp vẫn được tổng hợp bên dưới.</p>
        </div>
      ) : null}

      <div className="mt-10 space-y-14">
        {visibleLessons.map((lesson) => (
          <section aria-labelledby={`voice-lesson-${lesson.lessonId}`} key={lesson.lessonId}>
            <header className="mb-8 border-b border-emerald-200 pb-5">
              <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">LESSON</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight" id={`voice-lesson-${lesson.lessonId}`}>{lesson.lessonTitle}</h2>
            </header>
            <div className="space-y-12">
              {lesson.sections.map((section) => (
                <section aria-labelledby={`voice-section-${section.sectionId}`} key={section.sectionId}>
                  <header className="mb-6 max-w-3xl">
                    <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent)]">SECTION {String(section.sectionPosition + 1).padStart(2, "0")}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight" id={`voice-section-${section.sectionId}`}>{section.sectionTitle}</h3>
                    <div className="mt-4"><ReactionOverview section={section} /></div>
                  </header>
                  {section.comments.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-black/15 bg-white p-6 text-sm text-[var(--muted)]">Section này chưa có comment.</p>
                  ) : (
                    <div className="grid gap-5 md:grid-cols-2">
                      {section.comments.map((comment) => (
                        <article className="flex min-h-52 flex-col justify-between rounded-3xl border border-black/8 bg-white p-6 shadow-sm sm:p-8" key={comment.id}>
                          <p className="whitespace-pre-wrap break-words text-xl leading-9 text-[#263129]">“{comment.body}”</p>
                          <p className="mt-8 text-sm font-semibold text-[var(--accent)]">{comment.authorLabel}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </section>
        ))}
      </div>

      {isPresenting && currentStep ? (
        <section aria-label="Class Voices Presentation Mode" aria-modal="true" className="fixed inset-0 z-50 flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f5f2e8_55%,#e8f2eb_100%)] p-5 sm:p-8 lg:p-12" ref={presentationRef} role="dialog">
          <header className="flex shrink-0 items-center justify-between gap-5">
            <p className="text-xs font-bold tracking-[0.2em] text-[var(--accent)]">MINCLASS · CLASS VOICES</p>
            <button className="rounded-xl border border-black/15 bg-white px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4" onClick={exitPresentation} ref={exitButtonRef} type="button">Exit</button>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-6 sm:py-8" aria-live="polite">
            <div className={`w-full transition-all duration-200 motion-reduce:transition-none ${isStepVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.98] opacity-0"}`}>
              <PresentationContent meaningfulSectionCount={meaningfulSectionCount} onExit={exitPresentation} onReplay={() => showStep(0)} snapshot={snapshot} step={currentStep} />
            </div>
          </div>
          <footer className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
            <button aria-label="Bước trình chiếu trước" className="justify-self-start rounded-xl border border-black/15 bg-white px-3 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-30 sm:px-4 sm:text-base" disabled={currentIndex === 0 || !isStepVisible} onClick={() => showStep(nextPresentationIndex(currentIndex, -1, steps.length))} type="button">← Previous</button>
            <p className="text-sm font-semibold text-[var(--muted)]" aria-label={`Bước ${currentIndex + 1} trên ${steps.length}`}>{currentIndex + 1} / {steps.length}</p>
            <button aria-label="Bước trình chiếu tiếp theo" className="justify-self-end rounded-xl border border-black/15 bg-white px-3 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-30 sm:px-4 sm:text-base" disabled={currentIndex === steps.length - 1 || !isStepVisible} onClick={() => showStep(nextPresentationIndex(currentIndex, 1, steps.length))} type="button">Next →</button>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
