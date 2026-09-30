import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { GhotkaliDatabase, createPerson, createPartner, previewNextCode } from '../db';
import { exportBackupZip, restoreBackupZip } from './backup';

describe('Backup and Restore (SPEC 5.11 & 10 Acceptance)', () => {
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
});
