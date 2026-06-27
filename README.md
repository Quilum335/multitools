# MultiTool

MultiTool — локальный веб-сайт с набором практичных инструментов для картинок, видео, аудио, документов, текста, задач разработчика и повседневных утилит.

Фронтенд собран на React, TypeScript, Vite и Tailwind CSS. Express используется для API-интеграций, OCR, документов и внешних сервисов, а медиа-инструменты FFmpeg обрабатывают файлы на устройстве пользователя через статический wasm-core.

## Возможности

- Картинки: конвертация, сжатие, resize/crop/rotate, удаление фона, AI-апскейл, OCR, favicon, коллаж/PDF, пипетка, размытие лиц/номеров, водяной знак.
- Видео и аудио: конвертация видео, сжатие, видео в GIF, извлечение звука, обрезка медиа, конвертация аудио, скорость/громкость, запись экрана, транскрипция.
- Текст и документы: объединение/разделение PDF, сжатие PDF, извлечение текста из документов, счётчик/чистка текста, переводчик, текст и речь, JSON/XML formatter.
- Разное: QR-коды, пароли, цвета, Encoder, короткие ссылки, slug/transliteration, никнеймы, обложки YouTube, Markdown/HTML/JSON converter.
- Утилиты: конвертер единиц, калькулятор, таймер, randomizer, колесо-рулетка, заметки, калькулятор дат, данные устройства, мировое время.

## Требования

- Node.js 22+.
- Windows поддерживается для текущего локального распознавания речи.
- API-ключ нужен для AI-инструментов, которые обращаются к внешней модели.

## Переменные окружения

Создай `.env` на основе `.env.example`:

```env
GEMINI_API_KEY=your_key_here
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
SERVER_PORT=8787
```

Важно:

- реальные ключи хранятся только в `.env`;
- `.env` добавлен в `.gitignore`;
- если `SERVER_PORT` не указан, сервер использует `8787`.

## Установка

```bash
npm install
```

## Разработка

Запуск клиента Vite и локального API-сервера вместе:

```bash
npm run dev
```

## Локальный production-запуск

Собрать фронтенд:

```bash
npm run build
```

Запустить Express-сервер, который отдаёт `dist` и API:

```bash
npm run start
```

Открыть сайт:

```text
http://127.0.0.1:8787
```

## Деплой на Vercel через GitHub

Проект подготовлен для импорта GitHub-репозитория в Vercel:

- `vercel.json` задаёт build command `npm run build` и output directory `dist`;
- `/api/*` направляется в Express-приложение через Vercel Function;
- `npm run build` копирует `@ffmpeg/core` в `public/ffmpeg-core`, после чего Vercel отдаёт FFmpeg-core как статические файлы;
- остальные маршруты работают как SPA и возвращают `index.html`;
- секреты берутся из переменных окружения Vercel, а не из репозитория.

В Vercel нужно добавить переменные окружения:

```env
GEMINI_API_KEY=...
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

`SERVER_PORT` на Vercel не нужен, он используется только для локального запуска.

## Скрипты

- `npm run start` — старт локальный production-сервер.

- `npm run dev` — клиент и сервер одновременно.
- `npm run dev:client` — только Vite-клиент.
- `npm run server` — только Express-сервер.
- `npm run build` — копирование FFmpeg-core, TypeScript-проверка и production-сборка в `dist`.
- `npm run preview` — Vite preview.


## Структура проекта

```text
server/
  index.mjs          Локальный API-сервер и тяжёлая обработка.

src/
  components/        Общие UI-компоненты.
  data/              Каталог инструментов и категории.
  lib/               Утилиты для файлов и i18n.
  tools/             Реализация страниц инструментов.

dist/                Production-сборка.
```

## Основные API

- `GET /api/health` — проверка локального сервера и конфигурации.
- `POST /api/upscale` — AI-апскейл изображения.
- `POST /api/gemini-text` — текстовый AI endpoint.
- `POST /api/translate` — переводчик.
- `POST /api/ocr` — OCR изображения.
- `POST /api/document-text` — извлечение текста из документов.
- `POST /api/transcribe` — транскрипция аудио/видео.
- `POST /api/shorten` — создание локальной короткой ссылки.

## Локальный адрес

После запуска:

```text
http://127.0.0.1:8787
```
