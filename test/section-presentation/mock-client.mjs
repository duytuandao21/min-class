export const roomId = "fa000000-0000-4000-8000-000000000001";
export const lessonId = "fa000000-0000-4000-8000-000000000002";
export const otherLessonId = "fa000000-0000-4000-8000-000000000003";
export const sections = Array.from({ length: 4 }, (_, position) => ({
  id: `fb000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`,
  position, type: "CONTENT", title: `Nội dung ${position + 1}`,
  contentMd: `Nội dung section ${position + 1}.`,
}));
export function readState() {
  const saved = localStorage.getItem("section-test-state");
  if (saved) return JSON.parse(saved);
  const state = {
    [lessonId]: { teaching: 2, released: 2, revision: 2, status: "ACTIVE" },
    [otherLessonId]: { teaching: 0, released: 0, revision: 0, status: "ACTIVE" },
  };
  localStorage.setItem("section-test-state", JSON.stringify(state));
  return state;
}
export function snapshotRows(id) {
  const state = readState()[id];
  return sections.filter((section) => section.position <= state.released).map((section) => ({
    room_id: roomId, room_title: "Lesson đồng bộ", room_status: state.status,
    released_through: state.released, teaching_section: state.teaching,
    presentation_revision: state.revision, section_id: section.id,
    section_position: section.position, section_type: section.type,
    section_title: section.title, section_content_md: section.contentMd,
  }));
}
const channels = new Set();
const bus = new BroadcastChannel("section-test-events");
function emit() {
  for (const channel of channels) {
    if (channel.connected) channel.handlers.forEach((handler) => handler());
  }
}
bus.onmessage = emit;
window.sectionTest = {
  readState,
  failNext: false,
  fetchCount: 0,
  disconnect() {
    for (const channel of channels) {
      channel.connected = false;
      channel.status("CHANNEL_ERROR");
    }
  },
  reconnect() {
    for (const channel of channels) {
      channel.connected = true;
      channel.status("SUBSCRIBED");
    }
  },
  burst() { for (let i = 0; i < 10; i++) emit(); },
  end() {
    const state = readState();
    Object.values(state).forEach((item) => { item.status = "ENDED"; });
    localStorage.setItem("section-test-state", JSON.stringify(state));
    bus.postMessage("update");
    emit();
  },
};
export function createClient() {
  return {
    async rpc(name, args) {
      if (name === "get_teacher_lesson_feedback_snapshot") return { data: { reactions: [], comments: [] }, error: null };
      if (name === "get_student_session_lesson_flow_snapshot") {
        window.sectionTest.fetchCount += 1;
        return { data: snapshotRows(args.p_lesson_id), error: null };
      }
      if (name === "present_session_lesson_section" || name === "release_session_lesson_section") {
        if (window.sectionTest.failNext) {
          window.sectionTest.failNext = false;
          return { data: null, error: { code: "500" } };
        }
        const all = readState();
        const state = all[args.p_lesson_id];
        const target = name === "present_session_lesson_section" ? args.p_section_position : state.teaching + 1;
        if (state.status !== "ACTIVE") return { error: { code: "42501" } };
        if (target < 0 || target > 3 || (name.startsWith("present_") && target > state.released)) return { error: { code: "22023" } };
        state.teaching = target;
        state.released = Math.max(state.released, target);
        state.revision += 1;
        localStorage.setItem("section-test-state", JSON.stringify(all));
        bus.postMessage("update");
        emit();
        return { data: [{ teaching_section: state.teaching, released_through: state.released }], error: null };
      }
      throw new Error(`Unexpected test RPC: ${name}`);
    },
    channel() {
      const channel = {
        connected: true, handlers: [], status: () => {},
        on(_type, _filter, handler) { channel.handlers.push(handler); return channel; },
        subscribe(status) {
          channel.status = status;
          channels.add(channel);
          queueMicrotask(() => status("SUBSCRIBED"));
          return channel;
        },
      };
      return channel;
    },
    async removeChannel(channel) { channels.delete(channel); },
  };
}
