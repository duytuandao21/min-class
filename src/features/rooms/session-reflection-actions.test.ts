import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  saveSessionReflectionAction,
  type SessionReflectionState,
} from "./session-reflection-actions";

const roomId = "ef200000-0000-4000-8000-000000000001";
const reflectionId = "ef100000-0000-4000-8000-000000000001";
const initialState: SessionReflectionState = { status: "idle" };

function reflectionForm(speakingCount: string, reviewBody = "Buổi học dễ hiểu.") {
  const formData = new FormData();
  formData.set("speakingCount", speakingCount);
  formData.set("reviewBody", reviewBody);
  return formData;
}

describe("saveSessionReflectionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves a normalized post-session reflection", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        reflection_id: reflectionId,
        speaking_count: 3,
        review_body: "Buổi học dễ hiểu.",
        updated_at: "2026-08-27T03:00:00.000Z",
      }],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await saveSessionReflectionAction(
      roomId,
      initialState,
      reflectionForm("3", "  Buổi học dễ hiểu.  "),
    );

    expect(rpc).toHaveBeenCalledWith("save_own_session_reflection", {
      p_room_id: roomId,
      p_speaking_count: 3,
      p_review_body: "Buổi học dễ hiểu.",
    });
    expect(result).toMatchObject({
      status: "success",
      reflection: { speakingCount: 3, reviewBody: "Buổi học dễ hiểu." },
    });
  });

  it("rejects a non-integer speaking count before calling Supabase", async () => {
    const result = await saveSessionReflectionAction(
      roomId,
      initialState,
      reflectionForm("1.5"),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.speakingCount).toBeDefined();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("reports a submission attempted before Session End", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } }),
    });

    await expect(saveSessionReflectionAction(
      roomId,
      initialState,
      reflectionForm("0", ""),
    )).resolves.toMatchObject({
      status: "error",
      message: "Chỉ có thể gửi tổng kết sau khi buổi học kết thúc.",
    });
  });

  it("reports a duplicate one-time submission", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } }),
    });

    await expect(saveSessionReflectionAction(
      roomId,
      initialState,
      reflectionForm("2"),
    )).resolves.toMatchObject({
      status: "error",
      message: "Bạn đã gửi tổng kết cho buổi học này.",
    });
  });
});
