import { z } from "zod";

import { requireTeacher } from "@/features/auth/teacher-session";
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
  parseSessionReflectionRow,
  teacherSessionReflectionsSchema,
  type SessionReflection,
  type TeacherSessionReflections,
} from "@/features/rooms/session-reflection";
import {
  teacherAttendanceSchema,
  teacherRoomSummarySchema,
  type TeacherAttendance,
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
  lesson_id: z.string().uuid().nullable(),
});
const participantSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
  mssv: z.string(),
});
const lessonAccessGrantSchema = z.object({
  room_id: z.string().uuid(),
  mssv: z.string(),
});
const lessonPlacementSchema = z.object({
  id: z.string().uuid(),
  course_section_id: z.string().uuid().nullable(),
});
const courseSectionPlacementSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid(),
});
const sectionRowSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  type: z.enum(["CONTENT", "QUIZ", "REFLECTION"]),
  title: z.string().min(1),
  content_md: z.string(),
});

export type TeacherRoom = z.infer<typeof teacherRoomSchema> & {
  attendance: TeacherAttendance;
  lessonContext: {
    courseSectionId: string;
    subjectId: string;
  } | null;
  sections: LessonSection[];
};
export type StudentRoom = StudentLessonSnapshot & {
  mssv: string;
  reactions: OwnReactions;
  sessionReflection: SessionReflection | null;
};
export type TeacherRoomSummaryDetail = TeacherRoomSummary & {
  lessonContext: {
    lessonId: string;
    courseSectionId: string;
    subjectId: string;
  } | null;
  sessionReflections: TeacherSessionReflections;
};

export async function getTeacherRoom(input: string): Promise<TeacherRoom | null> {
  await requireTeacher();

  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const [roomResult, attendanceResult] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, code, title, status, started_at, teaching_section, released_through, lesson_id")
      .eq("id", roomId.data)
      .maybeSingle(),
    supabase.rpc("get_teacher_session_attendance", {
      p_session_id: roomId.data,
    }),
  ]);
  if (roomResult.error || attendanceResult.error) return null;

  const room = teacherRoomSchema.safeParse(roomResult.data);
  const attendance = teacherAttendanceSchema.safeParse(attendanceResult.data);
  if (!room.success || !attendance.success) return null;

  let lessonQuery = supabase.from("lessons").select("id, course_section_id");
  lessonQuery = room.data.lesson_id
    ? lessonQuery.eq("id", room.data.lesson_id)
    : lessonQuery.eq("room_id", roomId.data);
  const { data: lessonData, error: lessonError } = await lessonQuery.maybeSingle();
  const lesson = lessonPlacementSchema.safeParse(lessonData);
  if (lessonError || !lesson.success) return null;

  let lessonContext: TeacherRoom["lessonContext"] = null;
  if (lesson.data.course_section_id) {
    const { data: courseSectionData, error: courseSectionError } = await supabase
      .from("course_sections")
      .select("id, subject_id")
      .eq("id", lesson.data.course_section_id)
      .maybeSingle();
    const courseSection = courseSectionPlacementSchema.safeParse(courseSectionData);
    if (!courseSectionError && courseSection.success) {
      lessonContext = {
        courseSectionId: courseSection.data.id,
        subjectId: courseSection.data.subject_id,
      };
    }
  }

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

  return { ...room.data, attendance: attendance.data, lessonContext, sections };
}

export async function getStudentRoom(input: string): Promise<StudentRoom | null> {
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) return null;

  const [participantResult, accessGrantResult, snapshotResult] = await Promise.all([
    supabase
      .from("participants")
      .select("id, room_id, mssv")
      .eq("room_id", roomId.data)
      .eq("user_id", userData.user.id)
      .maybeSingle(),
    supabase
      .from("lesson_session_access_grants")
      .select("room_id, mssv")
      .eq("room_id", roomId.data)
      .eq("user_id", userData.user.id)
      .maybeSingle(),
    supabase.rpc("get_student_lesson_snapshot", { p_room_id: roomId.data }),
  ]);
  const { data: participantData, error: participantError } = participantResult;
  const participant = participantData ? participantSchema.safeParse(participantData) : null;
  const accessGrant = accessGrantResult.data
    ? lessonAccessGrantSchema.safeParse(accessGrantResult.data)
    : null;
  if (participantError || accessGrantResult.error) return null;
  if (participant && !participant.success) return null;
  if (accessGrant && !accessGrant.success) return null;
  if (!participant && !accessGrant) return null;

  if (snapshotResult.error) return null;
  let snapshot: StudentLessonSnapshot;
  try {
    snapshot = parseStudentLessonSnapshot(snapshotResult.data);
  } catch {
    return null;
  }

  const reactionResult = participant?.success
    ? await supabase
      .from("section_reactions")
      .select("section_id, reaction")
      .eq("participant_id", participant.data.id)
    : { data: [], error: null };
  if (reactionResult.error) return null;

  let reactions: OwnReactions;
  try {
    reactions = parseOwnReactions(reactionResult.data);
  } catch {
    return null;
  }

  const mssv = participant?.success ? participant.data.mssv : accessGrant?.success ? accessGrant.data.mssv : null;
  if (!mssv) return null;

  let sessionReflection: SessionReflection | null = null;
  if (snapshot.status === "ENDED" && participant?.success) {
    const { data: reflectionData, error: reflectionError } = await supabase.rpc(
      "get_own_session_reflection",
      { p_room_id: roomId.data },
    );
    if (reflectionError) return null;
    const reflectionRow = Array.isArray(reflectionData) ? reflectionData[0] : null;
    if (reflectionRow) {
      try {
        sessionReflection = parseSessionReflectionRow(reflectionRow);
      } catch {
        return null;
      }
    }
  }

  return { ...snapshot, mssv, reactions, sessionReflection };
}

export async function getTeacherFeedbackSnapshot(
  input: string,
): Promise<TeacherFeedbackSnapshot | null> {
  await requireTeacher();

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
  await requireTeacher();

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
): Promise<TeacherRoomSummaryDetail | null> {
  await requireTeacher();

  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const [summaryResult, attendanceResult, sessionReflectionsResult] = await Promise.all([
    supabase.rpc("get_teacher_room_summary", { p_room_id: roomId.data }),
    supabase.rpc("get_teacher_session_attendance", { p_session_id: roomId.data }),
    supabase.rpc("get_teacher_session_reflections", { p_room_id: roomId.data }),
  ]);
  if (summaryResult.error || attendanceResult.error || sessionReflectionsResult.error) return null;

  try {
    const summary = teacherRoomSummarySchema.parse({
      ...summaryResult.data,
      attendance: attendanceResult.data,
    });
    const sessionReflections = teacherSessionReflectionsSchema.parse(sessionReflectionsResult.data);

    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("lesson_id")
      .eq("id", roomId.data)
      .maybeSingle();
    if (roomError || !roomData?.lesson_id) {
      return { ...summary, lessonContext: null, sessionReflections };
    }

    const { data: lessonData, error: lessonError } = await supabase
      .from("lessons")
      .select("id, course_section_id")
      .eq("id", roomData.lesson_id)
      .maybeSingle();
    if (lessonError || !lessonData?.course_section_id) {
      return { ...summary, lessonContext: null, sessionReflections };
    }

    const { data: courseSectionData, error: courseSectionError } = await supabase
      .from("course_sections")
      .select("id, subject_id")
      .eq("id", lessonData.course_section_id)
      .maybeSingle();
    if (courseSectionError || !courseSectionData) {
      return { ...summary, lessonContext: null, sessionReflections };
    }

    return {
      ...summary,
      lessonContext: {
        lessonId: lessonData.id,
        courseSectionId: courseSectionData.id,
        subjectId: courseSectionData.subject_id,
      },
      sessionReflections,
    };
  } catch {
    return null;
  }
}

export async function getTeacherSessionReflections(
  input: string,
): Promise<TeacherSessionReflections | null> {
  await requireTeacher();

  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_teacher_session_reflections", {
    p_room_id: roomId.data,
  });
  if (error) return null;

  const result = teacherSessionReflectionsSchema.safeParse(data);
  return result.success ? result.data : null;
}

export async function getTeacherClassVoices(
  input: string,
): Promise<ClassVoicesSnapshot | null> {
  await requireTeacher();

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
