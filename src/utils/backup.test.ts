import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { GhotkaliDatabase, createPerson, createPartner, previewNextCode } from '../db';
import { exportBackupZip, restoreBackupZip } from './backup';
import { norm } from './normalizer';
import type { FieldDef, Suggestion } from '../types';

describe('Backup and Restore (SPEC 5.11 & SPEC-UPDATE-1 3.8 & 4)', () => {
  let db1: GhotkaliDatabase;
  let db2: GhotkaliDatabase;

  beforeEach(() => {
    db1 = new GhotkaliDatabase(`backup-src-${Date.now()}-${Math.random()}`);
    db2 = new GhotkaliDatabase(`backup-dest-${Date.now()}-${Math.random()}`);
  });

  afterEach(async () => {
    await db1.delete();
    await db2.delete();
  });

  it('exports zip and restores everything on a fresh database', async () => {
    // 1. Create a partner and person with photo blob in db1
    const partner = await createPartner(
      {
        name: 'কাশেম ঘটক',
        phone: '01711223344',
      },
      db1
    );

    const samplePhotoBlob = new Blob(['sample-image-bytes'], { type: 'image/jpeg' });
    const sampleThumbBlob = new Blob(['sample-thumb-bytes'], { type: 'image/jpeg' });

    const person = await createPerson(
      {
        gender: 'B',
        name: 'রোকেয়া খাতুন',
        father: 'আব্দুস সোবহান',
        district: 'সিলেট',
        status: 'active',
        sourceId: partner.id,
        photos: [
          {
            id: 'photo-1',
            kind: 'image',
            name: 'photo.jpg',
            mime: 'image/jpeg',
            blob: samplePhotoBlob,
            thumb: sampleThumbBlob,
            createdAt: Date.now(),
          },
        ],
        docs: [],
        tags: ['ডাক্তার'],
      },
      db1
    );

    expect(person.code).toBe('B-0001');

    // 2. Export to zip
    const { zipBlob, filename } = await exportBackupZip(db1);
    expect(filename).toMatch(/^biodata-backup-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(zipBlob.size).toBeGreaterThan(0);

    // Verify lastBackupAt was updated in db1 meta
    const lastBackupMeta = await db1.meta.get('lastBackupAt');
    expect(typeof lastBackupMeta?.value).toBe('number');

    // 3. Restore into clean db2
    const stats = await restoreBackupZip(zipBlob, 'merge', db2);
    expect(stats.people).toBe(1);
    expect(stats.partners).toBe(1);

    // Verify restored person
    const restoredPerson = await db2.people.get(person.id);
    expect(restoredPerson).toBeDefined();
    expect(restoredPerson?.name).toBe('রোকেয়া খাতুন');
    expect(restoredPerson?.code).toBe('B-0001');
    expect(restoredPerson?.photos).toHaveLength(1);
    expect(restoredPerson?.photos[0].mime).toBe('image/jpeg');

    // Verify photo blob contents
    const restoredBlobText = await restoredPerson!.photos[0].blob.text();
    expect(restoredBlobText).toBe('sample-image-bytes');

    // Verify code counter was synced in db2
    const nextCode = await previewNextCode('B', db2);
    expect(nextCode).toBe('B-0002');
  });

  it('keeps custom fields, education entries, and photo order in round-trip (Acceptance 138)', async () => {
    // 1. Setup field definitions in db1
    const customDef: FieldDef = {
      id: 'fd-father-job',
      label: 'পিতার পেশা',
      normLabel: norm('পিতার পেশা'),
      section: 'family',
      kind: 'text',
      useCount: 1,
      lastUsedAt: Date.now(),
    };
    await db1.fieldDefs.put(customDef);

    const suggestion: Suggestion = {
      id: 'sug-1',
      list: 'eduLevel',
      text: 'ফাজিল',
      useCount: 2,
      lastUsedAt: Date.now(),
    };
    await db1.suggestions.put(suggestion);

    // 2. Setup person with multiple photos, docs, education entries, and custom value
    const photoBlob1 = new Blob(['photo-1'], { type: 'image/jpeg' });
    const photoBlob2 = new Blob(['photo-2'], { type: 'image/jpeg' });
    const docBlob = new Blob(['pdf-content'], { type: 'application/pdf' });

    const person = await createPerson(
      {
        gender: 'G',
        name: 'মাহমুদুল হাসান',
        status: 'active',
        sourceId: null,
        photos: [
          {
            id: 'photo-p1',
            kind: 'image',
            name: 'p1.jpg',
            mime: 'image/jpeg',
            blob: photoBlob1,
            sortOrder: 0,
            createdAt: 1000,
          },
          {
            id: 'photo-p2',
            kind: 'image',
            name: 'p2.jpg',
            mime: 'image/jpeg',
            blob: photoBlob2,
            sortOrder: 1,
            createdAt: 2000,
          },
        ],
        coverPhotoId: 'photo-p2',
        docs: [
          {
            id: 'doc-d1',
            kind: 'pdf',
            name: 'biodata.pdf',
            mime: 'application/pdf',
            blob: docBlob,
            label: 'জীবনবৃত্তান্ত PDF',
            sortOrder: 0,
            createdAt: 3000,
          },
        ],
        educations: [
          { id: 'edu-1', level: 'এইচএসসি', institution: 'নটর ডেম কলেজ', year: '২০১৮' },
          { id: 'edu-2', level: 'বিএসসি', institution: 'সিলেট ইঞ্জিনিয়ারিং কলেজ', year: '২০২৩' },
        ],
        extra: [
          { fieldId: 'fd-father-job', value: 'অবসরপ্রাপ্ত সরকারি কর্মকর্তা' },
        ],
        tags: [],
      },
      db1
    );

    // 3. Export to zip
    const { zipBlob } = await exportBackupZip(db1);

    // 4. Restore into fresh db2
    await restoreBackupZip(zipBlob, 'merge', db2);

    // 5. Verify restored person data
    const restored = await db2.people.get(person.id);
    expect(restored).toBeDefined();

    // Verify photo order and cover photo
    expect(restored?.photos).toHaveLength(2);
    expect(restored?.photos[0].id).toBe('photo-p1');
    expect(restored?.photos[1].id).toBe('photo-p2');
    expect(restored?.coverPhotoId).toBe('photo-p2');

    // Verify document label and content
    expect(restored?.docs).toHaveLength(1);
    expect(restored?.docs[0].label).toBe('জীবনবৃত্তান্ত PDF');
    const restoredDocContent = await restored?.docs[0].blob.text();
    expect(restoredDocContent).toBe('pdf-content');

    // Verify educations
    expect(restored?.educations).toHaveLength(2);
    expect(restored?.educations?.[0].institution).toBe('নটর ডেম কলেজ');
    expect(restored?.educations?.[1].level).toBe('বিএসসি');

    // Verify custom fields
    expect(restored?.extra).toHaveLength(1);
    expect(restored?.extra?.[0].fieldId).toBe('fd-father-job');
    expect(restored?.extra?.[0].value).toBe('অবসরপ্রাপ্ত সরকারি কর্মকর্তা');

    // Verify suggestions
    const restoredSug = await db2.suggestions.get('sug-1');
    expect(restoredSug?.text).toBe('ফাজিল');
  });

  it('merges fieldDefs by normLabel and remaps custom value fieldIds on restore', async () => {
    // db1 has field definition "পিতার পেশা" with ID "fd-db1"
    const defDb1: FieldDef = {
      id: 'fd-db1',
      label: 'পিতার পেশা',
      normLabel: norm('পিতার পেশা'),
      section: 'family',
      kind: 'text',
      useCount: 2,
      lastUsedAt: 1000,
    };
    await db1.fieldDefs.put(defDb1);

    // db1 person uses "fd-db1"
    const personDb1 = await createPerson(
      {
        gender: 'B',
        name: 'সাদিয়া সুলতানা',
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
        tags: [],
        extra: [{ fieldId: 'fd-db1', value: 'ব্যবসায়ী' }],
      },
      db1
    );

    // db2 ALREADY has "পিতার পেশা" with a different ID "fd-db2"
    const defDb2: FieldDef = {
      id: 'fd-db2',
      label: 'পিতার পেশা',
      normLabel: norm('পিতার পেশা'),
      section: 'family',
      kind: 'text',
      useCount: 5,
      lastUsedAt: 2000,
    };
    await db2.fieldDefs.put(defDb2);

    // Export db1 and merge into db2
    const { zipBlob } = await exportBackupZip(db1);
    await restoreBackupZip(zipBlob, 'merge', db2);

    // In db2, there should only be ONE field for "পিতার পেশা" with ID "fd-db2"
    const allDefs = await db2.fieldDefs.toArray();
    const matchingDefs = allDefs.filter((d) => d.normLabel === norm('পিতার পেশা'));
    expect(matchingDefs).toHaveLength(1);
    expect(matchingDefs[0].id).toBe('fd-db2');
    expect(matchingDefs[0].useCount).toBe(7); // 2 + 5

    // Restored person in db2 must have their fieldId remapped from "fd-db1" to "fd-db2"
    const restoredPerson = await db2.people.get(personDb1.id);
    expect(restoredPerson).toBeDefined();
    expect(restoredPerson?.extra).toHaveLength(1);
    expect(restoredPerson?.extra?.[0].fieldId).toBe('fd-db2');
    expect(restoredPerson?.extra?.[0].value).toBe('ব্যবসায়ী');
  });

  it('resolves primary key ID collisions for distinct fieldDefs by allocating new IDs', async () => {
    // Both db1 and db2 have a field with ID "collision-id", but with DIFFERENT normLabels!
    // db1 has "চাচা" with ID "collision-id"
    const defDb1: FieldDef = {
      id: 'collision-id',
      label: 'চাচা',
      normLabel: norm('চাচা'),
      section: 'family',
      kind: 'text',
      useCount: 1,
      lastUsedAt: 1000,
    };
    await db1.fieldDefs.put(defDb1);

    const personDb1 = await createPerson(
      {
        gender: 'G',
        name: 'তারেক রহমান',
        status: 'active',
        sourceId: null,
        photos: [],
        docs: [],
        tags: [],
        extra: [{ fieldId: 'collision-id', value: '৩ জন' }],
      },
      db1
    );

    // db2 has "মামা" with ID "collision-id"
    const defDb2: FieldDef = {
      id: 'collision-id',
      label: 'মামা',
      normLabel: norm('মামা'),
      section: 'family',
      kind: 'text',
      useCount: 3,
      lastUsedAt: 2000,
    };
    await db2.fieldDefs.put(defDb2);

    // Export db1 and merge into db2
    const { zipBlob } = await exportBackupZip(db1);
    await restoreBackupZip(zipBlob, 'merge', db2);

    // In db2, both "মামা" and "চাচা" must exist
    const mamaDef = await db2.fieldDefs.get('collision-id');
    expect(mamaDef?.label).toBe('মামা');

    const chachaDef = await db2.fieldDefs.where('normLabel').equals(norm('চাচা')).first();
    expect(chachaDef).toBeDefined();
    expect(chachaDef?.id).not.toBe('collision-id');

    // Person from db1 must have their fieldId remapped to chachaDef.id (not collision-id)
    const restoredPerson = await db2.people.get(personDb1.id);
    expect(restoredPerson?.extra?.[0].fieldId).toBe(chachaDef?.id);
    expect(restoredPerson?.extra?.[0].value).toBe('৩ জন');
  });

  it('merges suggestions by [list+text]', async () => {
    const sugDb1: Suggestion = {
      id: 'sug-1',
      list: 'eduLevel',
      text: 'ডিপ্লোমা',
      useCount: 2,
      lastUsedAt: 1000,
    };
    await db1.suggestions.put(sugDb1);

    const sugDb2: Suggestion = {
      id: 'sug-2',
      list: 'eduLevel',
      text: 'ডিপ্লোমা',
      useCount: 4,
      lastUsedAt: 2000,
    };
    await db2.suggestions.put(sugDb2);

    const { zipBlob } = await exportBackupZip(db1);
    await restoreBackupZip(zipBlob, 'merge', db2);

    const allSugs = await db2.suggestions.where('[list+text]').equals(['eduLevel', 'ডিপ্লোমা']).toArray();
    expect(allSugs).toHaveLength(1);
    expect(allSugs[0].useCount).toBe(6);
  });

  it('replace mode completely clears existing fieldDefs and suggestions', async () => {
    // db2 has existing fieldDef and suggestion
    await db2.fieldDefs.put({
      id: 'old-fd',
      label: 'পুরাতন তথ্য',
      normLabel: norm('পুরাতন তথ্য'),
      section: 'other',
      kind: 'text',
      useCount: 1,
      lastUsedAt: 1000,
    });
    await db2.suggestions.put({
      id: 'old-sug',
      list: 'eduLevel',
      text: 'পুরাতন ডিগ্রি',
      useCount: 1,
      lastUsedAt: 1000,
    });

    // db1 is an empty database (no custom fields or suggestions)
    const { zipBlob } = await exportBackupZip(db1);

    // Restore with mode === 'replace'
    await restoreBackupZip(zipBlob, 'replace', db2);

    // db2 fieldDefs and suggestions must be completely cleared
    const remainingDefs = await db2.fieldDefs.toArray();
    expect(remainingDefs).toHaveLength(0);

    const remainingSugs = await db2.suggestions.toArray();
    expect(remainingSugs).toHaveLength(0);
  });
});
