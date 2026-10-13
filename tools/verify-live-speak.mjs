#!/usr/bin/env node
import { chromium } from "playwright";

const LIVE = process.env.DAY4_SPEAK_URL || "https://mrjkorea.github.io/day4-speak/";
const WAV = "https://mrjkorea.github.io/pronounce-try/test/bench-wavs/correct-it-is-here.wav";
const SENTENCE = "It is here.";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(300000);
  const t0 = Date.now();
  await page.goto(LIVE + "?bench=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__mrjDay4SpeakBench && document.getElementById("checkerTrack")?.classList.contains("done"),
    { timeout: 300000 }
  );
  const readyMs = Date.now() - t0;
  const boot = await page.evaluate(() => window.__mrjDay4SpeakBoot());
  const grade = await page.evaluate(
    async ({ url, sentence }) => {
      const blob = await fetch(url).then((r) => r.blob());
      const t = performance.now();
      const out = await window.__mrjDay4SpeakBench(blob, sentence, { passAt: 60 });
      return { ms: Math.round(performance.now() - t), pass: out.result.pass, grader: out.result.grader };
    },
    { url: WAV, sentence: SENTENCE }
  );
  await browser.close();
  console.log(JSON.stringify({ live: LIVE, readyMs, boot, grade }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
