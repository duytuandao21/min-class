"use client";

import { useEffect, useState } from "react";

import { fetchTeacherAttendance } from "@/features/rooms/dashboard-client";
import { createDegradedPollingController, createRealtimeSyncCoordinator } from "@/features/rooms/realtime-sync";
import type { TeacherAttendance } from "@/features/rooms/summary";
import { createClient } from "@/lib/supabase/client";

export function TeacherRoomOverview({ roomId, initialAttendance }: { roomId: string; initialAttendance: TeacherAttendance }) {
  const [attendance, setAttendance] = useState(initialAttendance);
  const [isDegraded, setIsDegraded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const coordinator = createRealtimeSyncCoordinator({
      fetchSnapshot: () => fetchTeacherAttendance(roomId),
      onError: () => setIsDegraded(true),
      onSuccess: setAttendance,
    });
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") coordinator.request();
    };
    const fallbackPolling = createDegradedPollingController({
      isVisible: () => document.visibilityState === "visible",
      requestSync: coordinator.syncNow,
    });

    const channel = supabase
      .channel(`room-participants:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` }, () => coordinator.request())
      .on("postgres_changes", { event: "*", schema: "public", table: "session_attendance", filter: `session_id=eq.${roomId}` }, () => coordinator.request())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fallbackPolling.stop();
          setIsDegraded(false);
          coordinator.syncNow();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setIsDegraded(true);
          fallbackPolling.start();
        }
      });

    const syncAfterReconnect = () => coordinator.syncNow();
    const markOffline = () => {
      setIsDegraded(true);
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
  }, [roomId]);

  return (
    <section className="mt-7 rounded-3xl border border-emerald-900/10 bg-gradient-to-r from-white to-emerald-50/70 px-6 py-5 shadow-sm sm:px-8 sm:py-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.14)] motion-reduce:animate-none" aria-hidden />
            <p className="text-xs font-bold tracking-[0.16em] text-emerald-800">LỚP HỌC ĐANG DIỄN RA</p>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Sinh viên nhập MSSV một lần, sau đó có thể chuyển giữa các Lesson trong chương đang LIVE.
          </p>
          {isDegraded ? <p className="mt-2 text-xs text-amber-800" role="status">Đang kết nối lại…</p> : null}
        </div>
        <div className="flex shrink-0 items-baseline gap-3 rounded-2xl border border-emerald-900/10 bg-white/85 px-5 py-3.5">
          <span className="text-3xl font-bold tracking-tight text-[var(--accent)]">{attendance.joinedCount}</span>
          <span className="text-sm font-semibold text-[var(--muted)]">/ {attendance.rosterCount} sinh viên</span>
        </div>
      </div>
    </section>
  );
}
