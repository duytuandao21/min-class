import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "./markdown-preview";

describe("MarkdownContent video rendering", () => {
  it("renders a direct file as an inline video with controls", () => {
    const html = renderToStaticMarkup(<MarkdownContent source="[video: Bài giảng](https://cdn.example.com/lesson.mp4)" />);
    expect(html).toContain("<video");
    expect(html).toContain("controls");
    expect(html).toContain("https://cdn.example.com/lesson.mp4");
    expect(html).toContain("Mở video gốc nếu không phát được");
  });

  it("renders a provider link as a responsive embedded player", () => {
    const html = renderToStaticMarkup(<MarkdownContent source="[video: Minh họa](https://youtu.be/abcdefghijk)" />);
    expect(html).toContain("<iframe");
    expect(html).toContain("aspect-video");
    expect(html).toContain("https://www.youtube-nocookie.com/embed/abcdefghijk");
    expect(html).toContain("sandbox=");
  });

  it("leaves ordinary links unchanged and does not embed unsafe legacy content", () => {
    const ordinary = renderToStaticMarkup(<MarkdownContent source="[Đọc thêm](https://example.com)" />);
    const unsafe = renderToStaticMarkup(<MarkdownContent source="[video: Bài giảng](https://localhost/video.mp4)" />);
    expect(ordinary).not.toContain("<iframe");
    expect(unsafe).not.toContain("<video");
    expect(unsafe).not.toContain("<iframe");
  });
});
