"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const BUILD = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../version.json"), "utf8")
).build;
const TEST_STUDENT = "zz_test_mrjmetrics";
const PROGRAM = "day4-speak";

function loadMrjScores(context) {
  const src = fs.readFileSync(path.join(__dirname, "../mrj-scores.js"), "utf8");
  vm.runInNewContext(src, context, { filename: "mrj-scores.js" });
}

function makeContext(overrides) {
  const noteScoreCalls = [];
  const fetchCalls = [];
  const store = {};

  const localStorage = {
    getItem(k) {
      return store[k] ?? null;
    },
    setItem(k, v) {
      store[k] = String(v);
    },
  };

  const ctx = {
    console,
    Date,
    Math,
    JSON,
    Promise,
    fetch(url, init) {
      fetchCalls.push({ url, init });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });
    },
    localStorage,
    MRJ_AUTH: {
      student: () => TEST_STUDENT,
      noteScore: (payload) => noteScoreCalls.push(payload),
    },
    MRJ_SCORES: null,
    addEventListener() {},
    window: null,
  };
  ctx.window = ctx;

  Object.assign(ctx, overrides);
  if (overrides && overrides.MRJ_AUTH) {
    ctx.MRJ_AUTH = overrides.MRJ_AUTH;
  }
  ctx.window = ctx;
  loadMrjScores(ctx);
  return { ctx, noteScoreCalls, fetchCalls };
}

describe("mrj-scores student identity", () => {
  it("signed in posts student_email, session_id, and noteScore with localDate", async () => {
    const fixed = new Date("2026-10-11T12:00:00");
    const { ctx, noteScoreCalls, fetchCalls } = makeContext({ Date: class extends Date {
      constructor(...args) {
        if (args.length === 0) super(fixed.getTime());
        else super(...args);
      }
      static now() { return fixed.getTime(); }
    } });

    await ctx.MRJ_SCORES.post({
      program: PROGRAM,
      itemId: "basic_a__unit01__01",
      scoreValue: 85,
      scoreMax: 100,
      scorePct: 85,
    });

    assert.equal(fetchCalls.length, 1);
    const body = JSON.parse(fetchCalls[0].init.body);
    assert.equal(body.student_email, TEST_STUDENT);
    assert.equal(body.session_id, `${PROGRAM}-${TEST_STUDENT}-2026-10-11`);
    const ev = body.events[0];
    assert.equal(ev.identity_method, "mrj_signin");
    assert.equal(ev.identity_confidence, "high");
    assert.equal(ev.local_date, "2026-10-11");

    assert.equal(noteScoreCalls.length, 1);
    assert.equal(noteScoreCalls[0].localDate, "2026-10-11");
    assert.equal(noteScoreCalls[0].itemId, "basic_a__unit01__01");
  });

  it("signed out does not call fetch", async () => {
    const { ctx, fetchCalls, noteScoreCalls } = makeContext({
      MRJ_AUTH: { student: () => "", noteScore: () => {} },
    });

    const result = await ctx.MRJ_SCORES.post({
      program: PROGRAM,
      itemId: "basic_a__unit01__01",
      scoreValue: 50,
      scoreMax: 100,
    });

    assert.equal(result.status, "skipped");
    assert.equal(fetchCalls.length, 0);
    assert.equal(noteScoreCalls.length, 0);
  });

  it("no-speech attempt_error posts CM only with no noteScore", async () => {
    const { ctx, noteScoreCalls, fetchCalls } = makeContext();

    await ctx.MRJ_SCORES.post({
      program: PROGRAM,
      appName: "MRJ Day 4 Speak",
      source: PROGRAM,
      itemId: "basic_a__unit01__01",
      itemType: "attempt_error",
      metadata: { reason: "no_speech" },
    });

    assert.equal(fetchCalls.length, 1);
    const body = JSON.parse(fetchCalls[0].init.body);
    assert.equal(body.events[0].item_type, "attempt_error");
    assert.equal(body.events[0].score_value, "");
    assert.equal(body.events[0].score_max, "");
    assert.deepEqual(JSON.parse(body.events[0].metadata_json), {
      reason: "no_speech",
    });
    assert.equal(noteScoreCalls.length, 0);
  });
});

describe("cache-bump", () => {
  it("index.html script and link ?v= match version.json build", () => {
    const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
    const matches = [...html.matchAll(/\?v=([^"']+)/g)].map((m) => m[1]);
    assert.ok(matches.length > 0, "expected ?v= cache busters in index.html");
    for (const v of matches) {
      assert.equal(v, BUILD);
    }
    assert.match(
      fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8"),
      new RegExp(`const BUILD = "${BUILD}"`)
    );
  });
});

describe("postFinishedScore no-speech", () => {
  it("app.js sends attempt_error for empty transcript at 0%", () => {
    const src = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
    assert.match(src, /itemType:\s*"attempt_error"/);
    assert.match(src, /reason:\s*"no_speech"/);
    assert.doesNotMatch(
      src,
      /if \(pct === 0 && !String\(transcript \|\| ""\)\.trim\(\)\) return;/
    );
  });
});
