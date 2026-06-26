import { ChangeEvent, DragEvent, useId, useRef, useState } from "react";
import { FilePlus2, UploadCloud } from "lucide-react";
import { formatBytes } from "../lib/files";

type DropZoneProps = {
  title: string;
  description: string;
  accept?: string;
  multiple?: boolean;
  files: File[];
  maxSizeMb?: number;
  onFiles: (files: File[]) => void;
};

export function DropZone({
  title,
  description,
  accept,
  multiple = false,
  files,
  maxSizeMb,
  onFiles
}: DropZoneProps) {
  const isEn = document.documentElement.lang === "en";
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  const commitFiles = (nextFiles: File[]) => {
    const limit = maxSizeMb ? maxSizeMb * 1024 * 1024 : null;
    if (limit) {
      const oversized = nextFiles.find((file) => file.size > limit);
      if (oversized) {
        setError(`Файл ${oversized.name} больше лимита ${maxSizeMb} МБ.`);
        return;
      }
    }
    setError("");
    onFiles(multiple ? nextFiles : nextFiles.slice(0, 1));
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    commitFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    commitFiles(Array.from(event.dataTransfer.files ?? []));
  };

  return (
    <div>
      <label
        htmlFor={id}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition ${
          isDragging
            ? "border-[var(--accent)] bg-blue-500/10"
            : "border-[var(--line-strong)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
        }`}
      >
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--accent)]">
          <UploadCloud size={24} aria-hidden="true" />
        </span>
        <span className="max-w-full break-words text-base font-bold text-[var(--ink)]">{title}</span>
        <span className="mt-2 max-w-md break-words text-sm leading-6 text-[var(--muted)]">{description}</span>
        <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--bg)]">
          <FilePlus2 size={16} aria-hidden="true" />
          {isEn ? "Choose file" : "Выбрать файл"}
        </span>
        {maxSizeMb ? (
          <span className="mt-3 text-xs text-[var(--muted)]">{isEn ? "Limit" : "Лимит"}: {maxSizeMb} MB</span>
        ) : null}
      </label>
      <input
        ref={inputRef}
        id={id}
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
      />
      {error ? <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
      {files.length ? (
        <div className="mt-3 grid gap-2">
          {files.map((file) => (
            <div
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate font-medium text-[var(--ink-2)]" title={file.name}>{file.name}</span>
              <span className="shrink-0 text-xs text-[var(--muted)]">{formatBytes(file.size)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
