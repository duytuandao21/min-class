import ExcelJS from "exceljs";
import { z } from "zod";

const courseSectionExportStudentSchema = z.object({
  mssv: z.string().min(1),
  speakingCount: z.number().int().nonnegative(),
  attendedLessonCount: z.number().int().nonnegative(),
});

export const courseSectionExportDataSchema = z.object({
  subjectId: z.string().uuid(),
  courseSectionId: z.string().uuid(),
  courseSectionCode: z.string().min(1),
  courseSectionName: z.string().nullable(),
  totalLessons: z.number().int().nonnegative(),
  students: z.array(courseSectionExportStudentSchema),
});

export type CourseSectionExportData = z.infer<typeof courseSectionExportDataSchema>;

export async function buildCourseSectionWorkbook(data: CourseSectionExportData): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MINCLASS";
  workbook.lastModifiedBy = "MINCLASS";
  workbook.created = new Date();
  workbook.title = `Dữ liệu lớp học phần ${data.courseSectionCode}`;
  workbook.subject = "Theo dõi tham gia và phát biểu của sinh viên";

  const worksheet = workbook.addWorksheet("Dữ liệu lớp", {
    pageSetup: {
      fitToPage: true,
      fitToWidth: 1,
      orientation: "portrait",
      paperSize: 9,
    },
    properties: { defaultRowHeight: 22 },
  });
  worksheet.columns = [
    { key: "mssv", width: 22 },
    { key: "speakingCount", width: 30 },
    { key: "attendance", width: 26 },
  ];
  worksheet.views = [{ activeCell: "A6", showGridLines: false, state: "frozen", ySplit: 5 }];
  worksheet.headerFooter.oddFooter = "MINCLASS  •  Trang &P / &N";

  worksheet.mergeCells("A1:C1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "MINCLASS · DỮ LIỆU LỚP HỌC PHẦN";
  titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B45" } };
  worksheet.getRow(1).height = 36;

  worksheet.mergeCells("A2:C2");
  const classCell = worksheet.getCell("A2");
  classCell.value = data.courseSectionName
    ? `${data.courseSectionCode}  ·  ${data.courseSectionName}`
    : data.courseSectionCode;
  classCell.font = { bold: true, color: { argb: "FF174F38" }, size: 12 };
  classCell.alignment = { horizontal: "left", vertical: "middle" };
  classCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F3EB" } };
  worksheet.getRow(2).height = 28;

  worksheet.mergeCells("A3:C3");
  const overviewCell = worksheet.getCell("A3");
  overviewCell.value = `Sĩ số: ${data.students.length} sinh viên  ·  Tổng số buổi học: ${data.totalLessons}`;
  overviewCell.font = { color: { argb: "FF4B5C52" }, size: 11 };
  overviewCell.alignment = { horizontal: "left", vertical: "middle" };
  worksheet.getRow(3).height = 26;

  const header = worksheet.getRow(5);
  header.values = ["MSSV", "Tổng số lần phát biểu", "Số buổi tham gia"];
  header.height = 30;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF176B45" },
  };
  header.eachCell((cell) => {
    cell.border = {
      bottom: { color: { argb: "FF0F5132" }, style: "medium" },
      left: { color: { argb: "FF4F8D70" }, style: "thin" },
      right: { color: { argb: "FF4F8D70" }, style: "thin" },
      top: { color: { argb: "FF0F5132" }, style: "thin" },
    };
  });
  worksheet.autoFilter = { from: "A5", to: "C5" };

  for (const student of data.students) {
    const row = worksheet.addRow({
      mssv: student.mssv,
      speakingCount: student.speakingCount,
      attendance: `${student.attendedLessonCount} / ${data.totalLessons}`,
    });
    row.height = 25;
    row.alignment = { horizontal: "center", vertical: "middle" };
    if (row.number % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F7F3" } };
    }
    row.eachCell((cell) => {
      cell.border = {
        bottom: { color: { argb: "FFD9E5DD" }, style: "thin" },
        left: { color: { argb: "FFE5ECE8" }, style: "thin" },
        right: { color: { argb: "FFE5ECE8" }, style: "thin" },
      };
    });
  }

  worksheet.getColumn("mssv").numFmt = "@";
  worksheet.getColumn("speakingCount").numFmt = "0";

  return workbook.xlsx.writeBuffer();
}

export function getCourseSectionExportFileName(courseSectionCode: string): string {
  const safeCode = courseSectionCode.replace(/[^A-Z0-9._-]/gi, "-");
  return `MINCLASS-${safeCode}-du-lieu.xlsx`;
}
