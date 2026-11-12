// Calls fn until it succeeds. It never stops, so a permanent failure hangs the caller.
export async function retry(fn) {
  for (;;) {
    try {
      return await fn();
    } catch {
      // try again
    }
  }
}
