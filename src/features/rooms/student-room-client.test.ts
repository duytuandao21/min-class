import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));

import { fetchStudentLessonSnapshot, StudentRoomUnavailableError } from "./student-room-client";

const roomId = "a9800000-0000-4000-8000-000000000001";
const lessonId = "a9800000-0000-4000-8000-000000000002";

describe("student presentation snapshot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches the authorized extended snapshot on reconnect", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{
      room_id: roomId, room_title: "Lesson", room_status: "ACTIVE",
      teaching_section: 0, released_through: 2, presentation_revision: 7,
      section_id: null, section_position: null, section_type: null,
      section_title: null, section_content_md: null,
    }], error: null });
    mocks.createClient.mockReturnValue({ rpc });
    await expect(fetchStudentLessonSnapshot(roomId, lessonId)).resolves.toMatchObject({ teachingSection: 0, presentationRevision: 7 });
    expect(rpc).toHaveBeenCalledWith("get_student_session_lesson_flow_snapshot", { p_room_id: roomId, p_lesson_id: lessonId });
  });

  it("distinguishes unavailable rooms from transient fetch errors", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ error: { code: "42501" } })
      .mockResolvedValueOnce({ error: { code: "500" } });
    mocks.createClient.mockReturnValue({ rpc });
    await expect(fetchStudentLessonSnapshot(roomId, lessonId)).rejects.toBeInstanceOf(StudentRoomUnavailableError);
    await expect(fetchStudentLessonSnapshot(roomId, lessonId)).rejects.toThrow("Không thể đồng bộ nội dung Room");
  });

  it("validates the lesson identifier", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockReturnValue({ rpc });
    await expect(fetchStudentLessonSnapshot(roomId, "invalid")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
