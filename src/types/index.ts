export type Gender = 'B' | 'G'; // B = bride, G = groom
export type Status = 'active' | 'proposal' | 'fixed' | 'married' | 'hold';

export interface EducationEntry {
  id: string;
  level: string; // required, free text with suggestions: এসএসসি, এইচএসসি, ডিপ্লোমা, অনার্স, মাস্টার্স, এমবিবিএস
  subject?: string; // বিভাগ / বিষয়
  institution?: string;
  result?: string; // "GPA 5.00", "First class"
  year?: string;
  status?: 'completed' | 'ongoing';
  note?: string;
}

export type FieldSection = 'family' | 'personal' | 'professional' | 'preference' | 'other';

export interface FieldDef {
  id: string;
  label: string;
  normLabel: string; // norm(label), unique
  section: FieldSection;
  kind: 'text' | 'longtext' | 'number';
  useCount: number;
  lastUsedAt: number;
  hidden?: boolean; // hidden from suggestions; existing values keep working
  seeded?: boolean;
}

export interface CustomValue {
  fieldId: string;
  value: string;
}

export interface Suggestion {
  id: string;
  list: 'eduLevel' | 'docLabel';
  text: string;
  useCount: number;
  lastUsedAt: number;
}

export interface MediaRef {
  id: string;
  kind: 'image' | 'pdf' | 'doc' | 'audio' | 'text';
  name: string;
  mime: string;
  blob: Blob; // original, never modified
  driveFileId?: string; // set after upload to Google Drive (Phase 2)
  thumb?: Blob; // 320px JPEG for lists, images only
  label?: string; // e.g. "বায়োডাটা PDF"
  sortOrder?: number;
  createdAt: number;
}

export interface Person {
  id: string; // uuid
  code: string; // "B-0143", unique, never reused
  gender: Gender;
  name?: string;
  alias?: string; // how the matchmaker remembers them
  father?: string;
  mother?: string;
  village?: string;
  postOffice?: string; // ডাকঘর
  upazila?: string;
  district?: string;
  age?: number;
  height?: string;
  education?: string; // deprecated, kept for backwards compatibility
  educations?: EducationEntry[];
  profession?: string;
  phone?: string; // contact phone / mobile number
  phoneLast4?: string; // last 4 digits of contact number, for duplicate checks only
  memo?: string; // free-text notes
  tags: string[];
  status: Status;
  sourceId: string | null; // null = own record, else Partner.id
  photos: MediaRef[];
  coverPhotoId?: string;
  docs: MediaRef[]; // pdf, doc, docx, txt, audio
  extra?: CustomValue[]; // ordered
  rawText?: string; // original pasted/shared biodata text
  fromInboxId?: string;
  marriedAt?: number;
  marriedViaPartnerId?: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // soft delete
}

export interface Partner {
  id: string;
  name: string;
  phone?: string;
  area?: string;
  note?: string;
  createdAt: number;
  deletedAt?: number;
}

export interface InboxItem {
  id: string;
  files: MediaRef[];
  text: string;
  via: 'share' | 'manual';
  sourceId?: string | null; // optionally chosen at share time
  status: 'new' | 'partial';
  receivedAt: number;
  discardedAt?: number;
}

export interface SendLog {
  id: string;
  personId: string;
  recipient: string; // free text, entered by user after sharing
  version: 'original' | 'redacted';
  at: number;
  response: 'pending' | 'interested' | 'no' | 'other';
  note?: string;
}

export interface Meta {
  key: 'counter:B' | 'counter:G' | 'lastBackupAt' | 'pinHash' | 'settings' | string;
  value: unknown;
}

export interface AppSettings {
  pinEnabled?: boolean;
}
