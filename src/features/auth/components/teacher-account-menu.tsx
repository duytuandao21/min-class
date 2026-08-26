import { logoutTeacherAction } from "@/features/auth/actions";

export function TeacherAccountMenu() {
  return (
    <form action={logoutTeacherAction} className="fixed top-4 right-4 z-50">
      <button className="rounded-xl border border-black/15 bg-white/95 px-4 py-2.5 text-sm font-semibold shadow-sm backdrop-blur transition hover:border-red-300 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-700" type="submit">
        Đăng xuất
      </button>
    </form>
  );
}
