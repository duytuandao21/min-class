import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
  getSupabaseConfig: vi.fn(() => ({ publishableKey: "test-key", url: "https://example.supabase.co" })),
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient: mocks.createBrowserClient }));
vi.mock("./config", () => ({ getSupabaseConfig: mocks.getSupabaseConfig }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("anonymous browser session bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("deduplicates concurrent session initialization", async () => {
    const pendingSession = deferred<{ data: { session: { access_token: string } }; error: null }>();
    const getSession = vi.fn(() => pendingSession.promise);
    mocks.createBrowserClient.mockReturnValue({
      auth: { getSession, signInAnonymously: vi.fn() },
    });
    const { ensureAnonymousSession } = await import("./client");

    const first = ensureAnonymousSession();
    const second = ensureAnonymousSession();
    expect(first).toBe(second);
    expect(getSession).toHaveBeenCalledOnce();

    pendingSession.resolve({ data: { session: { access_token: "token" } }, error: null });
    await Promise.all([first, second]);
  });

  it("creates an anonymous session only when no session exists", async () => {
    const signInAnonymously = vi.fn().mockResolvedValue({ error: null });
    mocks.createBrowserClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInAnonymously,
      },
    });
    const { ensureAnonymousSession } = await import("./client");

    await ensureAnonymousSession();

    expect(signInAnonymously).toHaveBeenCalledOnce();
  });

  it("allows a retry after initialization fails", async () => {
    const getSession = vi.fn()
      .mockResolvedValueOnce({ data: { session: null }, error: new Error("offline") })
      .mockResolvedValueOnce({ data: { session: { access_token: "token" } }, error: null });
    mocks.createBrowserClient.mockReturnValue({
      auth: { getSession, signInAnonymously: vi.fn() },
    });
    const { ensureAnonymousSession } = await import("./client");

    await expect(ensureAnonymousSession()).rejects.toThrow("offline");
    await expect(ensureAnonymousSession()).resolves.toBeUndefined();
    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
