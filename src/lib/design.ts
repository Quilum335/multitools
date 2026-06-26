import type { CategoryId } from "../types";

export const categoryVisuals: Record<CategoryId, { gradient: string; shadow: string; text: string }> = {
  image: {
    gradient: "linear-gradient(135deg,#6366f1,#a78bfa)",
    shadow: "rgba(99,102,241,.4)",
    text: "text-indigo-600 dark:text-indigo-300"
  },
  video: {
    gradient: "linear-gradient(135deg,#ec4899,#f97316)",
    shadow: "rgba(236,72,153,.4)",
    text: "text-pink-600 dark:text-pink-300"
  },
  text: {
    gradient: "linear-gradient(135deg,#0ea5e9,#6366f1)",
    shadow: "rgba(14,165,233,.4)",
    text: "text-sky-600 dark:text-sky-300"
  },
  dev: {
    gradient: "linear-gradient(135deg,#14b8a6,#22c55e)",
    shadow: "rgba(20,184,166,.4)",
    text: "text-teal-600 dark:text-teal-300"
  },
  utils: {
    gradient: "linear-gradient(135deg,#8b5cf6,#d946ef)",
    shadow: "rgba(139,92,246,.4)",
    text: "text-violet-600 dark:text-violet-300"
  }
};

export function getCategoryVisual(id: CategoryId) {
  return categoryVisuals[id];
}

export function gradientIconStyle(id: CategoryId) {
  const visual = getCategoryVisual(id);
  return {
    background: visual.gradient,
    boxShadow: `0 8px 20px ${visual.shadow}`
  };
}
