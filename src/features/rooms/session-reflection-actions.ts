"use server";

import { z } from "zod";

import { roomIdSchema } from "@/features/rooms/schemas";
import {
  parseSessionReflectionRow,
  type SessionReflection,
} from "@/features/rooms/session-reflection";
import { createClient } from "@/lib/supabase/server";

export type SessionReflectionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: {
    reviewBody?: string[];
    speakingCount?: string[];
  };
  reflection?: SessionReflection;
};

const sessionReflectionInputSchema = z.object({
  roomId: roomIdSchema,
  speakingCount: z.coerce.number().int("Chỉ nhập số nguyên.").min(0, "Số lần phát biểu không được âm.").max(999, "Số lần phát biểu tối đa là 999."),
  reviewBody: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(1000, "Review tối đa 1000 ký tự.").optional(),
  ),
});

export async function saveSessionReflectionAction(
  rawRoomId: string,
  _previousState: SessionReflectionState,
  formData: FormData,
): Promise<SessionReflectionState> {
  const input = sessionReflectionInputSchema.safeParse({
    roomId: rawRoomId,
    speakingCount: formData.get("speakingCount"),
    reviewBody: formData.get("reviewBody"),
  });
  if (!input.success) {
    const errors = z.flattenError(input.error).fieldErrors;
    return {
      status: "error",
      message: "Kiểm tra lại phần tổng kết buổi học.",
      fieldErrors: {
        reviewBody: errors.reviewBody,
        speakingCount: errors.speakingCount,
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_own_session_reflection", {
    p_room_id: input.data.roomId,
    p_speaking_count: input.data.speakingCount,
    p_review_body: input.data.reviewBody ?? null,
  });
  if (error) {
    const message = error.code === "42501"
      ? "Chỉ có thể gửi tổng kết sau khi buổi học kết thúc."
      : error.code === "23505"
        ? "Bạn đã gửi tổng kết cho buổi học này."
        : "Không thể lưu tổng kết. Hãy thử lại.";
    return {
      status: "error",
      message,
    };
  }

  try {
    const reflection = parseSessionReflectionRow(Array.isArray(data) ? data[0] : null);
    return {
      status: "success",
      message: "Đã lưu tổng kết của bạn.",
      reflection,
    };
  } catch {
    return { status: "error", message: "Phản hồi từ hệ thống không hợp lệ." };
  }
}
