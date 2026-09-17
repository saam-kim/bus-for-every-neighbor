import {summary} from './engine.js';

// Only completed runs belong in the teacher's results, never design forecasts.
export function completedProgress(state, mode) {
  const attempts = state.attempts || [];
  const latest = attempts.at(-1);
  return {
    mode, attempts: attempts.length,
    reflectionDone: (state.reflections || []).filter(x => x.trim()).length,
    summary: latest ? summary(latest.results) : null,
    results: latest?.results || null,
    design: latest?.design || null,
  };
}

// Coalesce edits, serialize writes, and ignore identical render notifications.
export function createSyncQueue(send, onStatus, delay = 450) {
  let latest, sentKey = '', timer, inFlight = false;
  function enqueue(payload) {
    latest = {key: JSON.stringify(payload), payload};
    if (inFlight || latest.key === sentKey) return;
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }
  async function flush() {
    clearTimeout(timer);
    if (inFlight || !latest || latest.key === sentKey) return;
    const snapshot = latest;
    inFlight = true;
    try {
      await send(snapshot.payload);
      sentKey = snapshot.key;
      onStatus(true);
    } catch {
      onStatus(false);
    } finally {
      inFlight = false;
    }
    // A failed write retries on the next edit or online event, not in a loop.
    if (latest.key !== snapshot.key) enqueue(latest.payload);
  }
  return {enqueue, flush};
}
