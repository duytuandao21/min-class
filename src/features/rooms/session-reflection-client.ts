"use client";

import { useEffect, useState } from "react";

import {
  teacherSessionReflectionsSchema,
  type TeacherSessionReflections,
} from "@/features/rooms/session-reflection";
import { createDegradedPollingController, createRealtimeSyncCoordinator } from "@/features/rooms/realtime-sync";
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

  useEffect(() => {
    const supabase = createClient();
    const coordinator = createRealtimeSyncCoordinator({
      fetchSnapshot: () => fetchTeacherSessionReflections(initialSnapshot.roomId),
      onError: () => setSyncError("Tạm thời chưa thể đồng bộ review mới. MINCLASS sẽ tự thử lại."),
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
      .channel(`session-reflections:${initialSnapshot.roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_reflections" },
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
  }, [initialSnapshot.roomId]);

  return { connection, snapshot, syncError };
}
