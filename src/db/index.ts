import Dexie, { type Table } from 'dexie';
import type { Person, Partner, InboxItem, SendLog, Meta, Gender } from '../types';

export class GhotkaliDatabase extends Dexie {
  people!: Table<Person, string>;
  partners!: Table<Partner, string>;
  inbox!: Table<InboxItem, string>;
  sendLogs!: Table<SendLog, string>;
  meta!: Table<Meta, string>;

  constructor(databaseName = 'GhotkaliDB') {
    super(databaseName);
    this.version(1).stores({
      people: 'id, &code, status, sourceId, deletedAt, updatedAt',
      partners: 'id, deletedAt, createdAt',
      inbox: 'id, status, discardedAt, receivedAt',
      sendLogs: 'id, personId, at, response',
      meta: 'key',
    });
  }
}

export const db = new GhotkaliDatabase();

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

