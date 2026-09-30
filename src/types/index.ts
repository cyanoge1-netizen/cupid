export type Gender = 'B' | 'G'; // B = bride, G = groom
export type Status = 'active' | 'proposal' | 'fixed' | 'married' | 'hold';

export interface MediaRef {
  id: string;
  kind: 'image' | 'pdf' | 'doc' | 'audio' | 'text';
  name: string;
  mime: string;
  blob: Blob; // original, never modified
  driveFileId?: string; // set after upload to Google Drive (Phase 2)
  thumb?: Blob; // 320px JPEG for lists, images only
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
  upazila?: string;
  district?: string;
  age?: number;
  height?: string;
  education?: string;
  profession?: string;
  phoneLast4?: string; // last 4 digits of contact number, for duplicate checks only
  memo?: string; // free-text notes
  tags: string[];
  status: Status;
  sourceId: string | null; // null = own record, else Partner.id
  photos: MediaRef[];
  docs: MediaRef[]; // pdf, doc, docx, txt, audio
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
