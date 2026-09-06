import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), requireTeacher: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/auth/teacher-session", () => ({ requireTeacher: mocks.requireTeacher }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { setChapterPreviewAction } from "./preview-actions";

describe("Teacher chapter preview setting", () => {
  const chapterId = "aa300000-0000-4000-8000-000000000001";
  beforeEach(() => vi.resetAllMocks());
  it.each([true, false])("sets the explicit switch to %s and refreshes both catalogs", async (enabled) => {
    const rpc = vi.fn().mockResolvedValue({ data: enabled, error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    expect(await setChapterPreviewAction(chapterId, enabled)).toEqual({ status: "success" });
    expect(mocks.requireTeacher).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("set_chapter_preview", { p_chapter_id: chapterId, p_enabled: enabled });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });
  it("does not access the database without a Teacher", async () => {
    mocks.requireTeacher.mockRejectedValue(new Error("redirect"));
    await expect(setChapterPreviewAction(chapterId, true)).rejects.toThrow("redirect");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("does not report success when database rejects ownership or lifecycle", async () => {
    mocks.createClient.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } }) });
    expect((await setChapterPreviewAction(chapterId, true)).status).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("rejects an invalid chapter", async () => {
    expect((await setChapterPreviewAction("invalid", true)).status).toBe("error");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
