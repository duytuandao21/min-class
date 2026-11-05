export const courseSectionId = "fd100000-0000-4000-8000-000000000001";
export const chapters = [1, 2, 3].map((number) => ({
  id: `fd200000-0000-4000-8000-${String(number).padStart(12, "0")}`,
  name: number === 3 ? "Chương 3: " + "Tên chương dài để kiểm tra hiển thị ".repeat(3) : `Chương ${number}: Nội dung`,
}));
export function readChapterState() {
  return JSON.parse(localStorage.getItem("multi-chapter-state") ?? '{"sessions":[],"nextId":1}');
}
function save(state) {
  localStorage.setItem("multi-chapter-state", JSON.stringify(state));
  window.dispatchEvent(new Event("chapter:update"));
}
window.chapterTest = { read: readChapterState, failNext: false, externalStart: (index) => startChapterSessionAction({ chapterId: chapters[index].id }) };
export async function startChapterSessionAction({ chapterId }) {
  const state = readChapterState();
  if (window.chapterTest.failNext) { window.chapterTest.failNext = false; throw new Error("Simulated connection loss"); }
  if (state.sessions.some((session) => session.chapterId === chapterId && session.status === "ACTIVE")) {
    return { ok: false, message: "Chương này đang LIVE. Hãy mở Dashboard hoặc tải lại trang." };
  }
  const chapter = chapters.find((chapter) => chapter.id === chapterId);
  const id = `fd300000-0000-4000-8000-${String(state.nextId++).padStart(12, "0")}`;
  state.sessions.push({ id, chapterId, title: chapter.name, status: "ACTIVE", started_at: new Date().toISOString(), released: false });
  save(state);
  return { ok: true, sessionId: id };
}
export async function endRoomAction(id) {
  const state = readChapterState();
  state.sessions.find((session) => session.id === id).status = "ENDED";
  save(state);
  return { ok: true };
}
export async function releaseEntireChapterAction(id) {
  const state = readChapterState();
  state.sessions.find((session) => session.id === id).released = true;
  save(state);
  return { ok: true };
}
