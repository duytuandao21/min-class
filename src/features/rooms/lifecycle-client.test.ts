import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));

import { advanceTeacherSection, presentTeacherSection } from "./lifecycle-client";

const roomId = "a9800000-0000-4000-8000-000000000001";
const lessonId = "a9800000-0000-4000-8000-000000000002";

describe("advanceTeacherSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the authoritative next Section from the release RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ teaching_section: 2, released_through: 2 }],
      error: null,
    });
    mocks.createClient.mockReturnValue({ rpc });

    await expect(advanceTeacherSection(roomId, lessonId)).resolves.toEqual({
      teachingSection: 2,
      releasedThrough: 2,
    });
    expect(rpc).toHaveBeenCalledWith("release_session_lesson_section", {
      p_room_id: roomId,
      p_lesson_id: lessonId,
    });
  });

  it("reports the final Section distinctly", async () => {
    mocks.createClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0001" } }),
    });

    await expect(advanceTeacherSection(roomId, lessonId)).rejects.toThrow("Đây đã là section cuối cùng.");
  });

  it("rejects malformed RPC data instead of applying stale progress", async () => {
    mocks.createClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    await expect(advanceTeacherSection(roomId, lessonId)).rejects.toThrow("Không thể đồng bộ trạng thái Section mới.");
  });

  it("validates identifiers before contacting Supabase", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockReturnValue({ rpc });

    await expect(advanceTeacherSection("invalid", lessonId)).rejects.toThrow();
    await expect(advanceTeacherSection(roomId, "invalid")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("presentTeacherSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses authoritative progress and keeps later sections released", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ teaching_section: 0, released_through: 4 }], error: null });
    mocks.createClient.mockReturnValue({ rpc });
    await expect(presentTeacherSection(roomId, lessonId, 0)).resolves.toEqual({ teachingSection: 0, releasedThrough: 4 });
    expect(rpc).toHaveBeenCalledWith("present_session_lesson_section", {
      p_room_id: roomId, p_lesson_id: lessonId, p_section_position: 0,
    });
  });

  it.each([-1, 0.5, NaN])("rejects invalid position %s before any RPC", async (position) => {
    const rpc = vi.fn();
    mocks.createClient.mockReturnValue({ rpc });
    await expect(presentTeacherSection(roomId, lessonId, position)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([roomId, "invalid"])("validates lesson/room identifiers (%s)", async (id) => {
    const rpc = vi.fn();
    mocks.createClient.mockReturnValue({ rpc });
    await expect(presentTeacherSection(id, "invalid", 0)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports unreleased sections and does not accept malformed responses", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: "22023" } })
      .mockResolvedValueOnce({ data: [], error: null });
    mocks.createClient.mockReturnValue({ rpc });
    await expect(presentTeacherSection(roomId, lessonId, 4)).rejects.toThrow("Chỉ có thể trình chiếu section đã mở");
    await expect(presentTeacherSection(roomId, lessonId, 0)).rejects.toThrow("Không thể đồng bộ trạng thái");
  });
});
