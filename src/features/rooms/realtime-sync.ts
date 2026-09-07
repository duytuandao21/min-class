export type RealtimeSyncCoordinator = {
  dispose: () => void;
  request: () => void;
  syncNow: () => void;
};

export type DegradedPollingController = {
  start: () => void;
  stop: () => void;
};

export function createDegradedPollingController({
  intervalMs = 3_000,
  isVisible,
  requestSync,
}: {
  intervalMs?: number;
  isVisible: () => boolean;
  requestSync: () => void;
}): DegradedPollingController {
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      if (timer !== null) return;
      requestSync();
      timer = setInterval(() => {
        if (isVisible()) requestSync();
      }, intervalMs);
    },
    stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    },
  };
}

export function createRealtimeSyncCoordinator<T>({
  debounceMs = 150,
  fetchSnapshot,
  onError,
  onSuccess,
}: {
  debounceMs?: number;
  fetchSnapshot: () => Promise<T>;
  onError: (error: unknown) => void;
  onSuccess: (snapshot: T) => void;
}): RealtimeSyncCoordinator {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let pendingAfterCurrentSync = false;
  let syncing = false;

  function clearDebounceTimer() {
    if (debounceTimer === null) return;
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  async function run() {
    if (disposed) return;
    if (syncing) {
      pendingAfterCurrentSync = true;
      return;
    }

    syncing = true;
    try {
      const snapshot = await fetchSnapshot();
      if (!disposed) onSuccess(snapshot);
    } catch (error) {
      if (!disposed) onError(error);
    } finally {
      syncing = false;
      if (pendingAfterCurrentSync && !disposed) {
        pendingAfterCurrentSync = false;
        void run();
      }
    }
  }

  return {
    dispose() {
      disposed = true;
      pendingAfterCurrentSync = false;
      clearDebounceTimer();
    },
    request() {
      if (disposed) return;
      if (syncing) {
        pendingAfterCurrentSync = true;
        return;
      }

      clearDebounceTimer();
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void run();
      }, debounceMs);
    },
    syncNow() {
      if (disposed) return;
      clearDebounceTimer();
      void run();
    },
  };
}
