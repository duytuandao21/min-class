"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createCourseSectionAction,
  createSubjectAction,
  deleteCourseSectionAction,
  deleteSubjectAction,
  type ManagementActionState,
  updateCourseSectionAction,
  updateSubjectAction,
} from "@/features/subjects/actions";
import type { CourseSection, Subject } from "@/features/subjects/server/queries";

const inputClassName = "mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15";
const primaryButtonClassName = "rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";
const cancelButtonClassName = "rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-bold text-[#263129] shadow-sm transition hover:border-black/35 hover:bg-black/5";
const initialManagementActionState: ManagementActionState = { status: "idle" };

function DeleteSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="min-h-11 rounded-xl bg-red-700 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      disabled={pending}
      type="submit"
    >
      {pending ? "Đang xóa…" : label}
    </button>
  );
}

function DeleteConfirmationDialog({
  action,
  confirmLabel,
  description,
  onCancel,
  title,
}: {
  action: () => Promise<void>;
  confirmLabel: string;
  description: string;
  onCancel: () => void;
  title: string;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]">
      <div
        aria-describedby="delete-confirmation-description"
        aria-labelledby="delete-confirmation-title"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-red-200 bg-[#fff8f6] p-6 shadow-2xl sm:p-7"
        role="alertdialog"
      >
        <div aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-100 text-2xl font-black text-red-700">
          !
        </div>
        <h3 className="mt-5 text-xl font-bold text-red-950" id="delete-confirmation-title">{title}</h3>
        <p className="mt-3 leading-7 text-red-900/85" id="delete-confirmation-description">{description}</p>
        <p className="mt-3 text-sm font-semibold text-red-800">Thao tác này không thể hoàn tác.</p>
        <form action={action} className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-xl border border-black/20 bg-white px-5 py-2.5 font-bold text-[#263129] shadow-sm transition hover:border-black/35 hover:bg-black/5 motion-reduce:transition-none"
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            Hủy
          </button>
          <DeleteSubmitButton label={confirmLabel} />
        </form>
      </div>
    </div>
  );
}

function FormMessage({ state }: { state: { status: string; message?: string } }) {
  if (!state.message) return null;
  return (
    <p
      className={`mt-4 rounded-xl p-3 text-sm ${state.status === "success" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  return messages?.[0] ? <p className="mt-1 text-sm text-red-700">{messages[0]}</p> : null;
}

export function CreateSubjectForm() {
  const [state, action, pending] = useActionState(createSubjectAction, initialManagementActionState);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        aria-expanded={open}
        className={primaryButtonClassName}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        + Thêm môn học
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4 backdrop-blur-[2px]">
        <form action={action} aria-labelledby="create-subject-title" aria-modal="true" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-2xl sm:p-7" role="dialog">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-semibold" id="create-subject-title">Thêm môn học</h3>
            <button className={cancelButtonClassName} onClick={() => setOpen(false)} type="button">Hủy</button>
          </div>
          <label className="mt-5 block font-semibold" htmlFor="subject-name">Tên môn học</label>
          <input aria-describedby="subject-name-error" autoFocus className={inputClassName} id="subject-name" maxLength={120} name="name" required />
          <div id="subject-name-error"><FieldError messages={state.fieldErrors?.name} /></div>
          <label className="mt-5 block font-semibold" htmlFor="subject-code">Mã môn học <span className="font-normal text-[var(--muted)]">(không bắt buộc)</span></label>
          <input aria-describedby="subject-code-error" autoCapitalize="characters" className={inputClassName} id="subject-code" maxLength={32} name="code" />
          <div id="subject-code-error"><FieldError messages={state.fieldErrors?.code} /></div>
          <FormMessage state={state} />
          <button className={`mt-6 w-full ${primaryButtonClassName}`} disabled={pending} type="submit">{pending ? "Đang tạo…" : "Tạo môn học"}</button>
        </form>
        </div>
      ) : null}
    </div>
  );
}

export function EditSubjectForm({ subject }: { subject: Subject }) {
  const actionWithId = updateSubjectAction.bind(null, subject.id);
  const [open, setOpen] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const [state, action, pending] = useActionState(async (previousState: ManagementActionState, formData: FormData) => {
    const result = await actionWithId(previousState, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, initialManagementActionState);

  function cancelDelete() {
    setIsDeleteConfirming(false);
    window.setTimeout(() => deleteTriggerRef.current?.focus(), 0);
  }

  return (
    <div className="relative shrink-0">
      <button aria-expanded={open} className="rounded-xl border border-black/15 bg-white px-5 py-3 font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]" onClick={() => setOpen((current) => !current)} type="button">
        Chỉnh sửa thông tin môn học
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4 backdrop-blur-[2px]">
        <div aria-labelledby="edit-subject-title" aria-modal="true" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-2xl sm:p-7" role="dialog">
          <form action={action}>
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-semibold" id="edit-subject-title">Thông tin môn học</h3>
              <button className={cancelButtonClassName} onClick={() => setOpen(false)} type="button">Hủy</button>
            </div>
            <label className="mt-5 block font-semibold" htmlFor="edit-subject-name">Tên môn học</label>
            <input className={inputClassName} defaultValue={subject.name} id="edit-subject-name" maxLength={120} name="name" required />
            <FieldError messages={state.fieldErrors?.name} />
            <label className="mt-5 block font-semibold" htmlFor="edit-subject-code">Mã môn học <span className="font-normal text-[var(--muted)]">(không bắt buộc)</span></label>
            <input autoCapitalize="characters" className={inputClassName} defaultValue={subject.code ?? ""} id="edit-subject-code" maxLength={32} name="code" />
            <FieldError messages={state.fieldErrors?.code} />
            <FormMessage state={state} />
            <button className={`mt-6 w-full ${primaryButtonClassName}`} disabled={pending} type="submit">{pending ? "Đang lưu…" : "Lưu thay đổi"}</button>
          </form>
          <div className="mt-5 border-t border-black/10 pt-5">
            <button
              className="w-full rounded-xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-700 transition hover:bg-red-50 motion-reduce:transition-none"
              onClick={() => setIsDeleteConfirming(true)}
              ref={deleteTriggerRef}
              type="button"
            >
              Xóa môn học
            </button>
          </div>
          {isDeleteConfirming ? (
            <DeleteConfirmationDialog
              action={deleteSubjectAction.bind(null, subject.id)}
              confirmLabel="Xóa môn học"
              description={`Môn học “${subject.name}” cùng các lớp học phần và dữ liệu thuộc môn học sẽ bị xóa vĩnh viễn.`}
              onCancel={cancelDelete}
              title="Xóa môn học này?"
            />
          ) : null}
        </div>
        </div>
      ) : null}
    </div>
  );
}

export function CreateCourseSectionForm({ subjectId }: { subjectId: string }) {
  const actionWithSubject = createCourseSectionAction.bind(null, subjectId);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previousState: ManagementActionState, formData: FormData) => {
    const result = await actionWithSubject(previousState, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, initialManagementActionState);
  return (
    <div className="relative shrink-0">
      <button aria-expanded={open} className={primaryButtonClassName} onClick={() => setOpen((current) => !current)} type="button">+ Thêm lớp học phần</button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4 backdrop-blur-[2px]">
        <form action={action} aria-labelledby="create-course-section-title" aria-modal="true" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-2xl sm:p-7" role="dialog">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-semibold" id="create-course-section-title">Thêm lớp học phần</h3>
            <button className={cancelButtonClassName} onClick={() => setOpen(false)} type="button">Hủy</button>
          </div>
          <label className="mt-5 block font-semibold" htmlFor="new-section-code">Mã lớp học phần</label>
          <input autoCapitalize="characters" autoFocus className={inputClassName} id="new-section-code" maxLength={32} name="sectionCode" placeholder="24110NETW42001" required />
          <FieldError messages={state.fieldErrors?.sectionCode} />
          <label className="mt-5 block font-semibold" htmlFor="new-section-name">Tên hiển thị <span className="font-normal text-[var(--muted)]">(không bắt buộc)</span></label>
          <input className={inputClassName} id="new-section-name" maxLength={120} name="displayName" placeholder="Ca sáng" />
          <FieldError messages={state.fieldErrors?.displayName} />
          <FormMessage state={state} />
          <button className={`mt-6 w-full ${primaryButtonClassName}`} disabled={pending} type="submit">{pending ? "Đang thêm…" : "Thêm lớp học phần"}</button>
        </form>
        </div>
      ) : null}
    </div>
  );
}

export function CourseSectionEditor({ courseSection }: { courseSection: CourseSection }) {
  const updateWithIds = updateCourseSectionAction.bind(null, courseSection.subject_id, courseSection.id);
  const [open, setOpen] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const [state, action, pending] = useActionState(async (previousState: ManagementActionState, formData: FormData) => {
    const result = await updateWithIds(previousState, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, initialManagementActionState);

  function cancelDelete() {
    setIsDeleteConfirming(false);
    window.setTimeout(() => deleteTriggerRef.current?.focus(), 0);
  }

  return (
    <article className="relative rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md">
      <Link className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]" href={`/teacher/subjects/${courseSection.subject_id}/sections/${courseSection.id}`}>
        <span className="block text-lg font-semibold text-[var(--accent)]">{courseSection.section_code}</span>
        <span className="mt-2 block min-h-6 text-sm text-[var(--muted)]">{courseSection.display_name ?? "Chưa có tên hiển thị"}</span>
      </Link>
      <div className="mt-5 flex items-center gap-3 border-t border-black/10 pt-4">
        <button className="rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]" onClick={() => setOpen((current) => !current)} type="button">Chỉnh sửa</button>
        <button
          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 motion-reduce:transition-none"
          onClick={() => setIsDeleteConfirming(true)}
          ref={deleteTriggerRef}
          type="button"
        >
          Xóa
        </button>
      </div>
      {isDeleteConfirming ? (
        <DeleteConfirmationDialog
          action={deleteCourseSectionAction.bind(null, courseSection.subject_id, courseSection.id)}
          confirmLabel="Xóa lớp học phần"
          description={`Lớp học phần “${courseSection.section_code}” cùng roster, bài học và dữ liệu liên quan sẽ bị xóa vĩnh viễn.`}
          onCancel={cancelDelete}
          title="Xóa lớp học phần này?"
        />
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4 backdrop-blur-[2px]">
        <form action={action} aria-labelledby={`edit-course-section-title-${courseSection.id}`} aria-modal="true" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-2xl" role="dialog">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold" id={`edit-course-section-title-${courseSection.id}`}>Chỉnh sửa lớp học phần</h3>
            <button className={cancelButtonClassName} onClick={() => setOpen(false)} type="button">Hủy</button>
          </div>
          <label className="mt-5 block text-sm font-semibold" htmlFor={`section-code-${courseSection.id}`}>Mã lớp học phần</label>
          <input autoCapitalize="characters" className={inputClassName} defaultValue={courseSection.section_code} id={`section-code-${courseSection.id}`} maxLength={32} name="sectionCode" required />
          <FieldError messages={state.fieldErrors?.sectionCode} />
          <label className="mt-4 block text-sm font-semibold" htmlFor={`section-name-${courseSection.id}`}>Tên hiển thị</label>
          <input className={inputClassName} defaultValue={courseSection.display_name ?? ""} id={`section-name-${courseSection.id}`} maxLength={120} name="displayName" />
          <FieldError messages={state.fieldErrors?.displayName} />
          <FormMessage state={state} />
          <button className={`mt-6 w-full ${primaryButtonClassName}`} disabled={pending} type="submit">{pending ? "Đang lưu…" : "Lưu thay đổi"}</button>
        </form>
        </div>
      ) : null}
    </article>
  );
}
