"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BackLink } from "@/components/back-link";
import { MarkdownContent } from "@/features/lessons/components/markdown-preview";
import { SectionReflection } from "@/features/rooms/components/section-reflection";
import { StudentQuiz } from "@/features/rooms/components/student-quiz";
import type { OwnReactions, Reaction } from "@/features/rooms/feedback";
import {
  reconcileStudentPosition,
  type StudentLessonSnapshot,
} from "@/features/rooms/lesson-flow";
import {
  fetchStudentLessonSnapshot,
  StudentRoomUnavailableError,
} from "@/features/rooms/student-room-client";
import { createClient } from "@/lib/supabase/client";

type ConnectionState = "connecting" | "connected" | "degraded";

function WaitingForSection() {
  return (
    <div className="max-w-xl rounded-3xl border border-black/10 bg-white px-7 py-12 text-center shadow-sm sm:px-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-900/8 text-xl text-[var(--accent)]" aria-hidden>
        …
      </div>
      <h2 className="mt-6 text-2xl font-semibold">Đang chờ nội dung</h2>
      <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
        Thầy/cô đang trình bày nội dung. Nội dung sẽ xuất hiện khi section hoàn thành.
      </p>
    </div>
  );
}

export function StudentLessonPlayer({
  initialSnapshot,
  initialReactions,
}: {
  initialSnapshot: StudentLessonSnapshot;
  initialReactions: OwnReactions;
}) {
  const router = useRouter();
  const initialPosition = initialSnapshot.sections.at(-1)?.position ?? null;
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [currentPosition, setCurrentPosition] = useState<number | null>(initialPosition);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [reactions, setReactions] = useState(initialReactions);
  const [syncError, setSyncError] = useState<string | null>(null);
  const snapshotRef = useRef(initialSnapshot);
  const currentPositionRef = useRef<number | null>(initialPosition);
  const syncVersionRef = useRef(0);

  const applySnapshot = useCallback((nextSnapshot: StudentLessonSnapshot) => {
    const nextPosition = reconcileStudentPosition(
      currentPositionRef.current,
      snapshotRef.current.sections,
      nextSnapshot.sections,
    );
    snapshotRef.current = nextSnapshot;
    currentPositionRef.current = nextPosition;
    setSnapshot(nextSnapshot);
    setCurrentPosition(nextPosition);
  }, []);

  const syncSnapshot = useCallback(async () => {
    const syncVersion = ++syncVersionRef.current;
    try {
      const nextSnapshot = await fetchStudentLessonSnapshot(initialSnapshot.id);
      if (syncVersion !== syncVersionRef.current) return;
      applySnapshot(nextSnapshot);
      setSyncError(null);
    } catch (error) {
      if (syncVersion !== syncVersionRef.current) return;
      if (error instanceof StudentRoomUnavailableError) {
        router.replace("/join");
        router.refresh();
        return;
      }
      setSyncError("Mất đồng bộ tạm thời. MINCLASS sẽ thử lại khi kết nối phục hồi.");
    }
  }, [applySnapshot, initialSnapshot.id, router]);

  useEffect(() => {
    const supabase = createClient();
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
          void syncSnapshot();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${initialSnapshot.id}`,
        },
        () => void syncSnapshot(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("connected");
          void syncSnapshot();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("degraded");
        }
      });

    const syncAfterReconnect = () => void syncSnapshot();
    window.addEventListener("online", syncAfterReconnect);
    window.addEventListener("focus", syncAfterReconnect);

    return () => {
      syncVersionRef.current += 1;
      window.removeEventListener("online", syncAfterReconnect);
      window.removeEventListener("focus", syncAfterReconnect);
      void supabase.removeChannel(channel);
    };
  }, [initialSnapshot.id, syncSnapshot]);

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
    <section className="flex flex-1 flex-col py-8">
      <div className="mb-5 flex min-h-10 items-center justify-between gap-4">
        {snapshot.status === "ENDED" ? <BackLink href="/" label="Trang chủ MINCLASS" /> : <span />}
        <div className="text-right text-xs text-[var(--muted)]" aria-live="polite">
          {connection === "connecting" ? "Đang kết nối realtime…" : null}
          {connection === "degraded" ? "Realtime đang kết nối lại…" : null}
        </div>
      </div>

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
        <div className="mx-auto w-full max-w-2xl">
          <article className="rounded-3xl border border-blue-300 bg-blue-100/75 p-6 shadow-sm sm:p-10">
            <header className="mb-7 border-b border-black/10 pb-5">
              <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-xs font-semibold text-[var(--accent)]">
                  SECTION {currentIndex + 1} / {snapshot.sections.length}
                </p>
                <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium">{currentSection.type}</span>
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">{currentSection.title}</h2>
            </header>

            {currentSection.type === "QUIZ" ? (
              <StudentQuiz
                key={currentSection.id}
                readOnly={snapshot.status === "ENDED"}
                roomId={snapshot.id}
                sectionId={currentSection.id}
              />
            ) : (
              <MarkdownContent source={currentSection.contentMd} />
            )}
          </article>

          <nav className="mt-5 flex items-center justify-between gap-4" aria-label="Điều hướng section">
            <button
              className="rounded-xl border border-black/15 bg-white px-4 py-2.5 font-semibold transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={currentIndex <= 0}
              onClick={() => moveTo(currentIndex - 1)}
              type="button"
            >
              ← Previous
            </button>
            <button
              className="rounded-xl border border-black/15 bg-white px-4 py-2.5 font-semibold transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35"
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
          ) : (
            <p className="mt-6 rounded-2xl border border-black/10 bg-white p-5 text-center text-sm text-[var(--muted)]">
              Buổi học đã kết thúc. Bạn vẫn có thể xem lại các section đã release.
            </p>
          )}

        </div>
      )}
    </section>
  );
}
