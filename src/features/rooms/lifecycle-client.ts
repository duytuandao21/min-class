import { z } from "zod";

import { roomIdSchema } from "@/features/rooms/schemas";
import { createClient } from "@/lib/supabase/client";

const releasedSectionProgressSchema = z.array(z.object({
  teaching_section: z.number().int().nonnegative(),
  released_through: z.number().int().nonnegative(),
})).min(1);

export async function presentTeacherSection(roomIdInput: string, lessonIdInput: string, positionInput: number) {
  const roomId = roomIdSchema.parse(roomIdInput);
  const lessonId = roomIdSchema.parse(lessonIdInput);
  const position = z.number().int().nonnegative().parse(positionInput);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("present_session_lesson_section", {
    p_room_id: roomId,
    p_lesson_id: lessonId,
    p_section_position: position,
  });
  if (error) {
    throw new Error(error.code === "22023"
      ? "Chỉ có thể trình chiếu section đã mở cho sinh viên."
      : "Không thể đồng bộ section. Hãy kiểm tra buổi học và thử lại.");
  }
  const progress = releasedSectionProgressSchema.safeParse(data);
  if (!progress.success) throw new Error("Không thể đồng bộ trạng thái Section mới.");
  return {
    teachingSection: progress.data[0].teaching_section,
    releasedThrough: progress.data[0].released_through,
  };
}

export async function advanceTeacherSection(roomIdInput: string, lessonIdInput: string) {
  const roomId = roomIdSchema.parse(roomIdInput);
  const lessonId = roomIdSchema.parse(lessonIdInput);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("release_session_lesson_section", {
    p_room_id: roomId,
    p_lesson_id: lessonId,
  });

  if (error) {
    throw new Error(error.code === "P0001"
      ? "Đây đã là section cuối cùng."
      : "Không thể chuyển sang Section tiếp theo.");
  }

  const progress = releasedSectionProgressSchema.safeParse(data);
  if (!progress.success) throw new Error("Không thể đồng bộ trạng thái Section mới.");

  return {
    teachingSection: progress.data[0].teaching_section,
    releasedThrough: progress.data[0].released_through,
  };
}
