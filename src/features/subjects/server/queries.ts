import "server-only";

import { z } from "zod";

import { requireTeacher } from "@/features/auth/teacher-session";
import { sortLessonsByTitle } from "@/features/lessons/order";
import { chapterIdSchema, courseSectionIdSchema, lessonIdSchema, subjectIdSchema } from "@/features/subjects/schemas";
import { createClient } from "@/lib/supabase/server";

const subjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  created_at: z.string(),
});

const subjectListSchema = subjectSchema.extend({
  course_sections: z.array(z.object({ count: z.number().int().nonnegative() })),
});

const courseSectionSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid(),
  section_code: z.string(),
  display_name: z.string().nullable(),
  created_at: z.string(),
});

const chapterSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid().nullable(),
  course_section_id: z.string().uuid().nullable(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const rosterStudentSchema = z.object({
  id: z.string().uuid(),
  mssv: z.string(),
  created_at: z.string(),
});

const persistentLessonSchema = z.object({
  id: z.string().uuid(),
  chapter_id: z.string().uuid(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const templateLessonSchema = persistentLessonSchema.extend({
  subject_id: z.string().uuid(),
});

const lessonSessionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["ACTIVE", "ENDED"]),
  started_at: z.string(),
  ended_at: z.string().nullable(),
});
const sessionLessonPlacementSchema = z.object({
  session_id: z.string().uuid(),
  lesson_id: z.string().uuid(),
});

const persistentLessonDetailSchema = persistentLessonSchema.extend({
  course_section_id: z.string().uuid(),
  markdown_source: z.string(),
});

const chapterLessonReviewSchema = persistentLessonDetailSchema;
const chapterSessionSchema = lessonSessionSchema.extend({
  title: z.string(),
});

export type Subject = z.infer<typeof subjectSchema>;
export type SubjectListItem = Subject & { courseSectionCount: number };
export type CourseSection = z.infer<typeof courseSectionSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type RosterStudent = z.infer<typeof rosterStudentSchema>;
export type PersistentLesson = z.infer<typeof persistentLessonSchema> & {
  latestSession: z.infer<typeof lessonSessionSchema> | null;
};
export type TemplateLesson = z.infer<typeof templateLessonSchema>;
export type SubjectDetail = Subject & {
  chapters: Chapter[];
  courseSections: CourseSection[];
  templateLessons: TemplateLesson[];
};
export type CourseSectionRosterDetail = {
  subject: Subject;
  courseSection: CourseSection;
  chapters: Chapter[];
  students: RosterStudent[];
  lessons: PersistentLesson[];
};
export type PersistentLessonDetail = {
  subject: Subject;
  courseSection: CourseSection;
  lesson: z.infer<typeof persistentLessonDetailSchema>;
  status: "UPCOMING" | "LIVE" | "ENDED";
  sessions: z.infer<typeof lessonSessionSchema>[];
};
export type CourseSectionChapterHistory = {
  subject: Subject;
  courseSection: CourseSection;
  chapter: Chapter;
  lessons: z.infer<typeof chapterLessonReviewSchema>[];
  sessions: z.infer<typeof chapterSessionSchema>[];
};

export async function getSubjects(): Promise<SubjectListItem[]> {
  const teacher = await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, code, created_at, course_sections(count)")
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Không thể tải danh sách môn học.");
  return z.array(subjectListSchema).parse(data).map(({ course_sections: courseSections, ...subject }) => ({
    ...subject,
    courseSectionCount: courseSections[0]?.count ?? 0,
  }));
}

export async function getSubjectDetail(rawSubjectId: string): Promise<SubjectDetail | null> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  if (!subjectId.success) return null;

  const teacher = await requireTeacher();
  const supabase = await createClient();
  const { data: subjectData, error: subjectError } = await supabase
    .from("subjects")
    .select("id, name, code, created_at")
    .eq("id", subjectId.data)
    .eq("teacher_id", teacher.id)
    .maybeSingle();

  if (subjectError) throw new Error("Không thể tải môn học.");
  if (!subjectData) return null;

  const [courseSectionResult, chapterResult, templateLessonResult] = await Promise.all([
    supabase
      .from("course_sections")
      .select("id, subject_id, section_code, display_name, created_at")
      .eq("subject_id", subjectId.data)
      .order("created_at", { ascending: true }),
    supabase
      .from("chapters")
      .select("id, subject_id, course_section_id, name, created_at, updated_at")
      .eq("subject_id", subjectId.data),
    supabase
      .from("lessons")
      .select("id, subject_id, chapter_id, title, created_at, updated_at")
      .eq("subject_id", subjectId.data)
      .order("created_at", { ascending: true }),
  ]);

  if (courseSectionResult.error) throw new Error("Không thể tải danh sách lớp học phần.");
  if (chapterResult.error) throw new Error("Không thể tải Lesson Plan.");
  if (templateLessonResult.error) throw new Error("Không thể tải Lesson mẫu.");
  return {
    ...subjectSchema.parse(subjectData),
    chapters: z.array(chapterSchema).parse(chapterResult.data).sort((left, right) => left.name.localeCompare(right.name, "vi")),
    courseSections: z.array(courseSectionSchema).parse(courseSectionResult.data),
    templateLessons: sortLessonsByTitle(z.array(templateLessonSchema).parse(templateLessonResult.data)),
  };
}

export async function getTemplateLessonDetail(rawSubjectId: string, rawLessonId: string) {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const lessonId = lessonIdSchema.safeParse(rawLessonId);
  if (!subjectId.success || !lessonId.success) return null;

  const subject = await getSubjectDetail(subjectId.data);
  if (!subject) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("id, subject_id, chapter_id, title, markdown_source, created_at, updated_at")
    .eq("id", lessonId.data)
    .eq("subject_id", subjectId.data)
    .maybeSingle();
  if (error) throw new Error("Không thể tải Lesson mẫu.");
  if (!data) return null;
  const lesson = templateLessonSchema.extend({ markdown_source: z.string() }).parse(data);
  return { subject, lesson };
}

export async function getCourseSectionRosterDetail(
  rawSubjectId: string,
  rawCourseSectionId: string,
): Promise<CourseSectionRosterDetail | null> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  if (!subjectId.success || !courseSectionId.success) return null;

  const teacher = await requireTeacher();
  const supabase = await createClient();
  const { data: subjectData, error: subjectError } = await supabase
    .from("subjects")
    .select("id, name, code, created_at")
    .eq("id", subjectId.data)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (subjectError) throw new Error("Không thể tải môn học.");
  if (!subjectData) return null;

  const { data: courseSectionData, error: courseSectionError } = await supabase
    .from("course_sections")
    .select("id, subject_id, section_code, display_name, created_at")
    .eq("id", courseSectionId.data)
    .eq("subject_id", subjectId.data)
    .maybeSingle();
  if (courseSectionError) throw new Error("Không thể tải lớp học phần.");
  if (!courseSectionData) return null;

  const [rosterResult, lessonResult, chapterResult] = await Promise.all([
    supabase
      .from("course_section_students")
      .select("id, mssv, created_at")
      .eq("course_section_id", courseSectionId.data)
      .order("mssv", { ascending: true }),
    supabase
      .from("lessons")
      .select("id, chapter_id, title, created_at, updated_at")
      .eq("course_section_id", courseSectionId.data)
      .order("created_at", { ascending: false }),
    supabase
      .from("chapters")
      .select("id, subject_id, course_section_id, name, created_at, updated_at")
      .eq("course_section_id", courseSectionId.data),
  ]);
  if (rosterResult.error) throw new Error("Không thể tải roster lớp học phần.");
  if (lessonResult.error) throw new Error("Không thể tải danh sách Lesson.");
  if (chapterResult.error) throw new Error("Không thể tải Lesson Plan.");

  const parsedLessons = z.array(persistentLessonSchema).parse(lessonResult.data);
  const lessonIds = parsedLessons.map((lesson) => lesson.id);
  const sessionByLesson = new Map<string, z.infer<typeof lessonSessionSchema>>();
  if (lessonIds.length > 0) {
    const { data: sessionData, error: sessionError } = await supabase
      .from("rooms")
      .select("id, status, started_at, ended_at")
      .eq("course_section_id", courseSectionId.data)
      .in("status", ["ACTIVE", "ENDED"])
      .order("started_at", { ascending: false });
    if (sessionError) throw new Error("Không thể tải Lesson Session.");
    const sessions = z.array(lessonSessionSchema).parse(sessionData);
    if (sessions.length > 0) {
      const { data: placementData, error: placementError } = await supabase
        .from("session_lessons")
        .select("session_id, lesson_id")
        .in("session_id", sessions.map((session) => session.id));
      if (placementError) throw new Error("Không thể tải Lesson trong Session.");
      const sessionById = new Map(sessions.map((session) => [session.id, session]));
      for (const placement of z.array(sessionLessonPlacementSchema).parse(placementData)) {
        const session = sessionById.get(placement.session_id);
        if (!session) continue;
        const current = sessionByLesson.get(placement.lesson_id);
        if (!current || session.status === "ACTIVE") sessionByLesson.set(placement.lesson_id, session);
      }
    }
  }
  return {
    subject: subjectSchema.parse(subjectData),
    courseSection: courseSectionSchema.parse(courseSectionData),
    chapters: z.array(chapterSchema).parse(chapterResult.data).sort((left, right) => left.name.localeCompare(right.name, "vi")),
    students: z.array(rosterStudentSchema).parse(rosterResult.data),
    lessons: sortLessonsByTitle(parsedLessons).map((lesson) => ({
      ...lesson,
      latestSession: sessionByLesson.get(lesson.id) ?? null,
    })),
  };
}

export async function getPersistentLessonDetail(
  rawSubjectId: string,
  rawCourseSectionId: string,
  rawLessonId: string,
): Promise<PersistentLessonDetail | null> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  const lessonId = lessonIdSchema.safeParse(rawLessonId);
  if (!subjectId.success || !courseSectionId.success || !lessonId.success) return null;

  const teacher = await requireTeacher();
  const supabase = await createClient();
  const { data: subjectData, error: subjectError } = await supabase
    .from("subjects")
    .select("id, name, code, created_at")
    .eq("id", subjectId.data)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (subjectError) throw new Error("Không thể tải môn học.");
  if (!subjectData) return null;

  const { data: courseSectionData, error: courseSectionError } = await supabase
    .from("course_sections")
    .select("id, subject_id, section_code, display_name, created_at")
    .eq("id", courseSectionId.data)
    .eq("subject_id", subjectId.data)
    .maybeSingle();
  if (courseSectionError) throw new Error("Không thể tải lớp học phần.");
  if (!courseSectionData) return null;

  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select("id, course_section_id, chapter_id, title, markdown_source, created_at, updated_at")
    .eq("id", lessonId.data)
    .eq("course_section_id", courseSectionId.data)
    .maybeSingle();
  if (lessonError) throw new Error("Không thể tải Lesson.");
  if (!lessonData) return null;

  const { data: sessionData, error: sessionError } = await supabase
    .from("session_lessons")
    .select("session_id")
    .eq("lesson_id", lessonId.data);
  if (sessionError) throw new Error("Không thể tải lịch sử Session.");
  const placements = z.array(z.object({ session_id: z.string().uuid() })).parse(sessionData);
  const { data: roomData, error: roomError } = placements.length > 0
    ? await supabase
      .from("rooms")
      .select("id, status, started_at, ended_at")
      .in("id", placements.map((placement) => placement.session_id))
      .in("status", ["ACTIVE", "ENDED"])
      .order("started_at", { ascending: false })
    : { data: [], error: null };
  if (roomError) throw new Error("Không thể tải lịch sử Session.");

  const sessions = z.array(lessonSessionSchema).parse(roomData);
  const status = sessions.some((session) => session.status === "ACTIVE")
    ? "LIVE"
    : sessions.length > 0
      ? "ENDED"
      : "UPCOMING";

  return {
    subject: subjectSchema.parse(subjectData),
    courseSection: courseSectionSchema.parse(courseSectionData),
    lesson: persistentLessonDetailSchema.parse(lessonData),
    status,
    sessions,
  };
}

export async function getCourseSectionChapterHistory(
  rawSubjectId: string,
  rawCourseSectionId: string,
  rawChapterId: string,
): Promise<CourseSectionChapterHistory | null> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  if (!subjectId.success || !courseSectionId.success || !chapterId.success) return null;

  const teacher = await requireTeacher();
  const supabase = await createClient();
  const { data: subjectData, error: subjectError } = await supabase
    .from("subjects")
    .select("id, name, code, created_at")
    .eq("id", subjectId.data)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (subjectError) throw new Error("Không thể tải môn học.");
  if (!subjectData) return null;

  const { data: courseSectionData, error: courseSectionError } = await supabase
    .from("course_sections")
    .select("id, subject_id, section_code, display_name, created_at")
    .eq("id", courseSectionId.data)
    .eq("subject_id", subjectId.data)
    .maybeSingle();
  if (courseSectionError) throw new Error("Không thể tải lớp học phần.");
  if (!courseSectionData) return null;

  const [chapterResult, lessonResult, sessionResult] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, subject_id, course_section_id, name, created_at, updated_at")
      .eq("id", chapterId.data)
      .eq("course_section_id", courseSectionId.data)
      .maybeSingle(),
    supabase
      .from("lessons")
      .select("id, course_section_id, chapter_id, title, markdown_source, created_at, updated_at")
      .eq("course_section_id", courseSectionId.data)
      .eq("chapter_id", chapterId.data),
    supabase
      .from("rooms")
      .select("id, title, status, started_at, ended_at")
      .eq("course_section_id", courseSectionId.data)
      .eq("chapter_id", chapterId.data)
      .in("status", ["ACTIVE", "ENDED"])
      .order("started_at", { ascending: false }),
  ]);
  if (chapterResult.error) throw new Error("Không thể tải chương.");
  if (!chapterResult.data) return null;
  if (lessonResult.error) throw new Error("Không thể tải nội dung chương.");
  if (sessionResult.error) throw new Error("Không thể tải lịch sử Session của chương.");

  const lessons = sortLessonsByTitle(z.array(chapterLessonReviewSchema).parse(lessonResult.data));

  return {
    subject: subjectSchema.parse(subjectData),
    courseSection: courseSectionSchema.parse(courseSectionData),
    chapter: chapterSchema.parse(chapterResult.data),
    lessons,
    sessions: z.array(chapterSessionSchema).parse(sessionResult.data),
  };
}
