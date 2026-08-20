"use client";

import { useRef, useState } from "react";

import { commentBodySchema, reactionOptions, type Reaction } from "@/features/rooms/feedback";
import { createSectionComment, setSectionReaction } from "@/features/rooms/feedback-client";

type SectionReflectionProps = {
  sectionId: string;
  selectedReaction?: Reaction;
  onReactionChange: (reaction: Reaction | undefined) => void;
};

export function SectionReflection({ sectionId, selectedReaction, onReactionChange }: SectionReflectionProps) {
  const persistedReactionRef = useRef(selectedReaction);
  const desiredReactionRef = useRef(selectedReaction);
  const savingReactionRef = useRef(false);
  const [isSavingReaction, setIsSavingReaction] = useState(false);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSent, setCommentSent] = useState(false);

  async function persistDesiredReaction() {
    if (savingReactionRef.current) return;
    savingReactionRef.current = true;
    setIsSavingReaction(true);

    while (desiredReactionRef.current !== undefined && desiredReactionRef.current !== persistedReactionRef.current) {
      const targetReaction = desiredReactionRef.current;
      try {
        await setSectionReaction(sectionId, targetReaction);
        persistedReactionRef.current = targetReaction;
        setReactionError(null);
      } catch {
        desiredReactionRef.current = persistedReactionRef.current;
        onReactionChange(persistedReactionRef.current);
        setReactionError("Không thể lưu reaction. Hãy thử lại.");
        break;
      }
    }

    savingReactionRef.current = false;
    setIsSavingReaction(false);
    if (desiredReactionRef.current !== persistedReactionRef.current) void persistDesiredReaction();
  }

  function chooseReaction(reaction: Reaction) {
    desiredReactionRef.current = reaction;
    onReactionChange(reaction);
    setReactionError(null);
    void persistDesiredReaction();
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedBody = commentBodySchema.safeParse(comment);
    if (!parsedBody.success) {
      setCommentError(parsedBody.error.issues[0]?.message ?? "Comment không hợp lệ.");
      return;
    }

    setIsSendingComment(true);
    setCommentError(null);
    setCommentSent(false);
    try {
      await createSectionComment(sectionId, parsedBody.data, isAnonymous);
      setComment("");
      setCommentSent(true);
    } catch {
      setCommentError("Không thể gửi comment. Hãy thử lại.");
    } finally {
      setIsSendingComment(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
      <h3 className="text-xl font-semibold">Reflection</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Phản hồi nhanh để thầy/cô biết bạn đang theo kịp tới đâu.</p>

      <div className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="Reaction cho section">
        {reactionOptions.map((option) => {
          const isSelected = selectedReaction === option.value;
          return (
            <button
              aria-pressed={isSelected}
              className={`rounded-2xl border px-4 py-3 text-left transition ${isSelected ? "border-[var(--accent)] bg-emerald-50 text-emerald-950" : "border-black/10 hover:border-black/30"}`}
              key={option.value}
              onClick={() => chooseReaction(option.value)}
              type="button"
            >
              <span className="mr-2 text-xl" aria-hidden>{option.emoji}</span>
              <span className="font-semibold">{option.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 min-h-5 text-xs" aria-live="polite">
        {isSavingReaction ? <span className="text-[var(--muted)]">Đang lưu reaction…</span> : null}
        {reactionError ? <span className="text-red-700" role="alert">{reactionError}</span> : null}
      </div>

      <form className="mt-5 border-t border-black/10 pt-6" onSubmit={submitComment}>
        <label className="font-semibold" htmlFor={`comment-${sectionId}`}>Comment</label>
        <textarea
          className="mt-3 min-h-28 w-full resize-y rounded-2xl border border-black/15 bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
          disabled={isSendingComment}
          id={`comment-${sectionId}`}
          maxLength={500}
          onChange={(event) => {
            setComment(event.target.value);
            setCommentError(null);
            setCommentSent(false);
          }}
          placeholder="Bạn muốn thầy/cô giải thích thêm điều gì?"
          value={comment}
        />
        <div className="mt-2 flex items-center justify-between gap-4 text-xs text-[var(--muted)]">
          <span>1–500 ký tự</span>
          <span>{comment.length}/500</span>
        </div>

        <fieldset className="mt-4 flex flex-wrap gap-5">
          <legend className="sr-only">Danh tính hiển thị</legend>
          <label className="flex cursor-pointer items-center gap-2">
            <input checked={!isAnonymous} disabled={isSendingComment} name={`identity-${sectionId}`} onChange={() => setIsAnonymous(false)} type="radio" />
            <span>Hiện MSSV</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input checked={isAnonymous} disabled={isSendingComment} name={`identity-${sectionId}`} onChange={() => setIsAnonymous(true)} type="radio" />
            <span>Ẩn danh</span>
          </label>
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button className="rounded-xl bg-[var(--accent)] px-5 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" disabled={isSendingComment} type="submit">
            {isSendingComment ? "Đang gửi…" : "Gửi comment"}
          </button>
          <div className="text-sm" aria-live="polite">
            {commentSent ? <span className="text-emerald-800">Đã gửi comment.</span> : null}
            {commentError ? <span className="text-red-700" role="alert">{commentError}</span> : null}
          </div>
        </div>
      </form>
    </section>
  );
}
