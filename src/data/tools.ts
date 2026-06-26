import {
  AtSign,
  AudioLines,
  BadgeIcon,
  Calculator,
  CalendarDays,
  Clock3,
  Code2,
  Eraser,
  Eye,
  FileArchive,
  FileImage,
  FileJson,
  FileText,
  Film,
  Gauge,
  Globe2,
  Hash,
  Image,
  ImagePlus,
  KeyRound,
  Languages,
  Link2,
  ListChecks,
  Mic2,
  Palette,
  Paintbrush,
  Pipette,
  QrCode,
  RefreshCw,
  Ruler,
  Scissors,
  ShieldCheck,
  Sparkles,
  Timer,
  Type,
  Video,
  Wand2
} from "lucide-react";
import type { Category, CategoryId, Tool } from "../types";

export const categories: Category[] = [
  {
    id: "image",
    name: "Картинки",
    description: "Конвертация, сжатие, размер, обрезка и подготовка графики.",
    path: "/image",
    icon: Image,
    accent: "text-blue-600 dark:text-blue-300"
  },
  {
    id: "video",
    name: "Видео и аудио",
    description: "Форматы, звук, GIF, сжатие и быстрые операции с роликами.",
    path: "/video",
    icon: Film,
    accent: "text-rose-600 dark:text-rose-300"
  },
  {
    id: "text",
    name: "Текст и документы",
    description: "PDF, чистка текста, подсчёт слов и подготовка документов.",
    path: "/text",
    icon: FileText,
    accent: "text-emerald-600 dark:text-emerald-300"
  },
  {
    id: "dev",
    name: "Разное",
    description: "QR, пароли, цвета, никнеймы, Encoder, JSON и полезные утилиты.",
    path: "/dev",
    icon: Sparkles,
    accent: "text-violet-600 dark:text-violet-300"
  },
  {
    id: "utils",
    name: "Утилиты",
    description: "Единицы, калькуляторы, время, заметки и быстрые проверки.",
    path: "/utils",
    icon: Gauge,
    accent: "text-orange-600 dark:text-orange-300"
  }
];

export const toolIcons = {
  "image-converter": RefreshCw,
  "image-compressor": FileArchive,
  "image-resizer": Scissors,
  "background-remover": Wand2,
  "image-upscaler": Sparkles,
  "image-ocr": Eye,
  "favicon-generator": BadgeIcon,
  "image-collage": ImagePlus,
  "photo-color-picker": Pipette,
  "face-blur": Eraser,
  "watermark": Paintbrush,
  "video-converter": Video,
  "video-compressor": FileArchive,
  "video-to-gif": Film,
  "audio-extractor": AudioLines,
  "media-trimmer": Scissors,
  "audio-converter": Mic2,
  "speed-volume": Gauge,
  "screen-recorder": Video,
  "transcription": Languages,
  "pdf-tools": FileText,
  "pdf-compressor": FileArchive,
  "document-converter": FileText,
  "text-tools": Type,
  "translator": Languages,
  "text-speech": Mic2,
  "json-formatter": FileJson,
  "qr-generator": QrCode,
  "password-generator": KeyRound,
  "color-converter": Palette,
  "encoder": Code2,
  "url-shortener": Link2,
  "slug-transliterator": Hash,
  "nickname-generator": AtSign,
  "youtube-cover": ImagePlus,
  "markdown-html-json": ListChecks,
  "calculator": Calculator,
  "unit-converter": Ruler,
  "timer": Timer,
  "randomizer": Sparkles,
  "giveaway-wheel": RefreshCw,
  "notes": FileText,
  "date-calculator": CalendarDays,
  "browser-info": Globe2,
  "world-time": Clock3
} as const;

export const tools: Tool[] = [
  {
    id: "image-converter",
    slug: "image-converter",
    title: "Конвертер картинок",
    shortTitle: "Конвертер",
    description: "PNG, JPG, WebP и AVIF с быстрым выбором формата.",
    category: "image",
    popular: true,
    tags: ["png", "jpg", "jpeg", "webp", "avif", "svg", "конвертер", "изображение"]
  },
  {
    id: "image-compressor",
    slug: "image-compressor",
    title: "Сжатие изображений",
    shortTitle: "Сжатие",
    description: "Уменьшайте вес PNG, JPG и WebP с контролем качества и максимального размера.",
    category: "image",
    popular: true,
    tags: ["сжать", "фото", "картинка", "png", "jpeg", "webp", "размер"]
  },
  {
    id: "image-resizer",
    slug: "image-resizer",
    title: "Размер, обрезка и поворот",
    shortTitle: "Размер",
    description: "Меняйте ширину, высоту, поворот и квадратную обрезку.",
    category: "image",
    popular: true,
    tags: ["resize", "обрезать", "поворот", "размер", "crop"]
  },
  {
    id: "background-remover",
    slug: "background-remover",
    title: "Удаление фона",
    shortTitle: "Фон",
    description: "Автоматическое отделение объекта от фона.",
    category: "image",
    tags: ["фон", "удалить", "background"]
  },
  {
    id: "image-upscaler",
    slug: "image-upscaler",
    title: "ИИ-апскейл",
    shortTitle: "Апскейл",
    description: "Увеличение изображения через AI-модель.",
    category: "image",
    tags: ["upscale", "ии", "увеличить"]
  },
  {
    id: "image-ocr",
    slug: "image-ocr",
    title: "Картинка в текст",
    shortTitle: "OCR",
    description: "Распознавание текста на изображении через локальный OCR.",
    category: "image",
    tags: ["ocr", "текст", "распознать"]
  },
  {
    id: "favicon-generator",
    slug: "favicon-generator",
    title: "Генератор favicon",
    shortTitle: "Favicon",
    description: "Набор иконок сайта из одного изображения.",
    category: "image",
    tags: ["favicon", "ico", "иконка"]
  },
  {
    id: "image-collage",
    slug: "image-collage",
    title: "Коллаж и PDF из картинок",
    shortTitle: "Коллаж",
    description: "Собирайте несколько изображений в лист или PDF.",
    category: "image",
    tags: ["коллаж", "pdf", "объединить"]
  },
  {
    id: "photo-color-picker",
    slug: "photo-color-picker",
    title: "Пипетка с фото",
    shortTitle: "Пипетка",
    description: "Выбор цвета из изображения и экспорт палитры.",
    category: "image",
    tags: ["пипетка", "цвет", "палитра"]
  },
  {
    id: "face-blur",
    slug: "face-blur",
    title: "Размытие лиц и номеров",
    shortTitle: "Размытие",
    description: "Защита персональных данных на фото.",
    category: "image",
    tags: ["blur", "лицо", "номер"]
  },
  {
    id: "watermark",
    slug: "watermark",
    title: "Водяной знак",
    shortTitle: "Водяной знак",
    description: "Нанесение текста или логотипа на изображение.",
    category: "image",
    tags: ["watermark", "логотип", "текст"]
  },
  {
    id: "video-converter",
    slug: "video-converter",
    title: "Конвертер видео",
    shortTitle: "Видео",
    description: "MP4, WebM, MOV и GIF через локальный backend ffmpeg.",
    category: "video",
    popular: true,
    tags: ["mp4", "webm", "mov", "avi", "gif", "конвертер", "видео"]
  },
  {
    id: "audio-extractor",
    slug: "audio-extractor",
    title: "Извлечение звука",
    shortTitle: "MP4 в MP3",
    description: "Достаньте аудиодорожку из видео и скачайте MP3.",
    category: "video",
    popular: true,
    tags: ["mp3", "аудио", "звук", "извлечь", "mp4"]
  },
  {
    id: "video-compressor",
    slug: "video-compressor",
    title: "Сжатие видео",
    shortTitle: "Сжатие видео",
    description: "Уменьшение веса роликов с прогрессом.",
    category: "video",
    tags: ["сжать", "видео", "битрейт"]
  },
  {
    id: "video-to-gif",
    slug: "video-to-gif",
    title: "Видео в GIF",
    shortTitle: "GIF",
    description: "Создание коротких GIF-анимаций из роликов.",
    category: "video",
    tags: ["gif", "анимация", "video"]
  },
  {
    id: "media-trimmer",
    slug: "media-trimmer",
    title: "Обрезка видео и аудио",
    shortTitle: "Обрезка",
    description: "Обрезайте файл по началу и длительности.",
    category: "video",
    tags: ["trim", "обрезать", "тайминг"]
  },
  {
    id: "audio-converter",
    slug: "audio-converter",
    title: "Конвертер аудио",
    shortTitle: "Аудио",
    description: "MP3, WAV, OGG и M4A.",
    category: "video",
    tags: ["mp3", "wav", "ogg", "m4a"]
  },
  {
    id: "speed-volume",
    slug: "speed-volume",
    title: "Скорость и громкость",
    shortTitle: "Скорость",
    description: "Изменение темпа и уровня аудио.",
    category: "video",
    tags: ["громкость", "скорость", "tempo"]
  },
  {
    id: "screen-recorder",
    slug: "screen-recorder",
    title: "Запись экрана",
    shortTitle: "Запись",
    description: "Запись экрана и веб-камеры.",
    category: "video",
    tags: ["screen", "record", "камера"]
  },
  {
    id: "transcription",
    slug: "transcription",
    title: "Транскрипция",
    shortTitle: "Субтитры",
    description: "Видео и аудио в текст через локальное распознавание Windows Speech.",
    category: "video",
    tags: ["whisper", "субтитры", "текст"]
  },
  {
    id: "pdf-tools",
    slug: "pdf-tools",
    title: "Объединение и разделение PDF",
    shortTitle: "PDF",
    description: "Собирайте PDF из нескольких файлов или оставляйте нужные страницы.",
    category: "text",
    popular: true,
    tags: ["pdf", "merge", "split", "объединить", "разделить"]
  },
  {
    id: "text-tools",
    slug: "text-tools",
    title: "Счётчик и чистка текста",
    shortTitle: "Текст",
    description: "Слова, символы, строки, регистр и удаление лишних пробелов.",
    category: "text",
    popular: true,
    tags: ["слова", "символы", "чистка", "регистр", "пробелы"]
  },
  {
    id: "pdf-compressor",
    slug: "pdf-compressor",
    title: "Сжатие PDF",
    shortTitle: "Сжатие PDF",
    description: "Оптимизация PDF-файлов.",
    category: "text",
    tags: ["pdf", "сжать"]
  },
  {
    id: "document-converter",
    slug: "document-converter",
    title: "Конвертер документов",
    shortTitle: "Документы",
    description: "PDF, DOCX, TXT и MD в аккуратный текст.",
    category: "text",
    tags: ["word", "docx", "txt"]
  },
  {
    id: "translator",
    slug: "translator",
    title: "Переводчик",
    shortTitle: "Перевод",
    description: "Перевод текста через быстрый языковой сервис.",
    category: "text",
    tags: ["translate", "перевод"]
  },
  {
    id: "text-speech",
    slug: "text-speech",
    title: "Текст и речь",
    shortTitle: "Речь",
    description: "Озвучка и диктовка.",
    category: "text",
    tags: ["tts", "speech", "диктовка"]
  },
  {
    id: "json-formatter",
    slug: "json-formatter",
    title: "JSON и XML",
    shortTitle: "JSON",
    description: "Форматирование и проверка структурных данных.",
    category: "text",
    tags: ["json", "xml", "format"]
  },
  {
    id: "qr-generator",
    slug: "qr-generator",
    title: "Генератор QR-кодов",
    shortTitle: "QR",
    description: "Создавайте QR-коды для ссылок, текста, Wi-Fi и контактов.",
    category: "dev",
    popular: true,
    tags: ["qr", "код", "ссылка", "wifi"]
  },
  {
    id: "password-generator",
    slug: "password-generator",
    title: "Генератор паролей",
    shortTitle: "Пароли",
    description: "Надёжные пароли с настройками длины и символов.",
    category: "dev",
    popular: true,
    tags: ["password", "пароль", "генератор"]
  },
  {
    id: "color-converter",
    slug: "color-converter",
    title: "Конвертер цветов",
    shortTitle: "Цвета",
    description: "HEX, RGB, HSL и быстрые палитры для интерфейсов.",
    category: "dev",
    popular: true,
    tags: ["hex", "rgb", "hsl", "цвет", "palette"]
  },
  {
    id: "encoder",
    slug: "encoder",
    title: "Encoder",
    shortTitle: "Encoder",
    description: "Base64, HTML и URL encode/decode для текста и файлов.",
    category: "dev",
    tags: ["base64", "html encode", "url encode", "encoder", "decode", "кодирование"]
  },
  {
    id: "url-shortener",
    slug: "url-shortener",
    title: "Сокращатель ссылок",
    shortTitle: "Ссылки",
    description: "Короткие URL с аналитикой.",
    category: "dev",
    tags: ["short", "url", "ссылка"]
  },
  {
    id: "slug-transliterator",
    slug: "slug-transliterator",
    title: "Генератор slug / транслитерация",
    shortTitle: "Slug",
    description: "Транслитерация текста, URL slug и аккуратные имена файлов.",
    category: "dev",
    tags: ["slug", "транслитерация", "url", "filename"]
  },
  {
    id: "nickname-generator",
    slug: "nickname-generator",
    title: "Генератор никнеймов",
    shortTitle: "Никнеймы",
    description: "Подбор никнеймов по стилю, базовому слову и символам.",
    category: "dev",
    tags: ["nickname", "ник", "никнейм", "username", "логин"]
  },
  {
    id: "youtube-cover",
    slug: "youtube-cover",
    title: "Обложка YouTube-видео",
    shortTitle: "Обложка",
    description: "Получение публичной обложки по ссылке на ролик.",
    category: "dev",
    tags: ["youtube", "cover", "обложка"]
  },
  {
    id: "markdown-html-json",
    slug: "markdown-html-json",
    title: "Markdown = HTML = JSON",
    shortTitle: "MD/HTML/JSON",
    description: "Конвертация Markdown, HTML и JSON между форматами.",
    category: "dev",
    tags: ["markdown", "html", "json", "convert"]
  },
  {
    id: "unit-converter",
    slug: "unit-converter",
    title: "Конвертер единиц",
    shortTitle: "Единицы",
    description: "Длина, вес, температура и быстрые вычисления.",
    category: "utils",
    popular: true,
    tags: ["единицы", "вес", "длина", "температура", "convert"]
  },
  {
    id: "calculator",
    slug: "calculator",
    title: "Калькулятор",
    shortTitle: "Калькулятор",
    description: "Обычные расчёты, проценты и ИМТ.",
    category: "utils",
    tags: ["калькулятор", "проценты", "имт"]
  },
  {
    id: "timer",
    slug: "timer",
    title: "Секундомер и таймер",
    shortTitle: "Таймер",
    description: "Время, интервалы и сигналы.",
    category: "utils",
    tags: ["timer", "секундомер", "время"]
  },
  {
    id: "randomizer",
    slug: "randomizer",
    title: "Случайные числа",
    shortTitle: "Рандом",
    description: "Генератор чисел и выбор победителя.",
    category: "utils",
    tags: ["random", "число", "победитель"]
  },
  {
    id: "giveaway-wheel",
    slug: "giveaway-wheel",
    title: "Колесо-рулетка",
    shortTitle: "Рулетка",
    description: "Розыгрыши и случайный выбор на стриме.",
    category: "utils",
    tags: ["рулетка", "giveaway", "wheel"]
  },
  {
    id: "notes",
    slug: "notes",
    title: "Заметки",
    shortTitle: "Заметки",
    description: "Локальные заметки с автосохранением.",
    category: "utils",
    tags: ["notes", "заметки", "local"]
  },
  {
    id: "date-calculator",
    slug: "date-calculator",
    title: "Калькулятор дат",
    shortTitle: "Даты",
    description: "Разница между датами, прибавление дней и расчёт возраста.",
    category: "utils",
    tags: ["дата", "возраст", "дни", "date", "age", "calendar"]
  },
  {
    id: "browser-info",
    slug: "browser-info",
    title: "Мой IP и устройство",
    shortTitle: "Устройство",
    description: "Данные устройства, окна, языка и сети.",
    category: "utils",
    tags: ["ip", "device", "устройство"]
  },
  {
    id: "world-time",
    slug: "world-time",
    title: "Мировое время",
    shortTitle: "Время",
    description: "Часовые пояса и быстрые сравнения времени.",
    category: "utils",
    tags: ["time", "timezone", "время"]
  }
];

export function getCategory(id: CategoryId) {
  return categories.find((category) => category.id === id);
}

export function getToolsByCategory(id: CategoryId) {
  return tools.filter((tool) => tool.category === id);
}

export function getToolBySlug(slug: string) {
  return tools.find((tool) => tool.slug === slug);
}

export function getToolIcon(slug: string) {
  return toolIcons[slug as keyof typeof toolIcons] ?? FileImage;
}

export function searchTools(query: string) {
  const value = query.trim().toLowerCase();
  if (!value) return tools;
  return tools.filter((tool) => {
    const haystack = [tool.title, tool.shortTitle, tool.description, ...tool.tags]
      .join(" ")
      .toLowerCase();
    return haystack.includes(value);
  });
}


