"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  TeacherSessionReflections,
} from "@/features/rooms/session-reflection";
import { useTeacherSessionReflectionsRealtime } from "@/features/rooms/session-reflection-client";

type PresentationStep =
  | { type: "INTRO" }
  | { type: "REVIEW"; reflection: TeacherSessionReflections["reflections"][number] }
  | { type: "FINAL" };

function buildSteps(snapshot: TeacherSessionReflections): PresentationStep[] {
  const reviews = snapshot.reflections.filter((reflection) => reflection.reviewBody !== null);
  if (reviews.length === 0) return [];
  return [
    { type: "INTRO" },
    ...reviews.map((reflection): PresentationStep => ({ type: "REVIEW", reflection })),
    { type: "FINAL" },
  ];
}

function PresentationContent({
  snapshot,
  step,
}: {
  snapshot: TeacherSessionReflections;
  step: PresentationStep;
}) {
  if (step.type === "INTRO") {
    return (
      <div className="mx-auto w-full max-w-5xl text-center">
        <p className="text-sm font-bold tracking-[0.24em] text-[var(--accent)]">MINCLASS · SESSION REVIEWS</p>
        <h2 className="mt-7 text-4xl font-semibold tracking-tight sm:text-6xl">Một buổi học qua góc nhìn của lớp</h2>
        <p className="mt-6 text-xl text-[var(--muted)]">{snapshot.roomTitle}</p>
      </div>
    );
  }

  if (step.type === "REVIEW") {
    return (
      <article className="mx-auto w-full max-w-5xl text-center">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">{step.reflection.mssv}</p>
        <p className="mt-8 whitespace-pre-wrap break-words text-3xl font-medium leading-[1.45] tracking-tight text-[var(--foreground)] sm:text-5xl lg:text-6xl">
          “{step.reflection.reviewBody}”
        </p>
        <p className="mt-10 text-lg font-semibold text-[var(--accent)] sm:text-2xl">
          {step.reflection.speakingCount} lần phát biểu
        </p>
      </article>
    );
  }

  const totalSpeaking = snapshot.reflections.reduce(
    (total, reflection) => total + reflection.speakingCount,
    0,
  );
  return (
    <div className="mx-auto w-full max-w-5xl text-center">
      <p className="text-sm font-bold tracking-[0.24em] text-[var(--accent)]">CẢM ƠN CẢ LỚP</p>
      <h2 className="mt-7 text-4xl font-semibold tracking-tight sm:text-6xl">Mỗi tiếng nói đều làm buổi học tốt hơn.</h2>
      <div className="mt-10 flex flex-wrap justify-center gap-4 text-lg">
        <span className="rounded-full bg-white px-5 py-3 font-semibold shadow-sm">{snapshot.submittedCount} tổng kết</span>
        <span className="rounded-full bg-white px-5 py-3 font-semibold shadow-sm">{totalSpeaking} lượt phát biểu</span>
      </div>
    </div>
  );
}

export function SessionReviewsViewer({
  initialPresentation = false,
  snapshot: initialSnapshot,
}: {
  initialPresentation?: boolean;
  snapshot: TeacherSessionReflections;
}) {
  const { connection, snapshot, syncError } = useTeacherSessionReflectionsRealtime(initialSnapshot);
  const steps = buildSteps(snapshot);
  const [isPresenting, setIsPresenting] = useState(initialPresentation && steps.length > 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLElement>(null);
  const enterButtonRef = useRef<HTMLButtonElement>(null);
  const exitButtonRef = useRef<HTMLButtonElement>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const showStep = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= steps.length || !visible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCurrentIndex(nextIndex);
      return;
    }
    setVisible(false);
    transitionTimerRef.current = window.setTimeout(() => {
      setCurrentIndex(nextIndex);
      setVisible(true);
      transitionTimerRef.current = null;
    }, 160);
  }, [steps.length, visible]);

  const exitPresentation = useCallback(() => {
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
    setVisible(true);
    setIsPresenting(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    window.setTimeout(() => enterButtonRef.current?.focus(), 0);
  }, []);

  function enterPresentation() {
    if (steps.length === 0) return;
    setCurrentIndex(0);
    setVisible(true);
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
        showStep(Math.max(0, currentIndex - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showStep(Math.min(steps.length - 1, currentIndex + 1));
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

  const currentStep = steps[currentIndex] ?? null;
  const totalSpeaking = snapshot.reflections.reduce(
    (total, reflection) => total + reflection.speakingCount,
    0,
  );

  return (
    <div ref={containerRef}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-950">{snapshot.submittedCount}/{snapshot.participantCount} đã gửi</span>
            <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950">{totalSpeaking} lượt phát biểu</span>
          </div>
          {connection !== "connected" ? (
            <p className="mt-3 text-xs text-[var(--muted)]" aria-live="polite">
              {connection === "connecting" ? "Đang kết nối realtime…" : "Realtime đang kết nối lại…"}
            </p>
          ) : null}
        </div>
        <button
          className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={steps.length === 0}
          onClick={enterPresentation}
          ref={enterButtonRef}
          type="button"
        >
          Trình chiếu Session Reviews ✨
        </button>
      </div>

      {syncError ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">{syncError}</p> : null}

      {snapshot.reflections.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-emerald-900/15 bg-emerald-50/60 px-6 py-12 text-center">
          <h2 className="text-2xl font-semibold">Chưa có sinh viên gửi tổng kết.</h2>
          <p className="mt-3 text-[var(--muted)]">Dữ liệu sẽ xuất hiện sau khi sinh viên lưu phần tổng kết cá nhân.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {snapshot.reflections.map((reflection) => (
            <article className="flex min-h-52 flex-col rounded-3xl border border-emerald-900/10 bg-white p-6 shadow-sm sm:p-8" key={reflection.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono font-bold text-[var(--accent)]">{reflection.mssv}</p>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-950">{reflection.speakingCount} lần phát biểu</span>
              </div>
              <p className="mt-7 flex-1 whitespace-pre-wrap break-words text-xl leading-9 text-[var(--foreground)]">
                {reflection.reviewBody ? `“${reflection.reviewBody}”` : "Không viết review."}
              </p>
            </article>
          ))}
        </div>
      )}

      {isPresenting && currentStep ? (
        <section
          aria-label="Session Reviews Presentation Mode"
          aria-modal="true"
          className="fixed inset-0 z-50 flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f5f2e8_55%,#e8f2eb_100%)] p-5 sm:p-8 lg:p-12"
          ref={presentationRef}
          role="dialog"
        >
          <header className="flex shrink-0 items-center justify-between gap-5">
            <p className="text-xs font-bold tracking-[0.2em] text-[var(--accent)]">MINCLASS · SESSION REVIEWS</p>
            <button className="rounded-xl border border-black/15 bg-white px-4 py-2 font-semibold" onClick={exitPresentation} ref={exitButtonRef} type="button">Exit</button>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-8" aria-live="polite">
            <div className={`w-full transition-all duration-200 motion-reduce:transition-none ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
              <PresentationContent snapshot={snapshot} step={currentStep} />
            </div>
          </div>
          <footer className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
            <button className="justify-self-start rounded-xl border border-black/15 bg-white px-4 py-3 font-semibold disabled:opacity-30" disabled={currentIndex === 0 || !visible} onClick={() => showStep(currentIndex - 1)} type="button">← Previous</button>
            <p className="text-sm font-semibold text-[var(--muted)]">{currentIndex + 1} / {steps.length}</p>
            <button className="justify-self-end rounded-xl border border-black/15 bg-white px-4 py-3 font-semibold disabled:opacity-30" disabled={currentIndex === steps.length - 1 || !visible} onClick={() => showStep(currentIndex + 1)} type="button">Next →</button>
          </footer>
        </section>
      ) : null}

      <div className="mt-10">
        <Link className="font-semibold text-[var(--accent)] underline decoration-emerald-300 underline-offset-4" href={`/teacher/rooms/${snapshot.roomId}/summary`}>
          Quay về Summary
        </Link>
      </div>
    </div>
  );
}
