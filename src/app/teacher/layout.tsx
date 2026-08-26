import type { ReactNode } from "react";

import { TeacherAccountMenu } from "@/features/auth/components/teacher-account-menu";
import { requireTeacher } from "@/features/auth/teacher-session";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  await requireTeacher();

  return (
    <>
      <TeacherAccountMenu />
      {children}
    </>
  );
}
