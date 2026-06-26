type ProgressBarProps = {
  value: number;
  label?: string;
};

export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
        <span>{label ?? "Прогресс"}</span>
        <span>{Math.round(clamped)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-md bg-[var(--surface-3)]">
        <div className="h-full rounded-md bg-[var(--accent)] transition-all" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
