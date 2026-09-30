import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { GhotkaliDatabase } from '../db';
import { db, syncCounterWithExistingPeople } from '../db';
import type { Person, Partner, InboxItem, SendLog, Meta, MediaRef } from '../types';

interface SerializedMediaRef {
  id: string;
  kind: MediaRef['kind'];
  name: string;
  mime: string;
  blobPath: string;
  thumbPath?: string;
  createdAt: number;
}

interface BackupManifest {
  version: 1;
  exportedAt: number;
  tables: {
    people: Array<Omit<Person, 'photos' | 'docs'> & { photos: SerializedMediaRef[]; docs: SerializedMediaRef[] }>;
    partners: Partner[];
    inbox: Array<Omit<InboxItem, 'files'> & { files: SerializedMediaRef[] }>;
    sendLogs: SendLog[];
    meta: Meta[];
  };
}

/**
 * Converts a Blob to a Uint8Array.
 */
async function blobToU8(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Exports full database and media blobs to a zip file (SPEC 5.11).
 */
export async function exportBackupZip(customDb: GhotkaliDatabase = db): Promise<{ zipBlob: Blob; filename: string }> {
  const [people, partners, inbox, sendLogs, meta] = await Promise.all([
    customDb.people.toArray(),
    customDb.partners.toArray(),
    customDb.inbox.toArray(),
    customDb.sendLogs.toArray(),
    customDb.meta.toArray(),
  ]);

  const zipFiles: Record<string, Uint8Array> = {};

  // Process people photos & docs
  const serializedPeople = [];
  for (const person of people) {
    const serializedPhotos: SerializedMediaRef[] = [];
    for (const photo of person.photos || []) {
      const blobPath = `media/${photo.id}_blob.bin`;
      zipFiles[blobPath] = await blobToU8(photo.blob);

      let thumbPath: string | undefined;
      if (photo.thumb) {
        thumbPath = `media/${photo.id}_thumb.bin`;
        zipFiles[thumbPath] = await blobToU8(photo.thumb);
      }

      serializedPhotos.push({
        id: photo.id,
        kind: photo.kind,
        name: photo.name,
        mime: photo.mime,
        blobPath,
        thumbPath,
        createdAt: photo.createdAt,
      });
    }

    const serializedDocs: SerializedMediaRef[] = [];
    for (const doc of person.docs || []) {
      const blobPath = `media/${doc.id}_blob.bin`;
      zipFiles[blobPath] = await blobToU8(doc.blob);

      serializedDocs.push({
        id: doc.id,
        kind: doc.kind,
        name: doc.name,
        mime: doc.mime,
        blobPath,
        createdAt: doc.createdAt,
      });
    }

    serializedPeople.push({
      ...person,
      photos: serializedPhotos,
      docs: serializedDocs,
    });
  }

  // Process inbox files
  const serializedInbox = [];
  for (const item of inbox) {
    const serializedFiles: SerializedMediaRef[] = [];
    for (const file of item.files || []) {
      const blobPath = `media/${file.id}_blob.bin`;
      zipFiles[blobPath] = await blobToU8(file.blob);

      let thumbPath: string | undefined;
      if (file.thumb) {
        thumbPath = `media/${file.id}_thumb.bin`;
        zipFiles[thumbPath] = await blobToU8(file.thumb);
      }

      serializedFiles.push({
        id: file.id,
        kind: file.kind,
        name: file.name,
        mime: file.mime,
        blobPath,
        thumbPath,
        createdAt: file.createdAt,
      });
    }

    serializedInbox.push({
      ...item,
      files: serializedFiles,
    });
  }

  const manifest: BackupManifest = {
    version: 1,
    exportedAt: Date.now(),
    tables: {
      people: serializedPeople,
      partners,
      inbox: serializedInbox,
      sendLogs,
      meta,
    },
  };

  zipFiles['data.json'] = strToU8(JSON.stringify(manifest, null, 2));

  const zippedU8 = zipSync(zipFiles);
  const zipBlob = new Blob([zippedU8 as unknown as BlobPart], { type: 'application/zip' });

  // Update lastBackupAt timestamp in Meta
  await customDb.meta.put({ key: 'lastBackupAt', value: Date.now() });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `biodata-backup-${dateStr}.zip`;

  return { zipBlob, filename };
}

/**
 * Restores database and media files from a zip file (SPEC 5.11).
 */
export async function restoreBackupZip(
  zipBlob: Blob,
  mode: 'merge' | 'replace' = 'merge',
  customDb: GhotkaliDatabase = db
): Promise<{ people: number; partners: number; inbox: number }> {
  const arrayBuffer = await zipBlob.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(arrayBuffer));

  if (!unzipped['data.json']) {
    throw new Error('Invalid backup zip: missing data.json');
  }

  const manifestStr = strFromU8(unzipped['data.json']);
  const manifest = JSON.parse(manifestStr) as BackupManifest;

  // Helper to reconstruct MediaRef
  function reconstructMediaRef(ref: SerializedMediaRef): MediaRef {
    const rawBlobBytes = unzipped[ref.blobPath];
    const blob = rawBlobBytes
      ? new Blob([rawBlobBytes as unknown as BlobPart], { type: ref.mime })
      : new Blob([], { type: ref.mime });

    let thumb: Blob | undefined;
    if (ref.thumbPath && unzipped[ref.thumbPath]) {
      thumb = new Blob([unzipped[ref.thumbPath] as unknown as BlobPart], { type: 'image/jpeg' });
    }

    return {
      id: ref.id,
      kind: ref.kind,
      name: ref.name,
      mime: ref.mime,
      blob,
      thumb,
      createdAt: ref.createdAt,
    };
  }

  // Reconstruct Person records
  const restoredPeople: Person[] = manifest.tables.people.map((p) => ({
    ...p,
    photos: p.photos.map(reconstructMediaRef),
    docs: p.docs.map(reconstructMediaRef),
  }));

  // Reconstruct Inbox records
  const restoredInbox: InboxItem[] = manifest.tables.inbox.map((i) => ({
    ...i,
    files: i.files.map(reconstructMediaRef),
  }));

  await customDb.transaction('rw', [customDb.people, customDb.partners, customDb.inbox, customDb.sendLogs, customDb.meta], async () => {
    if (mode === 'replace') {
      await customDb.people.clear();
      await customDb.partners.clear();
      await customDb.inbox.clear();
      await customDb.sendLogs.clear();

      await customDb.people.bulkAdd(restoredPeople);
      await customDb.partners.bulkAdd(manifest.tables.partners);
      await customDb.inbox.bulkAdd(restoredInbox);
      await customDb.sendLogs.bulkAdd(manifest.tables.sendLogs);
    } else {
      // Merge by ID (SPEC 5.11)
      for (const p of restoredPeople) {
        const existing = await customDb.people.get(p.id);
        if (!existing || p.updatedAt > existing.updatedAt) {
          await customDb.people.put(p);
        }
      }

      for (const partner of manifest.tables.partners) {
        await customDb.partners.put(partner);
      }

      for (const item of restoredInbox) {
        await customDb.inbox.put(item);
      }

      for (const log of manifest.tables.sendLogs) {
        await customDb.sendLogs.put(log);
      }
    }
  });

  // Align counters so newly generated codes never conflict
  await syncCounterWithExistingPeople(customDb);

  return {
    people: restoredPeople.length,
    partners: manifest.tables.partners.length,
    inbox: restoredInbox.length,
  };
}
