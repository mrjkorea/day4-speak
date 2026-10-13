/* Day 4 Speak — MRJ all 9 books · Coach Ray / Miss Harper · Citrinet checker */
import {
  bootChecker,
  gradeTrialSamples,
  DOOR_CHECKING_TEXT,
  DOOR_FAIL_TEXT,
} from "./checker/boot.js";
import { decodeAudioToMono } from "./checker/audio.js";
import { tokenizeWords } from "./checker/tokenize.js";
import {
  beginMicTake,
  cancelMicTake,
  isCapturing,
} from "./mic-capture.js";
import {
  startUnitTimer,
  unitTimerRunning,
  secondsLeft,
  stopUnitTimer,
  canStartMic,
} from "./flow-speak.js";

const BUILD = "20261013-citrinet";
  const CITRINET_PASS = 60;
  const PROGRAM = "day4-speak";
  const PASS = CITRINET_PASS;
  const LEGACY_RECORDS_KEY = "mrj_day4_speak_records_v1";
  const RECORDS_KEY_PREFIX = "mrj_day4_speak_records_v1:";
  const VOICE_KEY = "mrj_day4_speak_voice_v1";
  let recordsStorageKey = LEGACY_RECORDS_KEY;
  let progressRetryDone = false;
  let progressRetryTimer = null;
  const VOICES = {
    ray: { label: "Coach Ray", field: "audio" },
    harper: { label: "Miss Harper", field: "audio_harper" },
  };
  const BOOK_STYLE = {
    basic_a: { color: "#ff6b6b", emoji: "🐶" },
    basic_b: { color: "#ff922b", emoji: "🍎" },
    basic_c: { color: "#f59f00", emoji: "🎈" },
    int2a: { color: "#37b24d", emoji: "🌦️" },
    int2b: { color: "#12b886", emoji: "🕒" },
    int2c: { color: "#1c7ed6", emoji: "🌸" },
    int3a: { color: "#4c6ef5", emoji: "🎨" },
    int3b: { color: "#7950f2", emoji: "🎸" },
    int3c: { color: "#e64980", emoji: "🍡" },
  };
  let voice = "ray";
  try {
    const v = localStorage.getItem(VOICE_KEY);
    if (v && VOICES[v]) voice = v;
  } catch (_) {}

  function setVoice(v) {
    if (!VOICES[v]) return;
    voice = v;
    try { localStorage.setItem(VOICE_KEY, v); } catch (_) {}
    document.querySelectorAll(".voice-btn").forEach((b) => {
      const on = b.dataset.voice === v;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.body.dataset.voice = v;
  }

  function audioUrl(item) {
    return item[VOICES[voice].field] || item.audio || "";
  }
  window.Day4Voice = { get: () => voice, set: setVoice, url: audioUrl };
  // TODO: Score Dashboard hook — POST/local sync of records when dashboard ships.

  const el = (id) => document.getElementById(id);
  const views = {
    home: el("viewHome"),
    unit: el("viewUnit"),
    speak: el("viewSpeak"),
    done: el("viewDone"),
  };

  let manifest = null;
  let books = {};
  let state = {
    bookId: null,
    unit: null,
    index: 0,
    results: [],
    heard: false,
    passedCurrent: false,
  };
  let audio = new Audio();
  let checkerReady = false;
  let checkerError = "";
  let unitTimer = null;
  let unitClock = null;
  let gradingCount = 0;
  let pronounceChecking = false;
  const savedScores = {};
  const progressNodes = [];

  function show(view) {
    Object.values(views).forEach((v) => (v.hidden = true));
    views[view].hidden = false;
    el("btnHome").hidden = view === "home";
  }

  function studentIdKey() {
    try {
      if (window.MRJ_AUTH && typeof MRJ_AUTH.student === "function") {
        return String(MRJ_AUTH.student() || "").trim();
      }
    } catch (_) {}
    return "";
  }

  function recordsKeyForStudent(studentId) {
    const id = String(studentId || "").trim();
    if (!id) return LEGACY_RECORDS_KEY;
    return RECORDS_KEY_PREFIX + encodeURIComponent(id);
  }

  function mergeRecordLists(primary, secondary) {
    const seen = new Set();
    const out = [];
    function push(rec) {
      if (!rec || typeof rec !== "object") return;
      const key = [rec.bookId, rec.unitId, rec.when].join("|");
      if (seen.has(key)) return;
      seen.add(key);
      out.push(rec);
    }
    (primary || []).forEach(push);
    (secondary || []).forEach(push);
    return out.slice(0, 50);
  }

  function migrateLegacyRecords(studentKey) {
    if (!studentKey || studentKey === LEGACY_RECORDS_KEY) return;
    try {
      const legacyRaw = localStorage.getItem(LEGACY_RECORDS_KEY);
      if (!legacyRaw) return;
      const legacy = JSON.parse(legacyRaw);
      if (!Array.isArray(legacy) || !legacy.length) return;
      const currentRaw = localStorage.getItem(studentKey);
      let current = [];
      try {
        current = currentRaw ? JSON.parse(currentRaw) : [];
      } catch (_) {
        current = [];
      }
      if (!Array.isArray(current)) current = [];
      const merged = mergeRecordLists(current, legacy);
      localStorage.setItem(studentKey, JSON.stringify(merged));
    } catch (_) {}
  }

  function bindStudentRecords(studentId) {
    const key = recordsKeyForStudent(studentId);
    if (key === recordsStorageKey) return;
    recordsStorageKey = key;
    migrateLegacyRecords(key);
    renderRecords();
    paintSavedProgress();
  }

  function loadRecords() {
    try {
      return JSON.parse(localStorage.getItem(recordsStorageKey) || "[]");
    } catch {
      return [];
    }
  }
  function saveRecord(rec) {
    const all = loadRecords();
    all.unshift(rec);
    localStorage.setItem(recordsStorageKey, JSON.stringify(all.slice(0, 50)));
    renderRecords();
  }
  function renderRecords() {
    const all = loadRecords();
    const box = el("recordList");
    if (!all.length) {
      box.textContent = "아직 기록이 없어요.";
      return;
    }
    box.innerHTML = all
      .slice(0, 8)
      .map(
        (r) =>
          `<div class="rec-item"><strong>${r.bookLabel} · ${r.unitTitle}</strong> — ${r.passed}/${r.total} (${r.avg}%) <span class="muted">${r.when}</span></div>`
      )
      .join("");
  }

  function setCheckerProgress(frac, text) {
    const label = el("checkerLabel");
    const fill = el("checkerFill");
    const track = el("checkerTrack");
    if (!label) return;
    label.textContent = text;
    if (fill) fill.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
    if (track && frac >= 1) track.classList.add("done");
  }

  function scoringTarget(english) {
    const toks = tokenizeWords(english);
    if (toks.length === 1) {
      const w = toks[0].display;
      return `${w} ${w} ${w}`;
    }
    return english;
  }

  async function gradeItemBlob(blob, item) {
    const samples = await decodeAudioToMono(blob, 16000);
    const candidates = [item.english].concat(item.alts || []);
    let best = null;
    let bestTarget = candidates[0];
    for (const c of candidates) {
      const target = scoringTarget(c);
      const graded = await gradeTrialSamples(samples, target, CITRINET_PASS, null, {});
      const result = graded.result;
      if (!best || (result.scorePct || 0) > (best.scorePct || 0)) {
        best = result;
        bestTarget = c;
      }
    }
    return { result: best, matched: bestTarget };
  }

  function benchModeEnabled() {
    try {
      if (new URLSearchParams(location.search).get("bench") === "1") return true;
      const id = studentIdKey();
      return String(id).toLowerCase().startsWith("zz_test");
    } catch (_) {
      return false;
    }
  }

  function exposeBenchHook() {
    if (!checkerReady || !benchModeEnabled()) return;
    window.__mrjDay4SpeakBench = async (blob, english, gradeOpts) => {
      const passAt = typeof gradeOpts?.passAt === "number" ? gradeOpts.passAt : CITRINET_PASS;
      const samples = await decodeAudioToMono(blob, 16000);
      const graded = await gradeTrialSamples(samples, scoringTarget(english), passAt, null, gradeOpts || {});
      return { result: graded.result, door: graded.door, perf: graded.perf };
    };
    window.__mrjDay4SpeakBoot = () => ({ grader: "citrinet", ready: checkerReady });
  }

  async function bootCheckerModel() {
    try {
      setCheckerProgress(0.05, "Loading offline pronunciation checker…");
      await bootChecker();
      checkerReady = true;
      setCheckerProgress(1, "Offline checker ready");
      exposeBenchHook();
    } catch (err) {
      checkerError = err && err.message ? err.message : String(err);
      setCheckerProgress(0, "Checker did not load. " + checkerError);
      console.error(err);
    }
  }

  function stopUnitClock() {
    if (unitClock) {
      clearInterval(unitClock);
      unitClock = null;
    }
  }

  function startUnitClock() {
    stopUnitClock();
    const badge = el("unitTimer");
    if (!badge || !unitTimer) return;
    unitClock = setInterval(() => {
      if (!unitTimerRunning(unitTimer)) {
        badge.textContent = "0:00";
        stopUnitClock();
        if (views.speak && !views.speak.hidden) finishUnit();
        return;
      }
      const sec = secondsLeft(unitTimer);
      const m = Math.floor(sec / 60);
      const s = String(sec % 60).padStart(2, "0");
      badge.textContent = `${m}:${s}`;
      syncMicButton();
    }, 250);
  }

  function syncMicButton() {
    const btn = el("btnMic");
    if (!btn) return;
    const capturing = isCapturing();
    const allowed = canStartMic({
      recording: capturing,
      timerRunning: unitTimer ? unitTimerRunning(unitTimer) : true,
      checkerReady,
      heardCue: state.heard,
    });
    btn.disabled = !allowed && !capturing;
    if (capturing) {
      btn.classList.add("listening");
      btn.textContent = "⏹ Stop";
    } else {
      btn.classList.remove("listening");
      btn.textContent = "🎤 Speak";
    }
  }

  async function init() {
    void bootCheckerModel();
    manifest = await fetch("content/manifest.json").then((r) => r.json());
    const list = el("bookList");
    list.innerHTML = "";
    const datas = await Promise.all(
      manifest.books.map((b) => fetch(b.path).then((r) => r.json()))
    );
    manifest.books.forEach((b, i) => {
      const data = datas[i];
      books[b.id] = data;
      const st = BOOK_STYLE[b.id] || { color: "#3b82f6", emoji: "📘" };
      const sec = document.createElement("section");
      sec.className = "book-sec";
      sec.style.setProperty("--book", st.color);
      const head = document.createElement("button");
      head.type = "button";
      head.className = "book-head";
      head.innerHTML = `<span class="book-emoji">${st.emoji}</span><span class="book-name">${data.label}</span><span class="book-meta">${data.units.length} units · ${b.items} items</span>`;
      head.onclick = () => openBook(b.id);
      sec.appendChild(head);
      const grid = document.createElement("div");
      grid.className = "tile-grid";
      data.units.forEach((u) => {
        const t = document.createElement("button");
        t.type = "button";
        t.className = "unit-tile";
        const num = parseInt(u.id.replace("unit", ""), 10);
        t.innerHTML = `<span class="tile-num">${num}</span><span class="tile-title">${u.title}</span>`;
        t.setAttribute("aria-label", `${data.label} Unit ${num}: ${u.title}`);
        t.onclick = () => startUnit(b.id, u.id);
        trackProgress(t, b.id, u);
        grid.appendChild(t);
      });
      sec.appendChild(grid);
      const target = b.id.startsWith("basic") ? el("bookListBasic") : el("bookListInt");
      target.appendChild(sec);
    });
    document.querySelectorAll(".voice-btn").forEach((btn) => {
      btn.onclick = () => {
        setVoice(btn.dataset.voice);
        if (!views.speak.hidden && state.unit) playAudio();
      };
    });
    setVoice(voice);
    renderRecords();
    paintSavedProgress();
    el("btnHome").onclick = () => {
      stopMic();
      audio.pause();
      show("home");
      el("title").textContent = "Day 4 Speak";
      el("scoreBadge").hidden = true;
      el("unitTimer").hidden = true;
      stopUnitClock();
    };
    el("btnExport").onclick = exportJson;
    el("btnCue").onclick = playAudio;
    el("btnHear").onclick = playAudio;
    el("btnMic").onclick = toggleMic;
    el("btnNext").onclick = nextItem;
    el("btnSkip").onclick = () => {
      recordResult(false, 0, "");
      nextItem();
    };
    el("btnAgain").onclick = () => startUnit(state.bookId, state.unit.id, { redo: true });
    el("btnBackUnits").onclick = () => openBook(state.bookId);
    show("home");
  }

  function openBook(bookId) {
    state.bookId = bookId;
    const book = books[bookId];
    el("title").textContent = book.label;
    const grid = el("unitPicker");
    grid.innerHTML = "";
    grid.style.setProperty("--book", (BOOK_STYLE[bookId] || {}).color || "#3b82f6");
    book.units.forEach((u) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "unit-card";
      btn.innerHTML = `<h3>${u.id.replace("unit", "Unit ")}</h3><p>${u.title}<br/>${u.items.length} items</p>`;
      btn.onclick = () => startUnit(bookId, u.id);
      trackProgress(btn, bookId, u);
      grid.appendChild(btn);
    });
    paintSavedProgress();
    show("unit");
  }

  function trackProgress(node, bookId, unit) {
    progressNodes.push({ node, bookId, unit });
  }

  function rememberScore(itemId, score, passed) {
    Day4Progress.rememberScore(savedScores, itemId, score, passed);
  }

  function applyAuthProgress(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    Day4Progress.applyRows(savedScores, rows, PROGRAM);
    paintSavedProgress();
  }

  function authProgressError() {
    try {
      if (window.MRJ_AUTH && typeof MRJ_AUTH.progressError === "function") {
        return String(MRJ_AUTH.progressError() || "").trim();
      }
    } catch (_) {}
    return "";
  }

  function scheduleProgressRetry(reason) {
    if (progressRetryDone || progressRetryTimer) return;
    progressRetryTimer = setTimeout(() => {
      progressRetryTimer = null;
      progressRetryDone = true;
      loadRemoteProgressList(true);
    }, 22000);
    if (reason) console.warn("Day4 Speak: progress will retry —", reason);
  }

  function loadRemoteProgressList(fromRetry) {
    const auth = window.MRJ_AUTH;
    if (!auth || typeof auth.loadProgressForApp !== "function") return;
    if (!studentIdKey()) return;
    Promise.resolve()
      .then(() => auth.loadProgressForApp(PROGRAM))
      .then((result) => {
        if (result && result.ok && Array.isArray(result.progress)) {
          applyAuthProgress(result.progress);
          return;
        }
        const err =
          (result && result.error) || authProgressError() || "load_failed";
        if (!fromRetry) scheduleProgressRetry(err);
      })
      .catch(() => {
        if (!fromRetry) scheduleProgressRetry("network");
      });
  }

  function onMrjAuthReady(ev) {
    const detail = (ev && ev.detail) || {};
    const studentId =
      detail.id != null ? String(detail.id).trim() : studentIdKey();
    if (studentId) bindStudentRecords(studentId);
    exposeBenchHook();

    const rows = Array.isArray(detail.progress) ? detail.progress : [];
    if (rows.length) applyAuthProgress(rows);

    const err =
      authProgressError() ||
      (detail.progressError != null ? String(detail.progressError).trim() : "");
    if (err) {
      scheduleProgressRetry(err);
      return;
    }
    loadRemoteProgressList(false);
  }

  function unitSavedStats(unit) {
    let passed = 0;
    let best = 0;
    let any = false;
    unit.items.forEach((item) => {
      const saved = savedScores[item.id];
      if (!saved) return;
      any = true;
      if (saved.score > best) best = saved.score;
      if (saved.passed) passed += 1;
    });
    return { passed, total: unit.items.length, best, any };
  }

  function paintSavedProgress() {
    progressNodes.forEach((entry) => {
      if (!entry.node.isConnected) return;
      const stats = unitSavedStats(entry.unit);
      let badge = entry.node.querySelector(".tile-saved");
      if (!stats.any) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "tile-saved";
        entry.node.appendChild(badge);
      }
      badge.textContent = stats.passed
        ? `${stats.passed}/${stats.total} 통과`
        : `최고 ${stats.best}%`;
    });
  }

  function postFinishedScore(item, score, passed, transcript) {
    if (!item || !window.MRJ_SCORES || typeof MRJ_SCORES.post !== "function") return;
    const student =
      window.MRJ_AUTH && typeof MRJ_AUTH.student === "function"
        ? String(MRJ_AUTH.student() || "").trim()
        : "";
    if (!student) return;
    const pct = Math.round(Number(score));
    if (!Number.isFinite(pct)) return;
    const book = books[state.bookId];
    if (pct === 0 && !String(transcript || "").trim()) {
      MRJ_SCORES.post({
        student,
        program: PROGRAM,
        appName: "MRJ Day 4 Speak",
        source: PROGRAM,
        bookTitle: book ? book.label : "",
        itemId: item.id,
        itemType: "attempt_error",
        metadata: { reason: "no_speech" },
      });
      return;
    }
    rememberScore(item.id, pct, passed);
    MRJ_SCORES.post({
      student,
      program: PROGRAM,
      appName: "MRJ Day 4 Speak",
      source: PROGRAM,
      bookTitle: book ? book.label : "",
      itemId: item.id,
      itemType: "speaking",
      scoreValue: pct,
      scoreMax: 100,
      scorePct: pct,
      correctness: passed ? "correct" : "incorrect",
    });
    paintSavedProgress();
  }

  function absorbPassed() {
    if (state.redo || !state.unit) return;
    while (state.index < state.unit.items.length) {
      const item = state.unit.items[state.index];
      const saved = savedScores[item.id];
      if (!(saved && saved.passed)) break;
      if (state.results.length === state.index) {
        state.results.push({
          id: item.id,
          korean: item.korean,
          english: item.english,
          passed: true,
          score: saved.score,
          transcript: "",
          restored: true,
        });
      }
      state.index += 1;
    }
  }

  function startUnit(bookId, unitId, opts) {
    const book = books[bookId];
    const unit = book.units.find((u) => u.id === unitId);
    stopUnitClock();
    cancelMicTake();
    unitTimer = startUnitTimer();
    state = {
      bookId,
      unit,
      index: 0,
      results: [],
      heard: false,
      passedCurrent: false,
      redo: !!(opts && opts.redo),
    };
    el("title").textContent = `${book.label} · ${unit.title}`;
    el("scoreBadge").hidden = false;
    el("unitTimer").hidden = false;
    absorbPassed();
    const passedCount = state.results.filter((r) => r.passed).length;
    el("scoreBadge").textContent = `${passedCount}/${unit.items.length}`;
    if (state.index >= unit.items.length) {
      finishUnit();
      return;
    }
    show("speak");
    startUnitClock();
    renderItem();
  }

  function currentItem() {
    return state.unit.items[state.index];
  }

  function renderItem() {
    stopMic();
    const item = currentItem();
    const total = state.unit.items.length;
    el("progressText").textContent = `${state.index + 1} / ${total}`;
    el("progressBar").style.setProperty("--pct", `${(state.index / total) * 100}%`);
    el("koreanCue").textContent = item.korean;
    const pic = el("cuePic");
    if (item.image) {
      pic.hidden = false;
      pic.onerror = () => { pic.hidden = true; };
      pic.src = item.image;
      pic.alt = item.english;
    } else {
      pic.hidden = true;
      pic.removeAttribute("src");
      pic.alt = "";
    }
    el("englishReveal").hidden = true;
    el("englishReveal").textContent = item.english;
    el("resultBox").hidden = true;
    el("btnNext").hidden = true;
    el("btnSkip").hidden = false;
    const saved = savedScores[item.id];
    el("micStatus").textContent =
      saved && !saved.passed
        ? `지난 점수 ${saved.score}% · 먼저 한국어를 탭해서 영어를 들어요`
        : "먼저 한국어를 탭해서 영어를 들어요";
    state.heard = false;
    state.passedCurrent = false;
    pronounceChecking = false;
    audio.pause();
    syncMicButton();
  }

  function playAudio() {
    const item = currentItem();
    const src = audioUrl(item);
    if (!src) {
      // Web Speech Synthesis fallback
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(item.english);
        u.lang = "en-US";
        u.rate = 0.9;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
        state.heard = true;
        el("micStatus").textContent = "이제 🎤 Speak 버튼을 누르고 따라 말해요";
        return;
      }
      el("micStatus").textContent = "오디오 없음 — 그래도 말해 보세요!";
      state.heard = true;
      return;
    }
    audio.pause();
    audio.src = src;
    audio.play().catch((err) => {
      if (err && err.name === "NotAllowedError") return;
      // fallback 1: Coach Ray mp3 if Miss Harper file fails
      if (item.audio && src !== item.audio) {
        audio.src = item.audio;
        audio.play().catch(() => {});
        return;
      }
      // fallback 2: TTS if mp3 fails
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(item.english);
        u.lang = "en-US";
        speechSynthesis.speak(u);
      }
    });
    state.heard = true;
    el("micStatus").textContent = "이제 🎤 Speak 버튼을 누르고 따라 말해요";
  }

  function stopMic() {
    cancelMicTake();
    syncMicButton();
  }

  async function toggleMic() {
    if (isCapturing()) {
      stopMic();
      return;
    }
    if (!checkerReady) {
      el("micStatus").textContent = checkerError
        ? "Checker offline — refresh the page."
        : "Checker loading… wait a moment.";
      return;
    }
    if (
      !canStartMic({
        recording: false,
        timerRunning: unitTimer ? unitTimerRunning(unitTimer) : true,
        checkerReady,
        heardCue: state.heard,
      })
    ) {
      if (!state.heard) {
        el("micStatus").textContent = "먼저 한국어를 탭해서 영어를 들어요";
      } else if (unitTimer && !unitTimerRunning(unitTimer)) {
        el("micStatus").textContent = "Time is up for this unit.";
      }
      return;
    }
    const itemIndex = state.index;
    const item = currentItem();
    el("micStatus").textContent = "듣고 있어요… 영어로 말하세요!";
    syncMicButton();
    try {
      const started = await beginMicTake(async (blob) => {
        syncMicButton();
        if (!blob || state.index !== itemIndex) return;
        gradingCount += 1;
        pronounceChecking = true;
        el("micStatus").textContent = DOOR_CHECKING_TEXT;
        syncMicButton();
        try {
          const { result, matched } = await gradeItemBlob(blob, item);
          if (state.index === itemIndex) {
            finishGradeResult(item, result, matched, itemIndex);
          }
        } catch (err) {
          console.error(err);
          if (state.index === itemIndex) {
            el("micStatus").textContent = "Checking failed — try again.";
          }
        } finally {
          gradingCount -= 1;
          pronounceChecking = gradingCount > 0;
          syncMicButton();
        }
      });
      if (!started) syncMicButton();
    } catch (err) {
      console.error(err);
      el("micStatus").textContent = "마이크를 허용해 주세요.";
      syncMicButton();
    }
  }

  function finishGradeResult(item, result, matched, itemIndex) {
    if (state.index !== itemIndex) return;
    const doorFail = result && result.doorFail;
    const score = result ? result.scorePct || Math.round((result.score || 0) * 100) : 0;
    const pass = !!(result && result.pass);
    const box = el("resultBox");
    box.hidden = false;
    box.className = "result " + (pass ? "pass" : "fail");
    if (doorFail) {
      el("resultScore").textContent = "🔁 Try again";
      el("resultDetail").textContent = DOOR_FAIL_TEXT;
    } else {
      el("resultScore").textContent = (pass ? "✅ " : "😅 ") + score + "%";
      const weak = (result.words || [])
        .filter((w) => (w.score || 0) < CITRINET_PASS)
        .map((w) => w.word)
        .join(", ");
      el("resultDetail").textContent = weak
        ? `Target: “${matched}” · practice: ${weak}`
        : `Target: “${matched}”`;
    }
    el("englishReveal").hidden = false;
    el("micStatus").textContent = pass
      ? "통과! Next를 누르세요"
      : doorFail
        ? DOOR_FAIL_TEXT
        : `${CITRINET_PASS}% 미만 — 다시 Hear → Speak 해보세요`;
    if (pass) {
      state.passedCurrent = true;
      el("btnNext").hidden = false;
      el("btnSkip").hidden = true;
      recordResult(true, score, matched);
      const idxAtPass = state.index;
      setTimeout(() => {
        if (state.passedCurrent && state.index === idxAtPass) nextItem(true);
      }, 900);
    } else if (!doorFail) {
      postFinishedScore(item, score, false, matched);
    } else {
      postFinishedScore(item, 0, false, "");
    }
  }

  function recordResult(passed, score, transcript) {
    // avoid double-push on auto next
    if (state.results.length === state.index + 1) return;
    const item = currentItem();
    state.results.push({
      id: item.id,
      korean: item.korean,
      english: item.english,
      passed,
      score,
      transcript,
    });
    const passedCount = state.results.filter((r) => r.passed).length;
    el("scoreBadge").textContent = `${passedCount}/${state.unit.items.length}`;
    postFinishedScore(item, score, passed, transcript);
  }

  function nextItem(fromAuto) {
    if (!fromAuto && !state.passedCurrent && state.results.length === state.index) {
      recordResult(false, 0, "");
    }
    // if passed via mic but record already stored
    if (state.passedCurrent && state.results.length === state.index) {
      // shouldn't happen
    }
    state.index += 1;
    absorbPassed();
    if (state.index >= state.unit.items.length) {
      finishUnit();
      return;
    }
    renderItem();
  }

  function finishUnit() {
    stopUnitClock();
    cancelMicTake();
    if (unitTimer) unitTimer = stopUnitTimer(unitTimer);
    // pad skips if needed
    while (state.results.length < state.unit.items.length) {
      const i = state.results.length;
      const item = state.unit.items[i];
      state.results.push({
        id: item.id,
        korean: item.korean,
        english: item.english,
        passed: false,
        score: 0,
        transcript: "",
      });
    }
    const passed = state.results.filter((r) => r.passed).length;
    const total = state.results.length;
    const avg = Math.round(
      state.results.reduce((s, r) => s + (r.score || 0), 0) / total
    );
    const book = books[state.bookId];
    const when = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const rec = {
      bookId: state.bookId,
      bookLabel: book.label,
      unitId: state.unit.id,
      unitTitle: state.unit.title,
      passed,
      total,
      avg,
      when,
      results: state.results,
      // TODO: Score Dashboard — sync this record to MRJ dashboard when available
    };
    if (state.results.some((r) => !r.restored)) saveRecord(rec);
    paintSavedProgress();
    el("doneSummary").textContent = `${passed} / ${total} 통과`;
    el("doneDetail").textContent = `평균 점수 ${avg}% · ${when} (KST)`;
    el("progressBar").style.setProperty("--pct", "100%");
    show("done");
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(loadRecords(), null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mrj-day4-speak-records.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.addEventListener("mrj-auth-ready", onMrjAuthReady);
  window.Day4SpeakBuild = BUILD;

  init().catch((e) => {
    console.error(e);
    el("bookList").textContent = "콘텐츠를 불러오지 못했어요: " + e.message;
  });
