"use client";

import { useEffect, useState } from "react";

import {
  filterFeedbackSnapshotBySections,
  type TeacherFeedbackSnapshot,
} from "@/features/rooms/feedback";
import { fetchTeacherFeedbackSnapshot } from "@/features/rooms/feedback-client";
import { createDegradedPollingController, createRealtimeSyncCoordinator } from "@/features/rooms/realtime-sync";
import { createClient } from "@/lib/supabase/client";

type ConnectionState = "connecting" | "connected" | "degraded";

export function TeacherLiveFeedback({
  roomId,
  initialSnapshot,
  currentSectionId,
  lessonId,
  lessonTitle,
  sectionIds,
}: {
  roomId: string;
  initialSnapshot: TeacherFeedbackSnapshot;
  currentSectionId: string | null;
  lessonId: string;
  lessonTitle: string;
  sectionIds: string[];
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [syncError, setSyncError] = useState<string | null>(null);
  const lessonSnapshot = filterFeedbackSnapshotBySections(snapshot, sectionIds);
  const currentReaction = lessonSnapshot.reactions.find((reaction) => reaction.sectionId === currentSectionId) ?? null;

  useEffect(() => {
    const supabase = createClient();
    const coordinator = createRealtimeSyncCoordinator({
      fetchSnapshot: () => fetchTeacherFeedbackSnapshot(roomId, lessonId),
      onError: () => setSyncError("Mất đồng bộ Live Feedback tạm thời. MINCLASS sẽ thử lại khi kết nối phục hồi."),
      onSuccess: (nextSnapshot) => {
        setSnapshot(nextSnapshot);
        setSyncError(null);
      },
    });
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") coordinator.request();
    };
    const fallbackPolling = createDegradedPollingController({
      isVisible: () => document.visibilityState === "visible",
      requestSync: coordinator.syncNow,
    });

    const channel = supabase
      .channel(`room-feedback:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_feedback_events",
          filter: `room_id=eq.${roomId}`,
        },
        () => coordinator.request(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fallbackPolling.stop();
          setConnection("connected");
          coordinator.syncNow();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("degraded");
          fallbackPolling.start();
        }
      });

    const syncAfterReconnect = () => coordinator.syncNow();
    const markOffline = () => {
      setConnection("degraded");
      fallbackPolling.start();
    };

    window.addEventListener("online", syncAfterReconnect);
    window.addEventListener("offline", markOffline);
    window.addEventListener("focus", syncAfterReconnect);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      fallbackPolling.stop();
      coordinator.dispose();
      window.removeEventListener("online", syncAfterReconnect);
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("focus", syncAfterReconnect);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [lessonId, roomId]);

  return (
    <section className="mt-8 rounded-3xl border border-black/10 bg-white p-7 shadow-sm sm:p-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.16em] text-[var(--accent)]">LIVE FEEDBACK</p>
          <h2 className="mt-2 text-2xl font-semibold">Phản hồi · {lessonTitle}</h2>
        </div>
        {connection !== "connected" ? (
          <p className="text-xs text-[var(--muted)]" aria-live="polite">
            {connection === "connecting" ? "Đang kết nối realtime…" : "Realtime đang kết nối lại…"}
          </p>
        ) : null}
      </header>

      {syncError ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">{syncError}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold">Reaction theo section</h3>
          <div className="mt-3 space-y-3">
            {!currentReaction ? (
              <p className="rounded-2xl bg-black/3 p-4 text-sm text-[var(--muted)]">Chưa có reaction cho section hiện tại.</p>
            ) : (
              <article className="rounded-2xl border border-black/10 p-4">
                <p className="text-xs font-semibold text-[var(--muted)]">SECTION {currentReaction.sectionPosition + 1}</p>
                <h4 className="mt-1 font-semibold">{currentReaction.sectionTitle}</h4>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5">👍 {currentReaction.understand}</span>
                  <span className="rounded-full bg-amber-50 px-3 py-1.5">🤔 {currentReaction.unsure}</span>
                  <span className="rounded-full bg-sky-50 px-3 py-1.5">❓ {currentReaction.question}</span>
                </div>
              </article>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Comment mới nhất</h3>
          <div className="mt-3 max-h-[30rem] space-y-3 overflow-y-auto">
            {lessonSnapshot.comments.length === 0 ? (
              <p className="rounded-2xl bg-black/3 p-4 text-sm text-[var(--muted)]">Chưa có comment.</p>
            ) : lessonSnapshot.comments.map((comment) => (
              <article className="rounded-2xl border border-black/10 p-4" key={comment.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[var(--accent)]">{comment.authorLabel}</span>
                  <span className="text-[var(--muted)]">Section {comment.sectionPosition + 1} · {comment.sectionTitle}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{comment.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
