type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to in-app nav/hub badge invalidation (not the iOS app-icon badge). */
export function subscribeBadgeRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call after medication/appointment pending work changes so chrome badges update immediately. */
export function requestBadgeRefresh(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener failures so one bad subscriber cannot block others.
    }
  });
}
