/** Day 4 Speak — server progress rows → in-memory item scores (testable). */
(function (global) {
  "use strict";

  var PROGRAM = "day4-speak";
  var PASS = 80;

  function parseProgressScore(raw) {
    var text = String(raw == null ? "" : raw).trim();
    if (!text) return null;
    var slash = text.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (slash) {
      var value = Number(slash[1]);
      var max = Number(slash[2]);
      if (max) return Math.round((value / max) * 100);
      return Math.round(value);
    }
    var pct = text.match(/(\d+(?:\.\d+)?)/);
    if (!pct) return null;
    return Math.round(Number(pct[1]));
  }

  function rememberScore(savedScores, itemId, score, passed) {
    if (!itemId || !Number.isFinite(score)) return;
    var prev = savedScores[itemId];
    var pass = !!passed || score >= PASS;
    if (!prev || score > prev.score) {
      savedScores[itemId] = {
        score: score,
        passed: pass || !!(prev && prev.passed),
      };
      return;
    }
    if (pass) prev.passed = true;
  }

  function applyRows(savedScores, rows, program) {
    if (!savedScores || !Array.isArray(rows)) return savedScores;
    var prog = program || PROGRAM;
    rows.forEach(function (row) {
      if (!row || String(row.program || "") !== prog) return;
      var itemId = String(row.item || row.itemId || "").trim();
      var score = parseProgressScore(
        row.score != null
          ? row.score
          : row.scorePct != null
            ? row.scorePct
            : row.scoreValue
      );
      if (score == null) return;
      rememberScore(
        savedScores,
        itemId,
        score,
        score >= PASS || row.correctness === "correct"
      );
    });
    return savedScores;
  }

  var api = {
    PROGRAM: PROGRAM,
    PASS: PASS,
    parseProgressScore: parseProgressScore,
    rememberScore: rememberScore,
    applyRows: applyRows,
  };

  global.Day4Progress = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : global);
