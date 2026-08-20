import {
  parseQuizSubmissionResult,
  quizSubmissionSchema,
  studentQuizSnapshotSchema,
  teacherQuizAnalyticsSchema,
  type QuizSubmission,
  type StudentQuizSnapshot,
  type TeacherQuizAnalytics,
} from "@/features/rooms/quiz";
import { roomIdSchema } from "@/features/rooms/schemas";
import { createClient } from "@/lib/supabase/client";

export async function fetchStudentQuizSnapshot(sectionIdInput: string): Promise<StudentQuizSnapshot> {
  const sectionId = roomIdSchema.parse(sectionIdInput);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_student_quiz_snapshot", {
    p_section_id: sectionId,
  });
  if (error) throw new Error("Quiz chưa sẵn sàng.");
  return studentQuizSnapshotSchema.parse(data);
}

export async function submitQuiz(quizIdInput: string, answersInput: QuizSubmission) {
  const quizId = roomIdSchema.parse(quizIdInput);
  const answers = quizSubmissionSchema.parse(answersInput);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("submit_quiz", {
    p_quiz_id: quizId,
    p_answers: answers,
  });
  if (error) throw new Error("Không thể submit Quiz.");
  return parseQuizSubmissionResult(data);
}

export async function fetchTeacherQuizAnalytics(roomIdInput: string): Promise<TeacherQuizAnalytics> {
  const roomId = roomIdSchema.parse(roomIdInput);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_teacher_quiz_analytics", {
    p_room_id: roomId,
  });
  if (error) throw new Error("Không thể đồng bộ Quiz Analytics.");
  return teacherQuizAnalyticsSchema.parse(data);
}
