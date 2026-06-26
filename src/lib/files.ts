export type FileResult = {
  name: string;
  blob: Blob;
  url: string;
  sizeBefore?: number;
};

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function getExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() ?? "" : "";
}

export function replaceExtension(fileName: string, extension: string) {
  const safeExtension = extension.replace(/^\./, "");
  const base = fileName.replace(/\.[^.]+$/, "");
  return `${base || "result"}.${safeExtension}`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

export function downloadUrl(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать изображение."));
    };
    image.src = url;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Браузер не поддержал выбранный формат."));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

export function makeObjectResult(name: string, blob: Blob, sizeBefore?: number): FileResult {
  return {
    name,
    blob,
    sizeBefore,
    url: URL.createObjectURL(blob)
  };
}

export function revokeResult(result: FileResult | null) {
  if (result?.url) URL.revokeObjectURL(result.url);
}

export function parsePageRanges(input: string, pageCount: number) {
  const cleaned = input.trim();
  if (!cleaned) return Array.from({ length: pageCount }, (_, index) => index);

  const pages = new Set<number>();
  for (const chunk of cleaned.split(",")) {
    const part = chunk.trim();
    if (!part) continue;
    const [fromRaw, toRaw] = part.split("-").map((value) => Number(value.trim()));
    if (!Number.isInteger(fromRaw) || fromRaw < 1 || fromRaw > pageCount) {
      throw new Error(`Страница ${part} вне диапазона 1-${pageCount}.`);
    }
    const to = toRaw ? toRaw : fromRaw;
    if (!Number.isInteger(to) || to < fromRaw || to > pageCount) {
      throw new Error(`Диапазон ${part} вне диапазона 1-${pageCount}.`);
    }
    for (let page = fromRaw; page <= to; page += 1) pages.add(page - 1);
  }

  if (!pages.size) throw new Error("Укажите хотя бы одну страницу.");
  return [...pages].sort((a, b) => a - b);
}

export function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "result";
}
