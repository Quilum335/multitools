import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const source = join(process.cwd(), "node_modules", "@ffmpeg", "core", "dist", "esm");
const target = join(process.cwd(), "public", "ffmpeg-core");
const tesseractWorkerSource = join(process.cwd(), "node_modules", "tesseract.js", "dist", "worker.min.js");
const tesseractWorkerTarget = join(process.cwd(), "public", "tesseract", "worker.min.js");
const tesseractCoreSource = join(process.cwd(), "node_modules", "tesseract.js-core");
const tesseractCoreTarget = join(process.cwd(), "public", "tesseract-core");
const tessdataTarget = join(process.cwd(), "public", "tessdata");

if (!existsSync(source)) {
  throw new Error("@ffmpeg/core files were not found. Run npm install before building.");
}
if (!existsSync(tesseractWorkerSource) || !existsSync(tesseractCoreSource)) {
  throw new Error("Tesseract.js files were not found. Run npm install before building.");
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

rmSync(join(process.cwd(), "public", "tesseract"), { recursive: true, force: true });
mkdirSync(join(process.cwd(), "public", "tesseract"), { recursive: true });
copyFileSync(tesseractWorkerSource, tesseractWorkerTarget);

rmSync(tesseractCoreTarget, { recursive: true, force: true });
mkdirSync(tesseractCoreTarget, { recursive: true });
for (const fileName of [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-lstm.wasm",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm"
]) {
  copyFileSync(join(tesseractCoreSource, fileName), join(tesseractCoreTarget, fileName));
}

rmSync(tessdataTarget, { recursive: true, force: true });
mkdirSync(tessdataTarget, { recursive: true });
for (const lang of ["eng", "rus"]) {
  const trainedData = join(process.cwd(), "node_modules", "@tesseract.js-data", lang, "4.0.0", `${lang}.traineddata.gz`);
  if (!existsSync(trainedData)) throw new Error(`Tesseract language data for ${lang} was not found.`);
  copyFileSync(trainedData, join(tessdataTarget, `${lang}.traineddata.gz`));
}

console.log("Copied ffmpeg.wasm core to public/ffmpeg-core");
console.log("Copied Tesseract assets to public/tesseract, public/tesseract-core, and public/tessdata");
