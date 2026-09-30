# Biodata Manager: Product and Engineering Spec (v1)

Read this whole file before writing code. Implement **Phase 1 only** unless told otherwise. UI text is Bangla (bn-BD); code, comments, and identifiers are English.

---

## 1. Purpose and users

A matchmaker (ghotok) handles many bride and groom records on WhatsApp: photos, PDFs or Word docs, and biodata text. WhatsApp is a chat app, not a database, so records get lost, accidentally deleted, and are hard to find or categorise.

This app is a **local companion**, not a WhatsApp client. It stores, organises, searches, and re-shares records. It never connects to WhatsApp accounts or reads WhatsApp data automatically.

**Primary user:** the matchmaker. Not tech savvy. Remembers people by nickname, place, father's name, or a code. Uses an Android phone. Works with other partner matchmakers, and every record should show who supplied it. Sharing with partners is by mutual consent.

**Developer note:** the developer works on a phone (Termux), so keep tooling light and avoid anything that needs the Android SDK.

---

## 2. Non-negotiable principles

1. **Never lose data.** Every incoming item is saved raw first, and organised later. Deletes are soft. Originals are never modified.
2. **Generous search.** One search box, all fields, partial words, typo tolerance, Bangla and English digits treated the same.
3. **Fewest taps.** Large text (min 16px), touch targets min 48px, one primary action per screen.
4. **Offline-first, no backend.** All data stays on the device. No analytics, no third-party network calls, no accounts.
5. **Sensitive data.** Records contain personal details and photos of real people. Treat them accordingly (see section 9).
6. **Optional fields.** A record needs only a gender and at least one photo or some text to be saved.

---

## 3. Tech stack

Progressive Web App, installable on Android Chrome.

- Vite + React + TypeScript
- Dexie (IndexedDB wrapper) for all data, including image blobs
- `vite-plugin-pwa` with `injectManifest` strategy (custom service worker needed for the share target)
- `fflate` for zip export/import
- Vitest for unit tests
- Deployment: static hosting over HTTPS (GitHub Pages). Set Vite `base` correctly. `manifest.scope` and the share target `action` must be inside that base path.

Constraints:
- Share target and install only work over HTTPS in an installed PWA. Test the share flow on a real Android device after deploying.
- A PWA cannot read the WhatsApp media folder or run background jobs. Do not design features that need them.

---

## 4. Data model

```ts
type Gender = 'B' | 'G';            // B = bride, G = groom
type Status = 'active' | 'proposal' | 'fixed' | 'married' | 'hold';

interface Person {
  id: string;                        // uuid
  code: string;                      // "B-0143", unique, never reused
  gender: Gender;
  name?: string;
  alias?: string;                    // how the matchmaker remembers them
  father?: string;
  mother?: string;
  village?: string;
  upazila?: string;
  district?: string;
  age?: number;
  height?: string;
  education?: string;
  profession?: string;
  phoneLast4?: string;               // last 4 digits of contact number, for duplicate checks only
  memo?: string;                     // free-text notes
  tags: string[];
  status: Status;
  sourceId: string | null;           // null = own record, else Partner.id
  photos: MediaRef[];
  docs: MediaRef[];                  // pdf, doc, docx, txt, audio
  rawText?: string;                  // original pasted/shared biodata text
  fromInboxId?: string;
  marriedAt?: number;
  marriedViaPartnerId?: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;                // soft delete
}

interface MediaRef {
  id: string;
  kind: 'image' | 'pdf' | 'doc' | 'audio' | 'text';
  name: string;
  mime: string;
  blob: Blob;                        // original, never modified
  driveFileId?: string;              // set after upload to Google Drive (Phase 2)
  thumb?: Blob;                      // 320px JPEG for lists, images only
  createdAt: number;
}

interface Partner {
  id: string;
  name: string;
  phone?: string;
  area?: string;
  note?: string;
  createdAt: number;
  deletedAt?: number;
}

interface InboxItem {
  id: string;
  files: MediaRef[];
  text: string;
  via: 'share' | 'manual';
  sourceId?: string | null;          // optionally chosen at share time
  status: 'new' | 'partial';
  receivedAt: number;
  discardedAt?: number;
}

interface SendLog {
  id: string;
  personId: string;
  recipient: string;                 // free text, entered by user after sharing
  version: 'original' | 'redacted';
  at: number;
  response: 'pending' | 'interested' | 'no' | 'other';
  note?: string;
}

interface Meta {                     // key-value table
  key: 'counter:B' | 'counter:G' | 'lastBackupAt' | 'pinHash' | 'settings';
  value: unknown;
}
```

Indexes: `Person.code` (unique), `Person.status`, `Person.sourceId`, `Person.deletedAt`, `SendLog.personId`, `InboxItem.discardedAt`.

---

## 5. Core logic

### 5.1 Codes
- Format `B-0143` / `G-0087`. Prefix by gender, 4-digit zero-padded counter (grows past 4 digits if needed).
- Counter is stored in `Meta`, incremented in the **same transaction** that saves the person. Codes are never reused, even after deletion.
- Code never changes after creation.

### 5.2 Status lifecycle
- `active` (default), `proposal`, `fixed`, `married`, `hold`. Any status may change to any other.
- Setting `married`: ask confirmation, set `marriedAt`, ask "who arranged it?" (own or a partner chips), store `marriedViaPartnerId`.
- Default list shows `active` only. Filter chips: Active, Proposal, Fixed, Married, All. `married` records are never deleted automatically.
- Sorting: `updatedAt` descending. In "All", married and hold records sort last.

### 5.3 Delete and trash
- Delete sets `deletedAt`. Requires a confirm dialog that shows the person's name and code.
- Trash screen lists deleted people with a Restore button.
- On app open, permanently purge items with `deletedAt` older than 30 days. Purge only in this one place.
- No bulk delete in v1.

### 5.4 Inbox (import staging)
Every import path creates an `InboxItem` first. Nothing else is required.

- **Share path:** the OS share sheet sends files and/or text to the PWA. One share event produces **one** InboxItem (grouping all files and text from that event). Save immediately, show a short confirmation ("ইনবক্সে জমা হয়েছে"), and offer an optional quick "কার কাছ থেকে?" chip row that can be skipped.
- **Manual path:** Inbox screen has two buttons: pick from gallery/files (multi-select) and paste text. Both create an InboxItem with `via: 'manual'`.
- Image thumbnails are generated at import time (canvas, 320px JPEG). The original blob is stored untouched.
- Inbox items stay until processed or discarded. Discard is soft (`discardedAt`) and purged with the same 30-day rule.

### 5.5 Processing an inbox item ("সাজিয়ে নিন")
Steps, top to bottom on one screen:
1. Preview thumbnails and text.
2. Gender chips (required). Code preview updates live but is only committed on save.
3. Auto-filled fields from the text parser (5.6). Every field is editable. Nothing is saved without the user pressing save.
4. Source chips: recent partners first, "নিজের" always present, and "নতুন সহযোগী".
5. **Duplicate check** (5.7). If matches exist, show a warning card with two actions: "attach to existing" (adds files and text to that person) or "create new".
6. Actions: Save, or "পরে করব" (leaves the item in the inbox).

Saving creates or updates the Person, moves files from the inbox item into the person, and marks the inbox item processed (remove it from inbox).

### 5.6 Text parser
Deterministic, label-based. **No AI calls.** It only suggests values.

- Normalise: NFC, remove zero-width characters, convert Bangla digits to English, unify separators (`:`, `-`, `–`, `=`).
- Match lines like `<label> <sep> <value>` using this label map:

| Field | Labels (Bangla and English) |
|---|---|
| name | নাম, Name |
| father | পিতার নাম, বাবার নাম, Father |
| mother | মাতার নাম, মায়ের নাম, Mother |
| district | জেলা, District |
| upazila | উপজেলা, থানা, Upazila |
| village | গ্রাম, ঠিকানা, Village |
| age | বয়স, Age |
| height | উচ্চতা, Height |
| education | শিক্ষাগত যোগ্যতা, শিক্ষা, Education |
| profession | পেশা, Occupation, Profession |

- Unmatched text stays in `rawText`.
- Must be covered by unit tests with realistic multi-line Bangla samples, mixed Bangla/English labels, and Bangla digits.

### 5.7 Duplicate detection
Compute a match score against existing non-deleted people:
- +3 same normalised father name
- +2 same normalised name (or edit distance ≤ 1)
- +2 same `phoneLast4`
- +1 same district or village

Warn when score ≥ 4. Show which fields matched and which partner supplied the existing record. Comparison uses the normalisation from 5.9.

### 5.8 Source (partners)
- `sourceId = null` means own record. Otherwise it references a Partner.
- Every person card shows a source badge. Each partner has a fixed colour pair derived from its id.
- Partner screen shows per-partner totals (total, active, married), computed at read time, not stored. Tapping a partner opens the People list filtered by that source. It is a filter, not a separate list.
- Deleting a partner is soft, and their people keep the reference and show the name greyed.

### 5.9 Search
One input. Runs on every keystroke with a 150 ms debounce, in memory.

Normalisation `norm(s)`: NFC, remove zero-width chars, Bangla digits to English, punctuation to spaces, lowercase, trim.

Indexed fields: code, name, alias, father, mother, village, upazila, district, profession, education, memo, phoneLast4, tags, source partner name, status label.

Rules:
1. Split the query into tokens. **Every token** must match (AND).
2. A token matches if it is a substring of the record's joined normalised text (score +2), or, for tokens of 3 or more characters, is within edit distance 1 of any word (score +1).
3. A record with any unmatched token is excluded.
4. Rank by score, then `updatedAt`. Married records get -1.
5. If nothing matches, retry once with the last token dropped, and label the result "কাছাকাছি মিল".
6. Voice input: feature-detect `webkitSpeechRecognition`, `lang = 'bn-BD'`. Hide the mic button if unsupported. Do not promise offline voice.

Filter chips (status, gender, source, district) combine with the search query by AND.

Unit tests required: partial word, two-token query, Bangla vs English digits, typo, no-match fallback, source name search.

### 5.10 Sending (share out)
- Use `navigator.share({ files, text })` (feature-detect `canShare`). Requires a user gesture.
- The user chooses which items to include: photos, docs, text summary. Default: first photo plus formatted text.
- Known limitation: WhatsApp may ignore `text` when multiple files are shared. Mitigation: put the text as the caption of a single image share, or offer "কপি করুন" for the text separately.
- The web platform does **not** tell the app who received it. After the share sheet closes, show a small prompt: "কাকে পাঠালেন?" with recent recipient chips and a free-text field. Skippable. Save a `SendLog` with `response: 'pending'`.
- Sharing a partner's record: show a one-line notice ("এটা <partner>-এর রেকর্ড") before the share sheet.
- Follow-up: SendLogs with `response = 'pending'` older than 3 days appear as a warning card on Home ("৩ জনের উত্তর আসেনি"). In-app only, no push notifications.

### 5.11 Backup and restore
- Export creates one `.zip`: `data.json` (all tables, blobs referenced by path) plus `media/` files. Filename `biodata-backup-YYYY-MM-DD.zip`.
- Deliver via `navigator.share` (so it can go to Drive or Saved Messages) with a download fallback.
- Restore imports a zip and **merges by id** (never wipes existing data without an explicit "replace all" confirmation).
- `Meta.lastBackupAt` is updated on export. Home shows a banner if the last backup is older than 7 days. **Backups cannot run silently in a PWA**, so this reminder is the mechanism.
- On first launch call `navigator.storage.persist()`. If denied, show a persistent notice that backups matter more.

### 5.12 App lock
- Optional 4-digit PIN in Settings. Store a salted hash (`SubtleCrypto` PBKDF2). Lock on app open and after 2 minutes in the background.
- Photos and documents are personal data. Phase 2 adds encryption at rest.

### 5.13 Google Drive backup and restore (Phase 2)

Goal: one-tap backup to the user's own Google Drive, and restore on a new phone. This is **backup, not sync**: one active device at a time. The zip export in 5.11 stays as the zero-setup fallback (the user can share it to the Drive app).

**Auth**
- Google Identity Services token client, browser only, no backend. Scope: `https://www.googleapis.com/auth/drive.appdata` (non-sensitive, hidden app folder). Client ID comes from `VITE_GOOGLE_CLIENT_ID`.
- Access tokens are short-lived (about 1 hour) and there is no refresh token without a backend. A backup therefore always starts from a user tap (Settings button or the overdue banner). Never assume background upload.
- If the token expires mid-upload, pause, request a new token, and resume.

**Layout inside appDataFolder**
- `media/<mediaId>`: one file per MediaRef blob. Originals are immutable, so upload once and skip when `MediaRef.driveFileId` is set.
- `snapshots/<ISO-timestamp>.json`: all tables without blobs, plus the list of media ids with size and SHA-256, record counts, and app version.
- Keep the newest 5 snapshots and delete older snapshot files. Delete a media file only when no remaining snapshot references it.

**Backup algorithm**
1. Get a token.
2. Upload missing media (resumable upload for files over 5 MB, concurrency 3, progress like "১২/৪০").
3. Upload the snapshot JSON **last**, so an interrupted backup never leaves a snapshot pointing at missing media.
4. Prune old snapshots.
5. Update `Meta.lastBackupAt` and a short backup summary.
- Must be cancellable and resumable without creating duplicates.
- Before the first backup, if the total media size is over 50 MB, warn that it may use mobile data.

**Restore**
1. Settings, "Drive থেকে ফেরত আনুন", sign in, list snapshots (date, people count, size).
2. Choose a snapshot and a mode: **Merge** (default; by id, higher `updatedAt` wins, `deletedAt` tombstones honoured) or **Replace all** (needs an explicit typed confirmation and first exports a local zip automatically).
3. Download media in batches with progress, verify size and SHA-256, and only then write the database in one transaction. If anything fails, the existing data stays untouched.
4. Set `driveFileId` on restored media so they are not uploaded again.

**Errors:** quota full (say so, show what to do), offline (clear message, no silent queue), revoked access (ask for consent again).

**Privacy:** files live in the hidden app folder of the user's own Google account and count toward their Drive quota. Optional passphrase encryption (AES-GCM) of snapshots and media ships with encryption at rest. If enabled, the UI must state that a lost passphrase makes backups unrecoverable.

**Setup (put in README):** Google Cloud project, enable Drive API, OAuth consent screen (External) with the `drive.appdata` scope, publish it, create an OAuth client ID of type Web application with the deployed origin as an authorized JavaScript origin, then set `VITE_GOOGLE_CLIENT_ID`.

**Acceptance:**
- Backing up 40 photos, then adding 2 and backing up again, uploads only the 2 new files.
- An interrupted backup resumes with no duplicate files.
- On a fresh install, restoring the latest snapshot gives matching counts, openable photos, and working search.
- A failed restore leaves existing data unchanged.

---

## 6. Screens and navigation

Bottom navigation, 4 tabs, Bangla labels:

| Tab | Label | Content |
|---|---|---|
| Home | হোম | Big search + mic, primary button "নতুন যোগ করুন" (opens Inbox), 4 counters (bride active, groom active, proposal, fixed), follow-up card, backup banner, inbox card ("৩টি সাজানো বাকি"), recent people |
| People | তালিকা | Search, filter chips (status, gender, source, district), person cards |
| Partners | সহযোগী | Partner cards with counts, call and WhatsApp buttons, note, add partner |
| Sent | পাঠানো | SendLog list, response badge, change response |

Other screens: Inbox, Process item, Person detail (photos gallery, fields, status, source, send history, share, delete), Add/Edit partner, Trash, Settings (PIN, backup, restore).

Person card shows: thumbnail, code (mono), source badge, name, age, height, education, profession, district, status badge, WhatsApp share button.

Status colours: active = green, proposal = amber, fixed = blue, married = grey, hold = grey outline.

All user-facing strings live in a single `src/i18n/bn.ts`. No hard-coded Bangla in components.

---

## 7. PWA and share target

`manifest.webmanifest` must include:

```json
{
  "share_target": {
    "action": "./share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "files": [{
        "name": "media",
        "accept": ["image/*", "audio/*", "application/pdf",
                   "application/msword",
                   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                   "text/plain"]
      }]
    }
  },
  "display": "standalone",
  "lang": "bn"
}
```

Service worker: intercept `POST` to the share path, read `formData`, write one InboxItem to IndexedDB, then respond with a `303` redirect to `/inbox?shared=1`. Handle text-only, files-only, and mixed shares.

---

## 8. Redaction (Phase 2, design only)

- Text: regex for Bangladeshi mobile numbers (Bangla and English digits, optional +88), emails, and links (`wa.me`, `facebook.com`, `fb.com`). Replace with `▇▇▇▇`.
- Images and PDFs: OCR with Tesseract.js (`ben+eng`) to find word boxes, draw opaque boxes on a canvas, and export a **new** flattened image or PDF. Never leave text under a cover. Also drops EXIF.
- Always show a preview with manual add/remove of boxes. OCR for Bangla is imperfect, so the user must confirm.
- Redacted versions are stored as separate files. The original is untouched.

---

## 9. Privacy and security

- No network calls except loading the app itself and optional speech recognition (browser-provided).
- No logs or analytics that contain personal data.
- PIN lock (5.12). Encryption at rest in Phase 2 (`SubtleCrypto` AES-GCM, key derived from PIN).
- Backups contain personal data. Show a short warning when exporting.

---

## 10. Phases and acceptance criteria

### Phase 1 (MVP)
Scope: everything in sections 4 to 7 except redaction.

Acceptance:
- Share 2 photos and a text from WhatsApp to the installed PWA: one inbox item is created with all three.
- Paste a Bangla biodata text: name, father, district, age are pre-filled correctly.
- Saving a second record with the same father and district shows the duplicate warning.
- Searching "সিলেট রহিম" finds the record whose district is Sylhet and father is Rahim. Searching a name with one wrong letter still finds it.
- A record marked married disappears from the default list but is found under "সব".
- Deleting a record moves it to Trash. Restoring works. Codes are never reused.
- Partner filter shows only that partner's records; partner card counts are correct.
- Export produces a zip. Importing it on a fresh install restores everything.
- All screens are usable at 360px width; text is at least 16px; the app works offline after first load.

### Phase 2
Google Drive backup and restore (section 5.13), redaction (section 8), watermark, chat-export (`.zip`) import, OCR intake, voice-note attach, encryption at rest, richer partner stats.

### Phase 3
Capacitor wrapper for a native Android build (media-folder inbox, Google Drive backup), and optional WhatsApp Business API intake number.

---

## 11. Out of scope

Unofficial WhatsApp protocol libraries (account-ban risk), accessibility-service or notification scraping, a server, multi-device cloud sync (Drive backup in 5.13 is backup only), user accounts, payments or commission calculation, push notifications.

---

## 12. Working instructions for the agent

1. Scaffold the project, commit, then work feature by feature. One commit per feature.
2. Order: DB layer and types, code generator, search and parser with unit tests, People and Person screens, Partners, Inbox and Process, share target, Send and SendLog, Trash, Backup and PIN, polish.
3. Write unit tests (Vitest) for: code generator, normalisation, search, parser, duplicate scoring. Run them before each commit.
4. Do not add features outside the current phase. If something in this spec is ambiguous, choose the simpler behaviour and note it in `DECISIONS.md`.
5. Keep components small. Keep all strings in `bn.ts`. Keep data access in one `db/` module.
6. Provide a `README.md` with dev commands, how to deploy to GitHub Pages, and how to test the share target on a phone.
