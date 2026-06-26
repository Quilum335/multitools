import "dotenv/config";
import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import tesseract from "tesseract.js";
import mammoth from "mammoth";
import ffmpegPath from "ffmpeg-static";
import { PDFParse } from "pdf-parse";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 220 * 1024 * 1024
  }
});

const port = Number(process.env.SERVER_PORT || 8787);
const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const textModel = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const distPath = join(process.cwd(), "dist");
const ffmpegCorePath = join(process.cwd(), "node_modules", "@ffmpeg", "core", "dist", "esm");
const ocrLangPath = join(process.cwd(), "node_modules", ".cache", "multitool-tesseract-lang");
const ocrCachePath = join(process.cwd(), "node_modules", ".cache", "multitool-tesseract-cache");
const shortLinks = new Map();
const maxShortLinks = 1000;
const { createWorker } = tesseract;
let ocrWorkerPromise = null;
let ocrQueue = Promise.resolve();

const commonTessParams = {
  preserve_interword_spaces: "1",
  tessedit_pageseg_mode: "6",
  user_defined_dpi: "300"
};

app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.use(express.json({ limit: "3mb" }));

function requireGemini(res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "GEMINI_API_KEY is not set. Add it to .env and restart the app."
    });
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

function extractText(response) {
  if (typeof response?.text === "string" && response.text.trim()) return response.text;
  return (response?.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getGeminiError(error, fallback) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (!raw) return { statusCode: 500, message: fallback };
  try {
    const parsed = JSON.parse(raw);
    const status = parsed?.error?.status || parsed?.status || "";
    const code = Number(parsed?.error?.code || parsed?.code || 500);
    const statusCode = status === "RESOURCE_EXHAUSTED" || code === 429 ? 429 : code === 404 ? 404 : 500;
    return {
      statusCode,
      message: parsed?.error?.message || parsed?.message || raw
    };
  } catch {
    return {
      statusCode: /quota|rate limit|resource_exhausted/i.test(raw) ? 429 : 500,
      message: raw
    };
  }
}

function createShortId() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = randomUUID().replace(/-/g, "").slice(0, 10);
    if (!shortLinks.has(id)) return id;
  }
  throw new Error("Could not allocate short link id.");
}

function trimShortLinks() {
  while (shortLinks.size > maxShortLinks) {
    const oldest = shortLinks.keys().next().value;
    if (!oldest) break;
    shortLinks.delete(oldest);
  }
}

function ensureOcrLangData() {
  mkdirSync(ocrLangPath, { recursive: true });
  mkdirSync(ocrCachePath, { recursive: true });

  for (const lang of ["eng", "rus"]) {
    const target = join(ocrLangPath, `${lang}.traineddata.gz`);
    if (existsSync(target)) continue;
    const source = join(process.cwd(), "node_modules", "@tesseract.js-data", lang, "4.0.0", `${lang}.traineddata.gz`);
    copyFileSync(source, target);
  }
}

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ensureOcrLangData();
    ocrWorkerPromise = createWorker("eng+rus", 1, {
      langPath: ocrLangPath,
      cachePath: ocrCachePath,
      gzip: true
    }).then(async (worker) => {
      await worker.setParameters(commonTessParams);
      return worker;
    });
  }
  return ocrWorkerPromise;
}

async function preprocessOcrImage(buffer, mode) {
  if (mode === "original") return buffer;

  const dir = await mkdtemp(join(tmpdir(), "multitool-ocr-"));
  const input = join(dir, "input");
  const output = join(dir, `${mode}.png`);
  const vf =
    mode === "gray"
      ? "scale=iw*2:ih*2:flags=lanczos,format=gray,unsharp=5:5:0.8:3:3:0.35"
      : mode === "contrast"
        ? "scale=iw*2:ih*2:flags=lanczos,format=gray,eq=contrast=1.55:brightness=0.04:saturation=0,unsharp=5:5:0.9:3:3:0.4"
        : mode === "soft-binary"
          ? "scale=iw*2:ih*2:flags=lanczos,format=gray,eq=contrast=1.8:brightness=0.05:saturation=0,lut=y='if(gt(val,145),255,0)'"
          : "scale=iw*3:ih*3:flags=lanczos,format=gray,eq=contrast=1.35:brightness=0.03:saturation=0,unsharp=5:5:0.7:3:3:0.3";

  try {
    await writeFile(input, buffer);
    await runProcess(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vf", vf, "-frames:v", "1", output], 20000);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function scoreOcrResult(result) {
  const text = String(result?.data?.text || "").trim();
  const confidence = Number(result?.data?.confidence || 0);
  const usefulChars = (text.match(/[A-Za-zА-Яа-яЁё0-9]/g) || []).length;
  const cyrillicChars = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const weirdChars = (text.match(/[^\sA-Za-zА-Яа-яЁё0-9.,:;!?'"()/%№+=\-–—«»]/g) || []).length;
  const lines = text.split(/\n+/).filter((line) => line.trim().length > 1).length;
  return confidence + usefulChars * 0.32 + cyrillicChars * 0.18 + lines * 0.8 - weirdChars * 2.2;
}

function runOcrJob(fileBuffer) {
  const job = ocrQueue.then(async () => {
    const worker = await getOcrWorker();
    const variants = ["contrast", "gray", "upscale", "soft-binary", "original"];
    let best = null;

    for (const variant of variants) {
      try {
        const prepared = await preprocessOcrImage(fileBuffer, variant);
        const result = await worker.recognize(prepared, {
          rotateAuto: true
        });
        if (!best || scoreOcrResult(result) > scoreOcrResult(best)) best = result;
      } catch (error) {
        if (variant === "original") throw error;
      }
    }

    return best?.data?.text?.trim() || "";
  });
  ocrQueue = job.catch(() => undefined);
  return job;
}

function runProcess(command, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    if (!command) {
      reject(new Error("Required executable was not found."));
      return;
    }
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Operation timed out."));
    }, timeoutMs);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Process exited with code ${code}.`));
    });
  });
}

async function extractDocumentText(file) {
  const name = String(file.originalname || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();

  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".json") || name.endsWith(".html")) {
    return file.buffer.toString("utf8");
  }

  if (name.endsWith(".docx") || mime.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value.trim();
  }

  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  if (name.endsWith(".doc")) {
    throw new Error("Старый .doc без LibreOffice/antiword локально не читается надёжно. Сохраните файл как .docx или PDF.");
  }

  throw new Error("Этот формат документа пока не поддерживается локальным конвертером.");
}

async function extractAudioForTranscription(file) {
  const dir = await mkdtemp(join(tmpdir(), "multitool-transcribe-"));
  const input = join(dir, file.originalname || "input.bin");
  const output = join(dir, "audio.wav");
  try {
    await writeFile(input, file.buffer);
    await runProcess(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      input,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-t",
      "600",
      output
    ], 120000);
    const audio = await readFile(output);
    return {
      mimeType: "audio/wav",
      bytes: audio.toString("base64")
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runLocalSpeechRecognition(wavPath) {
  const script = `
Add-Type -AssemblyName System.Speech
$cultureNames = @('ru-RU','en-US')
$recognizer = $null
foreach ($cultureName in $cultureNames) {
  try {
    $culture = [System.Globalization.CultureInfo]::GetCultureInfo($cultureName)
    $candidate = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
    if ($candidate) { $recognizer = $candidate; break }
  } catch {}
}
if ($null -eq $recognizer) {
  throw 'Локальный распознаватель речи Windows для ru-RU/en-US не установлен.'
}
$grammar = New-Object System.Speech.Recognition.DictationGrammar
$recognizer.LoadGrammar($grammar)
$recognizer.SetInputToWaveFile('${wavPath.replace(/'/g, "''")}')
$lines = New-Object System.Collections.Generic.List[string]
while ($true) {
  $result = $recognizer.Recognize([TimeSpan]::FromSeconds(8))
  if ($null -eq $result) { break }
  if ($result.Text) { $lines.Add($result.Text) }
}
$recognizer.Dispose()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::Write(($lines -join [Environment]::NewLine))
`;
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], {
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Локальная транскрипция заняла слишком много времени."));
    }, 180000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || "Локальная транскрипция недоступна."));
    });
  });
}

async function transcribeMedia(file) {
  const dir = await mkdtemp(join(tmpdir(), "multitool-transcribe-"));
  const input = join(dir, file.originalname || "input.bin");
  const output = join(dir, "audio.wav");
  try {
    await writeFile(input, file.buffer);
    await runProcess(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      input,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-t",
      "600",
      output
    ], 120000);
    const text = await runLocalSpeechRecognition(output);
    return text || "Локальный распознаватель речи не нашёл разборчивого текста.";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function getOutputMime(outputName) {
  const ext = outputName.split(".").pop()?.toLowerCase();
  if (ext === "webm") return "video/webm";
  if (ext === "gif") return "image/gif";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "m4a") return "audio/mp4";
  return "video/mp4";
}

async function convertMediaFile(file, args, outputName) {
  const dir = await mkdtemp(join(tmpdir(), "multitool-ffmpeg-"));
  const inputExt = (file.originalname || "input.bin").split(".").pop() || "bin";
  const input = join(dir, `input.${inputExt}`);
  const output = join(dir, outputName);
  try {
    await writeFile(input, file.buffer);
    await runProcess(ffmpegPath, args(input, output), 240000);
    const data = await readFile(output);
    return {
      data,
      mimeType: getOutputMime(outputName)
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const translationLanguageCodes = {
  auto: "auto",
  ru: "ru",
  en: "en",
  es: "es",
  de: "de",
  fr: "fr",
  it: "it",
  pt: "pt",
  zh: "zh-CN",
  ja: "ja",
  ko: "ko",
  tr: "tr",
  ar: "ar",
  hi: "hi",
  pl: "pl",
  uk: "uk"
};

function detectSourceLanguage(text, target) {
  if (/[іїєґ]/i.test(text)) return "uk";
  if (/[а-яё]/i.test(text)) return "ru";
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\u3400-\u9fff]/.test(text)) return "zh-CN";
  if (/[\uac00-\ud7af]/.test(text)) return "ko";
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  return target === "en" ? "ru" : "en";
}

function splitTranslationText(text, maxLength = 900) {
  const chunks = [];
  let current = "";
  const lines = text.split(/(\n+)/);

  for (const line of lines) {
    if (line.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let index = 0; index < line.length; index += maxLength) {
        chunks.push(line.slice(index, index + maxLength));
      }
      continue;
    }
    if (current.length + line.length > maxLength) {
      chunks.push(current);
      current = "";
    }
    current += line;
  }

  if (current) chunks.push(current);
  return chunks;
}

async function translateWithMyMemory(text, source, target) {
  const sourceCode = translationLanguageCodes[source] || source;
  const targetCode = translationLanguageCodes[target] || target;
  const resolvedSource = sourceCode === "auto" ? detectSourceLanguage(text, targetCode) : sourceCode;
  if (!resolvedSource || !targetCode) throw new Error("Unsupported translation language.");
  if (resolvedSource === targetCode) return text;

  const chunks = splitTranslationText(text);
  const translated = [];

  for (const chunk of chunks) {
    const params = new URLSearchParams({
      q: chunk,
      langpair: `${resolvedSource}|${targetCode}`
    });
    const response = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Translation API returned ${response.status}.`);
    const data = await response.json();
    const translatedText = data?.responseData?.translatedText;
    if (typeof translatedText !== "string") {
      throw new Error(data?.responseDetails || "Translation API did not return text.");
    }
    translated.push(translatedText);
  }

  return translated.join("");
}

function getPublicOrigin(req) {
  const origin = req.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) return parsed.origin;
    } catch {
      // Fall back to the request host below.
    }
  }
  return `${req.protocol}://${req.get("host")}`;
}

function normalizeIp(value) {
  const ip = String(value || "").trim();
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  if (ip === "::1") return "127.0.0.1";
  return ip;
}

function getClientIp(req) {
  const forwarded = String(req.get("x-forwarded-for") || "")
    .split(",")
    .map((item) => normalizeIp(item))
    .find(Boolean);
  return forwarded || normalizeIp(req.ip) || normalizeIp(req.socket?.remoteAddress) || "";
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model,
    textModel,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    ocrConfigured: true
  });
});

app.get("/api/client-info", (req, res) => {
  res.json({
    ip: getClientIp(req) || "unknown",
    host: req.get("host") || "",
    protocol: req.protocol,
    userAgent: req.get("user-agent") || ""
  });
});

app.post("/api/ocr", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Image file is required." });
      return;
    }
    if (!req.file.mimetype?.startsWith("image/")) {
      res.status(400).json({ error: "Only image files are supported." });
      return;
    }

    const text = await runOcrJob(req.file.buffer);
    res.json({ text });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "OCR failed."
    });
  }
});

app.post("/api/translate", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const source = String(req.body?.source || "auto").trim();
    const target = String(req.body?.target || "en").trim();

    if (!text) {
      res.status(400).json({ error: "Text is required." });
      return;
    }
    if (text.length > 5000) {
      res.status(413).json({ error: "Text is too long for the free translation API. Use up to 5000 characters." });
      return;
    }

    const translatedText = await translateWithMyMemory(text, source, target);
    res.json({ text: translatedText });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Translation failed."
    });
  }
});

app.post("/api/document-text", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "File is required." });
      return;
    }
    const text = await extractDocumentText(req.file);
    res.json({ text });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Document conversion failed."
    });
  }
});

app.post("/api/transcribe-prep", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "File is required." });
      return;
    }
    const audio = await extractAudioForTranscription(req.file);
    res.json({
      ...audio,
      note: "Аудио подготовлено локальным backend. Распознавание выполняется браузерным Web Speech API, если он доступен в текущем браузере."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Audio preparation failed."
    });
  }
});

app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "File is required." });
      return;
    }
    const text = await transcribeMedia(req.file);
    res.json({ text });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Transcription failed."
    });
  }
});

app.post("/api/ffmpeg-run", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "File is required." });
      return;
    }
    const job = String(req.body?.job || "");
    const target = String(req.body?.target || "mp4");
    const start = Math.max(0, Number(req.body?.start || 0));
    const duration = Math.min(600, Math.max(0.1, Number(req.body?.duration || 8)));
    const quality = Math.min(40, Math.max(16, Number(req.body?.quality || 28)));
    const tempo = Math.min(2, Math.max(0.5, Number(req.body?.tempo || 1)));
    const volume = Math.min(3, Math.max(0.2, Number(req.body?.volume || 1)));
    const inputBase = String(req.file.originalname || "media").replace(/\.[^.]+$/, "") || "media";

    const jobs = {
      video: () => {
        const ext = ["mp4", "webm", "gif"].includes(target) ? target : "mp4";
        const out = `${inputBase}.${ext}`;
        if (ext === "gif") {
          return {
            out,
            args: (input, output) => [
              "-hide_banner", "-loglevel", "error", "-y", "-i", input,
              "-vf", "fps=12,scale=720:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
              "-loop", "0",
              output
            ]
          };
        }
        return {
          out,
          args: (input, output) => ext === "webm"
            ? ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-map", "0:v:0", "-map", "0:a?", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "32", "-c:a", "libopus", "-b:a", "128k", output]
            : ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", output]
        };
      },
      audio: () => ({
        out: `${inputBase}.mp3`,
        args: (input, output) => ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", "-b:a", "192k", output]
      }),
      "video-compressor": () => ({
        out: `${inputBase}.mp4`,
        args: (input, output) => ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", String(quality), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output]
      }),
      "video-to-gif": () => ({
        out: `${inputBase}.gif`,
        args: (input, output) => [
          "-hide_banner", "-loglevel", "error", "-y", "-ss", String(start), "-t", String(duration), "-i", input,
          "-vf", "fps=12,scale=720:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
          "-loop", "0",
          output
        ]
      }),
      "media-trimmer": () => ({
        out: `${inputBase}-trimmed.mp4`,
        args: (input, output) => ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(start), "-t", String(duration), "-i", input, "-map", "0:v?", "-map", "0:a?", "-c", "copy", output]
      }),
      "audio-converter": () => {
        const ext = ["mp3", "wav", "ogg", "m4a"].includes(target) ? target : "mp3";
        return {
          out: `${inputBase}.${ext}`,
          args: (input, output) => {
            if (ext === "wav") return ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", output];
            if (ext === "ogg") return ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", "-c:a", "libvorbis", "-q:a", "5", output];
            if (ext === "m4a") return ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", "-c:a", "aac", "-b:a", "192k", output];
            return ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", "-b:a", "192k", output];
          }
        };
      },
      "speed-volume": () => ({
        out: `${inputBase}.mp3`,
        args: (input, output) => ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-filter:a", `atempo=${tempo.toFixed(2)},volume=${volume.toFixed(2)}`, "-vn", "-b:a", "192k", output]
      })
    };

    const config = jobs[job]?.();
    if (!config) {
      res.status(400).json({ error: "Unknown media job." });
      return;
    }
    const result = await convertMediaFile(req.file, config.args, config.out);
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("X-Output-Name", encodeURIComponent(config.out));
    res.send(result.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Media processing failed."
    });
  }
});

app.post("/api/shorten", (req, res) => {
  const url = String(req.body?.url || "").trim();
  try {
    if (!url || url.length > 2048) throw new Error("URL length is invalid.");
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http and https links are supported.");
    const id = createShortId();
    shortLinks.set(id, { url: parsed.toString(), createdAt: Date.now() });
    trimShortLinks();
    const publicOrigin = getPublicOrigin(req);
    res.json({
      id,
      shortUrl: `${publicOrigin}/s/${id}`,
      target: parsed.toString()
    });
  } catch {
    res.status(400).json({ error: "Enter a valid http or https URL." });
  }
});

app.get("/s/:id", (req, res) => {
  if (!/^[a-f0-9]{10}$/i.test(req.params.id)) {
    res.status(404).send("Link not found");
    return;
  }
  const entry = shortLinks.get(req.params.id);
  if (!entry?.url) {
    res.status(404).send("Link not found");
    return;
  }
  res.redirect(entry.url);
});

app.post("/api/gemini-text", async (req, res) => {
  try {
    const ai = requireGemini(res);
    if (!ai) return;

    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required." });
      return;
    }

    const response = await ai.models.generateContent({
      model: textModel,
      contents: prompt
    });
    const text = extractText(response);
    res.json({ text });
  } catch (error) {
    console.error(error);
    const geminiError = getGeminiError(error, "Gemini request failed.");
    res.status(geminiError.statusCode).json({ error: geminiError.message });
  }
});

app.post("/api/file-text", upload.single("file"), async (req, res) => {
  try {
    const ai = requireGemini(res);
    if (!ai) return;

    if (!req.file) {
      res.status(400).json({ error: "File is required." });
      return;
    }

    const prompt =
      String(req.body?.prompt || "").trim() ||
      "Extract the useful text from this file. Preserve structure when possible and return plain text only.";

    const response = await ai.models.generateContent({
      model: textModel,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: req.file.mimetype || "application/octet-stream",
            data: req.file.buffer.toString("base64")
          }
        }
      ]
    });
    const text = extractText(response);
    res.json({ text });
  } catch (error) {
    console.error(error);
    const geminiError = getGeminiError(error, "File processing failed.");
    res.status(geminiError.statusCode).json({ error: geminiError.message });
  }
});

app.post("/api/upscale", upload.single("image"), async (req, res) => {
  try {
    const ai = requireGemini(res);
    if (!ai) return;

    if (!req.file) {
      res.status(400).json({ error: "Image file is required." });
      return;
    }

    const scale = ["2x", "4x"].includes(req.body.scale) ? req.body.scale : "2x";
    const prompt =
      req.body.prompt ||
      `Upscale this image by ${scale}. Preserve the original composition, colors, identity, geometry, text, and camera perspective. Increase apparent resolution and recover natural fine detail. Do not add new objects. Return only the improved image.`;

    const response = await ai.models.generateContent({
      model,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: req.file.mimetype || "image/png",
            data: req.file.buffer.toString("base64")
          }
        }
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    });

    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      const text = parts.map((part) => part.text).filter(Boolean).join("\n");
      res.status(502).json({
        error: text || "Gemini did not return an image."
      });
      return;
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const output = Buffer.from(imagePart.inlineData.data, "base64");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", "attachment; filename=\"upscaled.png\"");
    res.send(output);
  } catch (error) {
    console.error(error);
    const geminiError = getGeminiError(error, "Upscale failed.");
    res.status(geminiError.statusCode).json({ error: geminiError.message });
  }
});

app.use("/ffmpeg-core", express.static(ffmpegCorePath, {
  setHeaders(res) {
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  }
}));

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found." });
});

if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/.*/, (_req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
}

export default app;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, "127.0.0.1", () => {
    console.log(`Local API server: http://127.0.0.1:${port}`);
  });
}
