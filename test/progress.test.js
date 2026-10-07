"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  PROGRAM,
  PASS,
  applyRows,
  rememberScore,
  parseProgressScore,
} = require("../js/progress.js");

describe("Day4Progress.applyRows", () => {
  it("ignores rows from other programs", () => {
    const scores = {};
    applyRows(scores, [
      { program: "day5-practice", item: "x", scorePct: 95 },
      { program: PROGRAM, item: "a1", scorePct: 88 },
    ]);
    assert.equal(Object.keys(scores).length, 1);
    assert.equal(scores.a1.score, 88);
  });

  it("merges more than 20 rows with max score per item", () => {
    const scores = {};
    const rows = [];
    for (let i = 0; i < 30; i++) {
      rows.push({ program: PROGRAM, item: "item-" + i, scorePct: 70 + i });
    }
    applyRows(scores, rows);
    assert.equal(Object.keys(scores).length, 30);
    assert.equal(scores["item-29"].score, 99);
  });

  it("unions batches without lowering scores or un-completing passes", () => {
    const scores = {};
    applyRows(scores, [{ program: PROGRAM, item: "dog", scorePct: 90 }]);
    applyRows(scores, [{ program: PROGRAM, item: "dog", scorePct: 50 }]);
    assert.equal(scores.dog.score, 90);
    assert.equal(scores.dog.passed, true);

    applyRows(scores, [
      { program: PROGRAM, item: "cat", scorePct: 75, correctness: "incorrect" },
    ]);
    applyRows(scores, [
      { program: PROGRAM, item: "cat", scorePct: 85, correctness: "correct" },
    ]);
    assert.equal(scores.cat.score, 85);
    assert.equal(scores.cat.passed, true);
  });

  it("parses slash and percent score strings", () => {
    assert.equal(parseProgressScore("4 / 5"), 80);
    assert.equal(parseProgressScore("92"), 92);
    assert.equal(parseProgressScore(""), null);
  });

  it("rememberScore keeps passed when a later row is weaker", () => {
    const scores = {};
    rememberScore(scores, "u1", 95, true);
    rememberScore(scores, "u1", 60, false);
    assert.equal(scores.u1.score, 95);
    assert.equal(scores.u1.passed, true);
    assert.equal(PASS, 80);
  });
});
