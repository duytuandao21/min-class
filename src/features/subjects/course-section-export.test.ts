import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  buildCourseSectionWorkbook,
  getCourseSectionExportFileName,
  type CourseSectionExportData,
} from "./course-section-export";

const exportData: CourseSectionExportData = {
  subjectId: "11111111-1111-4111-8111-111111111111",
  courseSectionId: "22222222-2222-4222-8222-222222222222",
  courseSectionCode: "23162LTW1",
  courseSectionName: "Lập trình web",
  totalLessons: 5,
  students: [
    { mssv: "00123456", speakingCount: 7, attendedLessonCount: 4 },
    { mssv: "23162012", speakingCount: 0, attendedLessonCount: 2 },
  ],
};

describe("Course Section Excel export", () => {
  it("creates the requested columns and keeps MSSV as text", async () => {
    const buffer = await buildCourseSectionWorkbook(exportData);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet("Dữ liệu lớp");
    expect(worksheet).toBeDefined();
    expect(worksheet?.getCell("A1").value).toBe("MINCLASS · DỮ LIỆU LỚP HỌC PHẦN");
    expect(worksheet?.getCell("A2").value).toBe("23162LTW1  ·  Lập trình web");
    expect(worksheet?.getCell("A3").value).toBe("Sĩ số: 2 sinh viên  ·  Tổng số buổi học: 5");
    expect(worksheet?.getRow(5).values).toEqual([
      undefined,
      "MSSV",
      "Tổng số lần phát biểu",
      "Số buổi tham gia",
    ]);
    expect(worksheet?.getCell("A6").value).toBe("00123456");
    expect(worksheet?.getCell("B6").value).toBe(7);
    expect(worksheet?.getCell("C6").value).toBe("4 / 5");
    expect(worksheet?.getCell("C7").value).toBe("2 / 5");
    expect(worksheet?.views[0]).toMatchObject({ state: "frozen", ySplit: 5 });
    expect(worksheet?.autoFilter).toBe("A5:C5");
  });

  it("creates a safe, recognizable xlsx file name", () => {
    expect(getCourseSectionExportFileName("23162LTW1")).toBe("MINCLASS-23162LTW1-du-lieu.xlsx");
    expect(getCourseSectionExportFileName("LTW 1/2")).toBe("MINCLASS-LTW-1-2-du-lieu.xlsx");
  });
});
