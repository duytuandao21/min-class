import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { DeleteRoomButton } from "@/features/rooms/components/delete-room-button";
import { getTeacherRoomSummary } from "@/features/rooms/server/queries";

export default async function TeacherRoomSummaryPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const summary = await getTeacherRoomSummary(roomId);
  if (!summary) notFound();

  const lessonManagementHref = summary.lessonContext
    ? `/teacher/subjects/${summary.lessonContext.subjectId}/sections/${summary.lessonContext.courseSectionId}/lessons/${summary.lessonContext.lessonId}`
    : "/teacher/subjects";
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
      <BackLink href={lessonManagementHref} label="Lesson" />

      <header className="mt-10 border-b border-black/10 pb-8">
        <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">POST-CLASS SUMMARY · {summary.room.code}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{summary.room.title}</h1>
        <p className="mt-3 text-[var(--muted)]">Buổi học đã kết thúc. Summary được tính trực tiếp từ dữ liệu của Room.</p>
      </header>

      <section className="mt-8 rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-white to-emerald-50/70 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">TỔNG KẾT BUỔI HỌC</p>
        <h2 className="mt-3 text-2xl font-semibold">Nhìn lại những điều lớp học đã chia sẻ.</h2>
        <p className="mt-3 text-[var(--muted)]">Xem review cuối buổi và phản hồi trong từng section.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="inline-flex rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:opacity-90 motion-reduce:transition-none" href={`/teacher/rooms/${summary.room.id}/reviews`}>
            Xem Reviews
          </Link>
          <Link className="inline-flex rounded-xl border border-amber-200 bg-amber-100 px-5 py-3 font-semibold text-amber-950 transition hover:border-amber-300 hover:bg-amber-200 motion-reduce:transition-none" href={`/teacher/rooms/${summary.room.id}/voices`}>
            Xem phản hồi
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-sm text-[var(--muted)]">Sĩ số</p>
          <p className="mt-2 text-3xl font-semibold">{summary.attendance.rosterCount}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-sm text-[var(--muted)]">Có mặt / đã tham gia</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--accent)]">{summary.attendance.joinedCount}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-sm text-[var(--muted)]">Vắng</p>
          <p className="mt-2 text-3xl font-semibold text-red-800">{summary.attendance.absentCount}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-sm text-[var(--muted)]">Total comment</p>
          <p className="mt-2 text-3xl font-semibold">{summary.comments.total}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-sm text-[var(--muted)]">Anonymous</p>
          <p className="mt-2 text-3xl font-semibold">{summary.comments.anonymous}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-sm text-[var(--muted)]">Hiện MSSV</p>
          <p className="mt-2 text-3xl font-semibold">{summary.comments.named}</p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.7fr_0.7fr_1.3fr]">
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold">MSSV đã join</h2>
          {summary.participants.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Không có participant.</p>
          ) : (
            <ol className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {summary.participants.map((participant, index) => (
                <li className="flex min-w-0 items-center gap-3 rounded-xl bg-black/3 px-4 py-2.5" key={`${participant.mssv}-${participant.joinedAt}`}>
                  <span className="w-6 text-xs text-[var(--muted)]">{index + 1}</span>
                  <span className="min-w-0 break-all font-mono font-semibold">{participant.mssv}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold">Danh sách vắng</h2>
          {summary.attendance.absentMssvs.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Không có Student vắng.</p>
          ) : (
            <ol className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {summary.attendance.absentMssvs.map((mssv, index) => (
                <li className="flex min-w-0 items-center gap-3 rounded-xl bg-red-50 px-4 py-2.5" key={mssv}>
                  <span className="w-6 text-xs text-[var(--muted)]">{index + 1}</span>
                  <span className="min-w-0 break-all font-mono font-semibold">{mssv}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold">Reaction breakdown</h2>
          <div className="mt-4 space-y-3">
            {summary.reactions.map((reaction) => (
              <article className="rounded-2xl border border-black/10 p-4" key={reaction.sectionId}>
                <p className="text-xs text-[var(--muted)]">SECTION {reaction.sectionPosition + 1}</p>
                <h3 className="mt-1 font-semibold">{reaction.sectionTitle}</h3>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5">👍 {reaction.understand}</span>
                  <span className="rounded-full bg-amber-50 px-3 py-1.5">🤔 {reaction.unsure}</span>
                  <span className="rounded-full bg-sky-50 px-3 py-1.5">❓ {reaction.question}</span>
                </div>
              </article>
            ))}
          </div>
          {summary.mostEngagedSection ? (
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-emerald-950">
              <p className="text-xs font-semibold">NHIỀU PHẢN HỒI NHẤT</p>
              <p className="mt-1 font-semibold">Section {summary.mostEngagedSection.sectionPosition + 1} · {summary.mostEngagedSection.sectionTitle}</p>
              <p className="mt-1 text-sm">{summary.mostEngagedSection.totalFeedback} reaction và comment</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold">Quiz summary</h2>
        {summary.quizzes.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Không có Quiz đã release.</p>
        ) : (
          <div className="mt-5 space-y-6">
            {summary.quizzes.map((quiz) => (
              <article className="rounded-2xl border border-black/10 p-5" key={quiz.quizId}>
                <h3 className="font-semibold">{quiz.title}</h3>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <span>Completion: <strong>{quiz.submittedCount}/{quiz.participantCount} ({quiz.completionRate}%)</strong></span>
                  <span>Average score: <strong>{quiz.averageScore}/{quiz.totalQuestions}</strong></span>
                </div>
                <div className="mt-4 space-y-2">
                  {quiz.questions.map((question) => (
                    <section className="rounded-xl bg-black/3 px-4 py-3 text-sm" key={question.questionId}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>Câu {question.position + 1}: {question.questionText}</span>
                        <strong>{question.correctPercentage}% đúng</strong>
                      </div>
                      <div className="mt-3 space-y-2" aria-label={`Phân bố câu trả lời câu ${question.position + 1}`}>
                        {question.options.map((option) => (
                          <div className="flex items-center justify-between gap-4 rounded-lg bg-white/80 px-3 py-2" key={option.optionId}>
                            <span className="min-w-0 break-words">{option.content}</span>
                            <span className="shrink-0 font-semibold">{option.selectionCount} chọn</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 border-t border-red-200 pt-8">
        <h2 className="text-lg font-semibold text-red-950">Danger zone</h2>
        <p className="mt-2 mb-5 text-sm leading-6 text-[var(--muted)]">Xóa Room sẽ xóa vĩnh viễn toàn bộ dữ liệu của buổi học.</p>
        <DeleteRoomButton redirectTo={lessonManagementHref} roomId={summary.room.id} />
      </section>
    </main>
  );
}
