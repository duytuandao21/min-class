import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireTeacher: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/auth/teacher-session", () => ({ requireTeacher: mocks.requireTeacher }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveCourseSectionRosterAction, type RosterActionState } from "./roster-actions";

const subjectId = "aa100000-0000-4000-8000-000000000001";
const courseSectionId = "aa200000-0000-4000-8000-000000000001";
const initialState: RosterActionState = { status: "idle" };

function rosterForm(source: string, fileName = "roster.txt") {
  const formData = new FormData();
  formData.set("fileName", fileName);
  formData.set("rosterSource", source);
  return formData;
}

function ownedCourseSectionQuery(data: { id: string } | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe("Course Section roster action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTeacher.mockResolvedValue({ id: "teacher", email: "thaybao@minclass.local" });
  });

  it("saves a valid normalized roster through the atomic RPC", async () => {
    const query = ownedCourseSectionQuery({ id: courseSectionId });
    const rpc = vi.fn().mockResolvedValue({ data: 2, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query), rpc });

    const result = await saveCourseSectionRosterAction(
      subjectId,
      courseSectionId,
      initialState,
      rosterForm(" 23110001\nsv002 "),
    );

    expect(rpc).toHaveBeenCalledWith("replace_course_section_roster", {
      p_course_section_id: courseSectionId,
      p_mssv: ["23110001", "SV002"],
    });
    expect(result).toEqual({ status: "success", message: "Đã lưu 2 MSSV.", savedCount: 2 });
  });

  it("rejects duplicate input before accessing Supabase", async () => {
    const result = await saveCourseSectionRosterAction(
      subjectId,
      courseSectionId,
      initialState,
      rosterForm("23110001\n 23110001"),
    );

    expect(result.status).toBe("error");
    expect(mocks.requireTeacher).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("does not call the RPC for an unavailable Course Section", async () => {
    const query = ownedCourseSectionQuery(null);
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query), rpc });

    const result = await saveCourseSectionRosterAction(
      subjectId,
      courseSectionId,
      initialState,
      rosterForm("23110001"),
    );

    expect(result.status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });
});
