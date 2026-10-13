const SILENCE_MS = 1200;
const SILENCE_GRACE_MS = 1600;
const SILENCE_CHECK_MS = 80;
const SILENCE_RMS = 0.008;
const MAX_RECORD_MS = 60000;

let capture = null;
let silenceTimer = null;

export function isCapturing() {
  return !!capture;
}

export function startSilenceWatch(stream, ctx, onEnd, endSilence = SILENCE_MS, grace = SILENCE_GRACE_MS) {
  stopSilenceWatch();
  const finish = () => {
    stopSilenceWatch();
    onEnd();
  };
  try {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const src = ctx.createMediaStreamSource(stream);
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let quietMs = 0;
    let totalMs = 0;
    let spoke = false;
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      totalMs += SILENCE_CHECK_MS;
      if (rms >= SILENCE_RMS) {
        spoke = true;
        quietMs = 0;
      } else if (totalMs > grace && spoke) {
        quietMs += SILENCE_CHECK_MS;
      }
      if (quietMs >= endSilence || totalMs >= MAX_RECORD_MS || (!spoke && totalMs >= 12000)) {
        finish();
        return;
      }
      silenceTimer = setTimeout(tick, SILENCE_CHECK_MS);
    };
    silenceTimer = setTimeout(tick, SILENCE_CHECK_MS);
  } catch (e) {
    console.warn("startSilenceWatch failed", e);
    silenceTimer = setTimeout(finish, 5000);
  }
}

export function stopSilenceWatch() {
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
}

function startCapture(stream) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const chunks = [];
  proc.onaudioprocess = (e) => {
    if (!capture) return;
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  src.connect(proc);
  proc.connect(gain);
  gain.connect(ctx.destination);
  return { ctx, src, proc, gain, chunks, stream };
}

function claimCapture() {
  const rec = capture;
  capture = null;
  stopSilenceWatch();
  if (!rec) return null;
  try {
    rec.proc.disconnect();
    rec.src.disconnect();
    rec.gain.disconnect();
  } catch (_) {}
  rec.stream.getTracks().forEach((t) => t.stop());
  return rec;
}

function encodeWavInWorker(chunks, sampleRate) {
  const transfers = chunks.map((c) => c.buffer);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./wav-worker.js", import.meta.url));
    worker.onmessage = (ev) => {
      worker.terminate();
      resolve(new Blob([ev.data.buf], { type: "audio/wav" }));
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage({ chunks, sampleRate }, transfers);
  });
}

async function blobFrom(rec) {
  if (!rec) return null;
  const rate = rec.ctx.sampleRate || 48000;
  const blob = await encodeWavInWorker(rec.chunks, rate);
  rec.ctx.close().catch(() => {});
  return blob;
}

/**
 * @param {() => void} onFinished called when silence/end triggers (async grade should be chained outside)
 */
export async function beginMicTake(onFinished) {
  if (capture) return false;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  capture = startCapture(stream);
  startSilenceWatch(stream, capture.ctx, () => {
    void (async () => {
      const blob = await stopMicTake();
      if (onFinished) await onFinished(blob);
    })();
  });
  return true;
}

export async function stopMicTake() {
  const rec = claimCapture();
  return blobFrom(rec);
}

export function cancelMicTake() {
  const rec = claimCapture();
  if (rec) rec.ctx.close().catch(() => {});
}
