import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireTeacher: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/auth/teacher-session", () => ({ requireTeacher: mocks.requireTeacher }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { releaseEntireChapterAction } from "./lifecycle-actions";

const roomId = "a9800000-0000-4000-8000-000000000001";

describe("releaseEntireChapterAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTeacher.mockResolvedValue({ id: "teacher" });
  });

  it("releases all Lessons in the live Chapter Session", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 3, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(releaseEntireChapterAction(roomId)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("release_entire_chapter", { p_room_id: roomId });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/teacher/rooms/${roomId}`);
  });

  it("rejects an invalid Session id before calling Supabase", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(releaseEntireChapterAction("invalid")).resolves.toEqual({
      ok: false,
      message: "Buổi học không hợp lệ.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a Session that is no longer LIVE", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0001" } }),
    });

    await expect(releaseEntireChapterAction(roomId)).resolves.toEqual({
      ok: false,
      message: "Chỉ có thể Done chương đang LIVE.",
    });
  });
});
