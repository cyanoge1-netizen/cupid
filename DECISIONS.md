# Architecture & Design Decisions

This document records architectural, technical, and UX design decisions made during Phase 1 development according to SPEC.md section 12.

## 1. Project Scaffolding
- **Build & Framework**: Vite 8 + React 19 + TypeScript + Tailwind CSS v3.
- **PWA Strategy**: `vite-plugin-pwa` with `injectManifest` using `src/sw.ts` to support the Web Share Target API with multipart form-data handling.
- **Routing**: In-memory tab-based routing (with URL query and state synchronization) to ensure zero 404 rewrite errors on static hosting like GitHub Pages.
- **Data Access**: Dexie 4.x managing IndexedDB tables (`people`, `partners`, `inbox`, `sendLogs`, `meta`). All data operations are strictly encapsulated in `src/db/`.
- **Localization**: Single source of truth for all user-facing strings in `src/i18n/bn.ts`. Zero hardcoded Bangla strings in UI components.

## 2. Database & Atomic Code Generation (SPEC 5.1)
- Codes follow `B-0143` (bride) and `G-0087` (groom) format.
- Code generation is executed within a Dexie readwrite transaction alongside person insertion, guaranteeing no race conditions, no skipped codes, and no reuse even if records are deleted.
- Counters in `meta` grow beyond 4 digits seamlessly (`B-10000`).
- A `previewNextCode()` helper allows live preview in the "সাজিয়ে নিন" screen without advancing the sequence.
- `syncCounterWithExistingPeople()` automatically aligns counters to the highest existing code on backup restore or import.

## 3. Search and Typo Tolerance (SPEC 5.9)
- Normalization `norm(s)` converts text to Unicode NFC, removes zero-width characters (`\u200B-\u200D`, `\uFEFF`), transforms Bangla numerals to ASCII digits (`০-৯` -> `0-9`), replaces punctuation (including Bangla danda `।` and double danda `॥`) with spaces, and converts to lowercase.
- All query tokens must match (AND logic).
- Substring match awards +2 points; edit distance $\le 1$ on words $\ge 3$ characters awards +1 point. Married records get -1 point so active records rank higher.
- If no results match a multi-token query, the search automatically falls back to dropping the last token and labels the result as "কাছাকাছি মিল" (Near match).
- Voice search uses browser `webkitSpeechRecognition` with `lang = 'bn-BD'` and is hidden if unsupported.

## 4. Deterministic Text Parser (SPEC 5.6)
- Purely deterministic, label-based parsing with no external AI calls.
- Normalizes separators (`:`, `-`, `–`, `—`, `=`) and extracts fields based on precedence-ordered Bangla and English labels (e.g. `পিতার নাম` before `নাম`).
- Extracts numeric age from Bangla numerals and extracts `phoneLast4` from labeled fields or any embedded 11-digit Bangladeshi mobile number in the text.
- Full unprocessed input is preserved in `rawText`.

## 5. Duplicate Detection (SPEC 5.7)
- Weighted match score against non-deleted records:
  - +3 for same normalized father name
  - +2 for same normalized name (or edit distance $\le 1$)
  - +2 for same `phoneLast4`
  - +1 for same district or village
- A score $\ge 4$ displays a warning card showing matched fields and supplying partner name, offering "বিদ্যমান রেকর্ডে যুক্ত করুন" (Attach to existing) and "নতুন হিসেবে তৈরি করুন" (Create new).

## 6. Web Share Target PWA Integration (SPEC 7)
- Web App Manifest configures `share_target` with POST multipart form-data for images, documents, audio, and text.
- The service worker (`src/sw.ts`) intercepts POST to `share`, reads `formData`, writes an `InboxItem` directly to IndexedDB, and responds with a 303 redirect to `/?tab=inbox&shared=1`.
- If `OffscreenCanvas` is available, thumbnails are generated in the service worker; otherwise, thumbnails are generated on the main thread upon viewing.

## 7. Backup and Restore (SPEC 5.11)
- Compressed zip archives are produced using `fflate`.
- Archive contains `data.json` with schema manifest and all table records, plus binary media blobs stored in `media/`.
- Merging restore by ID keeps the record with higher `updatedAt`, while "Replace all" provides an explicit destructive overwrite option.
- Exports update `Meta.lastBackupAt`, which triggers an overdue warning banner on the Home screen if the backup is older than 7 days.
- On launch, `navigator.storage.persist()` is called to request persistent phone storage.

## 8. App Lock (SPEC 5.12)
- 4-digit numeric PIN is securely hashed using `SubtleCrypto` PBKDF2 with SHA-256, 100,000 iterations, and a unique 16-byte random cryptographic salt.
- The app locks on initial launch and whenever the app has been in the background for more than 2 minutes (`visibilitychange` check).

## 9. Web Share Target Redirection via `?tab=inbox&shared=1` (SPEC 7)
- In the Service Worker share target handler, responding with `Response.redirect(new URL('./?tab=inbox&shared=1', event.request.url).href, 303)` was chosen instead of a direct path redirect like `/inbox?shared=1`.
- **Rationale**:
  1. **GitHub Pages & Static Hosting Compatibility**: Static hosts serve single-page applications without server-side rewrite rules. Requesting a path like `/<repo>/inbox` directly from the browser would result in an HTTP 404 Not Found.
  2. **Base-Relative Resolution**: Resolving `./?tab=inbox&shared=1` against `event.request.url` produces a fully qualified URL regardless of whether the app is hosted at root domain (`/`), in a subfolder (`/<repo-name>/`), or behind a dev tunnel.
  3. **Seamless Client State Hydration**: On launch or redirect, `App.tsx` inspects `URLSearchParams` for `shared=1` and `tab=inbox`, sets active tab to Inbox, triggers the "ইনবক্সে জমা হয়েছে" source prompt, and cleans up the browser address bar cleanly using `window.history.replaceState`.
