import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { getStudentEndedLessonReview } from "./queries";

const sessionId = "f8600000-0000-4000-8000-000000000001";
const lessonId = "f8400000-0000-4000-8000-000000000001";
const subjectId = "f8100000-0000-4000-8000-000000000001";
const courseSectionId = "f8200000-0000-4000-8000-000000000001";

const endedReview = {
  sessionId,
  lessonId,
  title: "Lesson 1",
  endedAt: "2026-09-15T10:00:00.000Z",
  mssv: "SV001",
  sections: [{
    id: "f8500000-0000-4000-8000-000000000001",
    position: 0,
    type: "CONTENT",
    title: "Section 1",
    contentMd: "Content",
    quiz: null,
  }],
};

const context = [{
  lesson_id: lessonId,
  lesson_title: "Lesson 1",
  lesson_status: "ENDED",
  subject_id: subjectId,
  subject_name: "Subject",
  course_section_id: courseSectionId,
  section_code: "REVISIT01",
  section_display_name: null,
}];

function mockReviewQuery(reflectionResult: { data: unknown; error: { code: string } | null }) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "get_student_ended_lesson_review") return { data: endedReview, error: null };
    if (name === "get_own_session_reflection") return reflectionResult;
    if (name === "get_public_lesson_gate_context") return { data: context, error: null };
    return { data: null, error: { code: "unexpected" } };
  });
  mocks.createClient.mockResolvedValue({ rpc });
  return rpc;
}

describe("ended Lesson review reflection access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prompts an attendee who has not submitted, including on a returning browser", async () => {
    const rpc = mockReviewQuery({ data: [], error: null });
    const review = await getStudentEndedLessonReview(sessionId, lessonId);
    expect(review).toMatchObject({ participated: true, sessionReflection: null });
    expect(rpc).toHaveBeenCalledWith("get_own_session_reflection", { p_room_id: sessionId });
  });

  it("recognizes an already-submitted reflection and prevents a new prompt", async () => {
    mockReviewQuery({
      data: [{
        reflection_id: "f8700000-0000-4000-8000-000000000001",
        speaking_count: 2,
        review_body: "Buổi học hữu ích",
        updated_at: "2026-09-15T10:10:00.000Z",
      }],
      error: null,
    });
    const review = await getStudentEndedLessonReview(sessionId, lessonId);
    expect(review).toMatchObject({ participated: true, sessionReflection: { speakingCount: 2 } });
  });

  it("does not prompt a roster-only student who never joined", async () => {
    mockReviewQuery({ data: null, error: { code: "42501" } });
    const review = await getStudentEndedLessonReview(sessionId, lessonId);
    expect(review).toMatchObject({ participated: false, sessionReflection: null });
  });

  it("fails closed on an unexpected reflection lookup error", async () => {
    mockReviewQuery({ data: null, error: { code: "50000" } });
    expect(await getStudentEndedLessonReview(sessionId, lessonId)).toBeNull();
  });
});
