import { teacherLessonSummarySchema, type TeacherLessonSummary } from "@/features/rooms/summary";
import { roomIdSchema } from "@/features/rooms/schemas";
import { createClient } from "@/lib/supabase/client";

export async function fetchTeacherRoomLessonSummary(
  roomIdInput: string,
  lessonIdInput: string,
): Promise<TeacherLessonSummary> {
  const roomId = roomIdSchema.parse(roomIdInput);
  const lessonId = roomIdSchema.parse(lessonIdInput);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_teacher_room_lesson_summary", {
    p_lesson_id: lessonId,
    p_room_id: roomId,
  });
  if (error) throw new Error("Không thể tải kết quả Lesson.");
  return teacherLessonSummarySchema.parse(data);
}
