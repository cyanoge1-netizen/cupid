import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {
  GhotkaliDatabase,
  seedFieldDefsIfEmpty,
  seedSuggestionsIfEmpty,
  SEED_FIELD_DEFS,
  SEED_SUGGESTIONS,
} from './index';
import { educationSummary } from '../utils/summary';
import type { Person } from '../types';

describe('Dexie v2 Migration, Seeds, and Education Summary', () => {
  const dbName = `test-migration-${Date.now()}-${Math.random()}`;

  afterEach(async () => {
    const dbToDelete = new Dexie(dbName);
    await dbToDelete.delete();
  });

  describe('Database Upgrade from v1 to v2', () => {
    it('migrates legacy person.education into person.educations array while preserving education string', async () => {
      // 1. Setup a v1 database instance
      const v1Db = new Dexie(dbName);
      v1Db.version(1).stores({
        people: 'id, &code, status, sourceId, deletedAt, updatedAt',
        partners: 'id, deletedAt, createdAt',
        inbox: 'id, status, discardedAt, receivedAt',
        sendLogs: 'id, personId, at, response',
        meta: 'key',
      });
      await v1Db.open();

      const now = Date.now();
      // Insert test records
      await v1Db.table('people').bulkAdd([
        {
          id: 'p-1',
          code: 'G-0001',
          gender: 'G',
          name: 'Rahim',
          education: 'বিএসসি ইঞ্জিনিয়ারিং (সিএসই)',
          status: 'active',
          tags: [],
          photos: [],
          docs: [],
          sourceId: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'p-2',
          code: 'B-0001',
          gender: 'B',
          name: 'Fatima',
          education: 'এইচএসসি',
          educations: [
            {
              id: 'custom-edu-1',
              level: 'অনার্স',
              institution: 'ঢাকা বিশ্ববিদ্যালয়',
            },
          ],
          status: 'active',
          tags: [],
          photos: [],
          docs: [],
          sourceId: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'p-3',
          code: 'G-0002',
          gender: 'G',
          name: 'Karim',
          education: '   ',
          status: 'active',
          tags: [],
          photos: [],
          docs: [],
          sourceId: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'p-4',
          code: 'B-0002',
          gender: 'B',
          name: 'Ayesha',
          status: 'active',
          tags: [],
          photos: [],
          docs: [],
          sourceId: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await v1Db.close();

      // 2. Open with GhotkaliDatabase (which has v1 and v2 with upgrade)
      const v2Db = new GhotkaliDatabase(dbName);
      await v2Db.open();

      // Verify Person 1: education migrated to educations array, old field preserved
      const p1 = await v2Db.people.get('p-1');
      expect(p1).toBeDefined();
      expect(p1?.education).toBe('বিএসসি ইঞ্জিনিয়ারিং (সিএসই)');
      expect(p1?.educations).toHaveLength(1);
      expect(p1?.educations?.[0].level).toBe('বিএসসি ইঞ্জিনিয়ারিং (সিএসই)');
      expect(typeof p1?.educations?.[0].id).toBe('string');
      expect(p1?.educations?.[0].id.length).toBeGreaterThan(0);

      // Verify Person 2: existing educations untouched
      const p2 = await v2Db.people.get('p-2');
      expect(p2?.education).toBe('এইচএসসি');
      expect(p2?.educations).toHaveLength(1);
      expect(p2?.educations?.[0].level).toBe('অনার্স');
      expect(p2?.educations?.[0].institution).toBe('ঢাকা বিশ্ববিদ্যালয়');

      // Verify Person 3: empty whitespace education string does not create educations
      const p3 = await v2Db.people.get('p-3');
      expect(p3?.educations).toBeUndefined();

      // Verify Person 4: no education does not create educations
      const p4 = await v2Db.people.get('p-4');
      expect(p4?.educations).toBeUndefined();

      // Verify new tables are accessible
      expect(v2Db.fieldDefs).toBeDefined();
      expect(v2Db.suggestions).toBeDefined();

      await v2Db.close();
    });
  });

  describe('Seeding Default Catalog & Suggestions', () => {
    let testDb: GhotkaliDatabase;

    beforeEach(async () => {
      testDb = new GhotkaliDatabase(`test-seeds-${Date.now()}-${Math.random()}`);
      await testDb.open();
    });

    afterEach(async () => {
      await testDb.delete();
    });

    it('seeds fieldDefs if empty and avoids duplicate seeding', async () => {
      expect(await testDb.fieldDefs.count()).toBe(0);

      await seedFieldDefsIfEmpty(testDb);
      const initialCount = await testDb.fieldDefs.count();
      expect(initialCount).toBe(SEED_FIELD_DEFS.length);

      const sample = await testDb.fieldDefs.where('normLabel').equals('পিতার পেশা').first();
      expect(sample).toBeDefined();
      expect(sample?.section).toBe('family');
      expect(sample?.useCount).toBe(0);
      expect(sample?.seeded).toBe(true);
      expect(sample?.normLabel).toBe('পিতার পেশা');

      // Running again should be a no-op
      await seedFieldDefsIfEmpty(testDb);
      expect(await testDb.fieldDefs.count()).toBe(initialCount);
    });

    it('seeds suggestions if empty and avoids duplicate seeding', async () => {
      expect(await testDb.suggestions.count()).toBe(0);

      await seedSuggestionsIfEmpty(testDb);
      const initialCount = await testDb.suggestions.count();
      expect(initialCount).toBe(SEED_SUGGESTIONS.length);

      const eduSuggestions = await testDb.suggestions.where('list').equals('eduLevel').toArray();
      expect(eduSuggestions.length).toBeGreaterThanOrEqual(6);
      expect(eduSuggestions.some((s) => s.text === 'এসএসসি')).toBe(true);

      // Running again should be a no-op
      await seedSuggestionsIfEmpty(testDb);
      expect(await testDb.suggestions.count()).toBe(initialCount);
    });
  });

  describe('educationSummary', () => {
    it('formats first two education entries with institutions', () => {
      const person = {
        gender: 'G' as const,
        code: 'G-0001',
        status: 'active' as const,
        tags: [],
        photos: [],
        docs: [],
        sourceId: null,
        educations: [
          { id: '1', level: 'MBBS', institution: 'ঢাকা মেডিকেল' },
          { id: '2', level: 'এইচএসসি' },
          { id: '3', level: 'এসএসসি', institution: 'সিলেট জিলা স্কুল' },
        ],
      } as unknown as Person;

      expect(educationSummary(person)).toBe('MBBS (ঢাকা মেডিকেল), এইচএসসি');
    });

    it('formats single education entry without institution', () => {
      const person = {
        gender: 'B' as const,
        code: 'B-0001',
        status: 'active' as const,
        tags: [],
        photos: [],
        docs: [],
        sourceId: null,
        educations: [{ id: '1', level: 'ডিপ্লোমা' }],
      } as unknown as Person;

      expect(educationSummary(person)).toBe('ডিপ্লোমা');
    });

    it('falls back to legacy education string if educations is empty or absent', () => {
      const personWithLegacy = {
        gender: 'G' as const,
        code: 'G-0002',
        status: 'active' as const,
        tags: [],
        photos: [],
        docs: [],
        sourceId: null,
        education: 'মাস্টার্স (গণিত)',
      } as unknown as Person;

      expect(educationSummary(personWithLegacy)).toBe('মাস্টার্স (গণিত)');
    });

    it('returns empty string when no education data exists', () => {
      const personEmpty = {
        gender: 'B' as const,
        code: 'B-0002',
        status: 'active' as const,
        tags: [],
        photos: [],
        docs: [],
        sourceId: null,
      } as unknown as Person;

      expect(educationSummary(personEmpty)).toBe('');
    });
  });
});
