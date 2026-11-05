import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getActiveChapterSessions } from "./active-chapter-sessions";
import { ActiveChapterSessions } from "./components/active-chapter-sessions";

const chapters = [{ id: "c2", name: "Chương 2" }, { id: "c10", name: "Chương 10" }, { id: "c1", name: "Chương 1" }];
const session = (id: string, status: "ACTIVE" | "ENDED" = "ACTIVE") => ({ id, status, started_at: "2026-11-05T14:00:00Z" });

describe("active Chapter Sessions", () => {
  it("deduplicates multi-Lesson Sessions while retaining every ACTIVE Chapter", () => {
    const sessions = getActiveChapterSessions(chapters, [
      { chapter_id: "c10", latestSession: session("s10") },
      { chapter_id: "c2", latestSession: session("s2") },
      { chapter_id: "c2", latestSession: session("s2") },
      { chapter_id: "c1", latestSession: session("ended", "ENDED") },
      { chapter_id: "c1", latestSession: null },
    ]);
    expect(sessions.map((item) => item.id)).toEqual(["s2", "s10"]);
    expect(sessions.map((item) => item.title)).toEqual(["Chương 2", "Chương 10"]);
  });

  it("ignores unrecognized Chapters and handles empty data", () => {
    expect(getActiveChapterSessions([], [{ chapter_id: "foreign", latestSession: session("s") }])).toEqual([]);
    expect(getActiveChapterSessions(chapters, [])).toEqual([]);
    expect(renderToStaticMarkup(<ActiveChapterSessions sessions={[]} />)).toBe("");
  });

  it("links to independent Dashboards and highlights only the current Session", () => {
    const html = renderToStaticMarkup(<ActiveChapterSessions currentSessionId="s2" sessions={[
      { ...session("s1"), title: "Chương 1" }, { ...session("s2"), title: "Chương 2" },
    ]} />);
    expect(html).toContain('href="/teacher/rooms/s1"');
    expect(html).toContain('href="/teacher/rooms/s2"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain("Đang xem");
    expect(html).toContain("2 chương");
  });

  it("escapes long titles and retains the complete title for hover", () => {
    const title = 'Chương <script>alert("x")</script> ' + "Nội dung ".repeat(20);
    const html = renderToStaticMarkup(<ActiveChapterSessions sessions={[{ ...session("s"), title }]} />);
    expect(html).not.toContain("<script>");
    expect(html).toContain("truncate");
    expect(html).toContain('title="Chương &lt;script&gt;');
  });
});
