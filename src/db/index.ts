import Dexie, { type Table } from 'dexie';
import type {
  Person,
  Partner,
  InboxItem,
  SendLog,
  Meta,
  Gender,
  FieldDef,
  Suggestion,
  FieldSection,
} from '../types';
import { norm } from '../utils/normalizer';

export class GhotkaliDatabase extends Dexie {
  people!: Table<Person, string>;
  partners!: Table<Partner, string>;
  inbox!: Table<InboxItem, string>;
  sendLogs!: Table<SendLog, string>;
  meta!: Table<Meta, string>;
  fieldDefs!: Table<FieldDef, string>;
  suggestions!: Table<Suggestion, string>;

  constructor(databaseName = 'GhotkaliDB') {
    super(databaseName);
    this.version(1).stores({
      people: 'id, &code, status, sourceId, deletedAt, updatedAt',
      partners: 'id, deletedAt, createdAt',
      inbox: 'id, status, discardedAt, receivedAt',
      sendLogs: 'id, personId, at, response',
      meta: 'key',
    });

    this.version(2).stores({
      people: 'id, &code, status, sourceId, deletedAt, updatedAt',
      partners: 'id, deletedAt, createdAt',
      inbox: 'id, status, discardedAt, receivedAt',
      sendLogs: 'id, personId, at, response',
      meta: 'key',
      fieldDefs: 'id, &normLabel, section, useCount',
      suggestions: 'id, list, [list+text]',
    }).upgrade(async (tx) => {
      await tx.table('people').toCollection().modify((person: any) => {
        if (
          person.education &&
          typeof person.education === 'string' &&
          person.education.trim() &&
          (!person.educations || person.educations.length === 0)
        ) {
          person.educations = [
            {
              id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
              level: person.education.trim(),
            },
          ];
        }
      });
    });
  }
}

export const db = new GhotkaliDatabase();

// ---------------- Seed Data (SPEC-UPDATE-1 3.4) ----------------

export const SEED_FIELD_DEFS: Array<{ label: string; section: FieldSection; kind: 'text' | 'longtext' | 'number' }> = [
  // family: পিতার পেশা, মাতার পেশা, ভাই, বোন, চাচা, মামা, পরিবারের ধরন, পারিবারিক অবস্থা, নিজস্ব বাড়ি
  { label: 'পিতার পেশা', section: 'family', kind: 'text' },
  { label: 'মাতার পেশা', section: 'family', kind: 'text' },
  { label: 'ভাই', section: 'family', kind: 'text' },
  { label: 'বোন', section: 'family', kind: 'text' },
  { label: 'চাচা', section: 'family', kind: 'text' },
  { label: 'মামা', section: 'family', kind: 'text' },
  { label: 'পরিবারের ধরন', section: 'family', kind: 'text' },
  { label: 'পারিবারিক অবস্থা', section: 'family', kind: 'text' },
  { label: 'নিজস্ব বাড়ি', section: 'family', kind: 'text' },

  // personal: গায়ের রং, ওজন, রক্তের গ্রুপ, ধর্মীয় অনুশীলন, আগের বিবাহ, স্থায়ী ঠিকানা, বর্তমান ঠিকানা
  { label: 'গায়ের রং', section: 'personal', kind: 'text' },
  { label: 'ওজন', section: 'personal', kind: 'text' },
  { label: 'রক্তের গ্রুপ', section: 'personal', kind: 'text' },
  { label: 'ধর্মীয় অনুশীলন', section: 'personal', kind: 'text' },
  { label: 'আগের বিবাহ', section: 'personal', kind: 'text' },
  { label: 'স্থায়ী ঠিকানা', section: 'personal', kind: 'text' },
  { label: 'বর্তমান ঠিকানা', section: 'personal', kind: 'text' },

  // professional: কর্মস্থল, পদবি, মাসিক আয়
  { label: 'কর্মস্থল', section: 'professional', kind: 'text' },
  { label: 'পদবি', section: 'professional', kind: 'text' },
  { label: 'মাসিক আয়', section: 'professional', kind: 'text' },

  // preference: পাত্র/পাত্রীর চাহিদা, বয়সের সীমা, শিক্ষাগত চাহিদা, অন্যান্য চাহিদা
  { label: 'পাত্র/পাত্রীর চাহিদা', section: 'preference', kind: 'longtext' },
  { label: 'বয়সের সীমা', section: 'preference', kind: 'text' },
  { label: 'শিক্ষাগত চাহিদা', section: 'preference', kind: 'text' },
  { label: 'অন্যান্য চাহিদা', section: 'preference', kind: 'longtext' },

  // other: বিশেষ নোট
  { label: 'বিশেষ নোট', section: 'other', kind: 'longtext' },
];

export const SEED_SUGGESTIONS: Array<{ list: 'eduLevel' | 'docLabel'; text: string }> = [
  { list: 'eduLevel', text: 'এসএসসি' },
  { list: 'eduLevel', text: 'এইচএসসি' },
  { list: 'eduLevel', text: 'ডিপ্লোমা' },
  { list: 'eduLevel', text: 'অনার্স' },
  { list: 'eduLevel', text: 'মাস্টার্স' },
  { list: 'eduLevel', text: 'এমবিবিএস' },

  { list: 'docLabel', text: 'বায়োডাটা PDF' },
  { list: 'docLabel', text: 'ছবি' },
  { list: 'docLabel', text: 'সার্টিফিকেট' },
  { list: 'docLabel', text: 'জাতীয় পরিচয়পত্র' },
];

/**
 * Seeds default field definitions if the fieldDefs table is empty.
 */
export async function seedFieldDefsIfEmpty(customDb: GhotkaliDatabase = db): Promise<void> {
  const count = await customDb.fieldDefs.count();
  if (count > 0) return;

  const now = Date.now();
  const entries: FieldDef[] = SEED_FIELD_DEFS.map((s) => ({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    label: s.label,
    normLabel: norm(s.label),
    section: s.section,
    kind: s.kind,
    useCount: 0,
    lastUsedAt: now,
    seeded: true,
  }));

  await customDb.fieldDefs.bulkAdd(entries);
}

/**
 * Seeds default suggestions if the suggestions table is empty.
 */
export async function seedSuggestionsIfEmpty(customDb: GhotkaliDatabase = db): Promise<void> {
  const count = await customDb.suggestions.count();
  if (count > 0) return;

  const now = Date.now();
  const entries: Suggestion[] = SEED_SUGGESTIONS.map((s) => ({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    list: s.list,
    text: s.text,
    useCount: 0,
    lastUsedAt: now,
  }));

  await customDb.suggestions.bulkAdd(entries);
}

/**
 * Preview the next code for a given gender without committing an increment.
 */
export async function previewNextCode(gender: Gender, customDb: GhotkaliDatabase = db): Promise<string> {
  const counterKey = `counter:${gender}`;
  const metaRecord = await customDb.meta.get(counterKey);
  const current = typeof metaRecord?.value === 'number' ? metaRecord.value : 0;
  const next = current + 1;
  const padded = String(next).padStart(4, '0');
  return `${gender}-${padded}`;
}

/**
 * Formats a numeric counter into a code string (e.g. 1 -> B-0001, 143 -> G-0143, 10005 -> B-10005)
 */
export function formatPersonCode(gender: Gender, counter: number): string {
  const padded = String(counter).padStart(4, '0');
  return `${gender}-${padded}`;
}

/**
 * Parses a code string back to gender and counter (e.g. 'B-0143' -> { gender: 'B', counter: 143 })
 */
export function parsePersonCode(code: string): { gender: Gender; counter: number } | null {
  const match = code.trim().match(/^([BG])-(\d+)$/i);
  if (!match) return null;
  const gender = match[1].toUpperCase() as Gender;
  const counter = parseInt(match[2], 10);
  return { gender, counter };
}

/**
 * Atomically allocates a new code and inserts a new Person record in a single transaction.
 */
export async function createPerson(
  personData: Omit<Person, 'id' | 'code' | 'createdAt' | 'updatedAt'> & { id?: string },
  customDb: GhotkaliDatabase = db
): Promise<Person> {
  return await customDb.transaction('rw', customDb.people, customDb.meta, async () => {
    const counterKey = `counter:${personData.gender}`;
    const metaRecord = await customDb.meta.get(counterKey);
    const current = typeof metaRecord?.value === 'number' ? metaRecord.value : 0;
    const next = current + 1;
    await customDb.meta.put({ key: counterKey, value: next });

    const code = formatPersonCode(personData.gender, next);
    const now = Date.now();
    const id = personData.id || crypto.randomUUID();

    const newPerson: Person = {
      ...personData,
      id,
      code,
      createdAt: now,
      updatedAt: now,
    };

    await customDb.people.add(newPerson);
    return newPerson;
  });
}

/**
 * Updates a person and automatically refreshes updatedAt.
 */
export async function updatePerson(
  id: string,
  updates: Partial<Omit<Person, 'id' | 'code' | 'createdAt'>>,
  customDb: GhotkaliDatabase = db
): Promise<void> {
  const existing = await customDb.people.get(id);
  if (!existing) {
    throw new Error(`Person with id ${id} not found`);
  }
  await customDb.people.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

/**
 * Soft deletes a person by setting deletedAt timestamp.
 */
export async function softDeletePerson(id: string, customDb: GhotkaliDatabase = db): Promise<void> {
  await customDb.people.update(id, {
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Restores a soft-deleted person.
 */
export async function restorePerson(id: string, customDb: GhotkaliDatabase = db): Promise<void> {
  await customDb.people.update(id, {
    deletedAt: undefined,
    updatedAt: Date.now(),
  });
}

/**
 * Purges deleted records older than 30 days. Runs only on app open.
 */
export async function purgeOldDeleted(
  retentionDays = 30,
  customDb: GhotkaliDatabase = db
): Promise<{ people: number; inbox: number }> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  let purgedPeople = 0;
  let purgedInbox = 0;

  await customDb.transaction('rw', customDb.people, customDb.inbox, async () => {
    // Purge people with deletedAt < cutoff
    const oldPeople = await customDb.people
      .where('deletedAt')
      .below(cutoff)
      .toArray();

    for (const p of oldPeople) {
      if (p.deletedAt && p.deletedAt < cutoff) {
        await customDb.people.delete(p.id);
        purgedPeople++;
      }
    }

    // Purge inbox with discardedAt < cutoff
    const oldInbox = await customDb.inbox
      .where('discardedAt')
      .below(cutoff)
      .toArray();

    for (const item of oldInbox) {
      if (item.discardedAt && item.discardedAt < cutoff) {
        await customDb.inbox.delete(item.id);
        purgedInbox++;
      }
    }
  });

  return { people: purgedPeople, inbox: purgedInbox };
}

/**
 * Sync counter in Meta if necessary (e.g. after importing records).
 */
export async function syncCounterWithExistingPeople(customDb: GhotkaliDatabase = db): Promise<void> {
  const allPeople = await customDb.people.toArray();
  let maxB = 0;
  let maxG = 0;

  for (const p of allPeople) {
    const parsed = parsePersonCode(p.code);
    if (parsed) {
      if (parsed.gender === 'B' && parsed.counter > maxB) maxB = parsed.counter;
      if (parsed.gender === 'G' && parsed.counter > maxG) maxG = parsed.counter;
    }
  }

  const metaB = await customDb.meta.get('counter:B');
  const currentB = typeof metaB?.value === 'number' ? metaB.value : 0;
  if (maxB > currentB) {
    await customDb.meta.put({ key: 'counter:B', value: maxB });
  }

  const metaG = await customDb.meta.get('counter:G');
  const currentG = typeof metaG?.value === 'number' ? metaG.value : 0;
  if (maxG > currentG) {
    await customDb.meta.put({ key: 'counter:G', value: maxG });
  }
}

// ---------------- Partners ----------------

export async function createPartner(
  partnerData: Omit<Partner, 'id' | 'createdAt'> & { id?: string },
  customDb: GhotkaliDatabase = db
): Promise<Partner> {
  const newPartner: Partner = {
    ...partnerData,
    id: partnerData.id || crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await customDb.partners.add(newPartner);
  return newPartner;
}

export async function updatePartner(
  id: string,
  updates: Partial<Omit<Partner, 'id' | 'createdAt'>>,
  customDb: GhotkaliDatabase = db
): Promise<void> {
  await customDb.partners.update(id, updates);
}

export async function softDeletePartner(id: string, customDb: GhotkaliDatabase = db): Promise<void> {
  await customDb.partners.update(id, {
    deletedAt: Date.now(),
  });
}

export async function restorePartner(id: string, customDb: GhotkaliDatabase = db): Promise<void> {
  await customDb.partners.update(id, {
    deletedAt: undefined,
  });
}

// ---------------- Inbox ----------------

export async function createInboxItem(
  itemData: Omit<InboxItem, 'id' | 'receivedAt'> & { id?: string; receivedAt?: number },
  customDb: GhotkaliDatabase = db
): Promise<InboxItem> {
  const newItem: InboxItem = {
    ...itemData,
    id: itemData.id || crypto.randomUUID(),
    receivedAt: itemData.receivedAt || Date.now(),
  };
  await customDb.inbox.add(newItem);
  return newItem;
}

export async function softDiscardInboxItem(id: string, customDb: GhotkaliDatabase = db): Promise<void> {
  await customDb.inbox.update(id, {
    discardedAt: Date.now(),
  });
}

export async function deleteInboxItem(id: string, customDb: GhotkaliDatabase = db): Promise<void> {
  await customDb.inbox.delete(id);
}

// ---------------- SendLog ----------------

export async function createSendLog(
  logData: Omit<SendLog, 'id' | 'at'> & { id?: string; at?: number },
  customDb: GhotkaliDatabase = db
): Promise<SendLog> {
  const newLog: SendLog = {
    ...logData,
    id: logData.id || crypto.randomUUID(),
    at: logData.at || Date.now(),
  };
  await customDb.sendLogs.add(newLog);
  return newLog;
}

export async function updateSendLog(
  id: string,
  updates: Partial<Omit<SendLog, 'id' | 'personId' | 'at'>>,
  customDb: GhotkaliDatabase = db
): Promise<void> {
  await customDb.sendLogs.update(id, updates);
}

// ---------------- Meta ----------------

export async function getMeta<T = unknown>(key: string, customDb: GhotkaliDatabase = db): Promise<T | undefined> {
  const record = await customDb.meta.get(key);
  return record?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown, customDb: GhotkaliDatabase = db): Promise<void> {
  await customDb.meta.put({ key, value });
}

