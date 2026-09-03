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
import { roomIdSchema } from "@/features/rooms/schemas";
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

const roomStatusSchema = z.enum(["ACTIVE", "ENDED"]);
const teacherRoomSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status: roomStatusSchema,
  started_at: z.string().nullable(),
  teaching_section: z.number().int().nonnegative(),
  released_through: z.number().int(),
  lesson_id: z.string().uuid().nullable(),
  course_section_id: z.string().uuid().nullable(),
  chapter_id: z.string().uuid().nullable(),
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
const sessionLessonSchema = z.object({
  lesson_id: z.string().uuid(),
  teaching_section: z.number().int().nonnegative(),
  released_through: z.number().int(),
});
const sessionLessonLabelSchema = z.object({
  lesson_id: z.string().uuid(),
  lesson_title: z.string().min(1),
  chapter_name: z.string().min(1),
});

export type TeacherRoom = z.infer<typeof teacherRoomSchema> & {
  attendance: TeacherAttendance;
  lessonContext: {
    courseSectionId: string;
    subjectId: string;
  } | null;
  sections: LessonSection[];
  lessons: z.infer<typeof sessionLessonLabelSchema>[];
  selectedLessonId: string;
};
export type StudentRoom = StudentLessonSnapshot & {
  mssv: string;
  reactions: OwnReactions;
  sessionReflection: SessionReflection | null;
  lessons: z.infer<typeof sessionLessonLabelSchema>[];
  selectedLessonId: string;
};
export type TeacherRoomSummaryDetail = TeacherRoomSummary & {
  lessonContext: {
    lessonId: string;
    courseSectionId: string;
    subjectId: string;
  } | null;
  sessionReflections: TeacherSessionReflections;
};

export async function getTeacherRoom(input: string, selectedLessonInput?: string): Promise<TeacherRoom | null> {
  await requireTeacher();

  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const [roomResult, attendanceResult] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, title, status, started_at, teaching_section, released_through, lesson_id, course_section_id, chapter_id")
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

  const { data: sessionLessonData, error: sessionLessonError } = await supabase
    .from("session_lessons")
    .select("lesson_id, teaching_section, released_through")
    .eq("session_id", roomId.data);
  const progressRows = z.array(sessionLessonSchema).safeParse(sessionLessonData);
  if (sessionLessonError || !progressRows.success || progressRows.data.length === 0) return null;
  const requestedLessonId = z.string().uuid().safeParse(selectedLessonInput);
  const selectedProgress = progressRows.data.find((item) => item.lesson_id === (requestedLessonId.success ? requestedLessonId.data : null))
    ?? progressRows.data.find((item) => item.lesson_id === room.data.lesson_id)
    ?? progressRows.data[0];

  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select("id, course_section_id")
    .eq("id", selectedProgress.lesson_id)
    .maybeSingle();
  const lesson = lessonPlacementSchema.safeParse(lessonData);
  if (lessonError || !lesson.success) return null;

  let lessonContext: TeacherRoom["lessonContext"] = null;
  const contextCourseSectionId = room.data.course_section_id ?? lesson.data.course_section_id;
  if (contextCourseSectionId) {
    const { data: courseSectionData, error: courseSectionError } = await supabase
      .from("course_sections")
      .select("id, subject_id")
      .eq("id", contextCourseSectionId)
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

  const { data: lessonLabelsData, error: lessonLabelsError } = await supabase.rpc(
    "get_teacher_session_lessons",
    { p_room_id: roomId.data },
  );
  const lessonLabels = z.array(sessionLessonLabelSchema).safeParse(lessonLabelsData);
  if (lessonLabelsError || !lessonLabels.success) return null;

  return {
    ...room.data,
    teaching_section: selectedProgress.teaching_section,
    released_through: selectedProgress.released_through,
    attendance: attendance.data,
    lessonContext,
    sections,
    lessons: lessonLabels.data,
    selectedLessonId: selectedProgress.lesson_id,
  };
}

export async function getStudentRoom(input: string, selectedLessonInput?: string): Promise<StudentRoom | null> {
  const roomId = roomIdSchema.safeParse(input);
  if (!roomId.success) return null;

  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) return null;

  const [participantResult, accessGrantResult, lessonListResult] = await Promise.all([
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
    supabase.rpc("get_student_session_lessons", { p_room_id: roomId.data }),
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

  if (lessonListResult.error) return null;
  const lessons = z.array(sessionLessonLabelSchema).safeParse(lessonListResult.data);
  if (!lessons.success || lessons.data.length === 0) return null;
  const requestedLessonId = z.string().uuid().safeParse(selectedLessonInput);
  const selectedLesson = lessons.data.find((lesson) => lesson.lesson_id === (requestedLessonId.success ? requestedLessonId.data : null))
    ?? lessons.data[0];
  const snapshotResult = await supabase.rpc("get_student_session_lesson_snapshot", {
    p_room_id: roomId.data,
    p_lesson_id: selectedLesson.lesson_id,
  });
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

  return {
    ...snapshot,
    mssv,
    reactions,
    sessionReflection,
    lessons: lessons.data,
    selectedLessonId: selectedLesson.lesson_id,
  };
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
