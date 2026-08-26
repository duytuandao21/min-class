"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TeacherFeedbackSnapshot } from "@/features/rooms/feedback";
import { fetchTeacherFeedbackSnapshot } from "@/features/rooms/feedback-client";
import { createClient } from "@/lib/supabase/client";

type ConnectionState = "connecting" | "connected" | "degraded";

export function TeacherLiveFeedback({
  roomId,
  initialSnapshot,
  currentSectionId,
}: {
  roomId: string;
  initialSnapshot: TeacherFeedbackSnapshot;
  currentSectionId: string | null;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncVersionRef = useRef(0);
  const currentReaction = snapshot.reactions.find((reaction) => reaction.sectionId === currentSectionId) ?? null;

  const syncFeedback = useCallback(async () => {
    const syncVersion = ++syncVersionRef.current;
    try {
      const nextSnapshot = await fetchTeacherFeedbackSnapshot(roomId);
      if (syncVersion !== syncVersionRef.current) return;
      setSnapshot(nextSnapshot);
      setSyncError(null);
    } catch {
      if (syncVersion !== syncVersionRef.current) return;
      setSyncError("Mất đồng bộ Live Feedback tạm thời. MINCLASS sẽ thử lại khi kết nối phục hồi.");
    }
  }, [roomId]);

  useEffect(() => {
    const supabase = createClient();
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
        () => void syncFeedback(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("connected");
          void syncFeedback();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("degraded");
        }
      });

    const syncAfterReconnect = () => void syncFeedback();
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") void syncFeedback();
    };
    const fallbackSyncTimer = window.setInterval(syncWhenVisible, 3_000);

    window.addEventListener("online", syncAfterReconnect);
    window.addEventListener("focus", syncAfterReconnect);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      syncVersionRef.current += 1;
      window.clearInterval(fallbackSyncTimer);
      window.removeEventListener("online", syncAfterReconnect);
      window.removeEventListener("focus", syncAfterReconnect);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [roomId, syncFeedback]);

  return (
    <section className="mt-8 rounded-3xl border border-black/10 bg-white p-7 shadow-sm sm:p-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.16em] text-[var(--accent)]">LIVE FEEDBACK</p>
          <h2 className="mt-2 text-2xl font-semibold">Phản hồi mới nhất</h2>
        </div>
        <p className="text-xs text-[var(--muted)]" aria-live="polite">
          {connection === "connecting" ? "Đang kết nối realtime…" : null}
          {connection === "connected" ? "Realtime đang hoạt động" : null}
          {connection === "degraded" ? "Realtime đang kết nối lại…" : null}
        </p>
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
            {snapshot.comments.length === 0 ? (
              <p className="rounded-2xl bg-black/3 p-4 text-sm text-[var(--muted)]">Chưa có comment.</p>
            ) : snapshot.comments.map((comment) => (
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
