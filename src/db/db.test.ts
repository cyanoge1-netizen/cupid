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

    it('create person, soft delete, purge, create again; the new code must be higher than every previous code', async () => {
      // 1. Create person
      const p1 = await createPerson({
        gender: 'G',
        name: 'First Groom',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);
      expect(p1.code).toBe('G-0001');

      // 2. Soft delete
      await softDeletePerson(p1.id, testDb);
      const deletedRecord = await testDb.people.get(p1.id);
      expect(deletedRecord?.deletedAt).toBeDefined();

      // 3. Purge (set deletedAt to > 30 days ago and purge)
      await testDb.people.update(p1.id, { deletedAt: Date.now() - 40 * 24 * 60 * 60 * 1000 });
      const { people: purgedPeople } = await purgeOldDeleted(30, testDb);
      expect(purgedPeople).toBe(1);
      expect(await testDb.people.get(p1.id)).toBeUndefined(); // Permanently purged

      // 4. Create again
      const p2 = await createPerson({
        gender: 'G',
        name: 'Second Groom',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);

      // The new code must be higher than every previous code
      expect(p2.code).toBe('G-0002');
      const parsed1 = parsePersonCode(p1.code)!;
      const parsed2 = parsePersonCode(p2.code)!;
      expect(parsed2.counter).toBeGreaterThan(parsed1.counter);
    });

    it('confirms createPerson generates the code inside the same transaction and rolls back on error', async () => {
      // 1. Create an initial person
      const p1 = await createPerson({
        id: 'fixed-existing-id',
        gender: 'B',
        name: 'Initial Bride',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);

      expect(p1.code).toBe('B-0001');

      const metaBefore = await testDb.meta.get('counter:B');
      expect(metaBefore?.value).toBe(1);
      const peopleBefore = await testDb.people.toArray();
      expect(peopleBefore).toHaveLength(1);

      // 2. Call createPerson with duplicate primary key 'fixed-existing-id'
      // This forces an error inside createPerson transaction at table.add(),
      // AFTER the counter was incremented in memory
      let errorThrown: any = null;
      try {
        await createPerson({
          id: 'fixed-existing-id', // duplicate ID will cause people.add() to reject
          gender: 'B',
          name: 'Conflicting Bride',
          tags: [],
          status: 'active',
          sourceId: null,
          photos: [],
          docs: [],
        }, testDb);
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).toBeDefined();

      // 3. Assert counter and people table are completely unchanged afterwards
      const metaAfter = await testDb.meta.get('counter:B');
      expect(metaAfter?.value).toBe(1); // Not 2! Counter rolled back atomically

      const peopleAfter = await testDb.people.toArray();
      expect(peopleAfter).toHaveLength(1); // No new person inserted
      expect(peopleAfter[0].name).toBe('Initial Bride'); // Unchanged

      // 4. Verify subsequent createPerson succeeds with the correct next sequential code
      const p2 = await createPerson({
        gender: 'B',
        name: 'Subsequent Bride',
        tags: [],
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
      }, testDb);

      expect(p2.code).toBe('B-0002');
      const metaFinal = await testDb.meta.get('counter:B');
      expect(metaFinal?.value).toBe(2);
      expect(await testDb.people.toArray()).toHaveLength(2);
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
