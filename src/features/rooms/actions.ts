"use server";

import { z } from "zod";

import {
  MAX_MARKDOWN_BYTES,
  MarkdownValidationError,
  parseLessonMarkdown,
} from "@/features/lessons/markdown/parser";
import type { NormalizedLesson } from "@/features/lessons/markdown/schema";
import { requireTeacher } from "@/features/auth/teacher-session";
import { createClient } from "@/lib/supabase/server";

const roomTitleSchema = z.string().trim().min(1, "Nhập tên buổi học.").max(120, "Tên buổi học tối đa 120 ký tự.");
const lessonFileSchema = z
  .instanceof(File)
  .refine((file) => file.size > 0, "File Markdown không được để trống.")
  .refine((file) => file.size <= MAX_MARKDOWN_BYTES, "File Markdown không được vượt quá 1 MB.")
  .refine((file) => file.name.toLowerCase().endsWith(".md"), "Chỉ chấp nhận file .md.");
const saveInputSchema = z.object({
  roomTitle: roomTitleSchema,
  markdownSource: z.string().min(1).max(MAX_MARKDOWN_BYTES),
});

export type PreviewLessonResult =
  | {
      ok: true;
      roomTitle: string;
      fileName: string;
      markdownSource: string;
      lesson: NormalizedLesson;
    }
  | { ok: false; errors: string[] };

export type SaveRoomResult =
  | { ok: true; room: { id: string; code: string; title: string; status: "DRAFT" } }
  | { ok: false; errors: string[] };

function zodMessages(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.message);
}

export async function previewLessonAction(formData: FormData): Promise<PreviewLessonResult> {
  await requireTeacher();

  const result = z
    .object({ roomTitle: roomTitleSchema, lessonFile: lessonFileSchema })
    .safeParse({ roomTitle: formData.get("roomTitle"), lessonFile: formData.get("lessonFile") });
  if (!result.success) return { ok: false, errors: zodMessages(result.error) };

  try {
    const markdownSource = await result.data.lessonFile.text();
    const lesson = parseLessonMarkdown(markdownSource);
    return {
      ok: true,
      roomTitle: result.data.roomTitle,
      fileName: result.data.lessonFile.name,
      markdownSource,
      lesson,
    };
  } catch (error) {
    if (error instanceof MarkdownValidationError) return { ok: false, errors: error.issues };
    return { ok: false, errors: ["Không thể đọc file Markdown."] };
  }
}

export async function saveRoomAction(input: unknown): Promise<SaveRoomResult> {
  await requireTeacher();

  const result = saveInputSchema.safeParse(input);
  if (!result.success) return { ok: false, errors: zodMessages(result.error) };

  let lesson: NormalizedLesson;
  try {
    lesson = parseLessonMarkdown(result.data.markdownSource);
  } catch (error) {
    if (error instanceof MarkdownValidationError) return { ok: false, errors: error.issues };
    return { ok: false, errors: ["Lesson không hợp lệ."] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_room_with_lesson", {
    p_room_title: result.data.roomTitle,
    p_markdown_source: result.data.markdownSource,
    p_lesson: lesson,
  });
  if (error) return { ok: false, errors: ["Không thể lưu Room. Hãy thử lại."] };

  const room = Array.isArray(data) ? data[0] : null;
  const persistedRoom = z
    .object({
      room_id: z.string().uuid(),
      room_code: z.string().regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/),
      room_title: z.string(),
      room_status: z.literal("DRAFT"),
    })
    .safeParse(room);
  if (!persistedRoom.success) return { ok: false, errors: ["Room đã lưu nhưng phản hồi không hợp lệ."] };

  return {
    ok: true,
    room: {
      id: persistedRoom.data.room_id,
      code: persistedRoom.data.room_code,
      title: persistedRoom.data.room_title,
      status: persistedRoom.data.room_status,
    },
  };
}
