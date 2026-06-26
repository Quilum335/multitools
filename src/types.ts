import type { LucideIcon } from "lucide-react";

export type CategoryId = "image" | "video" | "text" | "dev" | "utils";

export type Category = {
  id: CategoryId;
  name: string;
  description: string;
  path: string;
  icon: LucideIcon;
  accent: string;
};

export type Tool = {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  category: CategoryId;
  popular?: boolean;
  tags: string[];
};
