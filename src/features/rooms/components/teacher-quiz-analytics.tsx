"use client";

import { useEffect, useState } from "react";

import {
  filterTeacherQuizAnalyticsBySections,
  type TeacherQuizAnalytics,
} from "@/features/rooms/quiz";
import { fetchTeacherQuizAnalytics } from "@/features/rooms/quiz-client";
import { createDegradedPollingController, createRealtimeSyncCoordinator } from "@/features/rooms/realtime-sync";
import { createClient } from "@/lib/supabase/client";

type ConnectionState = "connecting" | "connected" | "degraded";

export function TeacherQuizAnalytics({
  roomId,
  initialAnalytics,
  lessonId,
  lessonTitle,
  sectionIds,
}: {
  roomId: string;
  initialAnalytics: TeacherQuizAnalytics;
  lessonId: string;
  lessonTitle: string;
  sectionIds: string[];
}) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [syncError, setSyncError] = useState<string | null>(null);
  const lessonAnalytics = filterTeacherQuizAnalyticsBySections(analytics, sectionIds);

  useEffect(() => {
    const supabase = createClient();
    const coordinator = createRealtimeSyncCoordinator({
      fetchSnapshot: () => fetchTeacherQuizAnalytics(roomId, lessonId),
      onError: () => setSyncError("Mất đồng bộ Quiz Analytics tạm thời. MINCLASS sẽ thử lại khi kết nối phục hồi."),
      onSuccess: (nextAnalytics) => {
        setAnalytics(nextAnalytics);
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
      .channel(`quiz-analytics:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_feedback_events",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new.kind === "QUIZ") coordinator.request();
        },
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
          <p className="text-sm font-bold tracking-[0.16em] text-[var(--accent)]">QUIZ ANALYTICS</p>
          <h2 className="mt-2 text-2xl font-semibold">Kết quả Quiz · {lessonTitle}</h2>
        </div>
        {connection !== "connected" ? (
          <p className="text-xs text-[var(--muted)]" aria-live="polite">
            {connection === "connecting" ? "Đang kết nối realtime…" : "Realtime đang kết nối lại…"}
          </p>
        ) : null}
      </header>

      {syncError ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">{syncError}</p> : null}

      <div className="mt-6 space-y-6">
        {lessonAnalytics.quizzes.length === 0 ? (
          <p className="rounded-2xl bg-black/3 p-5 text-sm text-[var(--muted)]">Chưa có Quiz section được release.</p>
        ) : lessonAnalytics.quizzes.map((quiz) => (
          <article className="rounded-2xl border border-black/10 p-5 sm:p-6" key={quiz.quizId}>
            <p className="text-xs font-semibold text-[var(--muted)]">SECTION {quiz.sectionPosition + 1}</p>
            <h3 className="mt-1 text-xl font-semibold">{quiz.title}</h3>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-black/3 p-4">
                <p className="text-xs text-[var(--muted)]">Đã submit</p>
                <p className="mt-1 text-2xl font-semibold">{quiz.submittedCount}/{quiz.participantCount}</p>
              </div>
              <div className="rounded-xl bg-black/3 p-4">
                <p className="text-xs text-[var(--muted)]">Completion rate</p>
                <p className="mt-1 text-2xl font-semibold">{quiz.completionRate}%</p>
              </div>
              <div className="rounded-xl bg-black/3 p-4">
                <p className="text-xs text-[var(--muted)]">Điểm trung bình</p>
                <p className="mt-1 text-2xl font-semibold">{quiz.averageScore}/{quiz.totalQuestions}</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {quiz.questions.map((question) => (
                <section className="rounded-xl border border-black/10 p-4" key={question.questionId}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[var(--muted)]">Câu {question.position + 1} · {question.type}</p>
                      <h4 className="mt-1 font-semibold">{question.questionText}</h4>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-900">{question.correctPercentage}% đúng</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {question.options.map((option) => (
                      <div className="flex items-center justify-between gap-4 rounded-lg bg-black/3 px-3 py-2 text-sm" key={option.optionId}>
                        <span className="min-w-0 break-words">{option.content}</span>
                        <span className="shrink-0 font-semibold">{option.selectionCount} chọn</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
