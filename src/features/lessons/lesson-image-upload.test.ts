import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));

import { LESSON_IMAGE_BUCKET, listLessonImages, uploadLessonImage } from "./lesson-image";

const subjectId = "d1100000-0000-4000-8000-000000000001";
const teacherId = "d1000000-0000-4000-8000-000000000001";

describe("Lesson image upload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads with a generated path scoped to the Teacher and Subject", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: "https://cdn.example.com/lesson.png" } });
    const from = vi.fn().mockReturnValue({ upload, getPublicUrl });
    mocks.createClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: teacherId, is_anonymous: false } }, error: null }) },
      storage: { from },
    });

    const url = await uploadLessonImage(subjectId, new File(["png"], "source.png", { type: "image/png" }), "Sơ đồ TCP/IP");

    expect(url).toBe("https://cdn.example.com/lesson.png");
    expect(from).toHaveBeenCalledWith(LESSON_IMAGE_BUCKET);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${teacherId}/${subjectId}/[0-9a-f-]{36}-so-do-tcp-ip\\.png$`)),
      expect.any(File),
      { cacheControl: "31536000", contentType: "image/png", metadata: { alt: "Sơ đồ TCP/IP", originalName: "source.png" }, upsert: false },
    );
  });

  it("rejects an anonymous Student before contacting Storage", async () => {
    const from = vi.fn();
    mocks.createClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: teacherId, is_anonymous: true } }, error: null }) },
      storage: { from },
    });

    await expect(uploadLessonImage(subjectId, new File(["png"], "source.png", { type: "image/png" }), "Sơ đồ"))
      .rejects.toThrow("Phiên giảng viên không hợp lệ");
    expect(from).not.toHaveBeenCalled();
  });

  it("returns a safe error when Storage rejects the upload", async () => {
    const upload = vi.fn().mockResolvedValue({ error: { message: "RLS details" } });
    mocks.createClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: teacherId, is_anonymous: false } }, error: null }) },
      storage: { from: vi.fn().mockReturnValue({ upload }) },
    });

    await expect(uploadLessonImage(subjectId, new File(["png"], "source.png", { type: "image/png" }), "Sơ đồ"))
      .rejects.toThrow("Không thể upload ảnh");
  });

  it("lists owned images with public URLs for the Lesson library", async () => {
    const list = vi.fn().mockResolvedValue({
      data: [{ id: "image-id", name: "550e8400-e29b-41d4-a716-446655440000-so-do.png", created_at: "2026-09-04T01:00:00Z", metadata: { size: 2048 } }],
      error: null,
    });
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: "https://cdn.example.com/so-do.png" } });
    mocks.createClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: teacherId, is_anonymous: false } }, error: null }) },
      storage: { from: vi.fn().mockReturnValue({ list, getPublicUrl }) },
    });

    await expect(listLessonImages(subjectId)).resolves.toEqual([{
      id: "image-id",
      name: "550e8400-e29b-41d4-a716-446655440000-so-do.png",
      path: `${teacherId}/${subjectId}/550e8400-e29b-41d4-a716-446655440000-so-do.png`,
      url: "https://cdn.example.com/so-do.png",
      createdAt: "2026-09-04T01:00:00Z",
      size: 2048,
    }]);
  });
});
