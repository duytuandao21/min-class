import { afterEach, describe, expect, it, vi } from "vitest";

import { createDegradedPollingController, createRealtimeSyncCoordinator } from "./realtime-sync";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("Realtime sync coordinator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces a burst of realtime events into one fetch", async () => {
    vi.useFakeTimers();
    const fetchSnapshot = vi.fn().mockResolvedValue("latest");
    const onSuccess = vi.fn();
    const coordinator = createRealtimeSyncCoordinator({ fetchSnapshot, onError: vi.fn(), onSuccess });

    coordinator.request();
    coordinator.request();
    coordinator.request();
    await vi.advanceTimersByTimeAsync(150);

    expect(fetchSnapshot).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith("latest");
  });

  it("coalesces events received during a fetch into one following fetch", async () => {
    const first = deferred<string>();
    const fetchSnapshot = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce("second");
    const onSuccess = vi.fn();
    const coordinator = createRealtimeSyncCoordinator({ fetchSnapshot, onError: vi.fn(), onSuccess });

    coordinator.syncNow();
    coordinator.syncNow();
    coordinator.request();
    expect(fetchSnapshot).toHaveBeenCalledOnce();

    first.resolve("first");
    await first.promise;
    await vi.waitFor(() => expect(fetchSnapshot).toHaveBeenCalledTimes(2));

    expect(onSuccess).toHaveBeenNthCalledWith(1, "first");
    expect(onSuccess).toHaveBeenNthCalledWith(2, "second");
  });

  it("does not update state after disposal", async () => {
    const pending = deferred<string>();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const coordinator = createRealtimeSyncCoordinator({
      fetchSnapshot: () => pending.promise,
      onError,
      onSuccess,
    });

    coordinator.syncNow();
    coordinator.dispose();
    pending.resolve("late");
    await pending.promise;
    await Promise.resolve();

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("degraded realtime polling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls only after fallback starts and stops immediately after recovery", async () => {
    vi.useFakeTimers();
    const requestSync = vi.fn();
    const polling = createDegradedPollingController({
      isVisible: () => true,
      requestSync,
    });

    await vi.advanceTimersByTimeAsync(9_000);
    expect(requestSync).not.toHaveBeenCalled();

    polling.start();
    polling.start();
    expect(requestSync).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(requestSync).toHaveBeenCalledTimes(3);

    polling.stop();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(requestSync).toHaveBeenCalledTimes(3);
  });

  it("does not poll while the page is hidden", async () => {
    vi.useFakeTimers();
    const requestSync = vi.fn();
    const polling = createDegradedPollingController({
      isVisible: () => false,
      requestSync,
    });

    polling.start();
    await vi.advanceTimersByTimeAsync(6_000);

    expect(requestSync).toHaveBeenCalledOnce();
    polling.stop();
  });
});
