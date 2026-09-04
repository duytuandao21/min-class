"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/features/auth/teacher-session";
import { roomIdSchema } from "@/features/rooms/schemas";
import { createClient } from "@/lib/supabase/server";

export type ReleaseChapterResult =
  | { ok: true }
  | { ok: false; message: string };

export type EndRoomResult =
  | { ok: true }
  | { ok: false; message: string };

export type DeleteRoomResult =
  | { ok: true }
  | { ok: false; message: string };

export async function releaseEntireChapterAction(input: unknown): Promise<ReleaseChapterResult> {
  await requireTeacher();

  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return { ok: false, message: "Buổi học không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("release_entire_chapter", {
    p_room_id: roomId.data,
  });
  if (error) {
    return {
      ok: false,
      message: error.code === "P0001"
        ? "Chỉ có thể Done chương đang LIVE."
        : "Không thể Done toàn bộ chương.",
    };
  }

  revalidatePath(`/teacher/rooms/${roomId.data}`);
  return { ok: true };
}

export async function endRoomAction(input: unknown): Promise<EndRoomResult> {
  await requireTeacher();

  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return { ok: false, message: "Room không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("end_room", { p_room_id: roomId.data });
  if (error) return { ok: false, message: "Chỉ Room ACTIVE do bạn tạo mới có thể kết thúc." };

  revalidatePath(`/teacher/rooms/${roomId.data}`);
  revalidatePath(`/teacher/rooms/${roomId.data}/summary`);
  return { ok: true };
}

export async function deleteRoomAction(input: unknown): Promise<DeleteRoomResult> {
  await requireTeacher();

  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return { ok: false, message: "Room không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_room", { p_room_id: roomId.data });
  if (error) return { ok: false, message: "Chỉ Teacher tạo Room mới có thể xóa buổi học này." };

  revalidatePath("/");
  return { ok: true };
}
