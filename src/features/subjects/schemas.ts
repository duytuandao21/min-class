import { z } from "zod";

export const MANAGEMENT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{1,31}$/;
export const SECTION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{2,31}$/;

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).max(maximum).optional(),
  );

export const subjectIdSchema = z.string().uuid("Môn học không hợp lệ.");
export const courseSectionIdSchema = z.string().uuid("Lớp học phần không hợp lệ.");
export const chapterIdSchema = z.string().uuid("Chương không hợp lệ.");
export const lessonIdSchema = z.string().uuid("Lesson không hợp lệ.");

export const chapterInputSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên chương.").max(120, "Tên chương tối đa 120 ký tự."),
});

export const subjectInputSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên môn học.").max(120, "Tên môn học tối đa 120 ký tự."),
  code: optionalText(32).transform((value) => value?.toUpperCase()).refine(
    (value) => value === undefined || MANAGEMENT_CODE_PATTERN.test(value),
    "Mã môn học cần 2–32 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.",
  ),
});

export const courseSectionInputSchema = z.object({
  sectionCode: z.string().trim().toUpperCase().regex(
    SECTION_CODE_PATTERN,
    "Mã lớp học phần cần 3–32 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.",
  ),
  displayName: optionalText(120),
});

export type SubjectInput = z.infer<typeof subjectInputSchema>;
export type CourseSectionInput = z.infer<typeof courseSectionInputSchema>;
export type ChapterInput = z.infer<typeof chapterInputSchema>;
