import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StudentSessionReflection } from "./student-session-reflection";

const roomId = "f8600000-0000-4000-8000-000000000001";

describe("StudentSessionReflection on page entry", () => {
  it("automatically opens the form when the attendee has not submitted", () => {
    const html = renderToStaticMarkup(<StudentSessionReflection initialReflection={null} roomId={roomId} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Gửi tổng kết");
    expect(html).toContain("Đóng tổng kết cá nhân");
  });

  it("does not automatically open after submission", () => {
    const html = renderToStaticMarkup(<StudentSessionReflection
      initialReflection={{
        id: "f8700000-0000-4000-8000-000000000001",
        speakingCount: 2,
        reviewBody: "Buổi học hữu ích",
        updatedAt: "2026-09-15T10:10:00.000Z",
      }}
      roomId={roomId}
    />);
    expect(html).not.toContain('role="dialog"');
    expect(html).toContain("Xem tổng kết");
  });
});
