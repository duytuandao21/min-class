import {
  buildCourseSectionWorkbook,
  getCourseSectionExportFileName,
} from "@/features/subjects/course-section-export";
import { getCourseSectionExportData } from "@/features/subjects/server/export";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ subjectId: string; courseSectionId: string }> },
) {
  const { subjectId, courseSectionId } = await params;
  const data = await getCourseSectionExportData(subjectId, courseSectionId);
  if (!data) return new Response("Không tìm thấy lớp học phần.", { status: 404 });

  const workbook = await buildCourseSectionWorkbook(data);
  return new Response(new Uint8Array(workbook), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${getCourseSectionExportFileName(data.courseSectionCode)}"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
