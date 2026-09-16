import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPublicLessonGateContext: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/components/back-link", () => ({ BackLink: () => null }));
vi.mock("@/features/catalog/components/lesson-access-form", () => ({ LessonAccessForm: () => null }));
vi.mock("@/features/catalog/server/queries", () => ({ getPublicLessonGateContext: mocks.getPublicLessonGateContext }));

import PublicLessonAccessPage from "./page";

describe("public LIVE Lesson access page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the Chapter name with a readable line clamp, not the first Lesson title", async () => {
    const chapterName = "Chương 3: Tìm kiếm tuyến tính và giá trị của dữ liệu đã sắp xếp";
    mocks.getPublicLessonGateContext.mockResolvedValue({
      lesson_id: "ae300000-0000-4000-8000-000000000001",
      lesson_title: "Bài 4",
      lesson_status: "LIVE",
      subject_id: "ae100000-0000-4000-8000-000000000001",
      course_section_id: "ae200000-0000-4000-8000-000000000001",
      section_code: "DSA123",
      section_display_name: null,
      chapter_name: chapterName,
    });

    const markup = renderToStaticMarkup(await PublicLessonAccessPage({
      params: Promise.resolve({ lessonId: "ae300000-0000-4000-8000-000000000001" }),
    }));

    expect(markup).toContain(`title="${chapterName}"`);
    expect(markup).toContain(`>${chapterName}</h1>`);
    expect(markup).toContain("line-clamp-3");
    expect(markup).toContain("sm:line-clamp-2");
    expect(markup).not.toContain("Bài 4");
    expect(markup).toContain("Nhập MSSV để tham gia chương đang LIVE.");
  });
});
