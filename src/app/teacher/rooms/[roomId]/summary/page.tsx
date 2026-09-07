import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink } from "@/components/back-link";
import { DeleteRoomButton } from "@/features/rooms/components/delete-room-button";
import { TeacherSummaryLessons } from "@/features/rooms/components/teacher-summary-lessons";
import {
  getTeacherRoomAttendanceDetail,
  getTeacherRoomSummaryLessonList,
  getTeacherRoomSummaryOverview,
} from "@/features/rooms/server/queries";

function SummaryFallback() {
  return <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12" aria-busy="true"><div className="h-11 w-40 animate-pulse rounded-xl bg-black/10" /><div className="mt-10 h-28 animate-pulse rounded-3xl bg-black/5" /><div className="mt-8 grid gap-4 sm:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div className="h-28 animate-pulse rounded-2xl bg-black/5" key={index} />)}</div><p className="sr-only">Đang tải tổng kết buổi học</p></main>;
}

function AttendanceFallback() {
  return <section className="mt-8 grid gap-6 lg:grid-cols-2" aria-busy="true"><div className="h-72 animate-pulse rounded-3xl bg-black/5" /><div className="h-72 animate-pulse rounded-3xl bg-black/5" /><span className="sr-only">Đang tải danh sách điểm danh</span></section>;
}

async function AttendanceDetails({ attendancePromise }: { attendancePromise: ReturnType<typeof getTeacherRoomAttendanceDetail> }) {
  const attendance = await attendancePromise;
  if (!attendance) return null;
  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold">MSSV đã join</h2>
        {attendance.participants.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">Không có participant.</p> : (
          <ol className="mt-4 max-h-80 space-y-2 overflow-y-auto">{attendance.participants.map((participant, index) => <li className="flex min-w-0 items-center gap-3 rounded-xl bg-black/3 px-4 py-2.5" key={`${participant.mssv}-${participant.joinedAt}`}><span className="w-6 text-xs text-[var(--muted)]">{index + 1}</span><span className="min-w-0 break-all font-mono font-semibold">{participant.mssv}</span></li>)}</ol>
        )}
      </div>
      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold">Danh sách vắng</h2>
        {attendance.absentMssvs.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">Không có Student vắng.</p> : (
          <ol className="mt-4 max-h-80 space-y-2 overflow-y-auto">{attendance.absentMssvs.map((mssv, index) => <li className="flex min-w-0 items-center gap-3 rounded-xl bg-red-50 px-4 py-2.5" key={mssv}><span className="w-6 text-xs text-[var(--muted)]">{index + 1}</span><span className="min-w-0 break-all font-mono font-semibold">{mssv}</span></li>)}</ol>
        )}
      </div>
    </section>
  );
}

async function LessonSummaryList({ lessonListPromise, roomId }: { lessonListPromise: ReturnType<typeof getTeacherRoomSummaryLessonList>; roomId: string }) {
  const lessons = await lessonListPromise;
  return lessons ? <TeacherSummaryLessons lessons={lessons} roomId={roomId} /> : null;
}

export default async function TeacherRoomSummaryPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <Suspense fallback={<SummaryFallback />}><TeacherRoomSummaryContent roomId={roomId} /></Suspense>;
}

async function TeacherRoomSummaryContent({ roomId }: { roomId: string }) {
  const overviewPromise = getTeacherRoomSummaryOverview(roomId);
  const attendancePromise = getTeacherRoomAttendanceDetail(roomId);
  const lessonListPromise = getTeacherRoomSummaryLessonList(roomId);
  const summary = await overviewPromise;
  if (!summary) notFound();

  const lessonManagementHref = summary.lessonContext ? `/teacher/subjects/${summary.lessonContext.subjectId}/sections/${summary.lessonContext.courseSectionId}/lessons/${summary.lessonContext.lessonId}` : "/teacher/subjects";
  const courseSectionHref = summary.lessonContext ? `/teacher/subjects/${summary.lessonContext.subjectId}/sections/${summary.lessonContext.courseSectionId}` : "/teacher/subjects";

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
      <BackLink href={courseSectionHref} label="Course Section" />
      <header className="mt-10 border-b border-black/10 pb-8"><p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">POST-CLASS SUMMARY</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{summary.room.title}</h1><p className="mt-3 text-[var(--muted)]">Buổi học đã kết thúc. Summary được tính trực tiếp từ dữ liệu của Room.</p></header>

      <section className="mt-8 rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-white to-emerald-50/70 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">TỔNG KẾT BUỔI HỌC</p><h2 className="mt-3 text-2xl font-semibold">Nhìn lại những điều lớp học đã chia sẻ.</h2><p className="mt-3 text-[var(--muted)]">Xem review cuối buổi và phản hồi trong từng section.</p>
        <div className="mt-6 flex flex-wrap gap-3"><Link className="inline-flex rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:opacity-90" href={`/teacher/rooms/${summary.room.id}/reviews`}>Xem Reviews</Link><Link className="inline-flex rounded-xl border border-amber-200 bg-amber-100 px-5 py-3 font-semibold text-amber-950 transition hover:bg-amber-200" href={`/teacher/rooms/${summary.room.id}/voices`}>Xem phản hồi</Link></div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><p className="text-sm text-[var(--muted)]">Sĩ số</p><p className="mt-2 text-3xl font-semibold">{summary.attendance.rosterCount}</p></div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><p className="text-sm text-[var(--muted)]">Có mặt / đã tham gia</p><p className="mt-2 text-3xl font-semibold text-[var(--accent)]">{summary.attendance.joinedCount}</p></div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><p className="text-sm text-[var(--muted)]">Vắng</p><p className="mt-2 text-3xl font-semibold text-red-800">{summary.attendance.absentCount}</p></div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><p className="text-sm text-[var(--muted)]">Total comment</p><p className="mt-2 text-3xl font-semibold">{summary.comments.total}</p></div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><p className="text-sm text-[var(--muted)]">Anonymous</p><p className="mt-2 text-3xl font-semibold">{summary.comments.anonymous}</p></div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><p className="text-sm text-[var(--muted)]">Hiện MSSV</p><p className="mt-2 text-3xl font-semibold">{summary.comments.named}</p></div>
      </section>

      <Suspense fallback={<AttendanceFallback />}><AttendanceDetails attendancePromise={attendancePromise} /></Suspense>

      {summary.mostEngagedSection ? <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"><p className="text-xs font-semibold">NHIỀU PHẢN HỒI NHẤT TRONG BUỔI HỌC</p><p className="mt-1 font-semibold">Section {summary.mostEngagedSection.sectionPosition + 1} · {summary.mostEngagedSection.sectionTitle}</p><p className="mt-1 text-sm">{summary.mostEngagedSection.totalFeedback} reaction và comment</p></section> : null}

      <section className="mt-8" aria-labelledby="lesson-summary-title">
        <p className="text-sm font-bold tracking-[0.16em] text-[var(--accent)]">CHI TIẾT THEO LESSON</p><h2 className="mt-2 text-3xl font-semibold" id="lesson-summary-title">Nội dung và kết quả từng Lesson</h2>
        <Suspense fallback={<div className="mt-5 space-y-4" aria-busy="true">{Array.from({ length: 2 }, (_, index) => <div className="h-24 animate-pulse rounded-3xl bg-black/5" key={index} />)}</div>}><LessonSummaryList lessonListPromise={lessonListPromise} roomId={roomId} /></Suspense>
      </section>

      <section className="mt-10 border-t border-red-200 pt-8"><h2 className="text-lg font-semibold text-red-950">Danger zone</h2><p className="mt-2 mb-5 text-sm leading-6 text-[var(--muted)]">Xóa Room sẽ xóa vĩnh viễn toàn bộ dữ liệu của buổi học.</p><DeleteRoomButton redirectTo={lessonManagementHref} roomId={summary.room.id} /></section>
    </main>
  );
}
