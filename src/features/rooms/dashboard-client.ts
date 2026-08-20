import { z } from "zod";

import { roomIdSchema } from "@/features/rooms/schemas";
import { createClient } from "@/lib/supabase/client";

export async function fetchTeacherParticipantCount(roomIdInput: string): Promise<number> {
  const roomId = roomIdSchema.parse(roomIdInput);
  const supabase = createClient();
  const { count, error } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);
  if (error) throw new Error("Không thể đồng bộ participant count.");
  return z.number().int().nonnegative().parse(count ?? 0);
}
