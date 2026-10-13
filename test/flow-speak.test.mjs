import test from "node:test";
import assert from "node:assert/strict";
import {
  UNIT_LIMIT_SEC,
  timerSeconds,
  canStartMic,
  unitTimerRunning,
  secondsLeft,
  startUnitTimer,
} from "../js/flow-speak.js";

test("unit timer is 120 seconds", () => {
  assert.equal(timerSeconds(), 120);
  assert.equal(UNIT_LIMIT_SEC, 120);
});

test("canStartMic allows next take while grading", () => {
  assert.equal(
    canStartMic({
      recording: false,
      timerRunning: true,
      checkerReady: true,
      heardCue: true,
    }),
    true
  );
});

test("canStartMic blocks during recording", () => {
  assert.equal(
    canStartMic({
      recording: true,
      timerRunning: true,
      checkerReady: true,
      heardCue: true,
    }),
    false
  );
});

test("unit timer counts down", () => {
  const t0 = 1_000_000;
  const timer = startUnitTimer(t0);
  assert.equal(unitTimerRunning(timer, t0 + 119_000), true);
  assert.equal(secondsLeft(timer, t0 + 61_000), 59);
  assert.equal(unitTimerRunning(timer, t0 + 120_001), false);
});
