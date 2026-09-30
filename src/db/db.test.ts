import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  GhotkaliDatabase,
  createPerson,
  previewNextCode,
  formatPersonCode,
  parsePersonCode,
  softDeletePerson,
  restorePerson,
  purgeOldDeleted,
  syncCounterWithExistingPeople,
} from './index';

describe('Database and Code Generator', () => {
  let testDb: GhotkaliDatabase;

  beforeEach(() => {
    testDb = new GhotkaliDatabase(`test-${Date.now()}-${Math.random()}`);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  describe('formatPersonCode and parsePersonCode', () => {
    it('formats codes with 4-digit padding by default', () => {
      expect(formatPersonCode('B', 1)).toBe('B-0001');
      expect(formatPersonCode('G', 143)).toBe('G-0143');
      expect(formatPersonCode('B', 9999)).toBe('B-9999');
    });

    it('grows past 4 digits when counter exceeds 9999', () => {
      expect(formatPersonCode('B', 10000)).toBe('B-10000');
      expect(formatPersonCode('G', 123456)).toBe('G-123456');
    });

    it('parses valid codes', () => {
      expect(parsePersonCode('B-0143')).toEqual({ gender: 'B', counter: 143 });
      expect(parsePersonCode('G-0001')).toEqual({ gender: 'G', counter: 1 });
      expect(parsePersonCode('B-10000')).toEqual({ gender: 'B', counter: 10000 });
      expect(parsePersonCode('invalid')).toBeNull();
    });
  });

  describe('Atomic Code Generation in Transactions', () => {
    it('previews next code without advancing counter', async () => {
      const nextCode1 = await previewNextCode('B', testDb);
      expect(nextCode1).toBe('B-0001');

      const nextCode2 = await previewNextCode('B', testDb);
      expect(nextCode2).toBe('B-0001');
    });

    it('generates sequential codes for brides and grooms independently', async () => {
      const p1 = await createPerson({
        gender: 'B',
        name: 'Fatima',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);

      expect(p1.code).toBe('B-0001');

      const p2 = await createPerson({
        gender: 'G',
        name: 'Rahim',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);

      expect(p2.code).toBe('G-0001');

      const p3 = await createPerson({
        gender: 'B',
        name: 'Ayesha',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);

      expect(p3.code).toBe('B-0002');
    });

    it('never reuses code even after soft delete', async () => {
      const p1 = await createPerson({
        gender: 'B',
        name: 'Test Bride',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);

      expect(p1.code).toBe('B-0001');

      await softDeletePerson(p1.id, testDb);

      const p2 = await createPerson({
        gender: 'B',
        name: 'Another Bride',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);

      expect(p2.code).toBe('B-0002');
    });
  });

  describe('Soft Delete, Restore, and 30-day Purge', () => {
    it('soft deletes and restores a person', async () => {
      const p = await createPerson({
        gender: 'G',
        name: 'Karim',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);

      expect(p.deletedAt).toBeUndefined();

      await softDeletePerson(p.id, testDb);
      const deleted = await testDb.people.get(p.id);
      expect(deleted?.deletedAt).toBeDefined();

      await restorePerson(p.id, testDb);
      const restored = await testDb.people.get(p.id);
      expect(restored?.deletedAt).toBeUndefined();
    });

    it('purges items older than 30 days and retains recent deletions', async () => {
      const now = Date.now();
      const oldTime = now - 35 * 24 * 60 * 60 * 1000; // 35 days ago
      const recentTime = now - 5 * 24 * 60 * 60 * 1000; // 5 days ago

      // Person 1: old delete
      const p1 = await createPerson({
        gender: 'B',
        name: 'Old Deleted',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);
      await testDb.people.update(p1.id, { deletedAt: oldTime });

      // Person 2: recent delete
      const p2 = await createPerson({
        gender: 'B',
        name: 'Recent Deleted',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);
      await testDb.people.update(p2.id, { deletedAt: recentTime });

      // Inbox 1: old discarded
      await testDb.inbox.add({
        id: 'inbox-old',
        files: [],
        text: 'old inbox',
        via: 'manual',
        status: 'new',
        receivedAt: oldTime,
        discardedAt: oldTime,
      });

      // Inbox 2: recent discarded
      await testDb.inbox.add({
        id: 'inbox-recent',
        files: [],
        text: 'recent inbox',
        via: 'manual',
        status: 'new',
        receivedAt: recentTime,
        discardedAt: recentTime,
      });

      const { people: purgedPeople, inbox: purgedInbox } = await purgeOldDeleted(30, testDb);

      expect(purgedPeople).toBe(1);
      expect(purgedInbox).toBe(1);

      expect(await testDb.people.get(p1.id)).toBeUndefined();
      expect(await testDb.people.get(p2.id)).toBeDefined();

      expect(await testDb.inbox.get('inbox-old')).toBeUndefined();
      expect(await testDb.inbox.get('inbox-recent')).toBeDefined();
    });
  });

  describe('Counter Synchronization', () => {
    it('syncs counter to highest code when importing data', async () => {
      await testDb.people.bulkAdd([
        {
          id: 'p-1',
          code: 'B-0045',
          gender: 'B',
          tags: [],
          status: 'active',
          sourceId: null,
          photos: [],
          docs: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'p-2',
          code: 'G-0120',
          gender: 'G',
          tags: [],
          status: 'active',
          sourceId: null,
          photos: [],
          docs: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);

      await syncCounterWithExistingPeople(testDb);

      const nextB = await previewNextCode('B', testDb);
      expect(nextB).toBe('B-0046');

      const nextG = await previewNextCode('G', testDb);
      expect(nextG).toBe('G-0121');
    });
  });
});
