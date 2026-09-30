# Architecture & Design Decisions

This document records architectural, technical, and UX design decisions made during Phase 1 development and SPEC-UPDATE-1 implementation according to SPEC.md and SPEC-UPDATE-1.md.

## 1. Project Scaffolding
- **Build & Framework**: Vite 8 + React 19 + TypeScript + Tailwind CSS v3.
- **PWA Strategy**: `vite-plugin-pwa` with `injectManifest` using `src/sw.ts` to support the Web Share Target API with multipart form-data handling.
- **Routing**: In-memory tab-based routing (with URL query and state synchronization) to ensure zero 404 rewrite errors on static hosting like GitHub Pages.
- **Data Access**: Dexie 4.x managing IndexedDB tables (`people`, `partners`, `inbox`, `sendLogs`, `meta`, `fieldDefs`, `suggestions`). All data operations are strictly encapsulated in `src/db/`.
- **Localization**: Single source of truth for all user-facing strings in `src/i18n/bn.ts`. Zero hardcoded Bangla strings in UI components.

## 2. Database & Atomic Code Generation (SPEC 5.1)
- Codes follow `B-0143` (bride) and `G-0087` (groom) format.
- Code generation is executed within a Dexie readwrite transaction alongside person insertion, guaranteeing no race conditions, no skipped codes, and no reuse even if records are deleted.
- Counters in `meta` grow beyond 4 digits seamlessly (`B-10000`).
- A `previewNextCode()` helper allows live preview in the "সাজিয়ে নিন" screen without advancing the sequence.
- `syncCounterWithExistingPeople()` automatically aligns counters to the highest existing code on backup restore or import.

## 3. Search and Typo Tolerance (SPEC 5.9, SPEC-UPDATE-1 3.6)
- Normalization `norm(s)` converts text to Unicode NFC, removes zero-width characters (`\u200B-\u200D`, `\uFEFF`), transforms Bangla numerals to ASCII digits (`০-৯` -> `0-9`), replaces punctuation (including Bangla danda `।` and double danda `॥`) with spaces, and converts to lowercase.
- All query tokens must match (AND logic).
- Substring match awards +2 points; edit distance $\le 1$ on words $\ge 3$ characters awards +1 point. Married records get -1 point so active records rank higher.
- If no results match a multi-token query, the search automatically falls back to dropping the last token and labels the result as "কাছাকাছি মিল" (Near match).
- Search index indexes all education entry fields (level, institution, subject, result, year), custom values, and document labels/names. Field labels are explicitly excluded from indexing to prevent everyone with a field from matching.
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

## 7. Backup and Restore (SPEC 5.11, SPEC-UPDATE-1 3.8)
- Compressed zip archives are produced using `fflate`.
- Archive contains `data.json` with schema manifest and all table records (including `fieldDefs` and `suggestions`), plus binary media blobs stored in `media/`.
- Merging restore matches `fieldDefs` by `normLabel`. If IDs collide, incoming custom values (`person.extra[i].fieldId`) are automatically remapped to the existing local ID.
- Suggestions are merged by composite key `[list+text]`, accumulating usage counters.
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

## 10. Dexie v2 Schema Migration & Data Preservation (SPEC-UPDATE-1 3.1 & 3.2)
- Dexie schema was upgraded to version 2, introducing `fieldDefs: 'id, &normLabel, section, useCount'` and `suggestions: 'id, list, [list+text]'`.
- Automatic v2 migration converts legacy `education: string` into `educations: [{ id, level: education }]` without losing existing data or requiring manual user migration.
- 18 default seed fields across 5 sections (family, personal, professional, preference, other) and default education level suggestions are pre-seeded on first run.

## 11. Extensible Custom Field Catalog & Section Grouping (SPEC-UPDATE-1 3.4)
- Fields are uniquely identified and de-duplicated by `normLabel = norm(label)`.
- Creating a custom field in any section immediately registers the definition in Dexie, automatically offering it as a suggestion chip for subsequent records.
- Settings provides a "কাস্টম তথ্যের তালিকা" management interface:
  - Rename updates the label across the catalog.
  - Hide/unhide toggles suggestion availability while preserving all historical values on person records.
  - Deletion is strictly prevented if `useCount > 0` (guiding the user to "Hide" instead).
- Person view auto-collapses empty custom sections to keep biodata profiles clean and legible.

## 12. Parser Leftovers & Inbox Processing Checklist (SPEC-UPDATE-1 3.5)
- Deterministic extraction identifies `label: value` pairs from pasted text that do not match built-in fields, with negative lookahead protecting compound labels like `পিতার পেশা` or `মাতার নাম`.
- Displays an "আরও তথ্য পাওয়া গেছে" interactive checklist during intake.
- Lines matching an existing catalog label by `normLabel` are checked by default; new lines are unchecked.
- On save, checked lines become `CustomValue` entries, automatically creating missing `FieldDef` entries in section `other`.
- "আলাদা করুন" (Split) feature splits multi-degree education lines into discrete structured entries.

## 13. Media Architecture (Photos & Documents) (SPEC-UPDATE-1 3.3, 3.5)
- Original image and document Blobs are strictly immutable and stored directly in IndexedDB.
- 320px JPEG thumbnails are generated for lists to maintain high scrolling performance.
- Any photo can be designated as the `coverPhotoId` (highlighted with a gold star badge), which takes priority on cards and default share summaries.
- Supports PDF, DOC, DOCX, TXT, and audio attachments with label suggestions.
- Built-in file size checks provide non-blocking warning banners when an attachment exceeds 15 MB or a person's total media exceeds 50 MB.
- Deletions are accompanied by a non-blocking 10-second undo toast.

## 14. Fine-Grained Share Customization & Hard Privacy Invariants (SPEC-UPDATE-1 3.7)
- Biodata sharing provides section toggles: "মূল তথ্য" (checked by default), "শিক্ষা" (checked by default), and individual checkboxes for each custom field (unchecked by default).
- Preferences are saved in `localStorage` (`ghotkali_share_preferences`) so matchmakers don't have to reconfigure them each time.
- Hard privacy constraint: `phoneLast4`, `memo`, `sourceId`, and `status` are strictly stripped from all generated summary text.
- Sharing document attachments displays an explicit privacy notice reminding the matchmaker that PDFs/scans may contain unredacted contact numbers or addresses.
