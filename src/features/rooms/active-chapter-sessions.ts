import { z } from "zod";

export const activeChapterSessionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  started_at: z.string(),
});

export type ActiveChapterSession = z.infer<typeof activeChapterSessionSchema>;

export function getActiveChapterSessions(
  chapters: readonly { id: string; name: string }[],
  lessons: readonly {
    chapter_id: string;
    latestSession: { id: string; status: "ACTIVE" | "ENDED"; started_at: string } | null;
  }[],
): ActiveChapterSession[] {
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter.name]));
  const sessions = new Map<string, ActiveChapterSession>();
  for (const lesson of lessons) {
    const session = lesson.latestSession;
    const chapterName = chaptersById.get(lesson.chapter_id);
    if (session?.status === "ACTIVE" && chapterName) {
      sessions.set(session.id, { id: session.id, title: chapterName, started_at: session.started_at });
    }
  }
  return [...sessions.values()].sort((left, right) => left.title.localeCompare(right.title, "vi", { numeric: true }));
}
