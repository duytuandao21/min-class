import { describe, expect, it } from "vitest";

import {
  commentBodySchema,
  filterFeedbackSnapshotBySections,
  parseTeacherFeedbackSnapshot,
  reactionSchema,
} from "./feedback";

describe("section reflection validation", () => {
  it("accepts only the three MVP reactions", () => {
    expect(reactionSchema.parse("UNDERSTAND")).toBe("UNDERSTAND");
    expect(reactionSchema.safeParse("LIKE").success).toBe(false);
  });

  it("trims comments and rejects blank or overlong input", () => {
    expect(commentBodySchema.parse("  Cần giải thích thêm  ")).toBe("Cần giải thích thêm");
    expect(commentBodySchema.safeParse("   ").success).toBe(false);
    expect(commentBodySchema.safeParse("a".repeat(501)).success).toBe(false);
  });

  it("parses the masked Teacher feedback contract", () => {
    const snapshot = parseTeacherFeedbackSnapshot({
      reactions: [{
        sectionId: "55000000-0000-4000-8000-000000000001",
        sectionPosition: 0,
        sectionTitle: "Overview",
        understand: 24,
        unsure: 8,
        question: 4,
      }],
      comments: [{
        id: "75000000-0000-4000-8000-000000000001",
        sectionId: "55000000-0000-4000-8000-000000000001",
        sectionPosition: 0,
        sectionTitle: "Overview",
        body: "Please explain again",
        authorLabel: "Anonymous",
        isAnonymous: true,
        createdAt: "2026-08-20T00:00:00Z",
      }],
    });

    expect(snapshot.reactions[0]?.understand).toBe(24);
    expect(snapshot.comments[0]?.authorLabel).toBe("Anonymous");
  });

  it("keeps reactions and comments inside the selected Lesson", () => {
    const snapshot = parseTeacherFeedbackSnapshot({
      reactions: [
        { sectionId: "55000000-0000-4000-8000-000000000001", sectionPosition: 0, sectionTitle: "Lesson A", understand: 2, unsure: 0, question: 0 },
        { sectionId: "55000000-0000-4000-8000-000000000002", sectionPosition: 0, sectionTitle: "Lesson B", understand: 7, unsure: 1, question: 0 },
      ],
      comments: [
        { id: "75000000-0000-4000-8000-000000000001", sectionId: "55000000-0000-4000-8000-000000000001", sectionPosition: 0, sectionTitle: "Lesson A", body: "A", authorLabel: "23162011", isAnonymous: false, createdAt: "2026-09-03T01:00:00Z" },
        { id: "75000000-0000-4000-8000-000000000002", sectionId: "55000000-0000-4000-8000-000000000002", sectionPosition: 0, sectionTitle: "Lesson B", body: "B", authorLabel: "Anonymous", isAnonymous: true, createdAt: "2026-09-03T01:01:00Z" },
      ],
    });

    const filtered = filterFeedbackSnapshotBySections(snapshot, ["55000000-0000-4000-8000-000000000002"]);

    expect(filtered.reactions.map((reaction) => reaction.sectionTitle)).toEqual(["Lesson B"]);
    expect(filtered.comments.map((comment) => comment.body)).toEqual(["B"]);
  });
});
