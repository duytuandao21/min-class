export type VideoSource = { kind: "file" | "embed"; url: string };

export function videoTitleFromLink(text: string): string | null {
  const match = /^video:\s*(.+)$/i.exec(text.trim());
  return match?.[1].trim() || null;
}

export function resolveVideoSource(rawUrl: string): VideoSource | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Embedded content is loaded by the student's browser. Never point it at
  // local/private hosts or permit credentials and non-HTTPS protocols.
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" || url.username || url.password ||
    host === "localhost" || host.endsWith(".localhost") ||
    host.endsWith(".local") || host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")
  ) return null;

  if (/\.(mp4|webm|ogg|ogv|m4v)$/i.test(url.pathname)) {
    return { kind: "file", url: url.href };
  }

  if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = host === "youtu.be" ? parts[0] : parts[0] === "watch" ? url.searchParams.get("v") : ["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : null;
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return { kind: "embed", url: `https://www.youtube-nocookie.com/embed/${id}` };
    }
  }

  if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
    if (id) return { kind: "embed", url: `https://player.vimeo.com/video/${id}` };
  }

  if (host === "dailymotion.com" || host === "www.dailymotion.com" || host === "dai.ly") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = host === "dai.ly" ? parts[0] : parts[0] === "video" || parts[0] === "embed" ? parts.at(-1) : null;
    if (id && /^[a-zA-Z0-9]+$/.test(id)) return { kind: "embed", url: `https://www.dailymotion.com/embed/video/${id}` };
  }

  if (host === "drive.google.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[0] === "file" && parts[1] === "d" ? parts[2] : null;
    if (id && /^[a-zA-Z0-9_-]+$/.test(id)) return { kind: "embed", url: `https://drive.google.com/file/d/${id}/preview` };
  }

  if (host === "loom.com" || host === "www.loom.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[0] === "share" || parts[0] === "embed" ? parts[1] : null;
    if (id && /^[a-zA-Z0-9]+$/.test(id)) return { kind: "embed", url: `https://www.loom.com/embed/${id}` };
  }

  // Other providers can supply their own HTTPS embed URL. Some websites deny
  // framing; the UI always includes a direct link as a usable fallback.
  return { kind: "embed", url: url.href };
}
