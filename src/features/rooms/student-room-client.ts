import {
  parseStudentLessonSnapshot,
  type StudentLessonSnapshot,
} from "@/features/rooms/lesson-flow";
import { roomIdSchema } from "@/features/rooms/schemas";
import { createClient } from "@/lib/supabase/client";

export class StudentRoomUnavailableError extends Error {
  constructor() {
    super("Room không còn khả dụng.");
    this.name = "StudentRoomUnavailableError";
  }
}

export async function fetchStudentLessonSnapshot(input: string, lessonInput: string): Promise<StudentLessonSnapshot> {
  const roomId = roomIdSchema.parse(input);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_student_session_lesson_snapshot", {
    p_room_id: roomId,
    p_lesson_id: lessonInput,
  });
  if (error?.code === "42501") throw new StudentRoomUnavailableError();
  if (error) throw new Error("Không thể đồng bộ nội dung Room.");
  return parseStudentLessonSnapshot(data);
}
