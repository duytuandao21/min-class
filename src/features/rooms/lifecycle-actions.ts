"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { mssvSchema, roomCodeSchema, roomIdSchema } from "@/features/rooms/schemas";
import { createClient } from "@/lib/supabase/server";

export type StartRoomResult =
  | { ok: true }
  | { ok: false; message: string };

export type AdvanceSectionResult =
  | { ok: true }
  | { ok: false; message: string };

export type EndRoomResult =
  | { ok: true }
  | { ok: false; message: string };

export type DeleteRoomResult =
  | { ok: true }
  | { ok: false; message: string };

export type JoinRoomState = {
  status: "idle" | "error" | "success";
  fieldErrors?: { roomCode?: string[]; mssv?: string[] };
  message?: string;
  roomId?: string;
};

const joinedRoomSchema = z.object({
  room_id: z.string().uuid(),
  room_code: roomCodeSchema,
  room_title: z.string().min(1),
  room_status: z.literal("ACTIVE"),
  participant_id: z.string().uuid(),
});

export async function startRoomAction(input: unknown): Promise<StartRoomResult> {
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return { ok: false, message: "Room không hợp lệ." };

  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return { ok: false, message: "Phiên ẩn danh chưa sẵn sàng. Hãy thử lại." };
  }

  const { error } = await supabase.rpc("start_room", { p_room_id: roomId.data });
  if (error) {
    return {
      ok: false,
      message: error.code === "P0001" ? "Chỉ Room DRAFT có lesson mới có thể bắt đầu." : "Không thể bắt đầu Room.",
    };
  }

  revalidatePath(`/teacher/rooms/${roomId.data}`);
  return { ok: true };
}

export async function advanceSectionAction(input: unknown): Promise<AdvanceSectionResult> {
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return { ok: false, message: "Room không hợp lệ." };

  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return { ok: false, message: "Phiên ẩn danh chưa sẵn sàng. Hãy thử lại." };
  }

  const { error } = await supabase.rpc("release_section", { p_room_id: roomId.data });
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
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return { ok: false, message: "Room không hợp lệ." };

  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return { ok: false, message: "Phiên ẩn danh chưa sẵn sàng. Hãy thử lại." };
  }

  const { error } = await supabase.rpc("end_room", { p_room_id: roomId.data });
  if (error) return { ok: false, message: "Chỉ Room ACTIVE do bạn tạo mới có thể kết thúc." };

  revalidatePath(`/teacher/rooms/${roomId.data}`);
  revalidatePath(`/teacher/rooms/${roomId.data}/summary`);
  return { ok: true };
}

export async function deleteRoomAction(input: unknown): Promise<DeleteRoomResult> {
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return { ok: false, message: "Room không hợp lệ." };

  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return { ok: false, message: "Phiên ẩn danh chưa sẵn sàng. Hãy thử lại." };
  }

  const { error } = await supabase.rpc("delete_room", { p_room_id: roomId.data });
  if (error) return { ok: false, message: "Chỉ Teacher tạo Room mới có thể xóa buổi học này." };

  revalidatePath("/");
  return { ok: true };
}

export async function joinRoomAction(
  _previousState: JoinRoomState,
  formData: FormData,
): Promise<JoinRoomState> {
  const input = z
    .object({ roomCode: roomCodeSchema, mssv: mssvSchema })
    .safeParse({ roomCode: formData.get("roomCode"), mssv: formData.get("mssv") });

  if (!input.success) {
    const flattened = input.error.flatten().fieldErrors;
    return {
      status: "error",
      fieldErrors: { roomCode: flattened.roomCode, mssv: flattened.mssv },
      message: "Kiểm tra lại thông tin tham gia.",
    };
  }

  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return { status: "error", message: "Phiên ẩn danh chưa sẵn sàng. Hãy thử lại." };
  }

  const { data, error } = await supabase.rpc("join_room", {
    p_room_code: input.data.roomCode,
    p_mssv: input.data.mssv,
  });
  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "MSSV hoặc phiên này đã tham gia Room." };
    }
    if (error.code === "P0001") {
      return { status: "error", message: "Room không tồn tại hoặc chưa/không còn hoạt động." };
    }
    return { status: "error", message: "Không thể tham gia Room. Hãy thử lại." };
  }

  const joinedRoom = joinedRoomSchema.safeParse(Array.isArray(data) ? data[0] : null);
  if (!joinedRoom.success) {
    return { status: "error", message: "Phản hồi tham gia Room không hợp lệ." };
  }

  return { status: "success", roomId: joinedRoom.data.room_id };
}
