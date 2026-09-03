import { NextResponse } from "next/server";

import { requireTeacher } from "@/features/auth/teacher-session";
import { lessonIdSchema } from "@/features/subjects/schemas";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  await requireTeacher();
  const parsedId = lessonIdSchema.safeParse((await params).lessonId);
  if (!parsedId.success) return new NextResponse("Lesson không hợp lệ.", { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("lessons").select("title, markdown_source").eq("id", parsedId.data).maybeSingle();
  if (error || !data) return new NextResponse("Không tìm thấy Lesson.", { status: 404 });
  const fileName = `${data.title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "lesson"}.md`;
  return new NextResponse(data.markdown_source, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
