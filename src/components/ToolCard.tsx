import type { Tool } from "../types";
import { getToolIcon } from "../data/tools";
import { AppLink } from "./AppLink";
import { gradientIconStyle } from "../lib/design";

type ToolCardProps = {
  tool: Tool;
  navigate: (path: string) => void;
};

export function ToolCard({ tool, navigate }: ToolCardProps) {
  const Icon = getToolIcon(tool.slug);
  const isEn = document.documentElement.lang === "en";
  return (
    <AppLink
      href={`/tool/${tool.slug}`}
      navigate={navigate}
      className="card card-hover group flex h-full min-h-[178px] flex-col p-5 no-underline"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={gradientIconStyle(tool.category)}>
          <Icon size={22} aria-hidden="true" />
        </span>
      </div>
      <h3 className="mb-1.5 line-clamp-2 min-h-[2.8em] break-words text-[15.5px] font-bold leading-[1.4] text-[var(--ink)]">{tool.title}</h3>
      <p className="line-clamp-3 flex-1 text-[13px] leading-[1.45] text-[var(--muted)]">{tool.description}</p>
      <div className="mt-4 text-xs font-semibold text-[var(--accent)]">{isEn ? "Open" : "Открыть"}</div>
    </AppLink>
  );
}
