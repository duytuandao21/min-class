import { describe, expect, it } from "vitest";

import {
  commentBodySchema,
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
});
