// Browser integration harness: real players and RPC clients, simulated transport.
import { createRoot } from "react-dom/client";
import { TeacherSectionPlayer } from "../../src/features/rooms/components/teacher-section-player";
import { StudentLessonPlayer } from "../../src/features/rooms/components/student-lesson-player";
import { parseStudentLessonSnapshot } from "../../src/features/rooms/lesson-flow";
import { roomId, lessonId, otherLessonId, sections, snapshotRows, readState } from "./mock-client.mjs";
import "../../src/app/globals.css";
import { MultiChapterHarness } from "./multi-chapter-harness.jsx";

const params = new URLSearchParams(location.search);
const selectedLessonId = params.has("other") ? otherLessonId : lessonId;
const state = readState()[selectedLessonId];
const snapshot = parseStudentLessonSnapshot(snapshotRows(selectedLessonId));
createRoot(document.getElementById("root")).render(
  params.has("multi") ? <MultiChapterHarness /> : (
  <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 sm:px-10">
    <h1 className="text-3xl font-semibold">Lesson đồng bộ</h1>
    {params.get("role") === "teacher" ? (
      <TeacherSectionPlayer initialFeedback={{ reactions: [], comments: [] }}
        initialReleasedThrough={state.released} initialTeachingSection={state.teaching}
        lessonId={selectedLessonId} lessonTitle="Lesson đồng bộ" roomId={roomId} sections={sections} />
    ) : (
      <StudentLessonPlayer initialSnapshot={snapshot} initialReactions={{}}
        initialSessionReflection={null} participated lessonId={selectedLessonId} />
    )}
  </main>
  )
);
