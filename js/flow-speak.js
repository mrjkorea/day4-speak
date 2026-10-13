/** Unit rush timer + mic policy (mirrors pronounce flow). */

export const UNIT_LIMIT_SEC = 120;

export function timerSeconds() {
  return UNIT_LIMIT_SEC;
}

export function startUnitTimer(now = Date.now()) {
  return { startedAt: now, limitSec: UNIT_LIMIT_SEC };
}

export function unitTimerRunning(timer, now = Date.now()) {
  if (!timer || !timer.startedAt) return false;
  if (timer.stoppedAt) return false;
  return now - timer.startedAt < timer.limitSec * 1000;
}

export function secondsLeft(timer, now = Date.now()) {
  if (!timer || !timer.startedAt) return timerSeconds();
  if (timer.stoppedAt) return 0;
  const left = timer.limitSec - (now - timer.startedAt) / 1000;
  return Math.max(0, Math.ceil(left));
}

export function stopUnitTimer(timer, now = Date.now()) {
  if (!timer || !timer.startedAt || timer.stoppedAt) return timer;
  return Object.assign({}, timer, { stoppedAt: now });
}

/**
 * Next mic while a grade runs; block only during an active take.
 */
export function canStartMic({ recording, timerRunning, checkerReady, heardCue }) {
  if (!checkerReady || !heardCue) return false;
  if (recording) return false;
  if (!timerRunning) return false;
  return true;
}
