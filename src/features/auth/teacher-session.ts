import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const TEACHER_AUTH_EMAIL = "thaybao@minclass.local";

export type TeacherIdentity = {
  id: string;
  email: string;
};

export async function getTeacherIdentity(): Promise<TeacherIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (
    error
    || !user
    || user.is_anonymous
    || user.email?.toLowerCase() !== TEACHER_AUTH_EMAIL
  ) return null;

  return { id: user.id, email: TEACHER_AUTH_EMAIL };
}

export async function requireTeacher(): Promise<TeacherIdentity> {
  const teacher = await getTeacherIdentity();
  if (!teacher) redirect("/teacher/login");
  return teacher;
}
