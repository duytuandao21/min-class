"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { MarkdownContent } from "@/features/lessons/components/markdown-preview";
import { SectionReflection } from "@/features/rooms/components/section-reflection";
import { StudentQuiz } from "@/features/rooms/components/student-quiz";
import { StudentSessionReflection } from "@/features/rooms/components/student-session-reflection";
import type { OwnReactions, Reaction } from "@/features/rooms/feedback";
import {
  reconcileStudentPosition,
  getStudentPresentationPosition,
  type StudentLessonSnapshot,
} from "@/features/rooms/lesson-flow";
import {
  fetchStudentLessonSnapshot,
  StudentRoomUnavailableError,
} from "@/features/rooms/student-room-client";
import type { SessionReflection } from "@/features/rooms/session-reflection";
import { createClient } from "@/lib/supabase/client";
import { createDegradedPollingController, createRealtimeSyncCoordinator } from "@/features/rooms/realtime-sync";

type ConnectionState = "connecting" | "connected" | "degraded";

function WaitingForSection() {
  return (
    <div className="max-w-2xl rounded-3xl border border-black/10 bg-white px-8 py-14 text-center shadow-sm sm:px-14 sm:py-16">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-900/8 text-3xl text-[var(--accent)]" aria-hidden>
        …
      </div>
      <h2 className="mt-7 text-3xl font-semibold">Đang chờ nội dung</h2>
      <p className="mt-4 text-xl leading-9 text-[var(--muted)]">
        Thầy/cô đang trình bày nội dung. Nội dung sẽ xuất hiện khi section hoàn thành.
      </p>
    </div>
  );
}

export function StudentLessonPlayer({
  initialSnapshot,
  initialReactions,
  initialSessionReflection,
  lessonId,
  participated,
}: {
  initialSnapshot: StudentLessonSnapshot;
  initialReactions: OwnReactions;
  initialSessionReflection: SessionReflection | null;
  lessonId: string;
  participated: boolean;
}) {
  const router = useRouter();
  const initialPosition = getStudentPresentationPosition(initialSnapshot);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [currentPosition, setCurrentPosition] = useState<number | null>(initialPosition);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [reactions, setReactions] = useState(initialReactions);
  const [syncError, setSyncError] = useState<string | null>(null);
  const snapshotRef = useRef(initialSnapshot);
  const currentPositionRef = useRef<number | null>(initialPosition);

  const applySnapshot = useCallback((nextSnapshot: StudentLessonSnapshot) => {
    const nextPosition = reconcileStudentPosition(
      currentPositionRef.current,
      snapshotRef.current,
      nextSnapshot,
    );
    snapshotRef.current = nextSnapshot;
    currentPositionRef.current = nextPosition;
    setSnapshot(nextSnapshot);
    setCurrentPosition(nextPosition);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let realtimeHealthy = false;
    let disposed = false;
    const sync = createRealtimeSyncCoordinator({
      fetchSnapshot: () => fetchStudentLessonSnapshot(initialSnapshot.id, lessonId),
      onSuccess: (nextSnapshot) => {
        applySnapshot(nextSnapshot);
        setSyncError(null);
        if (realtimeHealthy) {
          polling.stop();
          setConnection("connected");
        }
      },
      onError: (error) => {
        if (error instanceof StudentRoomUnavailableError) {
          polling.stop();
          sync.dispose();
          router.replace("/learn");
          router.refresh();
          return;
        }
        setSyncError("Mất đồng bộ tạm thời. MINCLASS sẽ thử lại khi kết nối phục hồi.");
        polling.start();
      },
    });
    const polling = createDegradedPollingController({
      isVisible: () => document.visibilityState === "visible" && navigator.onLine,
      requestSync: () => sync.request(),
    });
    const connectionTimeout = setTimeout(() => {
      if (!realtimeHealthy) {
        setConnection("degraded");
        polling.start();
      }
    }, 8_000);
    const channel = supabase
      .channel(`room-flow:${initialSnapshot.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${initialSnapshot.id}`,
        },
        () => {
          sync.request();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "session_lessons",
          filter: `session_id=eq.${initialSnapshot.id}`,
        },
        () => sync.request(),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${initialSnapshot.id}`,
        },
        () => sync.request(),
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          realtimeHealthy = true;
          clearTimeout(connectionTimeout);
          polling.stop();
          setConnection("connected");
          sync.syncNow();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          realtimeHealthy = false;
          setConnection("degraded");
          polling.start();
        }
      });

    const syncAfterReconnect = () => sync.syncNow();
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") sync.syncNow();
    };
    const markOffline = () => {
      realtimeHealthy = false;
      setConnection("degraded");
      polling.start();
    };
    window.addEventListener("online", syncAfterReconnect);
    window.addEventListener("offline", markOffline);
    window.addEventListener("focus", syncAfterReconnect);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      disposed = true;
      clearTimeout(connectionTimeout);
      sync.dispose();
      polling.stop();
      window.removeEventListener("online", syncAfterReconnect);
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("focus", syncAfterReconnect);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [applySnapshot, initialSnapshot.id, lessonId, router]);

  const currentIndex = snapshot.sections.findIndex((section) => section.position === currentPosition);
  const currentSection = currentIndex >= 0 ? snapshot.sections[currentIndex] : null;
  const isLatest = currentIndex === snapshot.sections.length - 1;

  function moveTo(index: number) {
    const position = snapshot.sections[index]?.position;
    if (position === undefined) return;
    currentPositionRef.current = position;
    setCurrentPosition(position);
  }

  function updateReaction(sectionId: string, reaction: Reaction | undefined) {
    setReactions((current) => ({ ...current, [sectionId]: reaction }));
  }

  return (
    <section className="flex flex-1 flex-col pb-10 pt-4 sm:pt-5">
      {connection !== "connected" ? <div className="mb-3 flex min-h-5 items-center justify-end">
        <div className="text-right text-xs text-[var(--muted)]" aria-live="polite">
          {connection === "connecting" ? "Đang kết nối realtime…" : null}
          {connection === "degraded" ? "Realtime đang kết nối lại…" : null}
        </div>
      </div> : null}

      {syncError ? (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          {syncError}
        </p>
      ) : null}

      {!currentSection ? (
        <div className="flex flex-1 items-center justify-center py-10">
          <WaitingForSection />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-5xl">
          {snapshot.status === "ACTIVE" ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p aria-live="polite" className="text-sm font-semibold text-emerald-900">
                {currentPosition === snapshot.teachingSection ? "Đang theo giảng viên" : "Đang xem lại section đã mở"}
              </p>
              {currentPosition !== snapshot.teachingSection ? (
                <button
                  className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                  onClick={() => moveTo(snapshot.sections.findIndex((section) => section.position === snapshot.teachingSection))}
                  type="button"
                >
                  Về section đang dạy
                </button>
              ) : null}
            </div>
          ) : null}
          {snapshot.status === "ENDED" ? (
            <p className="mb-4 w-fit rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800" role="status">
              Buổi học đã kết thúc · Bạn vẫn có thể xem lại các section đã release.
            </p>
          ) : null}

          <article className="rounded-3xl border border-blue-300 bg-blue-100/75 p-7 shadow-sm sm:p-10 lg:p-12">
            <header className="mb-8 border-b border-black/10 pb-6">
              <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-sm font-bold text-[var(--accent)]">
                  SECTION {currentIndex + 1} / {snapshot.sections.length}
                </p>
                <span className="rounded-full bg-black/5 px-4 py-1.5 text-sm font-semibold">{currentSection.type}</span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{currentSection.title}</h2>
            </header>

            {currentSection.type === "QUIZ" ? (
              <StudentQuiz
                key={currentSection.id}
                readOnly={snapshot.status === "ENDED"}
                roomId={snapshot.id}
                sectionId={currentSection.id}
              />
            ) : (
              <MarkdownContent className="text-lg leading-8 sm:text-xl sm:leading-9" source={currentSection.contentMd} />
            )}
          </article>

          <nav className="mt-6 flex items-center justify-between gap-4" aria-label="Điều hướng section">
            <button
              className="min-h-12 rounded-xl border border-black/15 bg-white px-6 py-3 text-base font-bold transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={currentIndex <= 0}
              onClick={() => moveTo(currentIndex - 1)}
              type="button"
            >
              ← Previous
            </button>
            <button
              className="min-h-12 rounded-xl border border-black/15 bg-white px-6 py-3 text-base font-bold transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={isLatest}
              onClick={() => moveTo(currentIndex + 1)}
              type="button"
            >
              Next →
            </button>
          </nav>

          {snapshot.status === "ACTIVE" ? (
            <SectionReflection
              key={currentSection.id}
              onReactionChange={(reaction) => updateReaction(currentSection.id, reaction)}
              sectionId={currentSection.id}
              selectedReaction={reactions[currentSection.id]}
            />
          ) : participated ? (
            <StudentSessionReflection
              initialReflection={initialSessionReflection}
              roomId={snapshot.id}
            />
          ) : null}

        </div>
      )}
    </section>
  );
}
