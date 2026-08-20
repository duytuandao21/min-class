"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CopyRoomCodeButton } from "@/features/rooms/components/copy-room-code-button";
import { fetchTeacherParticipantCount } from "@/features/rooms/dashboard-client";
import { createClient } from "@/lib/supabase/client";

export function TeacherRoomOverview({ roomId, roomCode, initialParticipantCount }: { roomId: string; roomCode: string; initialParticipantCount: number }) {
  const [participantCount, setParticipantCount] = useState(initialParticipantCount);
  const [isDegraded, setIsDegraded] = useState(false);
  const syncVersionRef = useRef(0);

  const syncCount = useCallback(async () => {
    const syncVersion = ++syncVersionRef.current;
    try {
      const nextCount = await fetchTeacherParticipantCount(roomId);
      if (syncVersion !== syncVersionRef.current) return;
      setParticipantCount(nextCount);
      setIsDegraded(false);
    } catch {
      if (syncVersion === syncVersionRef.current) setIsDegraded(true);
    }
  }, [roomId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room-participants:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` }, () => void syncCount())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void syncCount();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setIsDegraded(true);
      });

    const syncAfterReconnect = () => void syncCount();
    window.addEventListener("online", syncAfterReconnect);
    return () => {
      syncVersionRef.current += 1;
      window.removeEventListener("online", syncAfterReconnect);
      void supabase.removeChannel(channel);
    };
  }, [roomId, syncCount]);

  return (
    <section className="mt-7 grid gap-4 md:grid-cols-[1.5fr_0.5fr]">
      <div className="rounded-3xl border-2 border-[var(--accent)] bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold text-[var(--muted)]">ROOM CODE</p>
        <div className="mt-3 flex flex-wrap items-center gap-5">
          <p className="font-mono text-5xl font-bold tracking-[0.16em] text-[var(--accent)] sm:text-7xl">{roomCode}</p>
          <CopyRoomCodeButton code={roomCode} />
        </div>
      </div>
      <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold text-[var(--muted)]">STUDENT ĐÃ JOIN</p>
        <p className="mt-3 text-5xl font-semibold tracking-tight">{participantCount}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">participant</p>
        {isDegraded ? <p className="mt-2 text-xs text-amber-800" role="status">Đang kết nối lại…</p> : null}
      </div>
    </section>
  );
}
