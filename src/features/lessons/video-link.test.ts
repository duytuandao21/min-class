import { describe, expect, it } from "vitest";

import { resolveVideoSource, videoTitleFromLink } from "./video-link";

describe("lesson video links", () => {
  it("recognizes a video label and direct video files", () => {
    expect(videoTitleFromLink("Video: Giới thiệu bài học")).toBe("Giới thiệu bài học");
    expect(videoTitleFromLink("Đọc thêm")).toBeNull();
    expect(resolveVideoSource("https://cdn.example.com/bai-hoc.mp4?token=abc")).toEqual({
      kind: "file", url: "https://cdn.example.com/bai-hoc.mp4?token=abc",
    });
  });

  it.each([
    ["https://youtu.be/abcdefghijk", "https://www.youtube-nocookie.com/embed/abcdefghijk"],
    ["https://www.youtube.com/watch?v=abcdefghijk", "https://www.youtube-nocookie.com/embed/abcdefghijk"],
    ["https://vimeo.com/123456", "https://player.vimeo.com/video/123456"],
    ["https://drive.google.com/file/d/abc_DEF/view", "https://drive.google.com/file/d/abc_DEF/preview"],
    ["https://www.loom.com/share/abc123", "https://www.loom.com/embed/abc123"],
  ])("converts %s to an embeddable player", (url, embed) => {
    expect(resolveVideoSource(url)).toEqual({ kind: "embed", url: embed });
  });

  it("tries a generic HTTPS embed URL for other providers", () => {
    expect(resolveVideoSource("https://video.example.com/embed/abc")).toEqual({
      kind: "embed", url: "https://video.example.com/embed/abc",
    });
  });

  it.each([
    "javascript:alert(1)", "http://example.com/video.mp4", "https://localhost/video.mp4",
    "https://192.168.1.1/video.mp4", "https://user:pass@example.com/video.mp4",
    "https://[::1]/video.mp4", "not-a-url",
  ])("rejects unsafe embed URL %s", (url) => {
    expect(resolveVideoSource(url)).toBeNull();
  });
});
