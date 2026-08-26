"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { TEACHER_AUTH_EMAIL } from "@/features/auth/teacher-session";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  username: z.string().trim().toLowerCase().pipe(z.literal("thaybao", {
    error: "Tên đăng nhập hoặc mật khẩu không đúng.",
  })),
  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
    .max(72, "Mật khẩu không được vượt quá 72 ký tự."),
});

export type TeacherAuthState = {
  status: "idle" | "error" | "success";
  fieldErrors?: { username?: string[]; password?: string[] };
  message?: string;
};

function validateCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
}

export async function loginTeacherAction(
  _previousState: TeacherAuthState,
  formData: FormData,
): Promise<TeacherAuthState> {
  const input = validateCredentials(formData);
  if (!input.success) {
    const errors = input.error.flatten().fieldErrors;
    return {
      status: "error",
      fieldErrors: { username: errors.username, password: errors.password },
      message: "Tên đăng nhập hoặc mật khẩu không đúng.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEACHER_AUTH_EMAIL,
    password: input.data.password,
  });

  if (
    error
    || !data.user
    || data.user.is_anonymous
    || data.user.email?.toLowerCase() !== TEACHER_AUTH_EMAIL
  ) {
    return { status: "error", message: "Tên đăng nhập hoặc mật khẩu không đúng." };
  }

  revalidatePath("/", "layout");
  redirect("/teacher/subjects");
}

export async function logoutTeacherAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Không thể đăng xuất. Hãy thử lại.");
  revalidatePath("/", "layout");
  redirect("/teacher/login");
}
