/** Let the browser paint between expensive studio tasks so one frame does not swallow the rest. */
export function yieldToMain() {
  return new Promise<void>((resolve) => {
    const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<unknown> } }).scheduler;
    if (typeof scheduler?.yield === "function") {
      scheduler.yield().then(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}
