/* Day 4 Speak — MRJ all 9 books · Coach Ray / Miss Harper model audio */
(function () {
  const PASS = 80;
  const STORAGE_KEY = "mrj_day4_speak_records_v1";
  const VOICE_KEY = "mrj_day4_speak_voice_v1";
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
  let recognition = null;
  let listening = false;

  function show(view) {
    Object.values(views).forEach((v) => (v.hidden = true));
    views[view].hidden = false;
    el("btnHome").hidden = view === "home";
  }

  function loadRecords() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }
  function saveRecord(rec) {
    const all = loadRecords();
    all.unshift(rec);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 50)));
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

  async function init() {
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
    el("btnHome").onclick = () => {
      stopMic();
      audio.pause();
      show("home");
      el("title").textContent = "Day 4 Speak";
      el("scoreBadge").hidden = true;
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
    el("btnAgain").onclick = () => startUnit(state.bookId, state.unit.id);
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
      grid.appendChild(btn);
    });
    show("unit");
  }

  function startUnit(bookId, unitId) {
    const book = books[bookId];
    const unit = book.units.find((u) => u.id === unitId);
    state = {
      bookId,
      unit,
      index: 0,
      results: [],
      heard: false,
      passedCurrent: false,
    };
    el("title").textContent = `${book.label} · ${unit.title}`;
    el("scoreBadge").hidden = false;
    el("scoreBadge").textContent = `0/${unit.items.length}`;
    show("speak");
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
    el("micStatus").textContent = "먼저 한국어를 탭해서 영어를 들어요";
    el("btnMic").disabled = false;
    state.heard = false;
    state.passedCurrent = false;
    audio.pause();
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

  function getRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.continuous = false;
    return r;
  }

  function stopMic() {
    listening = false;
    el("btnMic").classList.remove("listening");
    el("btnMic").textContent = "🎤 Speak";
    try {
      if (recognition) recognition.abort();
    } catch (_) {}
  }

  function toggleMic() {
    if (listening) {
      stopMic();
      return;
    }
    recognition = getRecognition();
    if (!recognition) {
      el("micStatus").textContent =
        "이 브라우저는 음성 인식을 지원하지 않아요 (Chrome 권장).";
      return;
    }
    listening = true;
    el("btnMic").classList.add("listening");
    el("btnMic").textContent = "⏹ Stop";
    el("micStatus").textContent = "듣고 있어요… 영어로 말하세요!";
    recognition.onresult = (ev) => {
      let transcript = "";
      for (let i = 0; i < ev.results.length; i++) {
        transcript += ev.results[i][0].transcript + " ";
      }
      transcript = transcript.trim();
      finishAttempt(transcript);
    };
    recognition.onerror = (ev) => {
      stopMic();
      el("micStatus").textContent = "인식 실패: " + (ev.error || "unknown") + " — 다시 시도!";
    };
    recognition.onend = () => {
      if (listening) stopMic();
    };
    try {
      recognition.start();
    } catch (e) {
      stopMic();
      el("micStatus").textContent = "마이크를 시작할 수 없어요.";
    }
  }

  function finishAttempt(transcript) {
    stopMic();
    const item = currentItem();
    const { score, matched, pass } = Day4Score.bestScore(
      transcript,
      item.english,
      item.alts || []
    );
    const box = el("resultBox");
    box.hidden = false;
    box.className = "result " + (pass ? "pass" : "fail");
    el("resultScore").textContent = (pass ? "✅ " : "😅 ") + score + "%";
    el("resultDetail").textContent = `You said: “${transcript}” · Target: “${matched}”`;
    el("englishReveal").hidden = false;
    el("micStatus").textContent = pass
      ? "통과! Next를 누르세요"
      : "80% 미만 — 다시 Hear → Speak 해보세요";
    if (pass) {
      state.passedCurrent = true;
      el("btnNext").hidden = false;
      el("btnSkip").hidden = true;
      recordResult(true, score, transcript);
      const idxAtPass = state.index;
      setTimeout(() => {
        if (state.passedCurrent && state.index === idxAtPass) nextItem(true);
      }, 900);
    }
  }

  function recordResult(passed, score, transcript) {
    // avoid double-push on auto next
    if (state.results.length === state.index + 1) return;
    state.results.push({
      id: currentItem().id,
      korean: currentItem().korean,
      english: currentItem().english,
      passed,
      score,
      transcript,
    });
    const passedCount = state.results.filter((r) => r.passed).length;
    el("scoreBadge").textContent = `${passedCount}/${state.unit.items.length}`;
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
    if (state.index >= state.unit.items.length) {
      finishUnit();
      return;
    }
    renderItem();
  }

  function finishUnit() {
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
    saveRecord(rec);
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

  init().catch((e) => {
    console.error(e);
    el("bookList").textContent = "콘텐츠를 불러오지 못했어요: " + e.message;
  });
})();
