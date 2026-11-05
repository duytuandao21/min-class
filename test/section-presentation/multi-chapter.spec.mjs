import { expect, test } from "@playwright/test";

async function startTwo(page) {
  await page.goto("/?multi=1");
  await page.getByRole("button", { name: "Bắt đầu LIVE Chương 1: Nội dung", exact: true }).click();
  await page.getByRole("link", { name: "Course Section" }).click();
  await page.getByRole("button", { name: "Bắt đầu LIVE Chương 2: Nội dung", exact: true }).click();
  await expect(page.getByText("2 chương", { exact: true })).toBeVisible();
}

test("two Chapters stay LIVE with independent Dashboard links and a current indicator", async ({ page }) => {
  await startTwo(page);
  const nav = page.getByRole("navigation", { name: "Chuyển Dashboard chương" });
  await expect(nav.getByRole("link")).toHaveCount(2);
  await expect(nav.locator('[aria-current="page"]')).toContainText("Chương 2");
  await nav.getByRole("link", { name: /Chương 1/ }).click();
  await expect(nav.locator('[aria-current="page"]')).toContainText("Chương 1");
  await page.getByRole("link", { name: "Course Section" }).click();
  await expect(page.getByRole("button", { name: /^Bắt đầu LIVE Chương 3/ })).toBeEnabled();
  expect(await page.evaluate(() => window.chapterTest.read().sessions.length)).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/multi-chapter-${test.info().project.name}.png`, fullPage: true });
});

test("ending a named Chapter requires confirmation and leaves the other LIVE", async ({ page }) => {
  await startTwo(page);
  await page.getByRole("button", { name: "Kết thúc LIVE chương", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Chương 2: Nội dung");
  await expect(dialog).toContainText("các chương khác vẫn tiếp tục LIVE");
  await dialog.getByRole("button", { name: "Hủy" }).click();
  expect(await page.evaluate(() => window.chapterTest.read().sessions.filter((session) => session.status === "ACTIVE").length)).toBe(2);
  await page.getByRole("button", { name: "Kết thúc LIVE chương", exact: true }).click();
  await dialog.getByRole("button", { name: "Xác nhận kết thúc" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tổng kết Chương 2: Nội dung");
  await page.getByRole("link", { name: "Course Section" }).click();
  await expect(page.getByText("1 chương", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bắt đầu LIVE Chương 2: Nội dung", exact: true })).toBeEnabled();
  await page.goto("/?multi=1&student=1");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Chương 1: Nội dung");
});

test("Done Chapter only releases the selected Chapter and student cards stay separate", async ({ page }) => {
  await startTwo(page);
  await page.getByRole("button", { name: "Done toàn bộ chương", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Chương 2: Nội dung");
  await dialog.getByRole("button", { name: "Xác nhận Done chương" }).click();
  expect(await page.evaluate(() => window.chapterTest.read().sessions.map((session) => session.released))).toEqual([false, true]);
  await page.goto("/?multi=1&student=1");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(2);
  const links = await page.locator("li a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(new Set(links).size).toBe(2);
});

test("connection failure on Start shows recovery and does not create a Session", async ({ page }) => {
  await page.goto("/?multi=1");
  await page.evaluate(() => { window.chapterTest.failNext = true; });
  await page.getByRole("button", { name: "Bắt đầu LIVE Chương 1: Nội dung", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Không thể bắt đầu LIVE");
  expect(await page.evaluate(() => window.chapterTest.read().sessions)).toHaveLength(0);
  await page.getByRole("button", { name: "Tải lại trang" }).click();
  await page.getByRole("button", { name: "Bắt đầu LIVE Chương 1: Nội dung", exact: true }).click();
  await expect(page.getByText("1 chương", { exact: true })).toBeVisible();
});
