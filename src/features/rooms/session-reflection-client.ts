"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  teacherSessionReflectionsSchema,
  type TeacherSessionReflections,
} from "@/features/rooms/session-reflection";
import { createClient } from "@/lib/supabase/client";

type ConnectionState = "connecting" | "connected" | "degraded";

async function fetchTeacherSessionReflections(roomId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_teacher_session_reflections", {
    p_room_id: roomId,
  });
  if (error) throw error;
  return teacherSessionReflectionsSchema.parse(data);
}

export function useTeacherSessionReflectionsRealtime(
  initialSnapshot: TeacherSessionReflections,
) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncVersionRef = useRef(0);

  const syncReflections = useCallback(async () => {
    const syncVersion = ++syncVersionRef.current;
    try {
      const nextSnapshot = await fetchTeacherSessionReflections(initialSnapshot.roomId);
      if (syncVersion !== syncVersionRef.current) return;
      setSnapshot(nextSnapshot);
      setSyncError(null);
    } catch {
      if (syncVersion !== syncVersionRef.current) return;
      setSyncError("Tạm thời chưa thể đồng bộ review mới. MINCLASS sẽ tự thử lại.");
    }
  }, [initialSnapshot.roomId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`session-reflections:${initialSnapshot.roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_reflections" },
        () => void syncReflections(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("connected");
          void syncReflections();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("degraded");
        }
      });

    const syncAfterReconnect = () => void syncReflections();
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") void syncReflections();
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
  }, [initialSnapshot.roomId, syncReflections]);

  return { connection, snapshot, syncError };
}
