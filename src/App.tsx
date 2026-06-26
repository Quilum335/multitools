import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Languages,
  MegaphoneOff,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  X,
  Zap
} from "lucide-react";
import { AppLink } from "./components/AppLink";
import { ToolCard } from "./components/ToolCard";
import { categories, getCategory, getToolBySlug, getToolIcon, getToolsByCategory, tools } from "./data/tools";
import { gradientIconStyle } from "./lib/design";
import { categoryCopy, toolCopy, ui, type Lang } from "./lib/i18n";
import { setPageMeta } from "./lib/meta";
import type { CategoryId, Tool } from "./types";

const ToolRenderer = lazy(() => import("./tools/ToolPages").then((module) => ({ default: module.ToolRenderer })));

type Route =
  | { name: "home" }
  | { name: "category"; categoryId: CategoryId }
  | { name: "tool"; slug: string }
  | { name: "about" }
  | { name: "not-found" };

function parseRoute(pathname: string): Route {
  if (pathname === "/") return { name: "home" };
  if (pathname === "/about") return { name: "about" };
  const category = categories.find((item) => item.path === pathname);
  if (category) return { name: "category", categoryId: category.id };
  const toolMatch = pathname.match(/^\/tool\/([^/]+)$/);
  if (toolMatch) return { name: "tool", slug: decodeURIComponent(toolMatch[1]) };
  return { name: "not-found" };
}

function getInitialTheme() {
  const stored = localStorage.getItem("multitool-theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialLang(): Lang {
  return localStorage.getItem("multitool-lang") === "en" ? "en" : "ru";
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const [lang, setLang] = useState<Lang>(getInitialLang);
  const [menuOpen, setMenuOpen] = useState(false);
  const route = parseRoute(path);
  const t = ui[lang];

  const navigate = (href: string) => {
    const url = new URL(href, window.location.origin);
    window.history.pushState(null, "", url.pathname + url.search);
    setPath(url.pathname);
    const nextQuery = url.searchParams.get("q");
    setQuery(nextQuery ?? "");
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("multitool-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#111112" : "#ffffff");
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("multitool-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (route.name === "home") {
      setPageMeta(
        lang === "ru" ? "MultiTool — всё в одной вкладке" : "MultiTool — every tool in one tab",
        lang === "ru"
          ? "Бесплатные онлайн-инструменты для картинок, видео, PDF, текста, QR-кодов, паролей, цветов и единиц. Без регистрации и рекламы."
          : "Free online tools for images, video, PDF, text, QR codes, passwords, colors, and units. No sign-up or ads."
      );
    }
    if (route.name === "category") {
      const category = getCategory(route.categoryId);
      const copy = category ? categoryCopy[lang][category.id] : null;
      setPageMeta(`${copy?.name ?? t.categories} — MultiTool`, copy?.description ?? "MultiTool category.");
    }
    if (route.name === "tool") {
      const tool = getToolBySlug(route.slug);
      const copy = tool ? toolCopy(tool, lang) : null;
      setPageMeta(copy ? `${copy.title} — MultiTool` : `${t.notFound} — MultiTool`, copy?.description ?? "MultiTool tool.");
    }
    if (route.name === "about") {
      setPageMeta(`${t.aboutNav} — MultiTool`, t.aboutCopy);
    }
  }, [lang, route, t.aboutCopy, t.aboutNav, t.categories, t.notFound]);

  const submitSearch = () => {
    navigate(query.trim() ? `/?q=${encodeURIComponent(query.trim())}` : "/");
  };

  return (
    <div className="app-shell">
      <Header
        query={query}
        setQuery={setQuery}
        submitSearch={submitSearch}
        theme={theme}
        toggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        lang={lang}
        toggleLang={() => setLang((current) => (current === "ru" ? "en" : "ru"))}
        navigate={navigate}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
      {route.name === "home" ? <HomePage query={query} setQuery={setQuery} navigate={navigate} lang={lang} /> : null}
      {route.name === "category" ? <CategoryPage categoryId={route.categoryId} navigate={navigate} lang={lang} /> : null}
      {route.name === "tool" ? <ToolPage slug={route.slug} navigate={navigate} lang={lang} /> : null}
      {route.name === "about" ? <AboutPage lang={lang} /> : null}
      {route.name === "not-found" ? <NotFoundPage navigate={navigate} lang={lang} /> : null}
      <Footer navigate={navigate} lang={lang} />
    </div>
  );
}

type HeaderProps = {
  query: string;
  setQuery: (value: string) => void;
  submitSearch: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  lang: Lang;
  toggleLang: () => void;
  navigate: (path: string) => void;
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
};

function BrandLogo({ size = 31 }: { size?: number }) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="shrink-0 rounded-[10px] shadow-[var(--sh-sm)]"
    />
  );
}

function Header({ query, setQuery, submitSearch, theme, toggleTheme, lang, toggleLang, navigate, menuOpen, setMenuOpen }: HeaderProps) {
  const t = ui[lang];
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur-[18px] backdrop-saturate-150">
      <div className="mx-auto flex min-h-[67px] max-w-[1280px] items-center justify-between gap-4 px-[clamp(18px,5vw,56px)]">
        <AppLink href="/" navigate={navigate} className="flex shrink-0 items-center gap-[11px] no-underline">
          <BrandLogo />
          <span className="text-[17px] font-bold tracking-[-.02em] text-[var(--ink)]">MultiTool</span>
        </AppLink>

        <form
          className="hidden flex-1 items-center gap-[9px] rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] px-3.5 py-2 transition focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)] md:flex md:max-w-[440px]"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
        >
          <Search size={17} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search}
          />
          <span className="rounded-md border border-[var(--line-strong)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--muted)]">⌘K</span>
        </form>

        <nav className="hidden shrink-0 items-center gap-2 lg:flex">
          <AppLink href="/" navigate={navigate} className="rounded-xl px-2.5 py-2 text-sm font-semibold text-[var(--ink-2)] no-underline hover:bg-[var(--surface-2)]">
            {t.categoriesNav}
          </AppLink>
          <AppLink href="/about" navigate={navigate} className="rounded-xl px-2.5 py-2 text-sm font-semibold text-[var(--ink-2)] no-underline hover:bg-[var(--surface-2)]">
            {t.aboutNav}
          </AppLink>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Переключить тему">
            {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
          <button className="inline-flex h-[38px] items-center gap-1.5 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink-2)] transition hover:bg-[var(--surface-2)]" onClick={toggleLang} aria-label="Switch language">
            <Languages size={17} aria-hidden="true" />
            {lang === "ru" ? "RU" : "EN"}
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <button className="icon-btn" onClick={toggleTheme} aria-label="Переключить тему">
            {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
          <button className="icon-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Открыть меню">
            {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-[var(--line)] bg-[var(--bg)] lg:hidden">
          <div className="grid gap-2 px-5 py-4">
            <form
              className="flex items-center gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] px-3.5 py-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <Search size={17} className="text-[var(--muted)]" aria-hidden="true" />
              <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} />
            </form>
            {categories.map((category) => (
              <AppLink key={category.id} href={category.path} navigate={navigate} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ink-2)] no-underline hover:bg-[var(--surface-2)]">
                {categoryCopy[lang][category.id].name}
              </AppLink>
            ))}
            <AppLink href="/about" navigate={navigate} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ink-2)] no-underline hover:bg-[var(--surface-2)]">
              {t.aboutNav}
            </AppLink>
            <button className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]" onClick={toggleLang}>
              <Languages size={17} aria-hidden="true" />
              {lang === "ru" ? "RU" : "EN"}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function HomePage({ query, setQuery, navigate, lang }: { query: string; setQuery: (value: string) => void; navigate: (path: string) => void; lang: Lang }) {
  const t = ui[lang];
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return tools;
    return tools.filter((tool) => {
      const localized = toolCopy(tool, lang);
      return [localized.title, localized.shortTitle, localized.description, tool.title, tool.shortTitle, tool.description, ...tool.tags]
        .join(" ")
        .toLowerCase()
        .includes(value);
    });
  }, [lang, query]);
  const popularTools = tools.filter((tool) => tool.popular).slice(0, 8);
  const shownTools = query.trim() ? filtered : popularTools;
  const suggestions =
    lang === "ru"
      ? [
          { label: "Сжать фото", href: "/tool/image-compressor" },
          { label: "MP4 → MP3", href: "/tool/audio-extractor" },
          { label: "Объединить PDF", href: "/tool/pdf-tools" },
          { label: "QR-код", href: "/tool/qr-generator" },
          { label: "Конвертер цветов", href: "/tool/color-converter" }
        ]
      : [
          { label: "Compress photo", href: "/tool/image-compressor" },
          { label: "MP4 → MP3", href: "/tool/audio-extractor" },
          { label: "Merge PDF", href: "/tool/pdf-tools" },
          { label: "QR code", href: "/tool/qr-generator" },
          { label: "Color converter", href: "/tool/color-converter" }
        ];

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="aurora-one pointer-events-none absolute left-[8%] top-[-160px] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,.20),transparent_66%)] blur-[28px]" />
        <div className="aurora-two pointer-events-none absolute right-[6%] top-[-120px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(236,72,153,.16),transparent_66%)] blur-[30px]" />
        <div className="aurora-one pointer-events-none absolute left-[42%] top-[60px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,.14),transparent_66%)] blur-[30px]" />

        <div className="relative mx-auto max-w-[880px] px-5 py-[clamp(54px,9vw,104px)] pb-11 text-center sm:px-10">
          <div className="mb-7 inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-semibold tracking-[.03em] text-[var(--ink-2)] shadow-[var(--sh-sm)] [animation:mtFadeSm_.6s_ease_both]">
            <span className="h-[7px] w-[7px] rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.16)] [animation:mtPulse_2.4s_ease-in-out_infinite]" />
            {t.heroBadge}
          </div>
          <h1 className="m-0 text-[clamp(38px,6.4vw,74px)] font-extrabold leading-[1.02] tracking-[-.038em] text-[var(--ink)] [animation:mtFade_.7s_cubic-bezier(.22,1,.36,1)_both]">
            {t.heroTitle.split("\n")[0]}<br className="hidden sm:block" /> {t.heroTitle.split("\n")[1]}
          </h1>
          <p className="mx-auto mb-9 mt-5 max-w-[530px] text-[clamp(17px,2.2vw,20px)] leading-[1.5] text-[var(--muted)] [animation:mtFade_.7s_cubic-bezier(.22,1,.36,1)_.08s_both]">
            {t.heroCopy}
          </p>

          <form
            className="mx-auto flex max-w-[600px] flex-col items-stretch gap-2 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] p-2 shadow-[var(--sh-md)] transition focus-within:border-[var(--accent)] focus-within:shadow-[var(--sh-lg)] sm:flex-row sm:items-center sm:gap-2.5 sm:pl-[18px] [animation:mtFade_.7s_cubic-bezier(.22,1,.36,1)_.16s_both]"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(query.trim() ? `/?q=${encodeURIComponent(query.trim())}` : "/");
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2 sm:px-0">
              <Search size={20} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
              <input
                className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.searchHero}
              />
            </div>
            <button className="btn-primary px-[22px] py-3" type="submit">
              {t.find}
            </button>
          </form>

          <div className="mt-[18px] flex flex-wrap justify-center gap-2 [animation:mtFadeSm_.7s_ease_.24s_both]">
            {suggestions.map((suggestion) => (
              <AppLink
                key={suggestion.label}
                href={suggestion.href}
                navigate={navigate}
                className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 text-[13px] font-medium text-[var(--ink-2)] no-underline transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {suggestion.label}
              </AppLink>
            ))}
          </div>

          <div className="mt-[42px] flex flex-wrap justify-center gap-x-[26px] gap-y-3 [animation:mtFadeSm_.7s_ease_.32s_both]">
            {[
              [UserRound, t.noRegistration],
              [MegaphoneOff, t.noAds],
              [ShieldCheck, t.localServer],
              [Zap, t.instantResult]
            ].map(([Icon, label]) => {
              const TypedIcon = Icon as typeof UserRound;
              return (
                <div key={label as string} className="flex items-center gap-[9px] text-[13.5px] font-medium text-[var(--ink-2)]">
                  <TypedIcon size={17} className="text-[var(--accent)]" aria-hidden="true" />
                  {label as string}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {query.trim() ? (
        <section className="page-wrap pb-6 pt-2">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 className="m-0 text-2xl font-bold tracking-[-.025em] text-[var(--ink)]">{t.searchResults}</h2>
            <span className="text-sm text-[var(--muted)]">{filtered.length} {t.found}</span>
          </div>
          <ToolGrid tools={shownTools} navigate={navigate} lang={lang} />
        </section>
      ) : null}

      <section className="page-wrap py-[34px] pb-[18px]">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="m-0 text-2xl font-bold tracking-[-.025em] text-[var(--ink)]">{t.categories}</h2>
          <span className="text-sm text-[var(--muted)]">{t.totalInSections}</span>
        </div>
        <div className="mt-stagger grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {categories.map((category) => {
            const Icon = category.icon;
            const count = getToolsByCategory(category.id).length;
            return (
              <AppLink key={category.id} href={category.path} navigate={navigate} className="card card-hover relative overflow-hidden p-6 no-underline">
                <span className="mb-[18px] flex h-12 w-12 items-center justify-center rounded-[14px] text-white" style={gradientIconStyle(category.id)}>
                  <Icon size={24} aria-hidden="true" />
                </span>
                <h3 className="mb-1.5 text-[17px] font-bold text-[var(--ink)]">{categoryCopy[lang][category.id].name}</h3>
                <p className="mb-4 text-[13.5px] leading-[1.45] text-[var(--muted)]">{categoryCopy[lang][category.id].description}</p>
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink-2)]">
                  {count} {lang === "ru" ? "инструментов" : "tools"}
                  <ArrowRight size={14} aria-hidden="true" />
                </div>
              </AppLink>
            );
          })}
        </div>
      </section>

      <section className="page-wrap py-[30px] pb-6">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="m-0 text-2xl font-bold tracking-[-.025em] text-[var(--ink)]">{t.popular}</h2>
          <span className="text-sm text-[var(--muted)]">{t.all} →</span>
        </div>
        <div className="mt-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {popularTools.map((tool) => (
            <PopularTool key={tool.slug} tool={tool} navigate={navigate} lang={lang} />
          ))}
        </div>
      </section>

      <section className="page-wrap pb-20 pt-6">
        <div className="grid gap-4 rounded-[22px] border border-[var(--line)] bg-[linear-gradient(135deg,var(--surface-2),var(--bg-soft))] p-[30px] md:grid-cols-3">
          {[
            [ShieldCheck, t.trustPrivateTitle, t.trustPrivateCopy],
            [Zap, t.trustSpeedTitle, t.trustSpeedCopy],
            [MegaphoneOff, t.trustCleanTitle, t.trustCleanCopy]
          ].map(([Icon, title, copy]) => {
            const TypedIcon = Icon as typeof ShieldCheck;
            return (
              <div key={title as string}>
                <div className="mb-3.5 flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent)] shadow-[var(--sh-sm)]">
                  <TypedIcon size={21} aria-hidden="true" />
                </div>
                <div className="mb-1.5 text-base font-bold text-[var(--ink)]">{title as string}</div>
                <div className="text-[13.5px] leading-[1.5] text-[var(--muted)]">{copy as string}</div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function PopularTool({ tool, navigate, lang }: { tool: Tool; navigate: (path: string) => void; lang: Lang }) {
  const category = getCategory(tool.category);
  const copy = toolCopy(tool, lang);
  const Icon = getToolIcon(tool.slug);
  return (
    <AppLink
      href={`/tool/${tool.slug}`}
      navigate={navigate}
      className="flex items-center gap-[13px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-[15px] no-underline shadow-[var(--sh-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-white" style={gradientIconStyle(tool.category)}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] font-semibold text-[var(--ink)]">{copy.title}</span>
        <span className="block text-xs text-[var(--muted)]">{category ? categoryCopy[lang][category.id].name : ""}</span>
      </span>
    </AppLink>
  );
}

function ToolGrid({ tools: list, navigate, lang }: { tools: Tool[]; navigate: (path: string) => void; lang: Lang }) {
  if (!list.length) {
    return <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{ui[lang].noResults}</div>;
  }
  return (
    <div className="mt-stagger grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((tool) => (
        <ToolCard key={tool.slug} tool={toolCopy(tool, lang)} navigate={navigate} />
      ))}
    </div>
  );
}

function CategoryPage({ categoryId, navigate, lang }: { categoryId: CategoryId; navigate: (path: string) => void; lang: Lang }) {
  const t = ui[lang];
  const [categoryQuery, setCategoryQuery] = useState("");
  const category = getCategory(categoryId);
  const list = getToolsByCategory(categoryId);
  if (!category) return <NotFoundPage navigate={navigate} lang={lang} />;
  const Icon = category.icon;
  const filtered = list.filter((tool) => {
    const q = categoryQuery.trim().toLowerCase();
    const localized = toolCopy(tool, lang);
    const byQuery = !q || [localized.title, localized.shortTitle, localized.description, tool.title, tool.shortTitle, tool.description, ...tool.tags].join(" ").toLowerCase().includes(q);
    return byQuery;
  });

  return (
    <main className="page-wrap py-[clamp(28px,5vw,52px)] pb-20 [animation:mtFade_.5s_cubic-bezier(.22,1,.36,1)_both]">
      <Breadcrumbs
        items={[
          { label: t.home, href: "/" },
          { label: categoryCopy[lang][category.id].name }
        ]}
        navigate={navigate}
      />

      <div className="mb-[30px] flex items-start gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] text-white" style={gradientIconStyle(category.id)}>
          <Icon size={32} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-extrabold leading-tight tracking-[-.03em] text-[var(--ink)]">{categoryCopy[lang][category.id].name}</h1>
          <p className="m-0 mt-2 max-w-[560px] text-base leading-[1.5] text-[var(--muted)]">
            {categoryCopy[lang][category.id].description} {t.totalInCategory.replace("{count}", String(list.length))}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex min-w-60 max-w-[380px] flex-1 items-center gap-[9px] rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] px-3.5 py-2.5 focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)]">
          <Search size={16} className="text-[var(--muted)]" aria-hidden="true" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
            value={categoryQuery}
            onChange={(event) => setCategoryQuery(event.target.value)}
            placeholder={t.searchInCategory}
          />
        </div>
      </div>

      <ToolGrid tools={filtered} navigate={navigate} lang={lang} />

      <div className="mt-[46px]">
        <div className="mb-3.5 text-sm font-semibold text-[var(--ink-2)]">{t.otherSections}</div>
        <div className="flex flex-wrap gap-2.5">
          {categories
            .filter((item) => item.id !== category.id)
            .map((item) => {
              const OtherIcon = item.icon;
              return (
                <AppLink key={item.id} href={item.path} navigate={navigate} className="flex items-center gap-2.5 rounded-full border border-[var(--line)] bg-[var(--surface)] py-2 pl-2 pr-4 text-sm font-semibold text-[var(--ink)] no-underline shadow-[var(--sh-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]">
                  <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] text-white" style={gradientIconStyle(item.id)}>
                    <OtherIcon size={16} aria-hidden="true" />
                  </span>
                  {categoryCopy[lang][item.id].name}
                </AppLink>
              );
            })}
        </div>
      </div>
    </main>
  );
}

function ToolPage({ slug, navigate, lang }: { slug: string; navigate: (path: string) => void; lang: Lang }) {
  const t = ui[lang];
  const tool = getToolBySlug(slug);
  if (!tool) return <NotFoundPage navigate={navigate} lang={lang} />;
  const category = getCategory(tool.category);
  const copy = toolCopy(tool, lang);
  const Icon = getToolIcon(tool.slug);
  const similar = getToolsByCategory(tool.category).filter((item) => item.slug !== tool.slug).slice(0, 4);

  return (
    <main className="mx-auto max-w-[980px] px-5 py-[clamp(24px,4vw,44px)] pb-20 sm:px-10 [animation:mtFade_.5s_cubic-bezier(.22,1,.36,1)_both]">
      <Breadcrumbs
        items={[
          { label: t.home, href: "/" },
          { label: category ? categoryCopy[lang][category.id].name : t.categories, href: category?.path ?? "/" },
          { label: copy.title }
        ]}
        navigate={navigate}
      />

      <div className="mb-3.5 flex items-start gap-[18px]">
        <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-2xl text-white" style={gradientIconStyle(tool.category)}>
          <Icon size={29} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[clamp(26px,3.6vw,36px)] font-extrabold leading-tight tracking-[-.03em] text-[var(--ink)]">{copy.title}</h1>
          <p className="m-0 mt-1.5 text-[15.5px] leading-[1.5] text-[var(--muted)]">{copy.description}</p>
        </div>
      </div>

      <Suspense fallback={<div className="panel p-6 text-sm font-semibold text-[var(--muted)]">{t.loadingTool}</div>}>
        <ToolRenderer tool={tool} lang={lang} />
      </Suspense>

      {similar.length ? (
        <section className="mt-10">
          <h2 className="m-0 mb-4 text-xl font-bold tracking-[-.02em] text-[var(--ink)]">{t.similarTools}</h2>
          <div className="mt-stagger grid gap-3 sm:grid-cols-2">
            {similar.map((item) => {
              const SimilarIcon = getToolIcon(item.slug);
              return (
                <AppLink key={item.slug} href={`/tool/${item.slug}`} navigate={navigate} className="flex items-center gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-[15px] py-3.5 text-sm font-semibold text-[var(--ink)] no-underline shadow-[var(--sh-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]">
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] text-white" style={gradientIconStyle(item.category)}>
                    <SimilarIcon size={19} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 truncate">{toolCopy(item, lang).title}</span>
                </AppLink>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Breadcrumbs({ items, navigate }: { items: Array<{ label: string; href?: string }>; navigate: (path: string) => void }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 text-[13.5px] text-[var(--muted)]">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
          {item.href ? (
            <AppLink href={item.href} navigate={navigate} className="text-[var(--muted)] no-underline hover:text-[var(--accent)]">
              {item.label}
            </AppLink>
          ) : (
            <span className="font-semibold text-[var(--ink-2)]">{item.label}</span>
          )}
          {index < items.length - 1 ? <span>/</span> : null}
        </span>
      ))}
    </div>
  );
}

function AboutPage({ lang }: { lang: Lang }) {
  const t = ui[lang];
  return (
    <main className="page-wrap py-14 pb-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="badge mb-5 bg-[var(--surface)] shadow-[var(--sh-sm)]">
          <ShieldCheck size={14} aria-hidden="true" />
          {t.trustPrivateTitle}
        </span>
        <h1 className="text-[clamp(36px,5vw,58px)] font-extrabold leading-[1.04] tracking-[-.038em] text-[var(--ink)]">{t.aboutTitle}</h1>
        <p className="mx-auto mt-5 max-w-[620px] text-lg leading-8 text-[var(--muted)]">
          {t.aboutCopy}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a className="btn-primary no-underline" href="https://t.me/Viber_make" target="_blank" rel="noreferrer">
            Telegram
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a className="btn-secondary no-underline" href="https://www.youtube.com/@Vibetros" target="_blank" rel="noreferrer">
            YouTube
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          [t.noRegistration, lang === "ru" ? "Любой инструмент открывается сразу." : "Every tool opens immediately."],
          [t.noAds, lang === "ru" ? "Интерфейс остаётся чистым и быстрым." : "The interface stays clean and fast."],
          [t.localServer, lang === "ru" ? "Тяжёлые задачи выполняются локально через приложение." : "Heavy tasks run locally through the app."]
        ].map(([title, copy]) => (
          <div key={title} className="card p-6">
            <CheckCircle2 className="mb-4 text-emerald-600 dark:text-emerald-300" size={24} aria-hidden="true" />
            <h2 className="text-lg font-bold text-[var(--ink)]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

function NotFoundPage({ navigate, lang }: { navigate: (path: string) => void; lang: Lang }) {
  const t = ui[lang];
  return (
    <main className="page-wrap py-16">
      <div className="panel max-w-2xl p-6">
        <h1 className="text-3xl font-extrabold text-[var(--ink)]">{t.notFound}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t.notFoundCopy}</p>
        <AppLink href="/" navigate={navigate} className="btn-primary mt-5 no-underline">
          {t.goHome}
        </AppLink>
      </div>
    </main>
  );
}

function Footer({ navigate, lang }: { navigate: (path: string) => void; lang: Lang }) {
  const t = ui[lang];
  const columns =
    lang === "ru"
      ? [
          { title: "Инструменты", items: ["Картинки", "Видео и аудио", "Текст и PDF", "Разное"] },
          { title: "Категории", items: ["Конвертеры", "Сжатие", "Генераторы", "Калькуляторы"] },
          { title: t.project, items: [t.aboutNav, t.privacy, "GitHub", t.contacts] }
        ]
      : [
          { title: "Tools", items: ["Images", "Video & audio", "Text & PDF", "Misc"] },
          { title: "Categories", items: ["Converters", "Compression", "Generators", "Calculators"] },
          { title: t.project, items: [t.aboutNav, t.privacy, "GitHub", t.contacts] }
        ];

  return (
    <footer className="border-t border-[var(--line)] bg-[var(--surface-2)]">
      <div className="page-wrap flex flex-wrap justify-between gap-9 py-10">
        <div className="max-w-[290px]">
          <AppLink href="/" navigate={navigate} className="mb-3 flex items-center gap-2.5 no-underline">
            <BrandLogo size={28} />
            <span className="text-base font-bold text-[var(--ink)]">MultiTool</span>
          </AppLink>
          <p className="m-0 text-[13.5px] leading-[1.55] text-[var(--muted)]">
            {t.footerCopy}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13.5px] font-semibold text-[var(--ink-2)] no-underline transition hover:border-[var(--line-strong)]" href="https://t.me/Viber_make" target="_blank" rel="noreferrer">
              Telegram
            </a>
            <a className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13.5px] font-semibold text-[var(--ink-2)] no-underline transition hover:border-[var(--line-strong)]" href="https://www.youtube.com/@Vibetros" target="_blank" rel="noreferrer">
              YouTube
            </a>
          </div>
        </div>
        <div className="flex flex-wrap gap-[52px]">
          {columns.map((column) => (
            <div key={column.title}>
              <div className="mb-3 text-[12.5px] font-bold uppercase tracking-[.05em] text-[var(--ink-2)]">{column.title}</div>
              <div className="flex flex-col gap-2.5">
                {column.items.map((item) => (
                  <span key={item} className="text-[13.5px] text-[var(--muted)]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
