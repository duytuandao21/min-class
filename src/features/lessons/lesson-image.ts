import { z } from "zod";

import { subjectIdSchema } from "@/features/subjects/schemas";
import { createClient } from "@/lib/supabase/client";

export const LESSON_IMAGE_BUCKET = "lesson-images";
export const MAX_LESSON_IMAGE_BYTES = 5 * 1024 * 1024;

const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const acceptedSourceExtensions: Record<keyof typeof imageExtensions, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

const lessonImageSchema = z.custom<File>(
  (value) => typeof File !== "undefined" && value instanceof File,
  "Hãy chọn một file ảnh.",
).superRefine((file, context) => {
  if (file.size === 0) context.addIssue({ code: "custom", message: "File ảnh không được để trống." });
  if (file.size > MAX_LESSON_IMAGE_BYTES) context.addIssue({ code: "custom", message: "Ảnh không được vượt quá 5 MB." });
  if (!(file.type in imageExtensions)) {
    context.addIssue({ code: "custom", message: "Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP." });
    return;
  }
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (!acceptedSourceExtensions[file.type as keyof typeof acceptedSourceExtensions].includes(extension)) {
    context.addIssue({ code: "custom", message: "Phần mở rộng file không khớp với định dạng ảnh." });
  }
});

const imageAltSchema = z.string().trim().min(1, "Nhập mô tả ảnh.").max(200, "Mô tả ảnh tối đa 200 ký tự.");

export type LessonImageInput = { file: File; alt: string };
export type LessonImage = {
  id: string;
  name: string;
  path: string;
  url: string;
  createdAt: string;
  size: number | null;
};

const storageImageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  created_at: z.string(),
  metadata: z.object({ size: z.number().nonnegative().optional() }).nullable().optional(),
});

export function validateLessonImageInput(input: LessonImageInput): { ok: true; alt: string } | { ok: false; errors: string[] } {
  const result = z.object({ file: lessonImageSchema, alt: imageAltSchema }).safeParse(input);
  if (!result.success) return { ok: false, errors: result.error.issues.map((issue) => issue.message) };
  return { ok: true, alt: result.data.alt };
}

export function createLessonImageMarkdown(url: string, alt: string): string {
  const safeAlt = alt.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]").replace(/\s+/g, " ").trim();
  return `![${safeAlt}](${url})`;
}

export function getLessonImageLabel(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  if (/^[0-9a-f-]{36}$/i.test(withoutExtension)) return "Hình ảnh bài học";
  const withoutUuid = withoutExtension.replace(/^[0-9a-f-]{36}-/i, "");
  return withoutUuid.replace(/[-_]+/g, " ").trim() || "Hình ảnh bài học";
}

function safeImageBaseName(fileName: string): string {
  const baseName = fileName
    .replace(/\.[^.]+$/, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "lesson-image";
}

async function getOwnedImageFolder(subjectId: string) {
  const parsedSubjectId = subjectIdSchema.safeParse(subjectId);
  if (!parsedSubjectId.success) throw new Error("Môn học không hợp lệ.");
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user || authData.user.is_anonymous) {
    throw new Error("Phiên giảng viên không hợp lệ. Hãy đăng nhập lại.");
  }
  return { folder: `${authData.user.id}/${parsedSubjectId.data}`, supabase };
}

export async function uploadLessonImage(subjectId: string, file: File, alt: string): Promise<string> {
  const validation = validateLessonImageInput({ file, alt });
  if (!validation.ok) throw new Error("Ảnh không hợp lệ.");
  const { folder, supabase } = await getOwnedImageFolder(subjectId);

  const extension = imageExtensions[file.type as keyof typeof imageExtensions];
  const objectPath = `${folder}/${crypto.randomUUID()}-${safeImageBaseName(validation.alt)}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(LESSON_IMAGE_BUCKET).upload(objectPath, file, {
    cacheControl: "31536000",
    contentType: file.type,
    metadata: { alt: validation.alt, originalName: file.name },
    upsert: false,
  });
  if (uploadError) throw new Error("Không thể upload ảnh. Hãy kiểm tra quyền truy cập và thử lại.");

  return supabase.storage.from(LESSON_IMAGE_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

export async function listLessonImages(subjectId: string): Promise<LessonImage[]> {
  const { folder, supabase } = await getOwnedImageFolder(subjectId);
  const { data, error } = await supabase.storage.from(LESSON_IMAGE_BUCKET).list(folder, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw new Error("Không thể tải thư viện ảnh. Hãy thử lại.");
  const parsed = z.array(storageImageSchema).safeParse(data);
  if (!parsed.success) throw new Error("Dữ liệu thư viện ảnh không hợp lệ.");

  return parsed.data.map((image) => {
    const path = `${folder}/${image.name}`;
    return {
      id: image.id,
      name: image.name,
      path,
      url: supabase.storage.from(LESSON_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl,
      createdAt: image.created_at,
      size: image.metadata?.size ?? null,
    };
  });
}
