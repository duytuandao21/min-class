import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  loginTeacherAction,
  logoutTeacherAction,
  type TeacherAuthState,
} from "./actions";
import { requireTeacher } from "./teacher-session";

const redirectSignal = new Error("NEXT_REDIRECT");
const initialTeacherAuthState: TeacherAuthState = { status: "idle" };
const testPassword = "minclass";

function credentials(username = "thaybao", password = testPassword) {
  const formData = new FormData();
  formData.set("username", username);
  formData.set("password", password);
  return formData;
}

describe("Teacher authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation(() => {
      throw redirectSignal;
    });
  });

  it("logs in with valid credentials", async () => {
    const auth = {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: { id: "teacher", email: "thaybao@minclass.local", is_anonymous: false } },
        error: null,
      }),
    };
    mocks.createClient.mockResolvedValue({ auth });

    await expect(loginTeacherAction(initialTeacherAuthState, credentials())).rejects.toBe(redirectSignal);

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "thaybao@minclass.local",
      password: testPassword,
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/teacher/subjects");
  });

  it("rejects an incorrect login without redirecting", async () => {
    const auth = {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid login credentials" },
      }),
    };
    mocks.createClient.mockResolvedValue({ auth });

    const result = await loginTeacherAction(initialTeacherAuthState, credentials());

    expect(result).toEqual({ status: "error", message: "Tên đăng nhập hoặc mật khẩu không đúng." });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("rejects every username except thaybao before calling Supabase", async () => {
    const result = await loginTeacherAction(
      initialTeacherAuthState,
      credentials("another-teacher"),
    );

    expect(result.status).toBe("error");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("logs out the current Teacher session", async () => {
    const auth = { signOut: vi.fn().mockResolvedValue({ error: null }) };
    mocks.createClient.mockResolvedValue({ auth });

    await expect(logoutTeacherAction()).rejects.toBe(redirectSignal);

    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).toHaveBeenCalledWith("/teacher/login");
  });

  it("allows a permanent user through the protected Teacher guard", async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "teacher", email: "thaybao@minclass.local", is_anonymous: false } },
          error: null,
        }),
      },
    });

    await expect(requireTeacher()).resolves.toEqual({
      id: "teacher",
      email: "thaybao@minclass.local",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["an unauthenticated request", null],
    ["an anonymous Student session", { id: "student", is_anonymous: true }],
    ["another permanent Supabase user", { id: "other", email: "other@example.com", is_anonymous: false }],
  ])("blocks %s from protected Teacher routes", async (_label, user) => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    });

    await expect(requireTeacher()).rejects.toBe(redirectSignal);
    expect(mocks.redirect).toHaveBeenCalledWith("/teacher/login");
  });
});
