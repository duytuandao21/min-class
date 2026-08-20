import { z } from "zod";

import {
  classVoicesSnapshotSchema,
  type ClassVoicesSnapshot,
} from "@/features/rooms/class-voices";
import {
  parseOwnReactions,
  parseTeacherFeedbackSnapshot,
  type OwnReactions,
  type TeacherFeedbackSnapshot,
} from "@/features/rooms/feedback";
import {
  lessonSectionSchema,
  parseStudentLessonSnapshot,
  type LessonSection,
  type StudentLessonSnapshot,
} from "@/features/rooms/lesson-flow";
import {
  teacherQuizAnalyticsSchema,
  type TeacherQuizAnalytics,
} from "@/features/rooms/quiz";
import { roomCodeSchema, roomIdSchema } from "@/features/rooms/schemas";
import {
  teacherRoomSummarySchema,
  type TeacherRoomSummary,
} from "@/features/rooms/summary";
import { createClient } from "@/lib/supabase/server";

const roomStatusSchema = z.enum(["DRAFT", "ACTIVE", "ENDED"]);
const teacherRoomSchema = z.object({
  id: z.string().uuid(),
  code: roomCodeSchema,
  title: z.string().min(1),
  status: roomStatusSchema,
  started_at: z.string().nullable(),
  teaching_section: z.number().int().nonnegative(),
  released_through: z.number().int(),
});
const participantSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
  mssv: z.string(),
});
const lessonIdSchema = z.object({ id: z.string().uuid() });
const sectionRowSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  type: z.enum(["CONTENT", "QUIZ", "REFLECTION"]),
  title: z.string().min(1),
  content_md: z.string(),
});

export type TeacherRoom = z.infer<typeof teacherRoomSchema> & {
  participantCount: number;
  sections: LessonSection[];
};
export type StudentRoom = StudentLessonSnapshot & { mssv: string; reactions: OwnReactions };

export async function getTeacherRoom(input: string): Promise<TeacherRoom | null> {
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) return null;

  const [roomResult, countResult] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, code, title, status, started_at, teaching_section, released_through")
      .eq("id", roomId.data)
      .maybeSingle(),
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId.data),
  ]);
  if (roomResult.error || countResult.error) return null;

  const room = teacherRoomSchema.safeParse(roomResult.data);
  if (!room.success) return null;

  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select("id")
    .eq("room_id", roomId.data)
    .maybeSingle();
  const lesson = lessonIdSchema.safeParse(lessonData);
  if (lessonError || !lesson.success) return null;

  const { data: sectionData, error: sectionError } = await supabase
    .from("sections")
    .select("id, position, type, title, content_md")
    .eq("lesson_id", lesson.data.id)
    .order("position");
  const sectionRows = z.array(sectionRowSchema).safeParse(sectionData);
  if (sectionError || !sectionRows.success) return null;
  const sections = sectionRows.data.map((section) => lessonSectionSchema.parse({
    id: section.id,
    position: section.position,
    type: section.type,
    title: section.title,
    contentMd: section.content_md,
  }));

  return { ...room.data, participantCount: countResult.count ?? 0, sections };
}

export async function getStudentRoom(input: string): Promise<StudentRoom | null> {
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) return null;

  const [participantResult, snapshotResult] = await Promise.all([
    supabase
      .from("participants")
      .select("id, room_id, mssv")
      .eq("room_id", roomId.data)
      .eq("user_id", userData.user.id)
      .maybeSingle(),
    supabase.rpc("get_student_lesson_snapshot", { p_room_id: roomId.data }),
  ]);
  const { data: participantData, error: participantError } = participantResult;
  const participant = participantSchema.safeParse(participantData);
  if (participantError || !participant.success) return null;

  if (snapshotResult.error) return null;
  let snapshot: StudentLessonSnapshot;
  try {
    snapshot = parseStudentLessonSnapshot(snapshotResult.data);
  } catch {
    return null;
  }

  const { data: reactionData, error: reactionError } = await supabase
    .from("section_reactions")
    .select("section_id, reaction")
    .eq("participant_id", participant.data.id);
  if (reactionError) return null;

  let reactions: OwnReactions;
  try {
    reactions = parseOwnReactions(reactionData);
  } catch {
    return null;
  }

  return { ...snapshot, mssv: participant.data.mssv, reactions };
}

export async function getTeacherFeedbackSnapshot(
  input: string,
): Promise<TeacherFeedbackSnapshot | null> {
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_teacher_feedback_snapshot", {
    p_room_id: roomId.data,
  });
  if (error) return null;

  try {
    return parseTeacherFeedbackSnapshot(data);
  } catch {
    return null;
  }
}

export async function getTeacherQuizAnalytics(
  input: string,
): Promise<TeacherQuizAnalytics | null> {
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_teacher_quiz_analytics", {
    p_room_id: roomId.data,
  });
  if (error) return null;

  try {
    return teacherQuizAnalyticsSchema.parse(data);
  } catch {
    return null;
  }
}

export async function getTeacherRoomSummary(
  input: string,
): Promise<TeacherRoomSummary | null> {
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_teacher_room_summary", {
    p_room_id: roomId.data,
  });
  if (error) return null;

  try {
    return teacherRoomSummarySchema.parse(data);
  } catch {
    return null;
  }
}

export async function getTeacherClassVoices(
  input: string,
): Promise<ClassVoicesSnapshot | null> {
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_teacher_class_voices", {
    p_room_id: roomId.data,
  });
  if (error) return null;

  try {
    return classVoicesSnapshotSchema.parse(data);
  } catch {
    return null;
  }
}
