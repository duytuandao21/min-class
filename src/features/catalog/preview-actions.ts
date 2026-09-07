"use server";

import { z } from "zod";
import { cookies } from "next/headers";

import { chapterPreviewInputSchema, chapterPreviewSchema, type ChapterPreview } from "./chapter-preview";
import { lessonAccessInputSchema } from "./schemas";
import { sortLessonsByTitle } from "@/features/lessons/order";
import { createClient } from "@/lib/supabase/server";

export type ChapterPreviewResult = { status: "success"; preview: ChapterPreview } | { status: "error"; message: string };
export type CourseSectionStudentAccessResult =
  | { status: "success"; mssv: string }
  | { status: "error"; message: string };

const courseSectionStudentInputSchema = z.object({
  courseSectionId: z.string().uuid(),
  mssv: lessonAccessInputSchema.shape.mssv,
});

const COURSE_SECTION_STUDENT_COOKIE_PREFIX = "minclass-course-section-student-";
const COURSE_SECTION_STUDENT_COOKIE_PATH = "/learn/subjects";

function courseSectionStudentCookieName(courseSectionId: string): string {
  return `${COURSE_SECTION_STUDENT_COOKIE_PREFIX}${courseSectionId}`;
}

async function rememberCourseSectionStudent(courseSectionId: string, mssv: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(courseSectionStudentCookieName(courseSectionId), mssv, {
    httpOnly: true,
    path: COURSE_SECTION_STUDENT_COOKIE_PATH,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getRememberedCourseSectionStudent(courseSectionId: string): Promise<string | null> {
  const id = z.string().uuid().safeParse(courseSectionId);
  if (!id.success) return null;
  const cookieStore = await cookies();
  const value = cookieStore.get(courseSectionStudentCookieName(id.data))?.value;
  const mssv = lessonAccessInputSchema.shape.mssv.safeParse(value);
  return mssv.success ? mssv.data : null;
}

export async function forgetCourseSectionStudentAction(courseSectionId: string): Promise<void> {
  const id = z.string().uuid().safeParse(courseSectionId);
  if (!id.success) return;
  const cookieStore = await cookies();
  cookieStore.set(courseSectionStudentCookieName(id.data), "", {
    httpOnly: true,
    maxAge: 0,
    path: COURSE_SECTION_STUDENT_COOKIE_PATH,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function verifyCourseSectionStudentAction(
  courseSectionId: string,
  mssv: string,
): Promise<CourseSectionStudentAccessResult> {
  const input = courseSectionStudentInputSchema.safeParse({ courseSectionId, mssv });
  const outsideRoster: CourseSectionStudentAccessResult = {
    status: "error",
    message: "Bạn không thuộc lớp học phần này",
  };
  if (!input.success) return outsideRoster;

  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user?.is_anonymous) {
      return { status: "error", message: "Không thể xác minh sinh viên. Hãy thử lại." };
    }
    const { data, error } = await supabase.rpc("verify_course_section_student", {
      p_course_section_id: input.data.courseSectionId,
      p_mssv: input.data.mssv,
    });
    if (error) return error.code === "P0003"
      ? outsideRoster
      : { status: "error", message: "Không thể xác minh sinh viên. Hãy thử lại." };
    if (data !== true) return { status: "error", message: "Không thể xác minh sinh viên. Hãy thử lại." };
    await rememberCourseSectionStudent(input.data.courseSectionId, input.data.mssv);
    return { status: "success", mssv: input.data.mssv };
  } catch {
    return { status: "error", message: "Không thể xác minh sinh viên. Hãy thử lại." };
  }
}

export async function readChapterPreviewAction(chapterId: string, mssv: string): Promise<ChapterPreviewResult> {
  const input = chapterPreviewInputSchema.safeParse({ chapterId, mssv });
  const denied: ChapterPreviewResult = { status: "error", message: "Không thể xem trước chương. Kiểm tra MSSV hoặc quay lại lớp học phần để cập nhật trạng thái." };
  const outsideRoster: ChapterPreviewResult = { status: "error", message: "Bạn không thuộc lớp học phần này" };
  if (!input.success) {
    return input.error.issues.some((issue) => issue.path[0] === "mssv")
      ? outsideRoster
      : denied;
  }
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user?.is_anonymous) return denied;
    const { data, error } = await supabase.rpc("get_student_chapter_preview", {
      p_chapter_id: input.data.chapterId,
      p_mssv: input.data.mssv,
    });
    if (error) return error.code === "P0003" ? outsideRoster : denied;
    const preview = chapterPreviewSchema.safeParse(data);
    if (!preview.success || preview.data.chapterId !== input.data.chapterId) return denied;
    return { status: "success", preview: { ...preview.data, lessons: sortLessonsByTitle(preview.data.lessons) } };
  } catch {
    return denied;
  }
}
