#!/usr/bin/env node
/** Headless Chrome benchmark for Day 4 Speak Citrinet checker (?bench=1). */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { bootModelPaths } from "../js/checker/trial.js";
import { CHECKER_CDN } from "../js/checker/config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = "It is here.";
const wavDir = join(root, "test", "bench-wavs");

async function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: opts.quiet ? "pipe" : "inherit", ...opts });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function ensureWavs() {
  await mkdir(wavDir, { recursive: true });
  const out = join(wavDir, "correct-it-is-here.wav");
  try {
    await stat(out);
    return;
  } catch {
    await run(
      "ffmpeg",
      ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-ar", "16000", "-ac", "1", out],
      { quiet: true }
    );
  }
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const pathOnly = req.url.split("?")[0];
      const rel = pathOnly === "/" ? "/index.html" : pathOnly;
      const file = join(root, decodeURIComponent(rel));
      readFile(file)
        .then((buf) => {
          const base = file.split("/").pop() || "";
          const ext = base.includes(".") ? base.split(".").pop() : "";
          const types = {
            html: "text/html",
            js: "text/javascript",
            mjs: "text/javascript",
            css: "text/css",
            json: "application/json",
            wav: "audio/wav",
          };
          res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
          res.end(buf);
        })
        .catch(() => {
          res.writeHead(404);
          res.end("not found");
        });
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

async function bench(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(300000);
  const t0 = Date.now();
  await page.goto(baseUrl + "?bench=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__mrjDay4SpeakBench && document.getElementById("checkerTrack")?.classList.contains("done"),
    { timeout: 300000 }
  );
  const readyMs = Date.now() - t0;
  const boot = await page.evaluate(() => window.__mrjDay4SpeakBoot());
  const wavUrl = `${baseUrl}test/bench-wavs/correct-it-is-here.wav`;
  const checkTimes = [];
  for (let i = 0; i < 3; i++) {
    const ms = await page.evaluate(
      async ({ url, sentence }) => {
        const blob = await fetch(url).then((r) => r.blob());
        const t = performance.now();
        await window.__mrjDay4SpeakBench(blob, sentence, { passAt: 60 });
        return performance.now() - t;
      },
      { url: wavUrl, sentence: TARGET }
    );
    checkTimes.push(Math.round(ms));
  }
  await browser.close();
  return { readyMs, checkTimes, boot, cdn: CHECKER_CDN, modelPaths: bootModelPaths() };
}

async function main() {
  await ensureWavs();
  const { server, url } = await startStaticServer();
  try {
    const report = { generatedAt: new Date().toISOString(), speak: await bench(url) };
    const outPath = join(root, "test", "bench-speak-report.json");
    await writeFile(outPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.error("\nWrote", outPath);
  } finally {
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
