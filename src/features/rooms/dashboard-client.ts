import { roomIdSchema } from "@/features/rooms/schemas";
import { teacherAttendanceSchema, type TeacherAttendance } from "@/features/rooms/summary";
import { createClient } from "@/lib/supabase/client";

export async function fetchTeacherAttendance(roomIdInput: string): Promise<TeacherAttendance> {
  const roomId = roomIdSchema.parse(roomIdInput);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_teacher_session_attendance", {
    p_session_id: roomId,
  });
  if (error) throw new Error("Không thể đồng bộ attendance.");
  return teacherAttendanceSchema.parse(data);
}
