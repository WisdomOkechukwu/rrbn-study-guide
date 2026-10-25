# Radia

A Next.js radiography study workspace built from the ten supplied PowerPoint lecture decks. Zustand manages study state with SQLite persistence and a browser backup.

## Run locally

Requires Node.js 24 or later (uses the built-in `node:sqlite` module).

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Included

- A redesigned dashboard with study sprints, subject shortcuts and real progress.
- 500 authored, four-option questions and 500 learning flashcards across all ten decks.
- Custom timed or untimed practice, exam mode, automatic submission, answer review and retrying missed questions.
- Topic tests launched from the slide reader, with scores, topic breakdowns and links back to the source.
- All 418 slides as readable extracted text, supported original embedded diagrams, slide search, keyboard navigation, adjustable text size and original PowerPoint downloads.
- Everyday-language lecture search, using local BM25 ranking, related concepts and question explanations. Results are source excerpts with slide references. No model, API key or external upload is needed.
- Bookmarks, flashcard learning status, session history and local student profile.

Original PowerPoint files are copied byte-for-byte into `public/lectures`. Source wording, including original errors, remains unchanged. Reading view reflows the extracted text; download the original deck for its exact layout, vector drawings, charts and animations. Study explanations are separate from the notes.

The question bank is an independent study resource, not official RRBN examination material or a guarantee of every possible question. Scores describe performance on the selected items, not clinical competence.

## Checks

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Browser checks require Playwright Chromium and a running local server:

```sh
npx playwright install chromium
npm run test:e2e
```

An existing Chromium executable can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Content maintenance

- `app/data/lectures.json`: extracted lecture text, image references and metadata.
- `app/data/questions.json`: authored questions, answer indices, explanations and one-based source slide numbers.
- `app/topics.ts`: topic ranges for focused assessments.
- `app/search.ts`: local natural-language retrieval.
- `scripts/build_content.py --source-dir /path/to/lectures`: rebuilds the slide library and copies the original decks.
- `scripts/build_questions.py`: rebuilds the authored bank.

The local Node server stores progress in `.data/radia.sqlite` using SQLite WAL mode. A private, HTTP-only browser cookie selects the study profile; there is no account or cross-device sign-in. Zustand retains a browser backup and retries database saves after connectivity returns. An older database snapshot does not overwrite newer unsaved browser progress. Timers keep running when a student leaves a session; an expired session is finalized when the app next runs.

## Interface imagery and mobile study mode

The interface uses a course-led design with horizontal navigation, image covers, course filters, and a continue-learning card. Public web photography is used only for interface covers. Source links are recorded in `app/data/image-credits.json` and available under Learning guidance → Course cover image credits. Local image files use Next.js responsive optimization; the smallest image is displayed only as a course thumbnail. The original lecture files, slide text, and diagrams are separate and unchanged.

At widths up to 800px, flashcards and active question sessions occupy the full viewport. A persistent header provides an exit, progress, and settings or question navigation. Bottom controls respect safe-area insets; sessions stay saved when students exit. Flashcard settings remain accessible through the settings icon.

## Restyled PowerPoints and content verification

The reader now uses locally hosted Poppins headings, Inter body text, native Office Math-to-MathML rendering, and structured tables. It selects the visible Office compatibility branch so equations are not dropped and fallback copies are not duplicated. Only formatting and presentation change; source wording is not corrected or paraphrased.

The reader provides separate downloads for the original and restyled decks. The library also provides `public/lectures/radia-redesigned-lectures.zip`, containing all ten restyled presentations and the Poppins fonts under their original Open Font License. Install those fonts for the intended PowerPoint headings; body text uses Arial. Original diagrams, chart data, media, notes, slide count, text runs and equations are preserved in the restyled packages.

- `scripts/restyle_powerpoints.py` creates the styled copies. It requires Pillow; originals are never overwritten.
- `scripts/verify_powerpoints.py` independently checks all 418 slides, text/math runs, paragraph counts, namespace bindings, package parts and original media.
- `scripts/slide_text.py` extracts original text, Office Math and genuine table structure.
- `app/data/question-review.json` records the editorial answer-key review and selected primary references. The original 300 keys were reviewed; 200 additional items were authored and checked against the supplied slides only; arithmetic is independently recalculated in tests.

A desktop PowerPoint renderer is not installed in this environment. The downloaded presentations are structurally and content verified, while the in-app reader is browser tested. Exact desktop rendering is subject to the installed fonts and presentation application.

The 200 additional questions (q301–q500) use only the supplied PowerPoints, with twenty additional questions per deck across two expansions. Each includes its source slide, explanation and original supporting slide text in the exported bank. No external material was used to author this expansion.

## Theme, branding and study storage

Use the sun/moon control in the header to switch themes. The saved theme is applied before first paint. Original embedded diagrams keep their original colours; interface surfaces, reader text, questions and flashcards adapt to dark mode.

The Gen Z brand mark is at `public/brand/radia-genz.png` and is used in the header and browser/app icons. `public/brand/generation.md` records the image-generation prompt. The above-the-fold continue-learning cover loads eagerly; other course covers remain lazy-loaded.

Open the student avatar → **A fresh start** → **Clear everything & start afresh**. Confirming clears the SQLite profile and browser study backup, including answers, results, bookmarks, learned cards, reading progress, session, name and theme preference. The lecture files and question bank are retained. Reset errors are shown and existing progress is kept if the database cannot be cleared.

Set `RADIA_DB_PATH` to choose a persistent SQLite file location. The server needs write access there. For a hosted HTTPS setup set `RADIA_SECURE_COOKIE=true`; this personal local app has no user sign-in. Keep the database on persistent disk when restarting the server.
