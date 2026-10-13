import { bootTrialInPage, bootModelPaths, gradeTrialSamples, DOOR_CHECKING_TEXT, DOOR_FAIL_TEXT } from "./trial.js";
import { ortWasmPaths } from "./config.js";

export {
  bootModelPaths,
  gradeTrialSamples,
  DOOR_CHECKING_TEXT,
  DOOR_FAIL_TEXT,
};

export async function bootChecker(opts = {}) {
  const ort = opts.ort || globalThis.ort;
  if (!ort || !ort.InferenceSession) {
    throw new Error("onnxruntime-web is not loaded");
  }
  const wasmPaths = opts.wasmPaths || ortWasmPaths();
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = wasmPaths;
  return bootTrialInPage({
    ort,
    wasmPaths,
    paths: bootModelPaths(),
    fetchImpl: opts.fetchImpl,
  });
}
