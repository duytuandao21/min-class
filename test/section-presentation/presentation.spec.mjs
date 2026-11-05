import { expect, test } from "@playwright/test";

const articleTitle = (page) => page.locator("article h2");
async function open(context, role = "student", suffix = "") {
  const page = await context.newPage();
  await page.goto(`/?role=${role}${suffix}`);
  await expect(articleTitle(page)).toHaveText(suffix ? "Nội dung 1" : "Nội dung 3");
  return page;
}

test("teacher presentation moves all students, preserves private preview and release frontier", async ({ context }) => {
  const teacher = await open(context, "teacher");
  const student = await open(context);
  const student2 = await open(context);
  const otherLesson = await open(context, "student", "&other=1");
  await student.getByRole("button", { name: "← Previous" }).click();
  await student.getByRole("button", { name: "← Previous" }).click();
  await expect(articleTitle(student)).toHaveText("Nội dung 1");
  await teacher.getByRole("button", { name: "Xem trước", exact: true }).click();
  await expect(articleTitle(teacher)).toHaveText("Nội dung 2");
  await expect(articleTitle(student2)).toHaveText("Nội dung 3");
  await teacher.getByRole("button", { name: "Trình chiếu section này" }).click();
  await expect(articleTitle(student)).toHaveText("Nội dung 2");
  await expect(articleTitle(student2)).toHaveText("Nội dung 2");
  await expect(articleTitle(otherLesson)).toHaveText("Nội dung 1");
  await expect(teacher.getByRole("button", { name: /^Done Section/ })).toHaveCount(0);
  await teacher.getByRole("button", { name: "Section tiếp", exact: true }).click();
  await expect(articleTitle(student)).toHaveText("Nội dung 3");
  await teacher.getByRole("button", { name: "Done Section 3" }).click();
  await expect(articleTitle(student2)).toHaveText("Nội dung 4");
  await teacher.getByRole("button", { name: "Quay lại section" }).click();
  await expect(articleTitle(student)).toHaveText("Nội dung 3");
  expect(await teacher.evaluate(() => Object.values(window.sectionTest.readState())[0].released)).toBe(3);
  await expect(student.getByRole("button", { name: "Next →" })).toBeEnabled();
  await teacher.screenshot({ path: `test-results/teacher-presentation-${test.info().project.name}.png`, fullPage: true });
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("re-presenting the same section forces browsing students back; ordinary refetch does not", async ({ context }) => {
  const teacher = await open(context, "teacher");
  const student = await open(context);
  await student.getByRole("button", { name: "← Previous" }).click();
  await student.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(articleTitle(student)).toHaveText("Nội dung 2");
  await teacher.getByRole("button", { name: "Đồng bộ lại lớp" }).click();
  await expect(articleTitle(student)).toHaveText("Nội dung 3");
  await student.getByRole("button", { name: "← Previous" }).click();
  await student.getByRole("button", { name: "Về section đang dạy" }).click();
  await expect(articleTitle(student)).toHaveText("Nội dung 3");
});

test("reconnect catches missed commands and degraded polling recovers without realtime", async ({ context }) => {
  const teacher = await open(context, "teacher");
  const student = await open(context);
  await student.bringToFront();
  await student.evaluate(() => window.sectionTest.disconnect());
  await teacher.getByRole("button", { name: "Quay lại section" }).click();
  await expect(articleTitle(student)).toHaveText("Nội dung 2", { timeout: 8_000 });
  await student.evaluate(() => window.sectionTest.reconnect());
  await student.getByRole("button", { name: "← Previous" }).click();
  await teacher.getByRole("button", { name: "Đồng bộ lại lớp" }).click();
  await expect(articleTitle(student)).toHaveText("Nội dung 2");
});

test("failed teacher commands preserve the displayed section and can be retried", async ({ context }) => {
  const teacher = await open(context, "teacher");
  const student = await open(context);
  await teacher.evaluate(() => { window.sectionTest.failNext = true; });
  await teacher.getByRole("button", { name: "Quay lại section" }).click();
  await expect(teacher.getByRole("alert")).toContainText("Không thể đồng bộ section");
  await expect(articleTitle(teacher)).toHaveText("Nội dung 3");
  await expect(articleTitle(student)).toHaveText("Nội dung 3");
  await teacher.getByRole("button", { name: "Quay lại section" }).click();
  await expect(articleTitle(student)).toHaveText("Nội dung 2");
});

test("ended sessions keep student review and still open the reflection popup", async ({ context }) => {
  const student = await open(context);
  await student.getByRole("button", { name: "← Previous" }).click();
  await student.evaluate(() => window.sectionTest.end());
  await expect(student.getByRole("dialog")).toBeVisible();
  await student.getByRole("button", { name: "Đóng tổng kết cá nhân" }).click();
  await expect(articleTitle(student)).toHaveText("Nội dung 2");
  await expect(student.getByText("Đang theo giảng viên")).toHaveCount(0);
});

test("event bursts coalesce and fallback polling stops when realtime recovers", async ({ context }) => {
  const student = await open(context);
  await expect(student.getByText("Đang kết nối realtime…")).toHaveCount(0);
  await student.clock.install();
  const before = await student.evaluate(() => window.sectionTest.fetchCount);
  await student.evaluate(() => window.sectionTest.burst());
  await student.clock.runFor(200);
  await expect.poll(() => student.evaluate(() => window.sectionTest.fetchCount)).toBe(before + 1);
  await student.evaluate(() => window.sectionTest.disconnect());
  await student.clock.runFor(200);
  await expect.poll(() => student.evaluate(() => window.sectionTest.fetchCount)).toBe(before + 2);
  await student.evaluate(() => window.sectionTest.reconnect());
  await expect.poll(() => student.evaluate(() => window.sectionTest.fetchCount)).toBe(before + 3);
  await student.clock.runFor(6_000);
  expect(await student.evaluate(() => window.sectionTest.fetchCount)).toBe(before + 3);
});
