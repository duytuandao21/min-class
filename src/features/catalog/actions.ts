"use server";

import { z } from "zod";

import { lessonAccessInputSchema, lessonStatusSchema } from "@/features/catalog/schemas";
import { createClient } from "@/lib/supabase/server";

export type LessonAccessState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: {
    mssv?: string[];
    sessionCode?: string[];
  };
  sessionId?: string;
};

const accessResultSchema = z.object({
  lesson_id: z.string().uuid(),
  lesson_status: lessonStatusSchema,
  session_id: z.string().uuid(),
});

export async function accessPublicLessonAction(
  lessonId: string,
  _previousState: LessonAccessState,
  formData: FormData,
): Promise<LessonAccessState> {
  const input = lessonAccessInputSchema.safeParse({
    lessonId,
    mssv: formData.get("mssv"),
    sessionCode: formData.get("sessionCode"),
  });
  if (!input.success) {
    const errors = z.flattenError(input.error).fieldErrors;
    const message = errors.sessionCode
      ? "Lesson Session Code chưa đúng"
      : errors.mssv
        ? "Bạn không thuộc lớp học phần này"
        : "Kiểm tra lại thông tin đã nhập.";

    return {
      status: "error",
      message,
      fieldErrors: { mssv: errors.mssv, sessionCode: errors.sessionCode },
    };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { status: "error", message: "Không thể xác minh quyền truy cập Lesson." };
  }

  if (!authData.user.is_anonymous) {
    return {
      status: "error",
      message: "Browser này đang đăng nhập Teacher. Hãy mở trang Student trong cửa sổ ẩn danh hoặc browser khác.",
    };
  }

  if (input.data.sessionCode) {
    const joined = await supabase.rpc("join_lesson_session", {
      p_lesson_id: input.data.lessonId,
      p_join_code: input.data.sessionCode,
      p_mssv: input.data.mssv,
    });
    if (joined.error) {
      const message = joined.error.code === "23505"
        ? "MSSV này đã tham gia bằng một phiên Student khác."
        : joined.error.code === "P0002"
          ? "Lesson Session Code chưa đúng"
          : joined.error.code === "P0003"
            ? "Bạn không thuộc lớp học phần này"
            : "Không thể tham gia Lesson Session.";

      return {
        status: "error",
        message,
      };
    }

    const joinedRoom = z.object({ room_id: z.string().uuid() }).safeParse(
      Array.isArray(joined.data) ? joined.data[0] : null,
    );
    if (!joinedRoom.success) {
      return { status: "error", message: "Không thể tham gia Lesson Session." };
    }

    return {
      status: "success",
      message: "Đã tham gia Lesson Session.",
      sessionId: joinedRoom.data.room_id,
    };
  }

  const { data, error } = await supabase.rpc("access_ended_lesson_session", {
    p_lesson_id: input.data.lessonId,
    p_mssv: input.data.mssv,
  });
  if (error) {
    return { status: "error", message: "Không thể xác minh quyền truy cập Lesson." };
  }

  const row = Array.isArray(data) ? data[0] : null;
  const result = accessResultSchema.safeParse(row);
  if (!result.success) {
    return { status: "error", message: "Không thể xác minh quyền truy cập Lesson." };
  }

  return {
    status: "success",
    message: "Đã xác minh quyền truy cập Lesson.",
    sessionId: result.data.session_id,
  };
}
