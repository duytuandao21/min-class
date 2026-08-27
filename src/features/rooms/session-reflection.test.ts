import { describe, expect, it } from "vitest";

import {
  parseSessionReflectionRow,
  teacherSessionReflectionsSchema,
} from "./session-reflection";

describe("Session reflection contracts", () => {
  it("parses an own reflection RPC row", () => {
    expect(parseSessionReflectionRow({
      reflection_id: "ef100000-0000-4000-8000-000000000001",
      speaking_count: 3,
      review_body: "Buổi học dễ hiểu.",
      updated_at: "2026-08-27T03:00:00.000Z",
    })).toEqual({
      id: "ef100000-0000-4000-8000-000000000001",
      speakingCount: 3,
      reviewBody: "Buổi học dễ hiểu.",
      updatedAt: "2026-08-27T03:00:00.000Z",
    });
  });

  it("parses Teacher data with MSSV and speaking count", () => {
    const snapshot = teacherSessionReflectionsSchema.parse({
      roomId: "ef200000-0000-4000-8000-000000000001",
      roomTitle: "TCP",
      participantCount: 2,
      submittedCount: 1,
      reflections: [{
        id: "ef100000-0000-4000-8000-000000000001",
        mssv: "23162011",
        speakingCount: 4,
        reviewBody: null,
        submittedAt: "2026-08-27T03:00:00.000Z",
      }],
    });

    expect(snapshot.reflections[0]).toMatchObject({ mssv: "23162011", speakingCount: 4 });
  });

  it("rejects an out-of-range speaking count", () => {
    expect(teacherSessionReflectionsSchema.safeParse({
      roomId: "ef200000-0000-4000-8000-000000000001",
      roomTitle: "TCP",
      participantCount: 1,
      submittedCount: 1,
      reflections: [{
        id: "ef100000-0000-4000-8000-000000000001",
        mssv: "23162011",
        speakingCount: 1000,
        reviewBody: null,
        submittedAt: "2026-08-27T03:00:00.000Z",
      }],
    }).success).toBe(false);
  });
});
