type OperationRunner<T> = () => Promise<T>;

interface ActiveOperation {
  id: string;
  promise: Promise<unknown>;
}

let activeOperation: ActiveOperation | null = null;

/**
 * Reset the module-level lock. Exported for tests only — production code should
 * never need to call this; the lock is self-releasing via `finally`.
 */
export function resetWalletOperationLock(): void {
  activeOperation = null;
}

/**
 * True when a wallet signing operation is currently in flight anywhere in the
 * application. UI controls can use this to disable buttons globally.
 */
export function isWalletOperationInProgress(): boolean {
  return activeOperation !== null;
}

/**
 * Run a wallet signing operation with application-wide deduplication.
 *
 * - Concurrent calls with the SAME id return the same promise, so rapid clicks
 *   on one control produce exactly one wallet request and one toast sequence.
 * - Concurrent calls with a DIFFERENT id are rejected with a clear message so
 *   the user cannot accidentally stack unrelated signing prompts.
 * - The lock is always released in `finally`, including after cancellation or
 *   rejection, so later actions are never permanently blocked.
 */
export function withWalletOperation<T>(id: string, run: OperationRunner<T>): Promise<T> {
  if (activeOperation) {
    if (activeOperation.id === id) {
      return activeOperation.promise as Promise<T>;
    }
    throw new Error("A wallet operation is already in progress. Please wait for it to finish.");
  }

  const promise = run().finally(() => {
    if (activeOperation?.promise === promise) {
      activeOperation = null;
    }
  });

  activeOperation = { id, promise };
  return promise;
}
