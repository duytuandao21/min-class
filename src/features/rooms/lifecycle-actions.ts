"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireTeacher } from "@/features/auth/teacher-session";
import { roomIdSchema } from "@/features/rooms/schemas";
import { createClient } from "@/lib/supabase/server";

export type AdvanceSectionResult =
  | { ok: true }
  | { ok: false; message: string };

export type EndRoomResult =
  | { ok: true }
  | { ok: false; message: string };

export type DeleteRoomResult =
  | { ok: true }
  | { ok: false; message: string };

export async function advanceSectionAction(input: unknown, lessonInput?: unknown): Promise<AdvanceSectionResult> {
  await requireTeacher();

  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return { ok: false, message: "Room không hợp lệ." };
  const lessonId = z.string().uuid().safeParse(lessonInput);
  if (!lessonId.success) return { ok: false, message: "Lesson không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("release_session_lesson_section", {
    p_room_id: roomId.data,
    p_lesson_id: lessonId.data,
  });
  if (error) {
    return {
      ok: false,
      message: error.code === "P0001"
        ? "Đây đã là section cuối cùng."
        : "Không thể chuyển sang Section tiếp theo.",
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
