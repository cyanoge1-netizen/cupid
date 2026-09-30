# SPEC Update 1: Rich biodata records

Applies on top of `SPEC.md`. Read `SPEC.md` first, then implement this update. UI text is Bangla, code is English. All strings go in `src/i18n/bn.ts`.

---

## 1. Goals

1. Several photos per person, with a cover photo.
2. Upload and keep PDF or document biodata files.
3. Education as **multiple entries** instead of one degree field.
4. User-defined fields (extended family info and anything else), with a **persistent suggestion catalog** so a label is created once and never retyped.

`Person.photos[]` and `Person.docs[]` already exist in the data model. Check what the UI really supports and fill the gaps. Do not create parallel structures.

---

## 2. Data model changes

```ts
interface EducationEntry {
  id: string;
  level: string;              // required, free text with suggestions: এসএসসি, এইচএসসি, ডিপ্লোমা, অনার্স, মাস্টার্স, এমবিবিএস
  subject?: string;           // বিভাগ / বিষয়
  institution?: string;
  result?: string;            // "GPA 5.00", "First class"
  year?: string;
  status?: 'completed' | 'ongoing';
  note?: string;
}

type FieldSection = 'family' | 'personal' | 'professional' | 'preference' | 'other';

interface FieldDef {          // the persistent catalog
  id: string;
  label: string;
  normLabel: string;          // norm(label), unique
  section: FieldSection;
  kind: 'text' | 'longtext' | 'number';
  useCount: number;
  lastUsedAt: number;
  hidden?: boolean;           // hidden from suggestions; existing values keep working
  seeded?: boolean;
}

interface CustomValue { fieldId: string; value: string; }

interface Suggestion {        // small persistent suggestion lists
  id: string;
  list: 'eduLevel' | 'docLabel';
  text: string;
  useCount: number;
  lastUsedAt: number;
}

// Person additions
educations?: EducationEntry[];
extra?: CustomValue[];        // ordered
coverPhotoId?: string;

// MediaRef additions
label?: string;               // e.g. "বায়োডাটা PDF"
sortOrder?: number;
```

Keep the old `Person.education?: string` for compatibility. It is deprecated and no longer edited.

**Dexie migration (next version):**
- Add tables `fieldDefs` (index `&normLabel`, `section`, `useCount`) and `suggestions` (index `list`, `[list+text]`).
- Upgrade: for each person with a non-empty `education` string and no `educations`, create `educations = [{ id, level: education }]`. Do not delete the old field.
- Seed `fieldDefs` on first run if the table is empty (section 3.4).

**Derived:** `educationSummary(person)` returns the first two entries as `"MBBS (ঢাকা মেডিকেল), এইচএসসি"`. Cards, share text, and search use it.

---

## 3. Rules

### 3.1 Photos
- Add many at once from the gallery or camera, and from inbox items. Each gets a 320px thumbnail. Originals stay untouched.
- One **cover photo** (star button). Default is the first photo. Cards and the default share use the cover.
- Reorder with move up/down buttons (no drag and drop). Remove with a 10 second undo.
- Full-screen viewer with swipe.

### 3.2 Documents
- Accept pdf, doc, docx, txt, audio. Ask for a label with chips from the `docLabel` suggestions, and save a new label as a suggestion.
- Show file size. Warn above 15 MB per file, and above 50 MB total per person.
- Open by creating an object URL. On Android, Chrome may pass PDFs to an external viewer. That is acceptable, do not assume inline rendering.
- Remove with a 10 second undo.

### 3.3 Education editor
- List of cards. Button "+ শিক্ষা যোগ করুন". Only `level` is required.
- `level` input shows suggestion chips: saved suggestions ranked by `useCount`, then the defaults. New text is saved as a suggestion on save.
- Reorder with move up/down. Delete with a 10 second undo.

### 3.4 Custom fields (the important part)
- Person edit screen has collapsible sections: মূল তথ্য (existing fixed fields), শিক্ষা, পারিবারিক তথ্য, ব্যক্তিগত, পেশা, চাহিদা, অন্যান্য, ছবি, কাগজপত্র. Sections with no data are collapsed and hidden in the detail view.
- Each custom section has "+ তথ্য যোগ করুন". It opens a bottom sheet with a search box and chips of catalog labels for that section, ranked by `useCount` then `lastUsedAt`, excluding labels already on this person and hidden ones.
- If the typed text matches no label, show "নতুন: '<text>' যোগ করুন". Choosing it **creates the `FieldDef` immediately**, in the current section, kind `text`. It is suggested from then on. A toggle switches the value input to long text.
- A label is unique by `normLabel`. Adding an existing label just selects it.
- On saving a person, increment `useCount` and set `lastUsedAt` for each used `FieldDef`.
- **Settings, "কাস্টম তথ্যের তালিকা":** list of definitions grouped by section with usage counts. Actions: rename (applies everywhere), hide or unhide, delete only when `useCount == 0` (otherwise offer hide). Values are never deleted from here.
- **Seed defaults** (editable, marked `seeded`):
  - family: পিতার পেশা, মাতার পেশা, ভাই, বোন, চাচা, মামা, পরিবারের ধরন, পারিবারিক অবস্থা, নিজস্ব বাড়ি
  - personal: গায়ের রং, ওজন, রক্তের গ্রুপ, ধর্মীয় অনুশীলন, আগের বিবাহ, স্থায়ী ঠিকানা, বর্তমান ঠিকানা
  - professional: কর্মস্থল, পদবি, মাসিক আয়
  - preference: পাত্র/পাত্রীর চাহিদা, বয়সের সীমা, শিক্ষাগত চাহিদা, অন্যান্য চাহিদা
  - other: বিশেষ নোট

### 3.5 Inbox processing and the parser
- Lines of the form `label sep value` that the parser cannot map to built-in fields go into a checklist "আরও তথ্য পাওয়া গেছে".
- A line is checked by default if its label matches an existing `FieldDef` by `normLabel`, otherwise unchecked. Checked lines become custom values on save. New labels are added to the catalog (section `other` unless matched).
- An education line may hold several degrees. Put the whole text in one editable entry, with a button "আলাদা করুন" that splits on commas and newlines into several entries.

### 3.6 Search
Index adds: all education entry fields, custom values, and document labels. Do not index field labels (that would match everyone who has the field).

### 3.7 Share
- The share sheet lists sections with checkboxes: মূল তথ্য (on), শিক্ষা (on), then each custom field individually (off by default). Remember the last selection in settings.
- Never include in shared text: `phoneLast4`, `memo`, source, status.
- Photos: cover selected by default, others optional. Documents: optional.
- If a PDF or document is selected, show a notice that the original file may contain phone numbers or addresses (redaction comes in Phase 2).

### 3.8 Backup
Zip export and restore (and the Drive snapshot in 5.13) include `fieldDefs` and `suggestions`. On import, merge `fieldDefs` by `normLabel`. If ids collide, remap the imported values to the existing id.

---

## 4. Acceptance criteria

- Add 4 photos to one person and set the third as cover: cards and the default share show the third. Reorder and remove-with-undo work.
- Upload a PDF, label it, open it, remove it, undo the removal.
- Add three education entries. The card shows the first two in the summary. Searching an institution name finds the person.
- Create the custom field "চাচা" once. On the next person it appears as a suggestion chip without retyping, and Settings shows its usage count.
- Renaming a label updates every person. Hiding a label removes it from suggestions but keeps existing values.
- Pasting biodata with an extra line "ভাই: ২ জন" shows it in the checklist. After saving, the next paste with the same label is pre-checked.
- Migration: existing persons with the old education string show it as one education entry. No data is lost.
- A backup export and import round trip keeps custom fields, their values, education entries, and photo order.

**Unit tests required:** field catalog (uniqueness by `normLabel`, `useCount`, hide, rename), migration, `educationSummary`, parser leftover extraction, search over the new fields, backup merge of `fieldDefs`.

---

## 5. Work order

1. Types, Dexie migration, seed data, and migration tests.
2. Catalog module with tests.
3. Education editor.
4. Custom fields editor and Settings screen.
5. Photos and documents UI.
6. Parser leftovers and the inbox checklist.
7. Search index.
8. Share sheet.
9. Backup and restore.
10. README and `DECISIONS.md` updates. One commit per step, run the tests before each commit.
