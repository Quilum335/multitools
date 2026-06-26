import { Download, FileCheck2 } from "lucide-react";
import type { FileResult } from "../lib/files";
import { downloadBlob, formatBytes } from "../lib/files";

type ResultCardProps = {
  result: FileResult | null;
  note?: string;
};

export function ResultCard({ result, note }: ResultCardProps) {
  const isEn = document.documentElement.lang === "en";
  if (!result) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">
        {isEn ? "The result will appear here after launch." : "Результат появится здесь после запуска."}
      </div>
    );
  }

  const diff =
    result.sizeBefore && result.sizeBefore > 0
      ? Math.round((1 - result.blob.size / result.sizeBefore) * 100)
      : null;

  return (
    <div className="min-h-[92px] rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <FileCheck2 size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[var(--ink)]" title={result.name}>{result.name}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {formatBytes(result.blob.size)}
              {diff !== null
                ? ` · ${isEn ? (diff >= 0 ? "smaller by" : "larger by") : diff >= 0 ? "меньше на" : "больше на"} ${Math.abs(diff)}%`
                : ""}
            </div>
          </div>
        </div>
        <button className="btn-primary w-full shrink-0 sm:w-auto" onClick={() => downloadBlob(result.blob, result.name)}>
          <Download size={16} aria-hidden="true" />
          {isEn ? "Download" : "Скачать"}
        </button>
      </div>
      {note ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{note}</p> : null}
    </div>
  );
}
