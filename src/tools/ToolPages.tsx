import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  AtSign,
  CalendarDays,
  Check,
  Copy,
  Download,
  Delete,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paintbrush,
  Play,
  RotateCcw,
  Sparkles,
  Wand2
} from "lucide-react";
import type { Tool } from "../types";
import { DropZone } from "../components/DropZone";
import { ProgressBar } from "../components/ProgressBar";
import { ResultCard } from "../components/ResultCard";
import {
  canvasToBlob,
  downloadBlob,
  downloadUrl,
  formatBytes,
  loadImage,
  makeObjectResult,
  parsePageRanges,
  replaceExtension,
  revokeResult,
  safeFileName,
  type FileResult
} from "../lib/files";
import type { Lang } from "../lib/i18n";

type ToolRendererProps = {
  tool: Tool;
  lang: Lang;
};

type ImageFormat = "png" | "jpeg" | "webp" | "avif";

const imageMime: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif"
};

const imageLabels: Record<ImageFormat, string> = {
  png: "PNG",
  jpeg: "JPG",
  webp: "WebP",
  avif: "AVIF"
};

async function loadPdfDocument() {
  const module = await import("pdf-lib");
  return module.PDFDocument;
}

export function ToolRenderer({ tool, lang }: ToolRendererProps) {
  switch (tool.slug) {
    case "image-converter":
      return <ImageConverterTool />;
    case "image-compressor":
      return <ImageCompressorTool />;
    case "image-resizer":
      return <ImageResizerTool />;
    case "background-remover":
      return <BackgroundRemoverTool lang={lang} />;
    case "image-upscaler":
      return <GeminiUpscaleTool lang={lang} />;
    case "image-ocr":
      return <FileAiTextTool kind="image-ocr" lang={lang} />;
    case "favicon-generator":
      return <FaviconTool lang={lang} />;
    case "image-collage":
      return <CollageTool lang={lang} />;
    case "photo-color-picker":
      return <PhotoColorPickerTool lang={lang} />;
    case "face-blur":
      return <BlurTool lang={lang} />;
    case "watermark":
      return <WatermarkTool lang={lang} />;
    case "video-converter":
      return <FfmpegTool mode="video" />;
    case "video-compressor":
      return <AdvancedFfmpegTool kind="video-compressor" lang={lang} />;
    case "video-to-gif":
      return <AdvancedFfmpegTool kind="video-to-gif" lang={lang} />;
    case "audio-extractor":
      return <FfmpegTool mode="audio" />;
    case "media-trimmer":
      return <AdvancedFfmpegTool kind="media-trimmer" lang={lang} />;
    case "audio-converter":
      return <AdvancedFfmpegTool kind="audio-converter" lang={lang} />;
    case "speed-volume":
      return <AdvancedFfmpegTool kind="speed-volume" lang={lang} />;
    case "screen-recorder":
      return <ScreenRecorderTool lang={lang} />;
    case "transcription":
      return <FileAiTextTool kind="transcription" lang={lang} />;
    case "pdf-tools":
      return <PdfTool />;
    case "pdf-compressor":
      return <PdfCompressorTool lang={lang} />;
    case "document-converter":
      return <FileAiTextTool kind="document-converter" lang={lang} />;
    case "text-tools":
      return <TextTool />;
    case "translator":
      return <GeminiTextTool kind="translator" lang={lang} />;
    case "text-speech":
      return <TextSpeechTool lang={lang} />;
    case "json-formatter":
      return <JsonFormatterTool lang={lang} />;
    case "qr-generator":
      return <QrTool />;
    case "password-generator":
      return <PasswordTool />;
    case "color-converter":
      return <ColorTool />;
    case "encoder":
      return <EncoderTool lang={lang} />;
    case "url-shortener":
      return <UrlShortenerTool lang={lang} />;
    case "slug-transliterator":
      return <SlugTransliteratorTool lang={lang} />;
    case "nickname-generator":
      return <NicknameGeneratorTool lang={lang} />;
    case "youtube-cover":
      return <YouTubeCoverTool lang={lang} />;
    case "markdown-html-json":
      return <MarkupConverterTool lang={lang} />;
    case "calculator":
      return <CalculatorTool lang={lang} />;
    case "unit-converter":
      return <UnitTool />;
    case "timer":
      return <TimerTool lang={lang} />;
    case "randomizer":
      return <RandomizerTool lang={lang} />;
    case "giveaway-wheel":
      return <GiveawayWheelTool lang={lang} />;
    case "notes":
      return <NotesTool lang={lang} />;
    case "date-calculator":
      return <DateCalculatorTool lang={lang} />;
    case "browser-info":
      return <DeviceInfoTool lang={lang} />;
    case "world-time":
      return <WorldTimeTool lang={lang} />;
    default:
      return <UniversalTextTool tool={tool} lang={lang} />;
  }
}

function useObjectResult() {
  const [result, setResult] = useState<FileResult | null>(null);

  const commitResult = (next: FileResult | null) => {
    setResult((current) => {
      revokeResult(current);
      return next;
    });
  };

  useEffect(() => () => revokeResult(result), [result]);

  return [result, commitResult] as const;
}

function ToolPanel({ children }: { children: React.ReactNode }) {
  return <div className="panel p-4 sm:p-5">{children}</div>;
}

function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-[var(--danger)]">
      {message}
    </div>
  );
}

function formatUnknownError(reason: unknown, fallback: string) {
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === "string" && reason.trim()) return reason;
  try {
    const serialized = JSON.stringify(reason);
    return serialized && serialized !== "{}" ? serialized : fallback;
  } catch {
    return fallback;
  }
}

function formatGeminiUiError(message: string, isEn: boolean) {
  if (/quota|rate.?limit|resource_exhausted|free_tier/i.test(message)) {
    return isEn
      ? "Image-model quota is exhausted for this API key. Use a key/project with available image generation quota."
      : "Квота image-модели исчерпана или равна нулю для этого API-ключа. Используйте ключ/проект с доступной квотой на генерацию изображений.";
  }
  if (/not found|not supported|model/i.test(message)) {
    return isEn
      ? "The selected image model is unavailable. Check the image model setting in .env."
      : "Выбранная image-модель недоступна. Проверьте настройку image-модели в .env.";
  }
  if (/fetch failed|network|econnreset|enotfound|etimedout/i.test(message)) {
    return isEn
      ? "The local app could not complete the AI request. Check internet access, proxy/VPN, and the API key."
      : "Локальное приложение не смогло выполнить AI-запрос. Проверьте интернет, proxy/VPN и API-ключ.";
  }
  return message;
}

async function localUpscaleFile(file: File, scale: "2x" | "4x") {
  const image = await loadImage(file);
  const multiplier = scale === "4x" ? 4 : 2;
  const maxSide = 8192;
  const naturalMax = Math.max(image.naturalWidth, image.naturalHeight);
  const safeMultiplier = Math.min(multiplier, Math.max(1, Math.floor(maxSide / naturalMax) || 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, image.naturalWidth * safeMultiplier);
  canvas.height = Math.max(1, image.naturalHeight * safeMultiplier);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, "image/png");
  return makeObjectResult(replaceExtension(file.name, `local-${safeMultiplier}x.png`), blob, file.size);
}

type WeightedItem = {
  label: string;
  weight: number;
  probability: number;
};

function parseWeightedItems(input: string) {
  const parsed = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)(?:\s+\/%?\s*(\d+(?:[.,]\d+)?))?$/);
      const label = (match?.[1] || line).trim();
      const weight = Math.max(0, Number((match?.[2] || "1").replace(",", ".")));
      return { label, weight: Number.isFinite(weight) ? weight : 1 };
    })
    .filter((item) => item.label && item.weight > 0);
  const total = parsed.reduce((sum, item) => sum + item.weight, 0) || 1;
  return parsed.map((item) => ({ ...item, probability: (item.weight / total) * 100 }));
}

function pickWeighted(items: WeightedItem[]) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }
  return items[items.length - 1] ?? null;
}

function conicFromItems(items: WeightedItem[]) {
  const colors = ["#7c3aed", "#06b6d4", "#22c55e", "#f97316", "#ec4899", "#eab308", "#3b82f6", "#ef4444"];
  let start = 0;
  const parts = items.map((item, index) => {
    const end = start + item.probability;
    const segment = `${colors[index % colors.length]} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${parts.join(", ")})`;
}

function ImageConverterTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [quality, setQuality] = useState(0.88);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useObjectResult();
  const file = files[0];

  const convert = async () => {
    if (!file) return;
    setIsBusy(true);
    setError("");
    try {
      const image = await loadImage(file);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas недоступен.");
      ctx.drawImage(image, 0, 0);
      const blob = await canvasToBlob(canvas, imageMime[format], format === "png" ? undefined : quality);
      setResult(makeObjectResult(replaceExtension(file.name, format === "jpeg" ? "jpg" : format), blob, file.size));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось конвертировать файл.");
      setResult(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <DropZone
          title="Перетащите картинку"
          description="Подойдут JPG, PNG, WebP, AVIF, GIF и SVG."
          accept="image/*"
          files={files}
          maxSizeMb={40}
          onFiles={setFiles}
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Формат результата</span>
            <select className="input" value={format} onChange={(event) => setFormat(event.target.value as ImageFormat)}>
              {Object.entries(imageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Качество: {Math.round(quality * 100)}%</span>
            <input
              className="w-full accent-[var(--accent)]"
              type="range"
              min="0.35"
              max="1"
              step="0.01"
              value={quality}
              disabled={format === "png"}
              onChange={(event) => setQuality(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={convert} disabled={!file || isBusy}>
            {isBusy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            Конвертировать
          </button>
        </div>
        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">Результат</h2>
        {result?.url && result.blob.type.startsWith("image/") ? (
          <img className="mb-4 max-h-72 w-full rounded-lg border border-[var(--line)] object-contain" src={result.url} alt="" />
        ) : null}
        <ResultCard result={result} />
      </ToolPanel>
    </div>
  );
}

function getResizePlan(image: HTMLImageElement, width: number, height: number, cropSquare: boolean, rotation: number) {
  const sourceSize = cropSquare ? Math.min(image.naturalWidth, image.naturalHeight) : null;
  const sourceX = sourceSize ? Math.round((image.naturalWidth - sourceSize) / 2) : 0;
  const sourceY = sourceSize ? Math.round((image.naturalHeight - sourceSize) / 2) : 0;
  const sourceW = sourceSize ?? image.naturalWidth;
  const sourceH = sourceSize ?? image.naturalHeight;
  const targetW = Math.max(1, Math.round(width));
  const targetH = Math.max(1, Math.round(cropSquare ? width : height));
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const radians = (normalizedRotation * Math.PI) / 180;
  const rotatedWidth = Math.ceil(Math.abs(targetW * Math.cos(radians)) + Math.abs(targetH * Math.sin(radians)));
  const rotatedHeight = Math.ceil(Math.abs(targetW * Math.sin(radians)) + Math.abs(targetH * Math.cos(radians)));
  return {
    sourceX,
    sourceY,
    sourceW,
    sourceH,
    targetW,
    targetH,
    rotation: normalizedRotation,
    radians,
    outputW: Math.max(1, rotatedWidth),
    outputH: Math.max(1, rotatedHeight)
  };
}

function drawResizePlan(ctx: CanvasRenderingContext2D, image: HTMLImageElement, plan: ReturnType<typeof getResizePlan>, scale = 1) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.rotate(plan.radians);
  ctx.drawImage(
    image,
    plan.sourceX,
    plan.sourceY,
    plan.sourceW,
    plan.sourceH,
    -((plan.targetW * scale) / 2),
    -((plan.targetH * scale) / 2),
    plan.targetW * scale,
    plan.targetH * scale
  );
  ctx.restore();
}

function ImageCompressorTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<"png" | "jpeg" | "webp">("webp");
  const [quality, setQuality] = useState(0.72);
  const [maxSide, setMaxSide] = useState(1920);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useObjectResult();
  const file = files[0];

  const compress = async () => {
    if (!file) return;
    setIsBusy(true);
    setError("");
    try {
      const image = await loadImage(file);
      const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * ratio));
      const height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas недоступен.");
      ctx.drawImage(image, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, imageMime[format], format === "png" ? undefined : quality);
      setResult(makeObjectResult(replaceExtension(file.name, format === "jpeg" ? "jpg" : format), blob, file.size));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сжать изображение.");
      setResult(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <DropZone
          title="Добавьте изображение"
          description="Лучше всего подходит для фотографий, скриншотов и больших web-изображений."
          accept="image/*"
          files={files}
          maxSizeMb={50}
          onFiles={setFiles}
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label>
            <span className="label">Формат</span>
            <select className="input" value={format} onChange={(event) => setFormat(event.target.value as "png" | "jpeg" | "webp")}>
              <option value="webp">WebP</option>
              <option value="jpeg">JPG</option>
              <option value="png">PNG</option>
            </select>
          </label>
          <label>
            <span className="label">Макс. сторона</span>
            <input className="input" type="number" min={320} max={8000} value={maxSide} onChange={(event) => setMaxSide(Number(event.target.value))} />
          </label>
          <label>
            <span className="label">Качество: {Math.round(quality * 100)}%</span>
            <input
              className="w-full accent-[var(--accent)]"
              type="range"
              min="0.25"
              max="0.98"
              step="0.01"
              value={quality}
              disabled={format === "png"}
              onChange={(event) => setQuality(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={compress} disabled={!file || isBusy}>
            {isBusy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Wand2 size={16} aria-hidden="true" />}
            Сжать
          </button>
        </div>
        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">Результат</h2>
        {result?.url ? <img className="mb-4 max-h-72 w-full rounded-lg border border-[var(--line)] object-contain" src={result.url} alt="" /> : null}
        <ResultCard result={result} />
      </ToolPanel>
    </div>
  );
}

function ImageResizerTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(800);
  const [keepRatio, setKeepRatio] = useState(true);
  const [cropSquare, setCropSquare] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null);
  const [result, setResult] = useObjectResult();
  const previewRef = useRef<HTMLCanvasElement>(null);
  const file = files[0];
  const naturalSize = sourceSize ? `${sourceSize.width} × ${sourceSize.height}` : "";

  useEffect(() => {
    let cancelled = false;
    setLoadedImage(null);
    setSourceSize(null);
    if (!file) return;
    loadImage(file)
      .then((image) => {
        if (cancelled) return;
        setLoadedImage(image);
        setSourceSize({ width: image.naturalWidth, height: image.naturalHeight });
        setWidth(image.naturalWidth);
        setHeight(image.naturalHeight);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedImage(null);
        setSourceSize(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!loadedImage) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const plan = getResizePlan(loadedImage, width, height, cropSquare, rotation);
    const scale = Math.min(1, 760 / plan.outputW, 430 / plan.outputH);
    canvas.width = Math.max(1, Math.round(plan.outputW * scale));
    canvas.height = Math.max(1, Math.round(plan.outputH * scale));
    drawResizePlan(ctx, loadedImage, plan, scale);
  }, [cropSquare, height, loadedImage, rotation, width]);

  useEffect(() => {
    if (cropSquare) setHeight(width);
  }, [cropSquare, width]);

  const updateWidth = (value: number) => {
    if (!Number.isFinite(value)) return;
    const safeValue = Math.max(1, Math.round(value));
    if (keepRatio && sourceSize) {
      setWidth(safeValue);
      setHeight(Math.max(1, Math.round((safeValue * sourceSize.height) / sourceSize.width)));
      return;
    }
    setWidth(safeValue);
  };

  const updateHeight = (value: number) => {
    if (!Number.isFinite(value)) return;
    const safeValue = Math.max(1, Math.round(value));
    if (keepRatio && sourceSize) {
      setHeight(safeValue);
      setWidth(Math.max(1, Math.round((safeValue * sourceSize.width) / sourceSize.height)));
      return;
    }
    setHeight(safeValue);
  };

  const process = async () => {
    if (!file) return;
    setIsBusy(true);
    setError("");
    try {
      const image = await loadImage(file);
      const plan = getResizePlan(image, width, height, cropSquare, rotation);
      const canvas = document.createElement("canvas");
      canvas.width = plan.outputW;
      canvas.height = plan.outputH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas недоступен.");
      drawResizePlan(ctx, image, plan, 1);
      const blob = await canvasToBlob(canvas, imageMime[format], format === "png" ? undefined : 0.9);
      setResult(makeObjectResult(replaceExtension(file.name, format === "jpeg" ? "jpg" : format), blob, file.size));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить изображение.");
      setResult(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <DropZone
          title="Добавьте изображение"
          description="Размер, квадратная обрезка и поворот."
          accept="image/*"
          files={files}
          maxSizeMb={50}
          onFiles={setFiles}
        />
        {naturalSize ? <p className="mt-3 text-sm text-[var(--muted)]">Исходный размер: {naturalSize}</p> : null}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="label">Ширина</span>
            <input className="input" type="number" min={1} value={width} onChange={(event) => updateWidth(Number(event.target.value))} />
          </label>
          <label>
            <span className="label">Высота</span>
            <input className="input" type="number" min={1} value={height} disabled={cropSquare} onChange={(event) => updateHeight(Number(event.target.value))} />
          </label>
          <label>
            <span className="label">Формат</span>
            <select className="input" value={format} onChange={(event) => setFormat(event.target.value as ImageFormat)}>
              {Object.entries(imageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Поворот</span>
            <input className="input" type="number" step="0.1" value={rotation} onChange={(event) => setRotation(Number(event.target.value))} />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <label className="badge cursor-pointer">
            <input className="accent-[var(--accent)]" type="checkbox" checked={keepRatio} onChange={(event) => setKeepRatio(event.target.checked)} />
            Сохранять пропорции
          </label>
          <label className="badge cursor-pointer">
            <input className="accent-[var(--accent)]" type="checkbox" checked={cropSquare} onChange={(event) => setCropSquare(event.target.checked)} />
            Обрезать квадратом
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={process} disabled={!file || isBusy}>
            {isBusy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
            Применить
          </button>
        </div>
        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">Предпросмотр</h2>
        <canvas ref={previewRef} className="mb-4 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)]" />
        {result?.url ? <img className="mb-4 max-h-72 w-full rounded-lg border border-[var(--line)] object-contain" src={result.url} alt="" /> : null}
        <ResultCard result={result} />
      </ToolPanel>
    </div>
  );
}

function GeminiUpscaleTool({ lang }: { lang: Lang }) {
  const isEn = lang === "en";
  const [files, setFiles] = useState<File[]>([]);
  const [scale, setScale] = useState<"2x" | "4x">("2x");
  const [mode, setMode] = useState<"gemini" | "local">("gemini");
  const [prompt, setPrompt] = useState("");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<FileResult[]>([]);
  const resultsRef = useRef<FileResult[]>([]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => () => resultsRef.current.forEach(revokeResult), []);

  const commitFiles = (nextFiles: File[]) => {
    const limited = nextFiles.slice(0, 40);
    if (nextFiles.length > 40) setError(isEn ? "Only the first 40 images were added." : "Добавлены только первые 40 изображений.");
    else setError("");
    resultsRef.current.forEach(revokeResult);
    setResults([]);
    setProgress(0);
    setMessage("");
    setFiles(limited);
  };

  const appendResult = (result: FileResult) => {
    setResults((current) => [...current, result]);
  };

  const runGeminiUpscale = async (file: File) => {
    const form = new FormData();
    form.append("image", file);
    form.append("scale", scale);
    if (prompt.trim()) form.append("prompt", prompt.trim());

    const response = await fetch("/api/upscale", {
      method: "POST",
      body: form
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || response.statusText);
      }
      throw new Error(await response.text());
    }

    const blob = await response.blob();
    const ext = blob.type.includes("jpeg") ? "jpg" : blob.type.includes("webp") ? "webp" : "png";
    return makeObjectResult(replaceExtension(file.name, `upscaled.${ext}`), blob, file.size);
  };

  const upscale = async () => {
    if (!files.length) return;
    setIsBusy(true);
    setError("");
    setProgress(8);
    resultsRef.current.forEach(revokeResult);
    setResults([]);
    setMessage(isEn ? "Preparing queue" : "Подготовка очереди");
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const baseProgress = (index / files.length) * 100;
        setProgress(Math.max(5, baseProgress));
        setMessage(`${isEn ? "Processing" : "Обработка"} ${index + 1}/${files.length}: ${file.name}`);
        try {
          const result = mode === "local" ? await localUpscaleFile(file, scale) : await runGeminiUpscale(file);
          appendResult(result);
        } catch (reason) {
          const rawMessage = reason instanceof Error ? reason.message : isEn ? "Upscale failed." : "Не удалось увеличить изображение.";
          const shouldFallback = mode === "gemini" && /quota|free tier|billing|resource_exhausted/i.test(rawMessage);
          if (!shouldFallback) throw reason;
          setError(formatGeminiUiError(rawMessage, isEn));
          setMessage(`${isEn ? "Local fallback" : "Локальный fallback"} ${index + 1}/${files.length}: ${file.name}`);
          appendResult(await localUpscaleFile(file, scale));
        }
      }
      setProgress(100);
      setMessage(isEn ? "Done" : "Готово");
    } catch (reason) {
      const rawMessage = reason instanceof Error ? reason.message : isEn ? "Upscale failed." : "Не удалось увеличить изображение.";
      setError(formatGeminiUiError(rawMessage, isEn));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <DropZone
          title={isEn ? "Upload images" : "Добавьте изображения"}
          description={isEn ? "Up to 40 images. They are processed one by one to avoid overload." : "До 40 изображений. Обработка идёт по очереди, без перегруза."}
          accept="image/png,image/jpeg,image/webp"
          multiple
          files={files}
          maxSizeMb={12}
          onFiles={commitFiles}
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label>
            <span className="label">{isEn ? "Scale" : "Масштаб"}</span>
            <select className="input" value={scale} onChange={(event) => setScale(event.target.value as "2x" | "4x")}>
              <option value="2x">2x</option>
              <option value="4x">4x</option>
            </select>
          </label>
          <label>
            <span className="label">{isEn ? "Engine" : "Движок"}</span>
            <select className="input" value={mode} onChange={(event) => setMode(event.target.value as "gemini" | "local")}>
              <option value="gemini">AI</option>
              <option value="local">{isEn ? "Local" : "Локально"}</option>
            </select>
          </label>
          <label>
            <span className="label">{isEn ? "Extra instruction" : "Доп. инструкция"}</span>
            <input
              className="input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={isEn ? "Preserve faces and text" : "Сохранить лица и текст"}
            />
          </label>
        </div>
        <div className="mt-5">
          <button className="btn-primary" onClick={upscale} disabled={!files.length || isBusy}>
            {isBusy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
            {mode === "gemini" ? (isEn ? "Upscale with AI" : "Увеличить через AI") : (isEn ? "Upscale locally" : "Увеличить локально")}
          </button>
        </div>
        {isBusy || progress > 0 ? (
          <div className="mt-5">
            <ProgressBar value={progress} label={message || (isEn ? "Progress" : "Прогресс")} />
          </div>
        ) : null}
        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{isEn ? "Result" : "Результат"}</h2>
        {results.length ? (
          <div className="grid gap-3">
            {results.map((result) => (
              <div key={result.url} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                {result.blob.type.startsWith("image/") ? <img className="mb-3 max-h-52 w-full rounded-lg border border-[var(--line)] object-contain" src={result.url} alt="" /> : null}
                <ResultCard result={result} />
              </div>
            ))}
          </div>
        ) : (
          <ResultCard result={null} note={isEn ? "AI mode needs available image quota. Local mode is ready immediately." : "AI-режиму нужна доступная image-квота. Локальный режим доступен сразу."} />
        )}
      </ToolPanel>
    </div>
  );
}

type FfmpegMode = "video" | "audio";

async function runFfmpegJob(
  file: File,
  outputName: string,
  args: (inputName: string, outputName: string) => string[],
  onProgress: (progress: number, message: string) => void
) {
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")]);
  const ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    onProgress(Math.max(15, Math.min(98, progress * 100)), "Обработка файла");
  });

  const baseURL = "/ffmpeg-core";
  onProgress(5, "Загрузка движка");
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
  });
  onProgress(15, "Подготовка файла");
  const inputName = `input.${file.name.split(".").pop() || "bin"}`;
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec(args(inputName, outputName));
  const data = await ffmpeg.readFile(outputName);
  onProgress(100, "Готово");
  return data instanceof Uint8Array ? data : new TextEncoder().encode(data);
}

async function runBackendMediaJob(
  file: File,
  fields: Record<string, string | number>,
  onProgress: (progress: number, message: string) => void
) {
  onProgress(10, "Загрузка файла");
  const form = new FormData();
  form.append("file", file);
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));

  let visualProgress = 18;
  const tick = window.setInterval(() => {
    visualProgress = Math.min(94, visualProgress + 4);
    onProgress(visualProgress, "Обработка на локальном backend");
  }, 900);
  try {
    const response = await fetch("/api/ffmpeg-run", { method: "POST", body: form });
    const blob = await response.blob();
    if (!response.ok) {
      let message = response.statusText;
      try {
        const data = JSON.parse(await blob.text()) as { error?: string };
        message = data.error || message;
      } catch {
        // Binary error fallback.
      }
      throw new Error(message);
    }
    const rawName = response.headers.get("X-Output-Name");
    const name = rawName ? decodeURIComponent(rawName) : replaceExtension(file.name, String(fields.target || "mp4"));
    onProgress(100, "Готово");
    return makeObjectResult(name, blob, file.size);
  } finally {
    window.clearInterval(tick);
  }
}

function FfmpegTool({ mode }: { mode: FfmpegMode }) {
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState<"mp4" | "webm" | "gif">("mp4");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useObjectResult();
  const file = files[0];

  const process = async () => {
    if (!file) return;
    setIsBusy(true);
    setError("");
    setProgress(0);
    setMessage("");
    try {
      const extension = mode === "audio" ? "mp3" : target;
      const result = await runBackendMediaJob(
        file,
        { job: mode, target: extension },
        (nextProgress, nextMessage) => {
          setProgress(nextProgress);
          setMessage(nextMessage);
        }
      );
      setResult(result);
    } catch (reason) {
      setError(
        formatUnknownError(reason, "Не удалось обработать файл. Попробуйте другой формат или файл меньшего размера.")
      );
      setResult(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <DropZone
          title={mode === "audio" ? "Добавьте видео" : "Добавьте видеофайл"}
          description={mode === "audio" ? "Аудиодорожка будет извлечена в MP3 на локальном backend." : "Обработка идёт на локальном backend через ffmpeg, без браузерного wasm."}
          accept="video/*,audio/*"
          files={files}
          maxSizeMb={180}
          onFiles={setFiles}
        />
        {mode === "video" ? (
          <label className="mt-5 block max-w-xs">
            <span className="label">Формат результата</span>
            <select className="input" value={target} onChange={(event) => setTarget(event.target.value as "mp4" | "webm" | "gif")}>
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
              <option value="gif">GIF</option>
            </select>
          </label>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={process} disabled={!file || isBusy}>
            {isBusy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {mode === "audio" ? "Извлечь звук" : "Конвертировать"}
          </button>
        </div>
        {isBusy || progress > 0 ? (
          <div className="mt-5">
            <ProgressBar value={progress} label={message || "Подготовка"} />
          </div>
        ) : null}
        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">Результат</h2>
        {result && mode === "video" && target !== "gif" ? (
          <video className="mb-4 max-h-72 w-full rounded-lg border border-[var(--line)]" src={result.url} controls />
        ) : null}
        {result && mode === "audio" ? <audio className="mb-4 w-full" src={result.url} controls /> : null}
        <ResultCard result={result} note="Для больших файлов обработка может занять несколько минут." />
      </ToolPanel>
    </div>
  );
}

function PdfTool() {
  const [mode, setMode] = useState<"merge" | "split">("merge");
  const [files, setFiles] = useState<File[]>([]);
  const [ranges, setRanges] = useState("1-3, 5");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useObjectResult();

  useEffect(() => {
    let cancelled = false;
    const file = files[0];
    if (mode !== "split" || !file) {
      setPageCount(null);
      return;
    }
    file
      .arrayBuffer()
      .then(async (buffer) => {
        const PDFDocument = await loadPdfDocument();
        return PDFDocument.load(buffer);
      })
      .then((doc) => {
        if (!cancelled) setPageCount(doc.getPageCount());
      })
      .catch(() => {
        if (!cancelled) setPageCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [files, mode]);

  const process = async () => {
    setIsBusy(true);
    setError("");
    try {
      const PDFDocument = await loadPdfDocument();
      if (mode === "merge") {
        if (files.length < 2) throw new Error("Добавьте минимум два PDF-файла.");
        const merged = await PDFDocument.create();
        for (const file of files) {
          const source = await PDFDocument.load(await file.arrayBuffer());
          const copiedPages = await merged.copyPages(source, source.getPageIndices());
          copiedPages.forEach((page) => merged.addPage(page));
        }
        const bytes = await merged.save();
        setResult(makeObjectResult("merged.pdf", new Blob([bytes], { type: "application/pdf" }), files.reduce((sum, file) => sum + file.size, 0)));
      } else {
        const file = files[0];
        if (!file) throw new Error("Добавьте PDF-файл.");
        const source = await PDFDocument.load(await file.arrayBuffer());
        const selectedPages = parsePageRanges(ranges, source.getPageCount());
        const output = await PDFDocument.create();
        const copiedPages = await output.copyPages(source, selectedPages);
        copiedPages.forEach((page) => output.addPage(page));
        const bytes = await output.save();
        setResult(makeObjectResult(replaceExtension(file.name, "pages.pdf"), new Blob([bytes], { type: "application/pdf" }), file.size));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обработать PDF.");
      setResult(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <div className="mb-5 inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-1">
          <button className={`btn px-3 ${mode === "merge" ? "bg-[var(--surface)] text-[var(--ink)] shadow-soft" : "text-[var(--muted)]"}`} onClick={() => setMode("merge")}>
            Объединить
          </button>
          <button className={`btn px-3 ${mode === "split" ? "bg-[var(--surface)] text-[var(--ink)] shadow-soft" : "text-[var(--muted)]"}`} onClick={() => setMode("split")}>
            Выбрать страницы
          </button>
        </div>
        <DropZone
          title={mode === "merge" ? "Добавьте PDF-файлы" : "Добавьте один PDF"}
          description={mode === "merge" ? "Файлы будут собраны в один документ в выбранном порядке." : "Укажите страницы или диапазоны через запятую."}
          accept="application/pdf,.pdf"
          multiple={mode === "merge"}
          files={files}
          maxSizeMb={80}
          onFiles={setFiles}
        />
        {mode === "split" ? (
          <label className="mt-5 block">
            <span className="label">Страницы {pageCount ? `(1-${pageCount})` : ""}</span>
            <input className="input" value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder="1-3, 5, 8-10" />
          </label>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={process} disabled={!files.length || isBusy}>
            {isBusy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
            Собрать PDF
          </button>
        </div>
        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">Результат</h2>
        <ResultCard result={result} />
      </ToolPanel>
    </div>
  );
}

function TextTool() {
  const [text, setText] = useState("MultiTool считает слова, чистит пробелы и быстро приводит текст в порядок.");
  const [copied, setCopied] = useState(false);
  const stats = useMemo(() => {
    const trimmed = text.trim();
    return {
      chars: text.length,
      charsNoSpaces: text.replace(/\s/g, "").length,
      words: trimmed ? trimmed.split(/\s+/u).length : 0,
      lines: text ? text.split(/\r\n|\r|\n/).length : 0
    };
  }, [text]);

  const copyText = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  const sentenceCase = () => {
    const lower = text.toLocaleLowerCase("ru-RU");
    setText(lower.replace(/(^\s*\p{L}|[.!?]\s*\p{L})/gu, (match) => match.toLocaleUpperCase("ru-RU")));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <ToolPanel>
        <label>
          <span className="label">Текст</span>
          <textarea className="input min-h-80 resize-y leading-6" value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setText(text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim())}>
            <Wand2 size={16} aria-hidden="true" />
            Почистить
          </button>
          <button className="btn-secondary" onClick={() => setText(text.toLocaleUpperCase("ru-RU"))}>
            В ВЕРХНИЙ
          </button>
          <button className="btn-secondary" onClick={() => setText(text.toLocaleLowerCase("ru-RU"))}>
            в нижний
          </button>
          <button className="btn-secondary" onClick={sentenceCase}>
            Предложения
          </button>
          <button className="btn-secondary" onClick={copyText}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? "Скопировано" : "Копировать"}
          </button>
          <button className="btn-secondary" onClick={() => downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), "text.txt")}>
            <Download size={16} aria-hidden="true" />
            TXT
          </button>
        </div>
        <div className="mt-5">
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">Статистика</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Слова", stats.words],
            ["Символы", stats.chars],
            ["Без пробелов", stats.charsNoSpaces],
            ["Строки", stats.lines]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <div className="text-2xl font-bold text-[var(--ink)]">{value}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{label}</div>
            </div>
          ))}
        </div>
      </ToolPanel>
    </div>
  );
}

type QrMode = "text" | "url" | "contact" | "wifi" | "email" | "phone" | "sms";

function escapeVCardValue(value: string) {
  return value.trim().replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function escapeWifiValue(value: string) {
  return value.trim().replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/:/g, "\\:");
}

function buildQrPayload(mode: QrMode, fields: Record<string, string>): string {
  switch (mode) {
    case "text":
      return fields.text.trim();
    case "url": {
      const raw = fields.url.trim();
      if (!raw) throw new Error("Введите ссылку.");
      const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const parsed = new URL(normalized);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Введите корректную ссылку.");
      return parsed.toString();
    }
    case "contact": {
      const name = fields.name.trim();
      if (!name) throw new Error("Укажите имя контакта.");
      const parts: string[] = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${escapeVCardValue(name)}`,
        fields.org.trim() ? `ORG:${escapeVCardValue(fields.org)}` : "",
        fields.phone.trim() ? `TEL;TYPE=CELL:${escapeVCardValue(fields.phone)}` : "",
        fields.email.trim() ? `EMAIL:${escapeVCardValue(fields.email)}` : "",
        fields.website.trim() ? `URL:${buildQrPayload("url", { url: fields.website })}` : "",
        fields.note.trim() ? `NOTE:${escapeVCardValue(fields.note)}` : "",
        "END:VCARD"
      ];
      return parts.filter(Boolean).join("\n");
    }
    case "wifi": {
      const ssid = fields.ssid.trim();
      if (!ssid) throw new Error("Укажите название сети.");
      const auth = fields.auth || "WPA";
      const password = escapeWifiValue(fields.password);
      const hidden = fields.hidden === "true" ? "true" : "false";
      return `WIFI:T:${auth};S:${escapeWifiValue(ssid)};${password ? `P:${password};` : ""}H:${hidden};;`;
    }
    case "email": {
      const email = fields.email.trim();
      if (!email) throw new Error("Укажите email.");
      const params = new URLSearchParams();
      if (fields.subject.trim()) params.set("subject", fields.subject.trim());
      if (fields.body.trim()) params.set("body", fields.body.trim());
      return `mailto:${email}${params.toString() ? `?${params.toString()}` : ""}`;
    }
    case "phone": {
      const phone = fields.phone.trim();
      if (!phone) throw new Error("Укажите номер телефона.");
      return `tel:${phone.replace(/\s+/g, "")}`;
    }
    case "sms": {
      const phone = fields.phone.trim();
      if (!phone) throw new Error("Укажите номер телефона.");
      const message = fields.message.trim();
      return `SMSTO:${phone.replace(/\s+/g, "")}:${message}`;
    }
    default:
      return "";
  }
}

function QrTool() {
  const [mode, setMode] = useState<QrMode>("url");
  const [text, setText] = useState("Привет!");
  const [url, setUrl] = useState("https://example.com");
  const [name, setName] = useState("Alex");
  const [org, setOrg] = useState("");
  const [phone, setPhone] = useState("+1 555 000 0000");
  const [email, setEmail] = useState("hello@example.com");
  const [website, setWebsite] = useState("https://example.com");
  const [note, setNote] = useState("");
  const [ssid, setSsid] = useState("My Wi-Fi");
  const [password, setPassword] = useState("supersecret");
  const [auth, setAuth] = useState("WPA");
  const [hidden, setHidden] = useState(false);
  const [subject, setSubject] = useState("Hello");
  const [body, setBody] = useState("This is a QR email.");
  const [message, setMessage] = useState("Hello from QR");
  const [size, setSize] = useState(320);
  const [dark, setDark] = useState("#0b0f19");
  const [light, setLight] = useState("#ffffff");
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");

  const payloadState = useMemo(() => {
    try {
      return { payload: buildQrPayload(mode, { text, url, name, org, phone, email, website, note, ssid, password, auth, hidden: String(hidden), subject, body, message }), error: "" };
    } catch (reason) {
      return { payload: "", error: reason instanceof Error ? reason.message : "Не удалось создать QR-код." };
    }
  }, [auth, body, email, hidden, message, mode, name, note, org, password, phone, ssid, subject, text, url, website]);

  useEffect(() => {
    let cancelled = false;
    if (!payloadState.payload) {
      setQrUrl("");
      setError(payloadState.error);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const { default: QRCode } = await import("qrcode");
        const urlValue = await QRCode.toDataURL(payloadState.payload || " ", {
          width: size,
          margin: 2,
          color: { dark, light },
          errorCorrectionLevel: "M"
        });
        if (!cancelled) {
          setQrUrl(urlValue);
          setError("");
        }
      } catch {
        if (!cancelled) setError("Не удалось создать QR-код.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dark, light, payloadState.error, payloadState.payload, size]);

  const modeButton = (value: QrMode, label: string) => (
    <button
      key={value}
      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${mode === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-2)] hover:border-[var(--line-strong)]"}`}
      onClick={() => setMode(value)}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_.9fr]">
      <ToolPanel>
        <div className="flex flex-wrap gap-2">
          {modeButton("url", "Ссылка")}
          {modeButton("text", "Текст")}
          {modeButton("contact", "Контакт")}
          {modeButton("wifi", "Wi‑Fi")}
          {modeButton("email", "Email")}
          {modeButton("phone", "Телефон")}
          {modeButton("sms", "SMS")}
        </div>

        <div className="mt-5 grid gap-4">
          {mode === "text" ? (
            <label>
              <span className="label">Текст</span>
              <textarea className="input min-h-36 resize-y" value={text} onChange={(event) => setText(event.target.value)} />
            </label>
          ) : null}

          {mode === "url" ? (
            <label>
              <span className="label">Ссылка</span>
              <input className="input" value={url} onChange={(event) => setUrl(event.target.value)} />
            </label>
          ) : null}

          {mode === "contact" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="label">Имя</span>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                <span className="label">Организация</span>
                <input className="input" value={org} onChange={(event) => setOrg(event.target.value)} />
              </label>
              <label>
                <span className="label">Телефон</span>
                <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </label>
              <label>
                <span className="label">Email</span>
                <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label>
                <span className="label">Сайт</span>
                <input className="input" value={website} onChange={(event) => setWebsite(event.target.value)} />
              </label>
              <label className="sm:col-span-2">
                <span className="label">Заметка</span>
                <textarea className="input min-h-28 resize-y" value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            </div>
          ) : null}

          {mode === "wifi" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="label">Название сети</span>
                <input className="input" value={ssid} onChange={(event) => setSsid(event.target.value)} />
              </label>
              <label>
                <span className="label">Пароль</span>
                <input className="input" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <label>
                <span className="label">Шифрование</span>
                <select className="input" value={auth} onChange={(event) => setAuth(event.target.value)}>
                  <option value="WPA">WPA/WPA2</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">Без пароля</option>
                </select>
              </label>
              <label className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--ink-2)]">
                <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
                Скрытая сеть
              </label>
            </div>
          ) : null}

          {mode === "email" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="label">Email</span>
                <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label>
                <span className="label">Тема</span>
                <input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} />
              </label>
              <label>
                <span className="label">Сообщение</span>
                <input className="input" value={body} onChange={(event) => setBody(event.target.value)} />
              </label>
            </div>
          ) : null}

          {mode === "phone" ? (
            <label>
              <span className="label">Телефон</span>
              <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
          ) : null}

          {mode === "sms" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="label">Телефон</span>
                <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </label>
              <label>
                <span className="label">Сообщение</span>
                <input className="input" value={message} onChange={(event) => setMessage(event.target.value)} />
              </label>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className="label">Размер: {size}px</span>
              <input className="w-full accent-[var(--accent)]" type="range" min="160" max="800" step="8" value={size} onChange={(event) => setSize(Number(event.target.value))} />
            </label>
            <label>
              <span className="label">Цвет</span>
              <input className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1" type="color" value={dark} onChange={(event) => setDark(event.target.value)} />
            </label>
            <label>
              <span className="label">Фон</span>
              <input className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1" type="color" value={light} onChange={(event) => setLight(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="mt-4">
          <ErrorMessage message={error || payloadState.error} />
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">QR-код</h2>
        <div className="flex min-h-80 items-center justify-center rounded-lg border border-[var(--line)] bg-white p-5">
          {qrUrl ? <img className="max-h-72 max-w-full" src={qrUrl} alt="QR-код" /> : null}
        </div>
        <button className="btn-primary mt-4 w-full" onClick={() => downloadUrl(qrUrl, "qr-code.png")} disabled={!qrUrl}>
          <Download size={16} aria-hidden="true" />
          Скачать PNG
        </button>
      </ToolPanel>
    </div>
  );
}

type PasswordOptions = {
  length: number;
  upper: boolean;
  lower: boolean;
  numbers: boolean;
  symbols: boolean;
};

const passwordSets = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lower: "abcdefghijkmnopqrstuvwxyz",
  numbers: "23456789",
  symbols: "!@#$%^&*_-+=?"
};

function randomFrom(chars: string) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return chars[buffer[0] % chars.length];
}

function createPassword(options: PasswordOptions) {
  const enabled = Object.entries(passwordSets)
    .filter(([key]) => options[key as keyof typeof passwordSets])
    .map(([, chars]) => chars);
  const pool = enabled.join("");
  if (!pool) return "";
  const required = enabled.map(randomFrom);
  while (required.length < options.length) required.push(randomFrom(pool));
  return required.sort(() => (crypto.getRandomValues(new Uint32Array(1))[0] % 3) - 1).join("");
}

function PasswordTool() {
  const [options, setOptions] = useState<PasswordOptions>({ length: 18, upper: true, lower: true, numbers: true, symbols: true });
  const [passwords, setPasswords] = useState<string[]>([]);
  const [copied, setCopied] = useState("");

  const generate = () => {
    setPasswords(Array.from({ length: 6 }, () => createPassword(options)).filter(Boolean));
  };

  useEffect(() => {
    generate();
  }, [options.length, options.upper, options.lower, options.numbers, options.symbols]);

  const toggle = (key: keyof Omit<PasswordOptions, "length">) => {
    setOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const copy = async (password: string) => {
    await navigator.clipboard.writeText(password);
    setCopied(password);
    window.setTimeout(() => setCopied(""), 1300);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <ToolPanel>
        <label>
          <span className="label">Длина: {options.length}</span>
          <input
            className="w-full accent-[var(--accent)]"
            type="range"
            min="8"
            max="64"
            value={options.length}
            onChange={(event) => setOptions((current) => ({ ...current, length: Number(event.target.value) }))}
          />
        </label>
        <div className="mt-5 grid gap-3">
          {[
            ["upper", "Заглавные буквы"],
            ["lower", "Строчные буквы"],
            ["numbers", "Цифры"],
            ["symbols", "Символы"]
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--ink-2)]">
              {label}
              <input className="accent-[var(--accent)]" type="checkbox" checked={options[key as keyof Omit<PasswordOptions, "length">]} onChange={() => toggle(key as keyof Omit<PasswordOptions, "length">)} />
            </label>
          ))}
        </div>
        <button className="btn-primary mt-5 w-full" onClick={generate}>
          <RotateCcw size={16} aria-hidden="true" />
          Сгенерировать
        </button>
        <div className="mt-5">
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">Варианты</h2>
        <div className="grid gap-3">
          {passwords.map((password) => (
            <button
              key={password}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-3 text-left transition hover:border-[var(--line-strong)]"
              onClick={() => copy(password)}
            >
              <span className="min-w-0 break-all font-mono text-sm font-semibold text-[var(--ink)]">{password}</span>
              <span className="shrink-0 text-[var(--accent)]">{copied === password ? <Check size={18} /> : <Copy size={18} />}</span>
            </button>
          ))}
        </div>
      </ToolPanel>
    </div>
  );
}

type Rgb = { r: number; g: number; b: number };

function clamp(value: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function rgbToHex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map((value) => clamp(Math.round(value)).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl({ r, g, b }: Rgb) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    if (max === gn) h = (bn - rn) / d + 2;
    if (max === bn) h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function parseColor(input: string): Rgb | null {
  const value = input.trim().toLowerCase();
  const hex = value.match(/^#?([a-f0-9]{3}|[a-f0-9]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split("").map((char) => char + char).join("") : hex[1];
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16)
    };
  }
  const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
  if (rgb) return { r: clamp(Number(rgb[1])), g: clamp(Number(rgb[2])), b: clamp(Number(rgb[3])) };
  const hsl = value.match(/^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/);
  if (hsl) return hslToRgb(Number(hsl[1]) % 360, clamp(Number(hsl[2]), 0, 100), clamp(Number(hsl[3]), 0, 100));
  return null;
}

function normalizeHue(value: number) {
  return ((Math.round(value) % 360) + 360) % 360;
}

function ColorTool() {
  const [input, setInput] = useState("#2563eb");
  const [hueShift, setHueShift] = useState(30);
  const [saturationShift, setSaturationShift] = useState(0);
  const [lightnessShift, setLightnessShift] = useState(0);
  const [copied, setCopied] = useState("");
  const spectrumRef = useRef<HTMLDivElement>(null);
  const color = parseColor(input);
  const hsl = color ? rgbToHsl(color) : null;
  const shifted = hsl ? hslToRgb(normalizeHue(hsl.h + hueShift), clamp(hsl.s + saturationShift, 0, 100), clamp(hsl.l + lightnessShift, 0, 100)) : null;
  const values = color && hsl
    ? [
        ["HEX", rgbToHex(color)],
        ["RGB", `rgb(${color.r}, ${color.g}, ${color.b})`],
        ["HSL", `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`],
        shifted ? ["Смещение", rgbToHex(shifted)] : null
      ]
        .filter(Boolean) as string[][]
    : [];
  const shadePalette = hsl
    ? [12, 24, 36, 48, 60, 72, 84, 92].map((lightness) => {
        const rgb = hslToRgb(hsl.h, hsl.s, lightness);
        return rgbToHex(rgb);
      })
    : [];
  const harmonyPalette = hsl
    ? [
        ["База", hsl.h],
        ["Сдвиг", hsl.h + hueShift],
        ["Компл.", hsl.h + 180],
        ["Аналог 1", hsl.h - 30],
        ["Аналог 2", hsl.h + 30],
        ["Триада 1", hsl.h + 120],
        ["Триада 2", hsl.h + 240]
      ].map(([label, hue]) => ({
        label: String(label),
        color: rgbToHex(hslToRgb(normalizeHue(Number(hue)), hsl.s, hsl.l))
      }))
    : [];
  const artTools = hsl
    ? [
        { label: "Теплее", color: rgbToHex(hslToRgb(normalizeHue(hsl.h + 18), hsl.s, hsl.l)) },
        { label: "Холоднее", color: rgbToHex(hslToRgb(normalizeHue(hsl.h - 18), hsl.s, hsl.l)) },
        { label: "Приглушить", color: rgbToHex(hslToRgb(hsl.h, clamp(hsl.s - 28, 0, 100), hsl.l)) },
        { label: "Ярче", color: rgbToHex(hslToRgb(hsl.h, clamp(hsl.s + 18, 0, 100), clamp(hsl.l + 6, 0, 100))) },
        { label: "Темнее", color: rgbToHex(hslToRgb(hsl.h, hsl.s, clamp(hsl.l - 16, 0, 100))) },
        { label: "Светлее", color: rgbToHex(hslToRgb(hsl.h, hsl.s, clamp(hsl.l + 16, 0, 100))) }
      ]
    : [];

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied(""), 1300);
  };

  const setHslInput = (nextH: number, nextS: number, nextL: number) => {
    setInput(rgbToHex(hslToRgb(normalizeHue(nextH), clamp(nextS, 0, 100), clamp(nextL, 0, 100))));
  };

  const pickFromSpectrum = (clientX: number, clientY: number) => {
    if (!hsl || !spectrumRef.current) return;
    const rect = spectrumRef.current.getBoundingClientRect();
    const sx = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const sy = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
    setHslInput(hsl.h, sx, 100 - sy);
  };

  const startSpectrumDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pickFromSpectrum(event.clientX, event.clientY);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
      <ToolPanel>
        <label>
          <span className="label">HEX, RGB или HSL</span>
          <input className="input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="#2563eb" />
        </label>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_48px]">
          <div
            ref={spectrumRef}
            className="relative h-56 cursor-crosshair overflow-hidden rounded-lg border border-[var(--line)] touch-none"
            style={{
              background: hsl
                ? `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsl.h} 100% 50%)`
                : "var(--surface-2)"
            }}
            onPointerDown={startSpectrumDrag}
            onPointerMove={(event) => {
              if (event.buttons === 1) pickFromSpectrum(event.clientX, event.clientY);
            }}
          >
            {hsl ? (
              <span
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.65)]"
                style={{ left: `${hsl.s}%`, top: `${100 - hsl.l}%` }}
              />
            ) : null}
          </div>
          <label
            className="block overflow-hidden rounded-lg border border-[var(--line)]"
            style={{ background: "linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
          >
            <span className="sr-only">Hue</span>
            <input
              className="h-56 w-full cursor-pointer accent-white [writing-mode:vertical-lr]"
              type="range"
              min="0"
              max="359"
              value={hsl?.h ?? 0}
              onChange={(event) => setHslInput(Number(event.target.value), hsl?.s ?? 80, hsl?.l ?? 50)}
            />
          </label>
        </div>
        <div className="mt-3 h-16 rounded-lg border border-[var(--line)]" style={{ background: color ? rgbToHex(color) : "var(--surface-2)" }} />
        {!color ? <p className="mt-3 text-sm font-semibold text-[var(--danger)]">Введите цвет в формате HEX, rgb(...) или hsl(...).</p> : null}
        <div className="mt-5 grid gap-4">
          <label>
            <span className="label">Смещение тона: {hueShift}°</span>
            <input className="w-full accent-[var(--accent)]" type="range" min="-180" max="180" step="1" value={hueShift} onChange={(event) => setHueShift(Number(event.target.value))} />
          </label>
          <label>
            <span className="label">Насыщенность: {saturationShift > 0 ? "+" : ""}{saturationShift}%</span>
            <input className="w-full accent-[var(--accent)]" type="range" min="-60" max="60" step="1" value={saturationShift} onChange={(event) => setSaturationShift(Number(event.target.value))} />
          </label>
          <label>
            <span className="label">Светлота: {lightnessShift > 0 ? "+" : ""}{lightnessShift}%</span>
            <input className="w-full accent-[var(--accent)]" type="range" min="-50" max="50" step="1" value={lightnessShift} onChange={(event) => setLightnessShift(Number(event.target.value))} />
          </label>
          {shifted ? (
            <button className="overflow-hidden rounded-lg border border-[var(--line)] text-left" onClick={() => copy(rgbToHex(shifted))}>
              <span className="block h-16" style={{ background: rgbToHex(shifted) }} />
              <span className="flex items-center justify-between bg-[var(--surface-2)] px-3 py-2 font-mono text-xs font-semibold text-[var(--ink-2)]">
                {rgbToHex(shifted)}
                {copied === rgbToHex(shifted) ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              </span>
            </button>
          ) : null}
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">Значения</h2>
        <div className="grid gap-3">
          {values.map(([label, value]) => (
            <button
              key={label}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-3 text-left transition hover:border-[var(--line-strong)]"
              onClick={() => copy(value)}
            >
              <span className="text-sm font-bold text-[var(--muted)]">{label}</span>
              <span className="min-w-0 truncate font-mono text-sm font-semibold text-[var(--ink)]">{value}</span>
              <span className="shrink-0 text-[var(--accent)]">{copied === value ? <Check size={17} /> : <Copy size={17} />}</span>
            </button>
          ))}
        </div>
        {harmonyPalette.length ? (
          <>
            <h3 className="mb-3 mt-6 text-sm font-bold text-[var(--ink-2)]">Гармония</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {harmonyPalette.map((item) => (
                <button key={`${item.label}-${item.color}`} className="overflow-hidden rounded-lg border border-[var(--line)] text-left" onClick={() => copy(item.color)}>
                  <span className="block h-14" style={{ background: item.color }} />
                  <span className="block bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--ink-2)]">
                    {item.label}
                    <span className="mt-1 block font-mono">{item.color}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        {shadePalette.length ? (
          <>
            <h3 className="mb-3 mt-6 text-sm font-bold text-[var(--ink-2)]">Палитра оттенков</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {shadePalette.map((item) => (
                <button key={item} className="overflow-hidden rounded-lg border border-[var(--line)] text-left" onClick={() => copy(item)}>
                  <span className="block h-14" style={{ background: item }} />
                  <span className="block bg-[var(--surface-2)] px-3 py-2 font-mono text-xs font-semibold text-[var(--ink-2)]">{item}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        {artTools.length ? (
          <>
            <h3 className="mb-3 mt-6 text-sm font-bold text-[var(--ink-2)]">Инструменты художника</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {artTools.map((item) => (
                <button key={item.label} className="overflow-hidden rounded-lg border border-[var(--line)] text-left" onClick={() => copy(item.color)}>
                  <span className="block h-12" style={{ background: item.color }} />
                  <span className="block bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--ink-2)]">
                    {item.label}
                    <span className="mt-1 block font-mono">{item.color}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </ToolPanel>
    </div>
  );
}

const unitGroups = {
  length: {
    label: "Длина",
    units: {
      mm: { label: "Миллиметры", factor: 0.001 },
      cm: { label: "Сантиметры", factor: 0.01 },
      m: { label: "Метры", factor: 1 },
      km: { label: "Километры", factor: 1000 },
      in: { label: "Дюймы", factor: 0.0254 },
      ft: { label: "Футы", factor: 0.3048 },
      mi: { label: "Мили", factor: 1609.344 }
    }
  },
  weight: {
    label: "Вес",
    units: {
      mg: { label: "Миллиграммы", factor: 0.000001 },
      g: { label: "Граммы", factor: 0.001 },
      kg: { label: "Килограммы", factor: 1 },
      t: { label: "Тонны", factor: 1000 },
      oz: { label: "Унции", factor: 0.0283495231 },
      lb: { label: "Фунты", factor: 0.45359237 }
    }
  },
  temperature: {
    label: "Температура",
    units: {
      c: { label: "Цельсий", factor: 1 },
      f: { label: "Фаренгейт", factor: 1 },
      k: { label: "Кельвин", factor: 1 }
    }
  }
} as const;

type UnitGroup = keyof typeof unitGroups;

function convertTemperature(value: number, from: string, to: string) {
  const celsius = from === "c" ? value : from === "f" ? ((value - 32) * 5) / 9 : value - 273.15;
  if (to === "c") return celsius;
  if (to === "f") return (celsius * 9) / 5 + 32;
  return celsius + 273.15;
}

function UnitTool() {
  const [group, setGroup] = useState<UnitGroup>("length");
  const [from, setFrom] = useState("m");
  const [to, setTo] = useState("km");
  const [value, setValue] = useState(100);
  const units = unitGroups[group].units as Record<string, { label: string; factor: number }>;
  const unitKeys = Object.keys(units);
  const safeFrom = units[from] ? from : unitKeys[0];
  const safeTo = units[to] ? to : unitKeys[1] ?? unitKeys[0];

  useEffect(() => {
    const keys = Object.keys(unitGroups[group].units);
    setFrom(keys[0]);
    setTo(keys[1] ?? keys[0]);
  }, [group]);

  const result = useMemo(() => {
    if (group === "temperature") return convertTemperature(value, safeFrom, safeTo);
    return (value * units[safeFrom].factor) / units[safeTo].factor;
  }, [group, safeFrom, safeTo, units, value]);

  const oneUnit = group === "temperature" ? convertTemperature(1, safeFrom, safeTo) : units[safeFrom].factor / units[safeTo].factor;

  return (
    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <ToolPanel>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Категория</span>
            <select className="input" value={group} onChange={(event) => setGroup(event.target.value as UnitGroup)}>
              {Object.entries(unitGroups).map(([key, data]) => (
                <option key={key} value={key}>
                  {data.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Значение</span>
            <input className="input" type="number" value={value} onChange={(event) => setValue(Number(event.target.value))} />
          </label>
          <label>
            <span className="label">Из</span>
            <select className="input" value={safeFrom} onChange={(event) => setFrom(event.target.value)}>
              {Object.entries(units).map(([key, data]) => (
                <option key={key} value={key}>
                  {data.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">В</span>
            <select className="input" value={safeTo} onChange={(event) => setTo(event.target.value)}>
              {Object.entries(units).map(([key, data]) => (
                <option key={key} value={key}>
                  {data.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5">
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">Результат</h2>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5">
          <div className="text-3xl font-bold text-[var(--ink)]">{Number.isFinite(result) ? result.toLocaleString("ru-RU", { maximumFractionDigits: 8 }) : "0"}</div>
          <div className="mt-2 text-sm font-semibold text-[var(--muted)]">{units[safeTo]?.label}</div>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
          <div>
            {value.toLocaleString("ru-RU")} {units[safeFrom]?.label}
          </div>
          <div>
            1 {units[safeFrom]?.label} = {oneUnit.toLocaleString("ru-RU", { maximumFractionDigits: 8 })} {units[safeTo]?.label}
          </div>
        </div>
      </ToolPanel>
    </div>
  );
}

function t(lang: Lang, ru: string, en: string) {
  return lang === "en" ? en : ru;
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value);
}

function downloadText(text: string, fileName: string) {
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), fileName);
}

async function callOcrFile(file: File) {
  const form = new FormData();
  form.append("image", file);
  const response = await fetch("/api/ocr", { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data.text || "";
}

async function callTranslationApi(text: string, source: string, target: string) {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source, target })
  });
  const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data.text || "";
}

async function callDocumentTextApi(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/document-text", { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data.text || "";
}

async function callTranscriptionApi(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/transcribe", { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data.text || "";
}

function drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 4) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  return lines.length * lineHeight;
}

function BackgroundRemoverTool({ lang }: { lang: Lang }) {
  const [files, setFiles] = useState<File[]>([]);
  const [tolerance, setTolerance] = useState(42);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useObjectResult();
  const file = files[0];

  const process = async () => {
    if (!file) return;
    setIsBusy(true);
    setError("");
    try {
      const image = await loadImage(file);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas недоступен.");
      ctx.drawImage(image, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = frame.data;
      const key = [data[0], data[1], data[2]];
      const soft = tolerance * 1.8;
      for (let index = 0; index < data.length; index += 4) {
        const distance = Math.hypot(data[index] - key[0], data[index + 1] - key[1], data[index + 2] - key[2]);
        if (distance < tolerance) data[index + 3] = 0;
        else if (distance < soft) data[index + 3] = Math.round(255 * ((distance - tolerance) / (soft - tolerance)));
      }
      ctx.putImageData(frame, 0, 0);
      const blob = await canvasToBlob(canvas, "image/png");
      setResult(makeObjectResult(replaceExtension(file.name, "transparent.png"), blob, file.size));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить фон.");
      setResult(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <DropZone
          title={t(lang, "Добавьте изображение", "Upload an image")}
          description={t(lang, "Цвет фона берётся из левого верхнего пикселя. Лучше всего работает на однотонном фоне.", "The background color is sampled from the top-left pixel. Best for solid backgrounds.")}
          accept="image/*"
          files={files}
          maxSizeMb={40}
          onFiles={setFiles}
        />
        <label className="mt-5 block">
          <span className="label">{t(lang, "Допуск цвета", "Color tolerance")}: {tolerance}</span>
          <input className="w-full accent-[var(--accent)]" type="range" min="5" max="130" value={tolerance} onChange={(event) => setTolerance(Number(event.target.value))} />
        </label>
        <button className="btn-primary mt-5" onClick={process} disabled={!file || isBusy}>
          {isBusy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Wand2 size={16} aria-hidden="true" />}
          {t(lang, "Удалить фон", "Remove background")}
        </button>
        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Результат", "Result")}</h2>
        {result?.url ? <img className="mb-4 max-h-72 w-full rounded-lg border border-[var(--line)] bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] object-contain" src={result.url} alt="" /> : null}
        <ResultCard result={result} />
      </ToolPanel>
    </div>
  );
}

function FaviconTool({ lang }: { lang: Lang }) {
  const [files, setFiles] = useState<File[]>([]);
  const [size, setSize] = useState(512);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useObjectResult();
  const [error, setError] = useState("");
  const file = files[0];

  const renderSize = async (targetSize: number) => {
    if (!file) throw new Error("Добавьте изображение.");
    const image = await loadImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas недоступен.");
    ctx.clearRect(0, 0, targetSize, targetSize);
    drawImageCover(ctx, image, 0, 0, targetSize, targetSize);
    return canvasToBlob(canvas, "image/png");
  };

  const generate = async () => {
    if (!file) return;
    setIsBusy(true);
    setError("");
    try {
      const blob = await renderSize(size);
      setResult(makeObjectResult(`favicon-${size}.png`, blob, file.size));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать favicon.");
      setResult(null);
    } finally {
      setIsBusy(false);
    }
  };

  const downloadSet = async () => {
    if (!file) return;
    setIsBusy(true);
    setError("");
    try {
      for (const item of [32, 48, 180, 192, 512]) {
        const blob = await renderSize(item);
        downloadBlob(blob, `favicon-${item}.png`);
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось скачать набор.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <DropZone title={t(lang, "Добавьте логотип", "Upload a logo")} description={t(lang, "Изображение будет обрезано в квадрат и подготовлено в PNG.", "The image will be cropped square and exported as PNG.")} accept="image/*" files={files} maxSizeMb={30} onFiles={setFiles} />
        <label className="mt-5 block max-w-xs">
          <span className="label">{t(lang, "Размер", "Size")}</span>
          <select className="input" value={size} onChange={(event) => setSize(Number(event.target.value))}>
            {[32, 48, 180, 192, 512].map((item) => (
              <option key={item} value={item}>{item}×{item}</option>
            ))}
          </select>
        </label>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={generate} disabled={!file || isBusy}>
            {isBusy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <ImageIcon size={16} aria-hidden="true" />}
            {t(lang, "Создать", "Create")}
          </button>
          <button className="btn-secondary" onClick={downloadSet} disabled={!file || isBusy}>
            <Download size={16} aria-hidden="true" />
            {t(lang, "Скачать набор", "Download set")}
          </button>
        </div>
        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Предпросмотр", "Preview")}</h2>
        {result?.url ? <img className="mb-4 h-32 w-32 rounded-[22px] border border-[var(--line)] object-cover" src={result.url} alt="" /> : null}
        <ResultCard result={result} note={t(lang, "Для сайта обычно нужны размеры 32, 180, 192 и 512 px.", "Common website sizes are 32, 180, 192, and 512 px.")} />
      </ToolPanel>
    </div>
  );
}

function CollageTool({ lang }: { lang: Lang }) {
  const [files, setFiles] = useState<File[]>([]);
  const [columns, setColumns] = useState(3);
  const [gap, setGap] = useState(18);
  const [background, setBackground] = useState("#ffffff");
  const [format, setFormat] = useState<"png" | "pdf">("png");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useObjectResult();

  const create = async () => {
    if (!files.length) return;
    setIsBusy(true);
    setError("");
    try {
      const images = await Promise.all(files.map(loadImage));
      const width = 1400;
      const cell = Math.floor((width - gap * (columns - 1)) / columns);
      const rows = Math.ceil(images.length / columns);
      const height = rows * cell + gap * Math.max(0, rows - 1);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas недоступен.");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      images.forEach((image, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        drawImageCover(ctx, image, col * (cell + gap), row * (cell + gap), cell, cell);
      });

      if (format === "pdf") {
        const png = await canvasToBlob(canvas, "image/png");
        const bytes = await png.arrayBuffer();
        const PDFDocument = await loadPdfDocument();
        const pdf = await PDFDocument.create();
        const page = pdf.addPage([width, height]);
        const embedded = await pdf.embedPng(bytes);
        page.drawImage(embedded, { x: 0, y: 0, width, height });
        const pdfBytes = await pdf.save();
        setResult(makeObjectResult("collage.pdf", new Blob([pdfBytes], { type: "application/pdf" }), files.reduce((sum, file) => sum + file.size, 0)));
      } else {
        const blob = await canvasToBlob(canvas, "image/png");
        setResult(makeObjectResult("collage.png", blob, files.reduce((sum, file) => sum + file.size, 0)));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось собрать коллаж.");
      setResult(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <DropZone title={t(lang, "Добавьте изображения", "Upload images")} description={t(lang, "Файлы будут собраны в ровную сетку.", "Files will be arranged into a clean grid.")} accept="image/*" multiple files={files} maxSizeMb={40} onFiles={setFiles} />
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <label><span className="label">{t(lang, "Колонки", "Columns")}</span><input className="input" type="number" min={1} max={6} value={columns} onChange={(event) => setColumns(Number(event.target.value))} /></label>
          <label><span className="label">{t(lang, "Отступ", "Gap")}</span><input className="input" type="number" min={0} max={80} value={gap} onChange={(event) => setGap(Number(event.target.value))} /></label>
          <label><span className="label">{t(lang, "Фон", "Background")}</span><input className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1" type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
          <label><span className="label">{t(lang, "Формат", "Format")}</span><select className="input" value={format} onChange={(event) => setFormat(event.target.value as "png" | "pdf")}><option value="png">PNG</option><option value="pdf">PDF</option></select></label>
        </div>
        <button className="btn-primary mt-5" onClick={create} disabled={!files.length || isBusy}>
          {isBusy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <ImageIcon size={16} aria-hidden="true" />}
          {t(lang, "Собрать", "Build")}
        </button>
        <div className="mt-4"><ErrorMessage message={error} /></div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Результат", "Result")}</h2>
        {result?.url && result.blob.type.startsWith("image/") ? <img className="mb-4 max-h-72 w-full rounded-lg border border-[var(--line)] object-contain" src={result.url} alt="" /> : null}
        <ResultCard result={result} />
      </ToolPanel>
    </div>
  );
}

function PhotoColorPickerTool({ lang }: { lang: Lang }) {
  const [files, setFiles] = useState<File[]>([]);
  const [color, setColor] = useState<Rgb | null>(null);
  const [copied, setCopied] = useState("");
  const [hoverPoint, setHoverPoint] = useState<{ left: number; top: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierRef = useRef<HTMLCanvasElement>(null);
  const file = files[0];

  useEffect(() => {
    let cancelled = false;
    if (!file) return;
    loadImage(file).then((image) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) return;
      const maxWidth = 900;
      const ratio = Math.min(1, maxWidth / image.naturalWidth);
      canvas.width = Math.round(image.naturalWidth * ratio);
      canvas.height = Math.round(image.naturalHeight * ratio);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixel = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      setColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
      setHoverPoint(null);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const getCanvasPoint = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const displayX = event.clientX - rect.left;
    const displayY = event.clientY - rect.top;
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((displayX / rect.width) * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((displayY / rect.height) * canvas.height)));
    return { x, y, displayX, displayY, rect };
  };

  const updateMagnifier = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event);
    const canvas = canvasRef.current;
    const lens = magnifierRef.current;
    const lensCtx = lens?.getContext("2d");
    if (!point || !canvas || !lens || !lensCtx) return;

    const lensSize = 128;
    const sampleSize = Math.max(1, Math.min(18, canvas.width, canvas.height));
    const sourceX = Math.max(0, Math.min(canvas.width - sampleSize, point.x - Math.floor(sampleSize / 2)));
    const sourceY = Math.max(0, Math.min(canvas.height - sampleSize, point.y - Math.floor(sampleSize / 2)));
    lensCtx.clearRect(0, 0, lensSize, lensSize);
    lensCtx.imageSmoothingEnabled = false;
    lensCtx.drawImage(canvas, sourceX, sourceY, sampleSize, sampleSize, 0, 0, lensSize, lensSize);
    lensCtx.strokeStyle = "rgba(255,255,255,.85)";
    lensCtx.lineWidth = 1;
    lensCtx.beginPath();
    lensCtx.moveTo(lensSize / 2, 0);
    lensCtx.lineTo(lensSize / 2, lensSize);
    lensCtx.moveTo(0, lensSize / 2);
    lensCtx.lineTo(lensSize, lensSize / 2);
    lensCtx.stroke();
    lensCtx.strokeStyle = "rgba(10,10,12,.75)";
    lensCtx.strokeRect(lensSize / 2 - 4, lensSize / 2 - 4, 8, 8);

    let left = point.displayX + 18;
    let top = point.displayY + 18;
    if (left + lensSize > point.rect.width) left = point.displayX - lensSize - 18;
    if (top + lensSize > point.rect.height) top = point.displayY - lensSize - 18;
    setHoverPoint({
      left: Math.max(0, Math.min(point.rect.width - lensSize, left)),
      top: Math.max(0, Math.min(point.rect.height - lensSize, top))
    });
  };

  const pick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!point || !canvas || !ctx) return;
    const { x, y } = point;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    setColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
  };

  const values = color ? [rgbToHex(color), `rgb(${color.r}, ${color.g}, ${color.b})`, `hsl(${rgbToHsl(color).h}, ${rgbToHsl(color).s}%, ${rgbToHsl(color).l}%)`] : [];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <ToolPanel>
        <DropZone title={t(lang, "Добавьте фото", "Upload a photo")} description={t(lang, "Кликните по изображению, чтобы взять цвет.", "Click the image to sample a color.")} accept="image/*" files={files} maxSizeMb={40} onFiles={setFiles} />
        <div className="relative mt-5">
          <canvas
            ref={canvasRef}
            onClick={pick}
            onMouseMove={updateMagnifier}
            onMouseLeave={() => setHoverPoint(null)}
            className="block max-h-[520px] w-full cursor-crosshair rounded-lg border border-[var(--line)] object-contain"
          />
          <canvas
            ref={magnifierRef}
            width={128}
            height={128}
            className={`pointer-events-none absolute z-10 h-32 w-32 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] shadow-[var(--sh-lg)] transition-opacity ${hoverPoint ? "opacity-100" : "opacity-0"}`}
            style={{ left: hoverPoint?.left ?? 0, top: hoverPoint?.top ?? 0 }}
          />
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Цвет", "Color")}</h2>
        <div className="h-32 rounded-lg border border-[var(--line)]" style={{ background: color ? rgbToHex(color) : "var(--surface-2)" }} />
        <div className="mt-4 grid gap-3">
          {values.map((value) => (
            <button key={value} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-3 text-left" onClick={async () => { await copyToClipboard(value); setCopied(value); }}>
              <span className="font-mono text-sm font-semibold text-[var(--ink)]">{value}</span>
              <span className="text-[var(--accent)]">{copied === value ? <Check size={17} /> : <Copy size={17} />}</span>
            </button>
          ))}
        </div>
      </ToolPanel>
    </div>
  );
}

function BlurTool({ lang }: { lang: Lang }) {
  const [files, setFiles] = useState<File[]>([]);
  const [x, setX] = useState(50);
  const [y, setY] = useState(38);
  const [size, setSize] = useState(28);
  const [blur, setBlur] = useState(18);
  const [result, setResult] = useObjectResult();
  const [error, setError] = useState("");
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const file = files[0];

  const drawBlurredImage = (canvas: HTMLCanvasElement, image: HTMLImageElement, preview = false) => {
    const scale = preview ? Math.min(1, 760 / image.naturalWidth) : 1;
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas недоступен.");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const side = Math.round((Math.min(canvas.width, canvas.height) * size) / 100);
    const left = Math.round((canvas.width * x) / 100 - side / 2);
    const top = Math.round((canvas.height * y) / 100 - side / 2);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(left, top, side, side, Math.max(8, side * 0.08));
    ctx.clip();
    ctx.filter = `blur(${Math.max(1, blur * scale)}px)`;
    ctx.drawImage(canvas, left, top, side, side, left, top, side, side);
    ctx.restore();
    ctx.strokeStyle = "rgba(129,140,248,.95)";
    ctx.lineWidth = preview ? 2 : Math.max(3, image.naturalWidth * 0.002);
    ctx.strokeRect(left, top, side, side);
  };

  useEffect(() => {
    let cancelled = false;
    setLoadedImage(null);
    if (!file) return;
    loadImage(file)
      .then((image) => {
        if (!cancelled) setLoadedImage(image);
      })
      .catch(() => {
        if (!cancelled) setLoadedImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const canvas = previewRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (!loadedImage) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    try {
      drawBlurredImage(canvas, loadedImage, true);
    } catch {
      // The export action reports canvas errors.
    }
  }, [blur, loadedImage, size, x, y]);

  const process = async () => {
    if (!file || !loadedImage) return;
    setError("");
    try {
      const canvas = document.createElement("canvas");
      drawBlurredImage(canvas, loadedImage, false);
      const blob = await canvasToBlob(canvas, "image/png");
      setResult(makeObjectResult(replaceExtension(file.name, "blurred.png"), blob, file.size));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось размыть область.");
      setResult(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <DropZone title={t(lang, "Добавьте изображение", "Upload an image")} description={t(lang, "Настройте область вручную: положение, размер и силу размытия.", "Set the area manually: position, size, and blur strength.")} accept="image/*" files={files} maxSizeMb={40} onFiles={setFiles} />
        <canvas ref={previewRef} className="mt-5 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)]" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[["X", x, setX], ["Y", y, setY], [t(lang, "Размер", "Size"), size, setSize], [t(lang, "Размытие", "Blur"), blur, setBlur]].map(([label, value, setter]) => (
            <label key={String(label)}>
              <span className="label">{String(label)}: {String(value)}</span>
              <input className="w-full accent-[var(--accent)]" type="range" min="1" max="100" value={Number(value)} onChange={(event) => (setter as (value: number) => void)(Number(event.target.value))} />
            </label>
          ))}
        </div>
        <button className="btn-primary mt-5" onClick={process} disabled={!loadedImage}>
          <Wand2 size={16} aria-hidden="true" />
          {t(lang, "Скачать результат", "Download result")}
        </button>
        <div className="mt-4"><ErrorMessage message={error} /></div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Результат", "Result")}</h2>
        {result?.url ? <img className="mb-4 max-h-72 w-full rounded-lg border border-[var(--line)] object-contain" src={result.url} alt="" /> : null}
        <ResultCard result={result} />
      </ToolPanel>
    </div>
  );
}

function WatermarkTool({ lang }: { lang: Lang }) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("MultiTool");
  const [opacity, setOpacity] = useState(46);
  const [size, setSize] = useState(7);
  const [result, setResult] = useObjectResult();
  const [error, setError] = useState("");
  const file = files[0];

  const process = async () => {
    if (!file) return;
    setError("");
    try {
      const image = await loadImage(file);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas недоступен.");
      ctx.drawImage(image, 0, 0);
      ctx.globalAlpha = opacity / 100;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = Math.max(2, canvas.width * 0.002);
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.font = `700 ${Math.round((canvas.width * size) / 100)}px Inter, Arial, sans-serif`;
      const margin = Math.round(canvas.width * 0.04);
      ctx.strokeText(text, canvas.width - margin, canvas.height - margin);
      ctx.fillText(text, canvas.width - margin, canvas.height - margin);
      ctx.globalAlpha = 1;
      const blob = await canvasToBlob(canvas, "image/png");
      setResult(makeObjectResult(replaceExtension(file.name, "watermark.png"), blob, file.size));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось добавить знак.");
      setResult(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <DropZone title={t(lang, "Добавьте изображение", "Upload an image")} description={t(lang, "Текстовый знак появится в правом нижнем углу.", "The text mark appears in the bottom-right corner.")} accept="image/*" files={files} maxSizeMb={40} onFiles={setFiles} />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="sm:col-span-3"><span className="label">{t(lang, "Текст", "Text")}</span><input className="input" value={text} onChange={(event) => setText(event.target.value)} /></label>
          <label><span className="label">{t(lang, "Размер", "Size")}: {size}</span><input className="w-full accent-[var(--accent)]" type="range" min="2" max="14" value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>
          <label><span className="label">{t(lang, "Прозрачность", "Opacity")}: {opacity}%</span><input className="w-full accent-[var(--accent)]" type="range" min="10" max="100" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></label>
        </div>
        <button className="btn-primary mt-5" onClick={process} disabled={!file}><Paintbrush size={16} aria-hidden="true" />{t(lang, "Нанести", "Apply")}</button>
        <div className="mt-4"><ErrorMessage message={error} /></div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Результат", "Result")}</h2>
        {result?.url ? <img className="mb-4 max-h-72 w-full rounded-lg border border-[var(--line)] object-contain" src={result.url} alt="" /> : null}
        <ResultCard result={result} />
      </ToolPanel>
    </div>
  );
}

type AdvancedFfmpegKind = "video-compressor" | "video-to-gif" | "media-trimmer" | "audio-converter" | "speed-volume";

function AdvancedFfmpegTool({ kind, lang }: { kind: AdvancedFfmpegKind; lang: Lang }) {
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState("mp3");
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(8);
  const [quality, setQuality] = useState(28);
  const [tempo, setTempo] = useState(1);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useObjectResult();
  const file = files[0];

  const process = async () => {
    if (!file) return;
    setIsBusy(true);
    setError("");
    setProgress(0);
    try {
      const result = await runBackendMediaJob(
        file,
        { job: kind, target, start, duration, quality, tempo, volume },
        (nextProgress, nextMessage) => {
          setProgress(nextProgress);
          setMessage(nextMessage);
        }
      );
      setResult(result);
    } catch (reason) {
      setError(formatUnknownError(reason, "Не удалось обработать файл."));
      setResult(null);
    } finally {
      setIsBusy(false);
    }
  };

  const title = {
    "video-compressor": t(lang, "Добавьте видео", "Upload video"),
    "video-to-gif": t(lang, "Добавьте видео", "Upload video"),
    "media-trimmer": t(lang, "Добавьте видео или аудио", "Upload video or audio"),
    "audio-converter": t(lang, "Добавьте аудио", "Upload audio"),
    "speed-volume": t(lang, "Добавьте аудио", "Upload audio")
  }[kind];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <ToolPanel>
        <DropZone title={title} description={t(lang, "Обработка выполняется на локальном backend через ffmpeg.", "Processing runs on the local backend through ffmpeg.")} accept="video/*,audio/*" files={files} maxSizeMb={180} onFiles={setFiles} />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {kind === "audio-converter" ? <label><span className="label">{t(lang, "Формат", "Format")}</span><select className="input" value={target} onChange={(event) => setTarget(event.target.value)}><option value="mp3">MP3</option><option value="wav">WAV</option><option value="ogg">OGG</option><option value="m4a">M4A</option></select></label> : null}
          {kind === "video-compressor" ? <label><span className="label">CRF: {quality}</span><input className="w-full accent-[var(--accent)]" type="range" min="18" max="36" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /></label> : null}
          {kind === "video-to-gif" || kind === "media-trimmer" ? (
            <>
              <label><span className="label">{t(lang, "Старт, сек", "Start, sec")}</span><input className="input" type="number" min={0} value={start} onChange={(event) => setStart(Number(event.target.value))} /></label>
              <label><span className="label">{t(lang, "Длительность, сек", "Duration, sec")}</span><input className="input" type="number" min={1} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
            </>
          ) : null}
          {kind === "speed-volume" ? (
            <>
              <label><span className="label">{t(lang, "Скорость", "Speed")}: {tempo.toFixed(2)}x</span><input className="w-full accent-[var(--accent)]" type="range" min="0.5" max="2" step="0.05" value={tempo} onChange={(event) => setTempo(Number(event.target.value))} /></label>
              <label><span className="label">{t(lang, "Громкость", "Volume")}: {volume.toFixed(2)}x</span><input className="w-full accent-[var(--accent)]" type="range" min="0.2" max="3" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
            </>
          ) : null}
        </div>
        <button className="btn-primary mt-5" onClick={process} disabled={!file || isBusy}>
          {isBusy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {t(lang, "Запустить", "Run")}
        </button>
        {isBusy || progress > 0 ? <div className="mt-5"><ProgressBar value={progress} label={message || t(lang, "Подготовка", "Preparing")} /></div> : null}
        <div className="mt-4"><ErrorMessage message={error} /></div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Результат", "Result")}</h2>
        {result?.url && result.blob.type.startsWith("video/") ? <video className="mb-4 max-h-72 w-full rounded-lg border border-[var(--line)]" src={result.url} controls /> : null}
        {result?.url && result.blob.type.startsWith("audio/") ? <audio className="mb-4 w-full" src={result.url} controls /> : null}
        {result?.url && result.blob.type === "image/gif" ? <img className="mb-4 max-h-72 w-full rounded-lg border border-[var(--line)] object-contain" src={result.url} alt="" /> : null}
        <ResultCard result={result} />
      </ToolPanel>
    </div>
  );
}

function ScreenRecorderTool({ lang }: { lang: Lang }) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useObjectResult();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async () => {
    setError("");
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setResult(makeObjectResult("screen-recording.webm", blob));
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось начать запись.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <ToolPanel>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5">
          <div className="text-lg font-bold text-[var(--ink)]">{isRecording ? t(lang, "Идёт запись", "Recording") : t(lang, "Готово к записи", "Ready to record")}</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t(lang, "Выберите экран или окно в системном диалоге.", "Choose a screen or window in the system dialog.")}</p>
        </div>
        <div className="mt-5 flex gap-3">
          <button className="btn-primary" onClick={start} disabled={isRecording}><Play size={16} aria-hidden="true" />{t(lang, "Начать", "Start")}</button>
          <button className="btn-secondary" onClick={stop} disabled={!isRecording}><RotateCcw size={16} aria-hidden="true" />{t(lang, "Остановить", "Stop")}</button>
        </div>
        <div className="mt-4"><ErrorMessage message={error} /></div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Запись", "Recording")}</h2>
        {result?.url ? <video className="mb-4 max-h-72 w-full rounded-lg border border-[var(--line)]" src={result.url} controls /> : null}
        <ResultCard result={result} />
      </ToolPanel>
    </div>
  );
}

type FileAiKind = "image-ocr" | "transcription" | "document-converter";

function FileAiTextTool({ kind, lang }: { kind: FileAiKind; lang: Lang }) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const file = files[0];

  const process = async () => {
    if (!file) return;
    setIsBusy(true);
    setError("");
    try {
      if (kind === "image-ocr") {
        setText(await callOcrFile(file));
      } else if (kind === "transcription") {
        setText(await callTranscriptionApi(file));
      } else if (kind === "document-converter") {
        setText(await callDocumentTextApi(file));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось получить текст.");
      setText("");
    } finally {
      setIsBusy(false);
    }
  };

  const accept = kind === "image-ocr" ? "image/*" : kind === "transcription" ? "audio/*,video/*" : ".pdf,.doc,.docx,.txt,.md,application/pdf,text/*";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <ToolPanel>
        <DropZone
          title={t(lang, "Добавьте файл", "Upload a file")}
          description={
            kind === "image-ocr"
              ? t(lang, "Распознавание идёт через локальный OCR на сервере: русский и английский.", "Recognition uses local server OCR: Russian and English.")
              : kind === "transcription"
                ? t(lang, "Backend извлечёт аудио и распознает через локальный Windows Speech, если язык установлен.", "The backend extracts audio and uses local Windows Speech when the language is installed.")
                : t(lang, "PDF, DOCX, TXT и MD разбираются в аккуратный текст.", "PDF, DOCX, TXT, and MD are parsed into clean text.")
          }
          accept={accept}
          files={files}
          maxSizeMb={70}
          onFiles={setFiles}
        />
        {kind === "transcription" ? (
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{t(lang, "Для русского/английского распознавания должен быть установлен локальный speech-recognizer Windows.", "Russian/English recognition needs the local Windows speech recognizer.")}</p>
        ) : null}
        <button className="btn-primary mt-5" onClick={process} disabled={!file || isBusy}>
          {isBusy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
          {t(lang, "Получить текст", "Get text")}
        </button>
        <div className="mt-4"><ErrorMessage message={error} /></div>
      </ToolPanel>
      <ToolPanel>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--ink)]">{t(lang, "Текст", "Text")}</h2>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={async () => { await copyToClipboard(text); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }} disabled={!text}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? t(lang, "Готово", "Copied") : t(lang, "Копировать", "Copy")}</button>
            <button className="btn-secondary" onClick={() => downloadText(text, "result.txt")} disabled={!text}><Download size={16} />TXT</button>
          </div>
        </div>
        <textarea className="input min-h-96 resize-y leading-6" value={text} onChange={(event) => setText(event.target.value)} placeholder={t(lang, "Результат появится здесь.", "The result will appear here.")} />
      </ToolPanel>
    </div>
  );
}

function PdfCompressorTool({ lang }: { lang: Lang }) {
  const [files, setFiles] = useState<File[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useObjectResult();
  const file = files[0];

  const process = async () => {
    if (!file) return;
    setIsBusy(true);
    setError("");
    try {
      const PDFDocument = await loadPdfDocument();
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      pdf.setProducer("MultiTool");
      pdf.setCreator("MultiTool");
      const bytes = await pdf.save({ useObjectStreams: true });
      setResult(makeObjectResult(replaceExtension(file.name, "optimized.pdf"), new Blob([bytes], { type: "application/pdf" }), file.size));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось оптимизировать PDF.");
      setResult(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <ToolPanel>
        <DropZone title={t(lang, "Добавьте PDF", "Upload PDF")} description={t(lang, "Файл будет пересобран с объектными потоками и очищенной служебной частью.", "The file will be re-saved with object streams and cleaner metadata.")} accept="application/pdf,.pdf" files={files} maxSizeMb={120} onFiles={setFiles} />
        <button className="btn-primary mt-5" onClick={process} disabled={!file || isBusy}>{isBusy ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}{t(lang, "Оптимизировать", "Optimize")}</button>
        <div className="mt-4"><ErrorMessage message={error} /></div>
      </ToolPanel>
      <ToolPanel><h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Результат", "Result")}</h2><ResultCard result={result} /></ToolPanel>
    </div>
  );
}

type GeminiTextKind = "translator";

const translatorLanguages = [
  ["auto", "Auto / авто"],
  ["ru", "Русский"],
  ["en", "English"],
  ["es", "Español"],
  ["de", "Deutsch"],
  ["fr", "Français"],
  ["it", "Italiano"],
  ["pt", "Português"],
  ["zh-CN", "中文"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["tr", "Türkçe"],
  ["ar", "العربية"],
  ["hi", "हिन्दी"],
  ["pl", "Polski"],
  ["uk", "Українська"]
] as const;

function GeminiTextTool({ kind, lang }: { kind: GeminiTextKind; lang: Lang }) {
  const [input, setInput] = useState("Привет! Переведи этот текст.");
  const [source, setSource] = useState("auto");
  const [target, setTarget] = useState("en");
  const [output, setOutput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const process = async () => {
    setIsBusy(true);
    setError("");
    try {
      setOutput(await callTranslationApi(input, source, target));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось выполнить запрос.");
      setOutput("");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <ToolPanel>
        <label><span className="label">{t(lang, "Текст", "Text")}</span><textarea className="input min-h-56 resize-y leading-6" value={input} onChange={(event) => setInput(event.target.value)} /></label>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">{t(lang, "С языка", "From")}</span>
            <select className="input" value={source} onChange={(event) => setSource(event.target.value)}>
              {translatorLanguages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span className="label">{t(lang, "На язык", "To")}</span>
            <select className="input" value={target} onChange={(event) => setTarget(event.target.value)}>
              {translatorLanguages.filter(([value]) => value !== "auto").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn-secondary" onClick={() => { if (source !== "auto") { const nextSource = target; setTarget(source); setSource(nextSource); } }}>
            <RotateCcw size={16} />
            {t(lang, "Поменять", "Swap")}
          </button>
          <button className="btn-primary" onClick={process} disabled={!input.trim() || isBusy}>{isBusy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}{t(lang, "Перевести", "Translate")}</button>
        </div>
        <div className="mt-4"><ErrorMessage message={error} /></div>
      </ToolPanel>
      <ToolPanel>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--ink)]">{t(lang, "Результат", "Result")}</h2>
          <button className="btn-secondary" onClick={async () => { await copyToClipboard(output); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }} disabled={!output}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? t(lang, "Готово", "Copied") : t(lang, "Копировать", "Copy")}</button>
        </div>
        <textarea className="input min-h-80 resize-y leading-6" value={output} onChange={(event) => setOutput(event.target.value)} />
      </ToolPanel>
    </div>
  );
}

function TextSpeechTool({ lang }: { lang: Lang }) {
  const [text, setText] = useState("MultiTool помогает быстро выполнить задачу.");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [inputDeviceId, setInputDeviceId] = useState("");
  const [outputDeviceId, setOutputDeviceId] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");
  const micStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const next = await navigator.mediaDevices.enumerateDevices();
    setDevices(next);
  };

  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    refreshDevices().catch(() => undefined);
    window.speechSynthesis.addEventListener("voiceschanged", load);
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const speak = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voices.find((voice) => voice.name === voiceName) ?? null;
    window.speechSynthesis.speak(utterance);
  };

  const requestMicrophone = async () => {
    setError("");
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: inputDeviceId ? { deviceId: { exact: inputDeviceId } } : true
    });
    micStreamRef.current = stream;
    await refreshDevices();

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      const average = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length;
      setMicLevel(Math.min(100, average * 4));
      rafRef.current = window.requestAnimationFrame(tick);
    };
    tick();
  };

  const testOutput = async () => {
    setError("");
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();
      oscillator.frequency.value = 660;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(destination);
      const audio = new Audio();
      audio.srcObject = destination.stream;
      const sinkAudio = audio as HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };
      if (outputDeviceId && sinkAudio.setSinkId) await sinkAudio.setSinkId(outputDeviceId);
      await audio.play();
      oscillator.start();
      window.setTimeout(() => {
        oscillator.stop();
        audio.pause();
        audioContext.close().catch(() => undefined);
      }, 450);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t(lang, "Не удалось проверить выход.", "Could not test output."));
    }
  };

  const dictate = async () => {
    type RecognitionLike = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
    const SpeechRecognitionCtor = (window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => RecognitionLike }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError(t(lang, "Диктовка недоступна в этой среде.", "Dictation is unavailable here."));
      return;
    }
    try {
      await requestMicrophone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t(lang, "Нужно разрешение к микрофону.", "Microphone permission is required."));
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = lang === "ru" ? "ru-RU" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => setText((current) => `${current}${current ? "\n" : ""}${event.results[0][0].transcript}`);
    recognition.onerror = () => setError(t(lang, "Не удалось распознать речь.", "Speech recognition failed."));
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  };

  const audioInputs = devices.filter((device) => device.kind === "audioinput");
  const audioOutputs = devices.filter((device) => device.kind === "audiooutput");

  return (
    <ToolPanel>
      <label><span className="label">{t(lang, "Текст", "Text")}</span><textarea className="input min-h-56 resize-y leading-6" value={text} onChange={(event) => setText(event.target.value)} /></label>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label><span className="label">{t(lang, "Голос", "Voice")}</span><select className="input" value={voiceName} onChange={(event) => setVoiceName(event.target.value)}><option value="">{t(lang, "Авто", "Auto")}</option>{voices.map((voice) => <option key={voice.name} value={voice.name}>{voice.name}</option>)}</select></label>
        <label><span className="label">{t(lang, "Микрофон", "Microphone")}</span><select className="input" value={inputDeviceId} onChange={(event) => setInputDeviceId(event.target.value)}><option value="">{t(lang, "По умолчанию", "Default")}</option>{audioInputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${t(lang, "Микрофон", "Microphone")} ${index + 1}`}</option>)}</select></label>
        <label><span className="label">{t(lang, "Выход", "Output")}</span><select className="input" value={outputDeviceId} onChange={(event) => setOutputDeviceId(event.target.value)}><option value="">{t(lang, "По умолчанию", "Default")}</option>{audioOutputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${t(lang, "Устройство", "Device")} ${index + 1}`}</option>)}</select></label>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <button className="btn-secondary" onClick={requestMicrophone}><Sparkles size={16} />{t(lang, "Разрешить микрофон", "Allow mic")}</button>
        <button className="btn-secondary" onClick={testOutput}><Play size={16} />{t(lang, "Тест выхода", "Test output")}</button>
        <button className="btn-primary" onClick={speak}><Play size={16} />{t(lang, "Озвучить", "Speak")}</button>
        <button className="btn-secondary" onClick={() => isListening ? recognitionRef.current?.stop() : dictate()}><Sparkles size={16} />{isListening ? t(lang, "Остановить", "Stop") : t(lang, "Диктовать", "Dictate")}</button>
      </div>
      <div className="mt-4">
        <ProgressBar value={micLevel} label={t(lang, "Уровень микрофона", "Mic level")} />
      </div>
      <div className="mt-4"><ErrorMessage message={error} /></div>
    </ToolPanel>
  );
}

function JsonFormatterTool({ lang }: { lang: Lang }) {
  const [input, setInput] = useState('{"name":"MultiTool","ready":true}');
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [indent, setIndent] = useState(2);

  const format = () => {
    setError("");
    try {
      if (input.trim().startsWith("<")) {
        setOutput(input.replace(/>\s*</g, ">\n<").replace(/^\s+|\s+$/g, ""));
      } else {
        setOutput(JSON.stringify(JSON.parse(input), null, indent));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Неверный JSON/XML.");
      setOutput("");
    }
  };

  const minify = () => {
    try {
      setOutput(JSON.stringify(JSON.parse(input)));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Неверный JSON.");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToolPanel>
        <label><span className="label">JSON / XML</span><textarea className="input min-h-96 resize-y font-mono text-sm leading-6" value={input} onChange={(event) => setInput(event.target.value)} /></label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="max-w-28"><span className="label">{t(lang, "Отступ", "Indent")}</span><input className="input" type="number" min={0} max={8} value={indent} onChange={(event) => setIndent(Number(event.target.value))} /></label>
          <button className="btn-primary self-end" onClick={format}><Wand2 size={16} />{t(lang, "Форматировать", "Format")}</button>
          <button className="btn-secondary self-end" onClick={minify}>{t(lang, "Минифицировать", "Minify")}</button>
        </div>
        <div className="mt-4"><ErrorMessage message={error} /></div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Результат", "Result")}</h2>
        <textarea className="input min-h-96 resize-y font-mono text-sm leading-6" value={output} onChange={(event) => setOutput(event.target.value)} />
      </ToolPanel>
    </div>
  );
}

type EncoderCodec = "base64" | "html" | "url";
type EncoderMode = "encode" | "decode";

function encodeUtf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function decodeUtf8Base64(value: string) {
  const binary = atob(value.trim());
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function encodeHtmlEntities(value: string) {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return value.replace(/[&<>"']/g, (char) => map[char]);
}

function decodeHtmlEntities(value: string) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function EncoderTool({ lang }: { lang: Lang }) {
  const [codec, setCodec] = useState<EncoderCodec>("base64");
  const [mode, setMode] = useState<EncoderMode>("encode");
  const [input, setInput] = useState("MultiTool & tools");
  const [output, setOutput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

  const run = async () => {
    setError("");
    try {
      if (codec === "base64" && mode === "encode" && files[0]) {
        const reader = new FileReader();
        reader.onload = () => setOutput(String(reader.result));
        reader.onerror = () => setError(t(lang, "Не удалось прочитать файл.", "Could not read the file."));
        reader.readAsDataURL(files[0]);
        return;
      }

      const next =
        codec === "base64"
          ? mode === "encode" ? encodeUtf8Base64(input) : decodeUtf8Base64(input)
          : codec === "html"
            ? mode === "encode" ? encodeHtmlEntities(input) : decodeHtmlEntities(input)
            : mode === "encode" ? encodeURIComponent(input) : decodeURIComponent(input.replace(/\+/g, "%20"));
      setOutput(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t(lang, "Не удалось выполнить кодирование.", "Could not run the encoder."));
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToolPanel>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label>
            <span className="label">{t(lang, "Тип", "Type")}</span>
            <select className="input" value={codec} onChange={(event) => { setCodec(event.target.value as EncoderCodec); setFiles([]); }}>
              <option value="base64">Base64</option>
              <option value="html">HTML Encode / Decode</option>
              <option value="url">URL Encode / Decode</option>
            </select>
          </label>
          <div>
            <span className="label">{t(lang, "Операция", "Operation")}</span>
            <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-1">
              {(["encode", "decode"] as const).map((item) => (
                <button
                  key={item}
                  className={`btn px-3 ${mode === item ? "bg-[var(--surface)] text-[var(--ink)] shadow-soft" : "text-[var(--muted)]"}`}
                  onClick={() => setMode(item)}
                >
                  {item === "encode" ? t(lang, "Encode", "Encode") : t(lang, "Decode", "Decode")}
                </button>
              ))}
            </div>
          </div>
        </div>
        {codec === "base64" && mode === "encode" ? (
          <div className="mt-5">
            <DropZone title={t(lang, "Файл в Data URL", "File to Data URL")} description={t(lang, "Необязательно: выберите файл или работайте с текстом ниже.", "Optional: choose a file or work with text below.")} files={files} maxSizeMb={25} onFiles={setFiles} />
          </div>
        ) : null}
        <label className="mt-5 block">
          <span className="label">{t(lang, "Текст", "Text")}</span>
          <textarea className="input min-h-44 resize-y font-mono text-sm" value={input} onChange={(event) => setInput(event.target.value)} />
        </label>
        <button className="btn-primary mt-5" onClick={run}><Play size={16} />{mode === "encode" ? "Encode" : "Decode"}</button>
        <div className="mt-4"><ErrorMessage message={error} /></div>
      </ToolPanel>
      <ToolPanel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--ink)]">{t(lang, "Результат", "Result")}</h2>
          <button className="btn-secondary" onClick={() => copyToClipboard(output)} disabled={!output}><Copy size={16} />{t(lang, "Копировать", "Copy")}</button>
        </div>
        <textarea className="input min-h-96 resize-y font-mono text-sm" value={output} onChange={(event) => setOutput(event.target.value)} />
      </ToolPanel>
    </div>
  );
}

function UrlShortenerTool({ lang }: { lang: Lang }) {
  const [url, setUrl] = useState("https://example.com");
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const shorten = async () => {
    setIsBusy(true);
    setError("");
    try {
      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = (await response.json()) as { shortUrl?: string; error?: string };
      if (!response.ok) throw new Error(data.error || response.statusText);
      setShortUrl(data.shortUrl || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сократить ссылку.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ToolPanel>
      <label><span className="label">URL</span><input className="input" value={url} onChange={(event) => setUrl(event.target.value)} /></label>
      <button className="btn-primary mt-5" onClick={shorten} disabled={isBusy}>{isBusy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}{t(lang, "Сократить", "Shorten")}</button>
      <div className="mt-4"><ErrorMessage message={error} /></div>
      {shortUrl ? (
        <button className="mt-5 flex w-full items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-left" onClick={() => copyToClipboard(shortUrl)}>
          <span className="font-mono text-sm font-semibold text-[var(--ink)]">{shortUrl}</span>
          <Copy size={18} className="text-[var(--accent)]" />
        </button>
      ) : null}
    </ToolPanel>
  );
}

type NicknameStyle = "mixed" | "short" | "gamer" | "cute" | "cyber" | "clean";

const nicknameAdjectives = ["nova", "silent", "bright", "lucky", "swift", "wild", "ghost", "pixel", "solar", "velvet", "midnight", "crimson"];
const nicknameNouns = ["fox", "byte", "spark", "pilot", "rider", "orbit", "blade", "mint", "echo", "raven", "quest", "pixel"];
const nicknamePrefixes = ["neo", "x", "ultra", "byte", "astro", "meta", "zero", "proto", "hyper", "mini"];
const nicknameSuffixes = ["core", "wave", "arc", "line", "loop", "play", "lab", "mode", "zen", "kit"];

function cleanNicknameSeed(value: string) {
  return value.trim().replace(/[^\p{L}\p{N}]+/gu, "") || randomItem(nicknameNouns);
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function titleNick(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function createNickname(style: NicknameStyle, seed: string, separator: string, withNumbers: boolean) {
  const base = cleanNicknameSeed(seed);
  const number = withNumbers ? String(Math.floor(10 + Math.random() * 990)) : "";
  const adjective = randomItem(nicknameAdjectives);
  const noun = randomItem(nicknameNouns);
  const prefix = randomItem(nicknamePrefixes);
  const suffix = randomItem(nicknameSuffixes);

  if (style === "short") return `${base.slice(0, 8)}${number}`;
  if (style === "gamer") return `${titleNick(adjective)}${separator}${titleNick(noun)}${number}`;
  if (style === "cute") return `${titleNick(base)}${separator}${titleNick(randomItem(["mimi", "bloom", "berry", "moon", "star", "bun"]))}${number}`;
  if (style === "cyber") return `${titleNick(prefix)}${separator}${titleNick(base)}${separator}${titleNick(suffix)}${number}`;
  if (style === "clean") return `${titleNick(base)}${separator}${titleNick(noun)}`;
  return Math.random() > 0.5
    ? `${titleNick(adjective)}${separator}${titleNick(base)}${number}`
    : `${titleNick(prefix)}${separator}${titleNick(noun)}${number}`;
}

function NicknameGeneratorTool({ lang }: { lang: Lang }) {
  const [seed, setSeed] = useState("nova");
  const [style, setStyle] = useState<NicknameStyle>("mixed");
  const [separator, setSeparator] = useState("");
  const [count, setCount] = useState(12);
  const [withNumbers, setWithNumbers] = useState(true);
  const [copied, setCopied] = useState("");
  const [items, setItems] = useState<string[]>(() => Array.from({ length: 12 }, () => createNickname("mixed", "nova", "", true)));

  const generate = () => {
    const total = Math.min(30, Math.max(1, count));
    const next = new Set<string>();
    let attempts = 0;
    while (next.size < total && attempts < total * 8) {
      next.add(createNickname(style, seed, separator, withNumbers));
      attempts += 1;
    }
    setItems([...next]);
    setCopied("");
  };

  const copy = async (value: string) => {
    await copyToClipboard(value);
    setCopied(value);
    window.setTimeout(() => setCopied(""), 1200);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
      <ToolPanel>
        <label>
          <span className="label">{t(lang, "Базовое слово", "Base word")}</span>
          <input className="input" value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="nova" />
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">{t(lang, "Стиль", "Style")}</span>
            <select className="input" value={style} onChange={(event) => setStyle(event.target.value as NicknameStyle)}>
              <option value="mixed">{t(lang, "Смешанный", "Mixed")}</option>
              <option value="short">{t(lang, "Короткий", "Short")}</option>
              <option value="gamer">{t(lang, "Игровой", "Gamer")}</option>
              <option value="cute">{t(lang, "Мягкий", "Cute")}</option>
              <option value="cyber">{t(lang, "Кибер", "Cyber")}</option>
              <option value="clean">{t(lang, "Чистый", "Clean")}</option>
            </select>
          </label>
          <label>
            <span className="label">{t(lang, "Разделитель", "Separator")}</span>
            <select className="input" value={separator} onChange={(event) => setSeparator(event.target.value)}>
              <option value="">{t(lang, "Без разделителя", "None")}</option>
              <option value="_">_</option>
              <option value=".">.</option>
              <option value="-">-</option>
            </select>
          </label>
          <label>
            <span className="label">{t(lang, "Количество", "Count")}</span>
            <input className="input" type="number" min={1} max={30} value={count} onChange={(event) => setCount(Number(event.target.value))} />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--ink-2)] sm:self-end">
            <input type="checkbox" checked={withNumbers} onChange={(event) => setWithNumbers(event.target.checked)} />
            {t(lang, "Добавлять числа", "Add numbers")}
          </label>
        </div>
        <button className="btn-primary mt-5" onClick={generate}>
          <Sparkles size={16} aria-hidden="true" />
          {t(lang, "Сгенерировать", "Generate")}
        </button>
      </ToolPanel>
      <ToolPanel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-bold text-[var(--ink)]">{t(lang, "Никнеймы", "Nicknames")}</h2>
          <button className="btn-secondary" onClick={() => copy(items.join("\n"))} disabled={!items.length}>
            <Copy size={16} aria-hidden="true" />
            {t(lang, "Все", "All")}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <button
              key={item}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-3 text-left transition hover:border-[var(--line-strong)]"
              onClick={() => copy(item)}
            >
              <span className="min-w-0 truncate font-mono text-sm font-semibold text-[var(--ink)]">{item}</span>
              <span className="shrink-0 text-[var(--accent)]">{copied === item ? <Check size={17} aria-hidden="true" /> : <AtSign size={17} aria-hidden="true" />}</span>
            </button>
          ))}
        </div>
      </ToolPanel>
    </div>
  );
}

function parseYouTubeId(value: string) {
  return value.match(/[?&]v=([^&]+)/)?.[1] || value.match(/youtu\.be\/([^?]+)/)?.[1] || value.match(/shorts\/([^?]+)/)?.[1] || "";
}

function YouTubeCoverTool({ lang }: { lang: Lang }) {
  const [url, setUrl] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const id = parseYouTubeId(url.trim());
  const images = id ? ["maxresdefault", "sddefault", "hqdefault"].map((name) => ({ name, url: `https://img.youtube.com/vi/${id}/${name}.jpg` })) : [];
  return (
    <ToolPanel>
      <label><span className="label">YouTube URL</span><input className="input" value={url} onChange={(event) => setUrl(event.target.value)} /></label>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {images.map((item) => (
          <div key={item.name} className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3">
            <img className="aspect-video w-full rounded-md object-cover" src={item.url} alt="" />
            <button className="btn-secondary mt-3 w-full" onClick={() => downloadUrl(item.url, `${id}-${item.name}.jpg`)}><Download size={16} />{item.name}</button>
          </div>
        ))}
      </div>
      {!id ? <p className="mt-4 text-sm text-[var(--muted)]">{t(lang, "Вставьте ссылку на видео.", "Paste a video link.")}</p> : null}
    </ToolPanel>
  );
}

function TimecodeTool({ lang }: { lang: Lang }) {
  const [items, setItems] = useState("Вступление\nГлавная тема\nПрактика\nИтоги");
  const [step, setStep] = useState(90);
  const output = items.split(/\r?\n/).filter(Boolean).map((line, index) => {
    const seconds = index * step;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const stamp = h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
    return `${stamp} ${line}`;
  }).join("\n");
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToolPanel><label><span className="label">{t(lang, "Темы по строкам", "Topics by line")}</span><textarea className="input min-h-80 resize-y" value={items} onChange={(event) => setItems(event.target.value)} /></label><label className="mt-4 block max-w-xs"><span className="label">{t(lang, "Шаг, сек", "Step, sec")}</span><input className="input" type="number" min={1} value={step} onChange={(event) => setStep(Number(event.target.value))} /></label></ToolPanel>
      <ToolPanel><h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Таймкоды", "Timecodes")}</h2><textarea className="input min-h-80 resize-y font-mono text-sm" value={output} readOnly /><button className="btn-secondary mt-4" onClick={() => copyToClipboard(output)}><Copy size={16} />{t(lang, "Копировать", "Copy")}</button></ToolPanel>
    </div>
  );
}

const transliterationMap: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  і: "i", ї: "yi", є: "ye", ґ: "g"
};

function transliterateText(value: string) {
  return value
    .split("")
    .map((char) => {
      const lower = char.toLowerCase();
      const mapped = transliterationMap[lower];
      if (mapped === undefined) return char;
      return char === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    })
    .join("");
}

function toSlug(value: string, separator: string) {
  return transliterateText(value)
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`${separator}+`, "g"), separator)
    .replace(new RegExp(`^${separator}|${separator}$`, "g"), "");
}

function SlugTransliteratorTool({ lang }: { lang: Lang }) {
  const [input, setInput] = useState("Пример заголовка для страницы");
  const [separator, setSeparator] = useState("-");
  const transliterated = transliterateText(input);
  const slug = toSlug(input, separator);
  const filename = `${slug || "file"}.txt`;

  return (
    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <ToolPanel>
        <label><span className="label">{t(lang, "Текст", "Text")}</span><textarea className="input min-h-56 resize-y leading-6" value={input} onChange={(event) => setInput(event.target.value)} /></label>
        <label className="mt-4 block max-w-xs"><span className="label">{t(lang, "Разделитель", "Separator")}</span><select className="input" value={separator} onChange={(event) => setSeparator(event.target.value)}><option value="-">-</option><option value="_">_</option></select></label>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Результат", "Result")}</h2>
        {[
          [t(lang, "Транслитерация", "Transliteration"), transliterated],
          ["Slug", slug],
          [t(lang, "Имя файла", "File name"), filename]
        ].map(([label, value]) => (
          <button key={label} className="mb-3 flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-3 text-left" onClick={() => copyToClipboard(value)}>
            <span className="min-w-0"><span className="block text-xs font-bold uppercase text-[var(--muted)]">{label}</span><span className="mt-1 block truncate font-mono text-sm font-semibold text-[var(--ink)]">{value || "result"}</span></span>
            <Copy size={17} className="shrink-0 text-[var(--accent)]" />
          </button>
        ))}
      </ToolPanel>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function simpleMarkdownToHtml(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("# ")) return `<h1>${escapeHtml(trimmed.slice(2))}</h1>`;
      if (trimmed.startsWith("## ")) return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`;
      if (/^- /.test(trimmed)) return `<ul>${trimmed.split(/\n/).map((line) => `<li>${escapeHtml(line.replace(/^- /, ""))}</li>`).join("")}</ul>`;
      return `<p>${escapeHtml(trimmed).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")}</p>`;
    })
    .join("\n");
}

function htmlToPlainBlocks(html: string) {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, "## $1\n\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gis, "- $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gis, "$1\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

type MarkupKind = "markdown" | "html" | "json";

function jsonToMarkdown(value: unknown, heading = ""): string {
  if (value === null || typeof value !== "object") {
    return heading ? `## ${heading}\n\n${String(value ?? "")}` : String(value ?? "");
  }
  if (Array.isArray(value)) {
    const primitive = value.every((item) => item === null || typeof item !== "object");
    if (primitive) return `${heading ? `## ${heading}\n\n` : ""}${value.map((item) => `- ${String(item ?? "")}`).join("\n")}`;
    return value
      .map((item, index) => jsonToMarkdown(item, heading ? `${heading} ${index + 1}` : `Item ${index + 1}`))
      .join("\n\n");
  }
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => jsonToMarkdown(item, key))
    .join("\n\n");
}

function markdownToStructuredJson(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("# ")) return { type: "heading", level: 1, text: block.slice(2).trim() };
      if (block.startsWith("## ")) return { type: "heading", level: 2, text: block.slice(3).trim() };
      if (/^- /m.test(block)) {
        return {
          type: "list",
          items: block.split(/\n/).map((line) => line.replace(/^- /, "").trim()).filter(Boolean)
        };
      }
      return { type: "paragraph", text: block.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1") };
    });
}

function convertMarkup(input: string, source: MarkupKind, target: MarkupKind) {
  if (source === "json" && target === "json") return JSON.stringify(JSON.parse(input), null, 2);
  const markdown =
    source === "markdown"
      ? input
      : source === "html"
        ? htmlToPlainBlocks(input)
        : jsonToMarkdown(JSON.parse(input));
  if (target === "markdown") return markdown;
  if (target === "html") return simpleMarkdownToHtml(markdown);
  return JSON.stringify({ blocks: markdownToStructuredJson(markdown) }, null, 2);
}

function MarkupConverterTool({ lang }: { lang: Lang }) {
  const [source, setSource] = useState<MarkupKind>("markdown");
  const [target, setTarget] = useState<MarkupKind>("html");
  const [input, setInput] = useState("# Заголовок\n\n- Пункт\n- Ещё пункт\n\n**Жирный текст**");
  const output = useMemo(() => {
    try {
      return convertMarkup(input, source, target);
    } catch (error) {
      return error instanceof Error ? error.message : "Parse error";
    }
  }, [input, source, target]);
  const options: Array<[MarkupKind, string]> = [["markdown", "Markdown"], ["html", "HTML"], ["json", "JSON"]];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToolPanel>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <label><span className="label">{t(lang, "Из", "From")}</span><select className="input" value={source} onChange={(event) => setSource(event.target.value as MarkupKind)}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="btn-secondary" onClick={() => { setSource(target); setTarget(source); }} type="button" aria-label={t(lang, "Поменять местами", "Swap")}>
            <ArrowLeftRight size={16} />
          </button>
          <label><span className="label">{t(lang, "В", "To")}</span><select className="input" value={target} onChange={(event) => setTarget(event.target.value as MarkupKind)}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <label className="mt-4 block"><span className="label">{t(lang, "Вход", "Input")}</span><textarea className="input min-h-96 resize-y font-mono text-sm leading-6" value={input} onChange={(event) => setInput(event.target.value)} /></label>
      </ToolPanel>
      <ToolPanel>
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-[var(--ink)]">{t(lang, "Выход", "Output")}</h2><button className="btn-secondary" onClick={() => copyToClipboard(output)}><Copy size={16} />{t(lang, "Копировать", "Copy")}</button></div>
        <textarea className="input min-h-96 resize-y font-mono text-sm leading-6" value={output} readOnly />
      </ToolPanel>
    </div>
  );
}

function normalizeCalculatorExpression(input: string) {
  return input
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/[×∙·]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\s+/g, "");
}

function evaluateCalculatorExpression(raw: string) {
  const input = normalizeCalculatorExpression(raw);
  if (!input) return 0;
  if (input.length > 180) throw new Error("Expression is too long");

  let index = 0;
  const functions: Record<string, (value: number) => number> = {
    sqrt: Math.sqrt,
    abs: Math.abs,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    ln: Math.log,
    log: Math.log10,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil
  };

  const peek = () => input[index] || "";
  const match = (token: string) => {
    if (input.startsWith(token, index)) {
      index += token.length;
      return true;
    }
    return false;
  };
  const isDigit = (char: string) => /\d/.test(char);
  const startsValue = () => {
    const char = peek();
    return char === "(" || char === "." || isDigit(char) || /[a-z]/.test(char);
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    while (true) {
      if (match("+")) value += parseTerm();
      else if (match("-")) value -= parseTerm();
      else break;
    }
    return value;
  };

  const parseTerm = (): number => {
    let value = parsePower();
    while (true) {
      if (match("*")) value *= parsePower();
      else if (match("/")) value /= parsePower();
      else if (startsValue()) value *= parsePower();
      else break;
    }
    return value;
  };

  const parsePower = (): number => {
    const value = parseUnary();
    if (match("^")) return value ** parsePower();
    return value;
  };

  const parseUnary = (): number => {
    if (match("+")) return parseUnary();
    if (match("-")) return -parseUnary();
    return parsePostfix();
  };

  const parsePostfix = (): number => {
    let value = parsePrimary();
    while (true) {
      if (match("%")) value /= 100;
      else if (match("!")) {
        if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error("Invalid factorial");
        let result = 1;
        for (let item = 2; item <= value; item += 1) result *= item;
        value = result;
      } else break;
    }
    return value;
  };

  const parseNumber = () => {
    const start = index;
    let dots = 0;
    while (isDigit(peek()) || peek() === ".") {
      if (peek() === ".") dots += 1;
      if (dots > 1) throw new Error("Invalid number");
      index += 1;
    }
    if (start === index) throw new Error("Number expected");
    return Number(input.slice(start, index));
  };

  const readIdentifier = () => {
    const start = index;
    while (/[a-z]/.test(peek())) index += 1;
    return input.slice(start, index);
  };

  const parsePrimary = (): number => {
    if (match("(")) {
      const value = parseExpression();
      if (!match(")")) throw new Error("Missing closing bracket");
      return value;
    }
    if (isDigit(peek()) || peek() === ".") return parseNumber();
    if (/[a-z]/.test(peek())) {
      const name = readIdentifier();
      if (name === "pi") return Math.PI;
      if (name === "e") return Math.E;
      const fn = functions[name];
      if (!fn) throw new Error("Unknown function");
      const argument = match("(")
        ? (() => {
            const value = parseExpression();
            if (!match(")")) throw new Error("Missing closing bracket");
            return value;
          })()
        : parseUnary();
      return fn(argument);
    }
    throw new Error("Unexpected symbol");
  };

  const value = parseExpression();
  if (index !== input.length) throw new Error("Unexpected input");
  if (!Number.isFinite(value)) throw new Error("Invalid result");
  return value;
}

function CalculatorTool({ lang }: { lang: Lang }) {
  const [expression, setExpression] = useState("12 × (8 + 4) ÷ 3");
  const [weight, setWeight] = useState(75);
  const [height, setHeight] = useState(180);
  const calculation = useMemo(() => {
    try {
      return { value: evaluateCalculatorExpression(expression), error: "" };
    } catch {
      return { value: 0, error: t(lang, "Проверьте выражение.", "Check the expression.") };
    }
  }, [expression, lang]);
  const bmi = weight > 0 && height > 0 ? weight / (height / 100) ** 2 : 0;
  const append = (value: string) => setExpression((current) => `${current}${value}`);
  const basicButtons = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "%", "+", "(", ")", "^", "√(", "π", "e", "!", "log("];
  const functionButtons = ["sin(", "cos(", "tan(", "ln(", "abs(", "round("];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToolPanel>
        <label>
          <span className="label">{t(lang, "Выражение", "Expression")}</span>
          <input className="input font-mono" value={expression} onChange={(event) => setExpression(event.target.value)} />
        </label>
        <div className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5 text-3xl font-bold text-[var(--ink)]">
          {Number.isFinite(calculation.value) ? calculation.value.toLocaleString(undefined, { maximumFractionDigits: 10 }) : "0"}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {basicButtons.map((button) => (
            <button key={button} className="btn-secondary min-h-11 px-2 font-mono text-sm" onClick={() => append(button)}>
              {button}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {functionButtons.map((button) => (
            <button key={button} className="btn-secondary min-h-10 px-2 font-mono text-xs" onClick={() => append(button)}>
              {button}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setExpression("")}>
            {t(lang, "Очистить", "Clear")}
          </button>
          <button className="btn-secondary" onClick={() => setExpression((current) => current.slice(0, -1))}>
            <Delete size={16} aria-hidden="true" />
          </button>
          <button className="btn-secondary" onClick={() => append(")")}>
            )
          </button>
        </div>
        <div className="mt-4">
          <ErrorMessage message={calculation.error} />
        </div>
      </ToolPanel>
      <ToolPanel>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "ИМТ", "BMI")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">{t(lang, "Вес, кг", "Weight, kg")}</span>
            <input className="input" type="number" min={1} value={weight} onChange={(event) => setWeight(Number(event.target.value))} />
          </label>
          <label>
            <span className="label">{t(lang, "Рост, см", "Height, cm")}</span>
            <input className="input" type="number" min={1} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
          </label>
        </div>
        <div className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5 text-3xl font-bold text-[var(--ink)]">{Number.isFinite(bmi) ? bmi.toFixed(1) : "0.0"}</div>
        <div className="mt-5 grid gap-2 text-sm text-[var(--muted)]">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 font-mono">√, π, ^, %, !</div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 font-mono">sin(), cos(), tan(), log(), ln(), abs()</div>
        </div>
      </ToolPanel>
    </div>
  );
}

function TimerTool({ lang }: { lang: Lang }) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);

  const configured = Math.max(0, hours * 3600 + minutes * 60 + seconds);

  useEffect(() => {
    if (running) return;
    setRemaining(configured);
  }, [configured, running]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          setRunning(false);
          try {
            const audio = new AudioContext();
            const oscillator = audio.createOscillator();
            oscillator.connect(audio.destination);
            oscillator.start();
            oscillator.stop(audio.currentTime + 0.18);
          } catch {
            // Sound is optional.
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const mm = Math.floor((remaining % 3600) / 60);
  const ss = remaining % 60;
  const hh = Math.floor(remaining / 3600);
  return (
    <ToolPanel>
      <div className="text-center text-[clamp(48px,10vw,96px)] font-extrabold tracking-[-.04em] text-[var(--ink)]">
        {String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </div>
      <div className="mx-auto mt-6 grid max-w-2xl gap-4 sm:grid-cols-4">
        <label>
          <span className="label">{t(lang, "Часы", "Hours")}</span>
          <input className="input" type="number" min={0} value={hours} onChange={(event) => setHours(Math.max(0, Number(event.target.value) || 0))} />
        </label>
        <label>
          <span className="label">{t(lang, "Минуты", "Minutes")}</span>
          <input className="input" type="number" min={0} max={59} value={minutes} onChange={(event) => setMinutes(Math.max(0, Number(event.target.value) || 0))} />
        </label>
        <label>
          <span className="label">{t(lang, "Секунды", "Seconds")}</span>
          <input className="input" type="number" min={0} max={59} value={seconds} onChange={(event) => setSeconds(Math.max(0, Number(event.target.value) || 0))} />
        </label>
        <button className="btn-secondary self-end" onClick={() => setRemaining(configured)}>
          <RotateCcw size={16} aria-hidden="true" />
          {t(lang, "Установить", "Set")}
        </button>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="btn-primary" onClick={() => setRunning((current) => !current)}>
          <Play size={16} aria-hidden="true" />
          {running ? t(lang, "Пауза", "Pause") : t(lang, "Старт", "Start")}
        </button>
        <button className="btn-secondary" onClick={() => { setRunning(false); setRemaining(configured); }}>
          <RotateCcw size={16} aria-hidden="true" />
          {t(lang, "Сброс", "Reset")}
        </button>
      </div>
    </ToolPanel>
  );
}

function RandomizerTool({ lang }: { lang: Lang }) {
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(100);
  const [count, setCount] = useState(5);
  const [names, setNames] = useState("Анна /40\nИван /30\nМария /20\nОлег /10");
  const [output, setOutput] = useState("");
  const [numbers, setNumbers] = useState<number[]>([]);
  const weighted = useMemo(() => parseWeightedItems(names), [names]);
  const generate = () => {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    const nums = Array.from({ length: Math.min(1000, Math.max(1, count)) }, () => Math.floor(Math.random() * (high - low + 1)) + low);
    const winner = pickWeighted(weighted);
    setNumbers(nums);
    const average = nums.reduce((sum, item) => sum + item, 0) / nums.length;
    setOutput(`${t(lang, "Числа", "Numbers")}: ${nums.join(", ")}\n${t(lang, "Среднее", "Average")}: ${average.toFixed(2)}${winner ? `\n${t(lang, "Взвешенный выбор", "Weighted pick")}: ${winner.label} (${winner.probability.toFixed(1)}%)` : ""}`);
  };
  const buckets = useMemo(() => {
    if (!numbers.length) return [];
    const low = Math.min(...numbers);
    const high = Math.max(...numbers);
    const size = Math.max(1, Math.ceil((high - low + 1) / 10));
    return Array.from({ length: 10 }, (_, index) => {
      const from = low + index * size;
      const to = index === 9 ? high : from + size - 1;
      const value = numbers.filter((item) => item >= from && item <= to).length;
      return { label: `${from}-${to}`, value };
    }).filter((item) => item.value || numbers.length > 1);
  }, [numbers]);
  const maxBucket = Math.max(1, ...buckets.map((bucket) => bucket.value));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToolPanel><div className="grid gap-4 sm:grid-cols-3"><label><span className="label">Min</span><input className="input" type="number" value={min} onChange={(event) => setMin(Number(event.target.value))} /></label><label><span className="label">Max</span><input className="input" type="number" value={max} onChange={(event) => setMax(Number(event.target.value))} /></label><label><span className="label">{t(lang, "Количество", "Count")}</span><input className="input" type="number" min={1} max={1000} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label></div><label className="mt-4 block"><span className="label">{t(lang, "Взвешенные варианты", "Weighted options")}</span><textarea className="input min-h-44 resize-y" value={names} onChange={(event) => setNames(event.target.value)} placeholder="Анна /40" /></label><button className="btn-primary mt-5" onClick={generate}><Sparkles size={16} />{t(lang, "Сгенерировать", "Generate")}</button></ToolPanel>
      <ToolPanel><h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t(lang, "Результат", "Result")}</h2><textarea className="input min-h-44 resize-y font-mono text-sm" value={output} onChange={(event) => setOutput(event.target.value)} />{buckets.length ? <div className="mt-5 grid gap-2">{buckets.map((bucket) => <div key={bucket.label} className="grid grid-cols-[74px_1fr_38px] items-center gap-2 text-xs"><span className="font-mono text-[var(--muted)]">{bucket.label}</span><span className="h-3 overflow-hidden rounded-full bg-[var(--surface-3)]"><span className="block h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${(bucket.value / maxBucket) * 100}%` }} /></span><span className="text-right font-bold text-[var(--ink)]">{bucket.value}</span></div>)}</div> : null}</ToolPanel>
    </div>
  );
}

function GiveawayWheelTool({ lang }: { lang: Lang }) {
  const [items, setItems] = useState("Анна /35\nИван /25\nМария /20\nОлег /10\nНикита /10");
  const [winner, setWinner] = useState("");
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const weighted = useMemo(() => parseWeightedItems(items), [items]);
  const pick = () => {
    if (!weighted.length || isSpinning) return;
    const selected = pickWeighted(weighted);
    if (!selected) return;
    let cursor = 0;
    const center = weighted.reduce((found, item) => {
      if (found !== null) return found;
      const start = cursor;
      cursor += item.probability;
      return item.label === selected.label ? start + item.probability / 2 : null;
    }, null as number | null) ?? 0;
    setWinner("");
    setIsSpinning(true);
    setRotation((current) => current + 1800 + (360 - (center / 100) * 360));
    window.setTimeout(() => {
      setWinner(`${selected.label} · ${selected.probability.toFixed(1)}%`);
      setIsSpinning(false);
    }, 2400);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
      <ToolPanel><label><span className="label">{t(lang, "Участники и шансы", "Participants and odds")}</span><textarea className="input min-h-80 resize-y" value={items} onChange={(event) => setItems(event.target.value)} placeholder="Анна /40" /></label><button className="btn-primary mt-5" onClick={pick} disabled={!weighted.length || isSpinning}>{isSpinning ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}{t(lang, "Крутить", "Spin")}</button><div className="mt-5 grid gap-2">{weighted.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm"><span className="truncate font-semibold text-[var(--ink)]">{item.label}</span><span className="font-mono text-xs text-[var(--muted)]">{item.probability.toFixed(1)}%</span></div>)}</div></ToolPanel>
      <ToolPanel><div className="relative mx-auto flex aspect-square max-h-[440px] items-center justify-center"><div className="absolute -top-1 z-10 h-0 w-0 border-x-[16px] border-t-[28px] border-x-transparent border-t-[var(--ink)]" /><div className="absolute inset-0 rounded-full border-[12px] border-[var(--surface)] shadow-[var(--sh-lg)] transition-transform duration-[2400ms] ease-out" style={{ background: conicFromItems(weighted), transform: `rotate(${rotation}deg)` }} /><div className="relative z-10 flex h-[42%] w-[42%] items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] p-4 text-center shadow-[var(--sh-md)]"><div><div className="text-xs font-bold uppercase tracking-[.08em] text-[var(--muted)]">{t(lang, "Победитель", "Winner")}</div><div className="mt-2 text-[clamp(22px,4vw,38px)] font-extrabold text-[var(--ink)]">{winner || (isSpinning ? "..." : "Spin")}</div></div></div></div></ToolPanel>
    </div>
  );
}

function NotesTool({ lang }: { lang: Lang }) {
  const [text, setText] = useState(() => localStorage.getItem("multitool-notes") || "");
  useEffect(() => localStorage.setItem("multitool-notes", text), [text]);
  return (
    <ToolPanel>
      <textarea className="input min-h-[460px] resize-y leading-6" value={text} onChange={(event) => setText(event.target.value)} placeholder={t(lang, "Пишите здесь. Всё сохраняется локально.", "Write here. Everything is saved locally.")} />
      <div className="mt-4 flex gap-3"><button className="btn-secondary" onClick={() => downloadText(text, "notes.txt")}><Download size={16} />TXT</button><button className="btn-secondary" onClick={() => setText("")}><RotateCcw size={16} />{t(lang, "Очистить", "Clear")}</button></div>
    </ToolPanel>
  );
}

type DateCalcMode = "diff" | "add" | "age";

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetweenDates(a: Date, b: Date) {
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end - start) / 86_400_000);
}

function calendarAge(from: Date, to: Date) {
  let years = to.getFullYear() - from.getFullYear();
  let anchor = new Date(from);
  anchor.setFullYear(from.getFullYear() + years);
  if (anchor > to) {
    years -= 1;
    anchor = new Date(from);
    anchor.setFullYear(from.getFullYear() + years);
  }

  let months = to.getMonth() - anchor.getMonth() + (to.getFullYear() - anchor.getFullYear()) * 12;
  let monthAnchor = new Date(anchor);
  monthAnchor.setMonth(anchor.getMonth() + months);
  if (monthAnchor > to) {
    months -= 1;
    monthAnchor = new Date(anchor);
    monthAnchor.setMonth(anchor.getMonth() + months);
  }

  return {
    years,
    months,
    days: Math.max(0, daysBetweenDates(monthAnchor, to)),
    totalDays: Math.max(0, daysBetweenDates(from, to))
  };
}

function formatCalendarDate(date: Date, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long"
  }).format(date);
}

function DateCalculatorTool({ lang }: { lang: Lang }) {
  const today = toDateValue(new Date());
  const [mode, setMode] = useState<DateCalcMode>("diff");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(toDateValue(addCalendarDays(new Date(), 30)));
  const [baseDate, setBaseDate] = useState(today);
  const [days, setDays] = useState(14);
  const [birthDate, setBirthDate] = useState("2000-01-01");
  const [ageAt, setAgeAt] = useState(today);

  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);
  const base = parseDateValue(baseDate);
  const birth = parseDateValue(birthDate);
  const ageDate = parseDateValue(ageAt);
  const signedDiff = start && end ? daysBetweenDates(start, end) : 0;
  const absDiff = Math.abs(signedDiff);
  const addedDate = base ? addCalendarDays(base, Number.isFinite(days) ? days : 0) : null;
  const age = birth && ageDate && ageDate >= birth ? calendarAge(birth, ageDate) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[.95fr_1.05fr]">
      <ToolPanel>
        <div className="inline-flex flex-wrap rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-1">
          {([
            ["diff", t(lang, "Разница", "Difference")],
            ["add", t(lang, "Прибавить дни", "Add days")],
            ["age", t(lang, "Возраст", "Age")]
          ] as const).map(([value, label]) => (
            <button
              key={value}
              className={`btn px-3 ${mode === value ? "bg-[var(--surface)] text-[var(--ink)] shadow-soft" : "text-[var(--muted)]"}`}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "diff" ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label><span className="label">{t(lang, "Начальная дата", "Start date")}</span><input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label><span className="label">{t(lang, "Конечная дата", "End date")}</span><input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          </div>
        ) : null}

        {mode === "add" ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label><span className="label">{t(lang, "Дата", "Date")}</span><input className="input" type="date" value={baseDate} onChange={(event) => setBaseDate(event.target.value)} /></label>
            <label><span className="label">{t(lang, "Дней", "Days")}</span><input className="input" type="number" value={days} onChange={(event) => setDays(Number(event.target.value))} /></label>
          </div>
        ) : null}

        {mode === "age" ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label><span className="label">{t(lang, "Дата рождения", "Birth date")}</span><input className="input" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
            <label><span className="label">{t(lang, "На дату", "At date")}</span><input className="input" type="date" value={ageAt} onChange={(event) => setAgeAt(event.target.value)} /></label>
          </div>
        ) : null}

        <div className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm leading-6 text-[var(--muted)]">
          {mode === "diff"
            ? t(lang, "Считает календарные дни между двумя датами. Отрицательное направление показывается отдельно.", "Calculates calendar days between two dates. Direction is shown separately.")
            : mode === "add"
              ? t(lang, "Можно вводить отрицательное число, чтобы отнять дни.", "Use a negative number to subtract days.")
              : t(lang, "Возраст считается в полных годах, месяцах и днях на выбранную дату.", "Age is calculated in full years, months, and days at the selected date.")}
        </div>
      </ToolPanel>

      <ToolPanel>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--ink)]"><CalendarDays size={20} />{t(lang, "Результат", "Result")}</h2>
        {mode === "diff" && start && end ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5">
              <div className="text-sm text-[var(--muted)]">{t(lang, "Разница", "Difference")}</div>
              <div className="mt-1 text-4xl font-bold text-[var(--ink)]">{absDiff}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{t(lang, "дней", "days")}</div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5">
              <div className="text-sm text-[var(--muted)]">{t(lang, "В неделях", "In weeks")}</div>
              <div className="mt-1 text-4xl font-bold text-[var(--ink)]">{Math.floor(absDiff / 7)}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{t(lang, "недель", "weeks")} · {absDiff % 7} {t(lang, "дн.", "d")}</div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5 sm:col-span-2">
              <div className="text-sm text-[var(--muted)]">{t(lang, "Направление", "Direction")}</div>
              <div className="mt-1 text-xl font-bold text-[var(--ink)]">
                {signedDiff === 0
                  ? t(lang, "Это одна и та же дата.", "It is the same date.")
                  : signedDiff > 0
                    ? t(lang, "Конечная дата позже начальной.", "The end date is after the start date.")
                    : t(lang, "Конечная дата раньше начальной.", "The end date is before the start date.")}
              </div>
            </div>
          </div>
        ) : null}

        {mode === "add" && addedDate ? (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5">
            <div className="text-sm text-[var(--muted)]">{t(lang, "Новая дата", "New date")}</div>
            <div className="mt-2 text-[clamp(28px,5vw,44px)] font-extrabold text-[var(--ink)]">{toDateValue(addedDate)}</div>
            <div className="mt-3 text-sm capitalize text-[var(--muted)]">{formatCalendarDate(addedDate, lang)}</div>
          </div>
        ) : null}

        {mode === "age" ? (
          age ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5"><div className="text-sm text-[var(--muted)]">{t(lang, "Лет", "Years")}</div><div className="mt-1 text-4xl font-bold text-[var(--ink)]">{age.years}</div></div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5"><div className="text-sm text-[var(--muted)]">{t(lang, "Месяцев", "Months")}</div><div className="mt-1 text-4xl font-bold text-[var(--ink)]">{age.months}</div></div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5"><div className="text-sm text-[var(--muted)]">{t(lang, "Дней", "Days")}</div><div className="mt-1 text-4xl font-bold text-[var(--ink)]">{age.days}</div></div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-5 sm:col-span-3">
                <div className="text-sm text-[var(--muted)]">{t(lang, "Всего дней", "Total days")}</div>
                <div className="mt-1 text-3xl font-bold text-[var(--ink)]">{age.totalDays}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-[var(--danger)]">{t(lang, "Дата расчёта должна быть позже даты рождения.", "The calculation date must be after the birth date.")}</div>
          )
        ) : null}
      </ToolPanel>
    </div>
  );
}

function DeviceInfoTool({ lang }: { lang: Lang }) {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const [clientInfo, setClientInfo] = useState<{ ip?: string; host?: string; protocol?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/client-info")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (alive && data) setClientInfo(data as { ip?: string; host?: string; protocol?: string });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const rows = [
    [t(lang, "IP подключения", "Connection IP"), clientInfo?.ip || "—"],
    [t(lang, "Адрес сайта", "Site address"), clientInfo?.host ? `${clientInfo.protocol || location.protocol.replace(":", "")}://${clientInfo.host}` : location.origin],
    [t(lang, "Платформа", "Platform"), navigator.platform],
    [t(lang, "Язык", "Language"), navigator.language],
    [t(lang, "Окно", "Window"), `${window.innerWidth}×${window.innerHeight}`],
    [t(lang, "Экран", "Screen"), `${window.screen.width}×${window.screen.height}`],
    [t(lang, "Ядер CPU", "CPU cores"), String(navigator.hardwareConcurrency || "—")],
    [t(lang, "Память", "Memory"), nav.deviceMemory ? `${nav.deviceMemory} GB` : "—"],
    [t(lang, "Часовой пояс", "Timezone"), Intl.DateTimeFormat().resolvedOptions().timeZone],
    [t(lang, "Сеть", "Network"), navigator.onLine ? t(lang, "онлайн", "online") : t(lang, "офлайн", "offline")],
    ["User Agent", navigator.userAgent]
  ];
  return (
    <ToolPanel>
      <div className="grid gap-3">
        {rows.map(([label, value]) => <div key={label} className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3 sm:grid-cols-[180px_1fr]"><div className="text-sm font-bold text-[var(--muted)]">{label}</div><div className="break-all font-mono text-sm text-[var(--ink)]">{value}</div></div>)}
      </div>
    </ToolPanel>
  );
}

function WorldTimeTool({ lang }: { lang: Lang }) {
  const zones = ["Europe/Moscow", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Shanghai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <ToolPanel>
      <div className="grid gap-3 sm:grid-cols-2">
        {zones.map((zone) => <div key={zone} className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-4"><div className="text-sm font-bold text-[var(--muted)]">{zone}</div><div className="mt-2 text-2xl font-bold text-[var(--ink)]">{now.toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-US", { timeZone: zone })}</div><div className="mt-1 text-sm text-[var(--muted)]">{now.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { timeZone: zone, weekday: "long", day: "2-digit", month: "long" })}</div></div>)}
      </div>
    </ToolPanel>
  );
}

function UniversalTextTool({ tool, lang }: { tool: Tool; lang: Lang }) {
  const [text, setText] = useState(tool.description);
  return (
    <ToolPanel>
      <label><span className="label">{tool.title}</span><textarea className="input min-h-56 resize-y leading-6" value={text} onChange={(event) => setText(event.target.value)} /></label>
      <div className="mt-4 flex gap-3">
        <button className="btn-secondary" onClick={() => copyToClipboard(text)}><Copy size={16} />{t(lang, "Копировать", "Copy")}</button>
        <button className="btn-secondary" onClick={() => downloadText(text, `${safeFileName(tool.slug)}.txt`)}><Download size={16} />TXT</button>
      </div>
    </ToolPanel>
  );
}

