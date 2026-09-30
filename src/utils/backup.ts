import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { GhotkaliDatabase } from '../db';
import { db, syncCounterWithExistingPeople } from '../db';
import type { Person, Partner, InboxItem, SendLog, Meta, MediaRef, FieldDef, Suggestion } from '../types';

interface SerializedMediaRef {
  id: string;
  kind: MediaRef['kind'];
  name: string;
  mime: string;
  blobPath: string;
  thumbPath?: string;
  label?: string;
  sortOrder?: number;
  createdAt: number;
}

interface BackupManifest {
  version: 1 | 2;
  exportedAt: number;
  tables: {
    people: Array<Omit<Person, 'photos' | 'docs'> & { photos: SerializedMediaRef[]; docs: SerializedMediaRef[] }>;
    partners: Partner[];
    inbox: Array<Omit<InboxItem, 'files'> & { files: SerializedMediaRef[] }>;
    sendLogs: SendLog[];
    meta: Meta[];
    fieldDefs?: FieldDef[];
    suggestions?: Suggestion[];
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
 * Exports full database and media blobs to a zip file (SPEC 5.11, SPEC-UPDATE-1 3.8).
 */
export async function exportBackupZip(customDb: GhotkaliDatabase = db): Promise<{ zipBlob: Blob; filename: string }> {
  const [people, partners, inbox, sendLogs, meta, fieldDefs, suggestions] = await Promise.all([
    customDb.people.toArray(),
    customDb.partners.toArray(),
    customDb.inbox.toArray(),
    customDb.sendLogs.toArray(),
    customDb.meta.toArray(),
    customDb.fieldDefs.toArray(),
    customDb.suggestions.toArray(),
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
        label: photo.label,
        sortOrder: photo.sortOrder,
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
        label: doc.label,
        sortOrder: doc.sortOrder,
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
        label: file.label,
        sortOrder: file.sortOrder,
        createdAt: file.createdAt,
      });
    }

    serializedInbox.push({
      ...item,
      files: serializedFiles,
    });
  }

  const manifest: BackupManifest = {
    version: 2,
    exportedAt: Date.now(),
    tables: {
      people: serializedPeople,
      partners,
      inbox: serializedInbox,
      sendLogs,
      meta,
      fieldDefs,
      suggestions,
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
 * Restores database and media files from a zip file (SPEC 5.11, SPEC-UPDATE-1 3.8).
 */
export async function restoreBackupZip(
  zipBlob: Blob,
  mode: 'merge' | 'replace' = 'merge',
  customDb: GhotkaliDatabase = db
): Promise<{ people: number; partners: number; inbox: number; fieldDefs: number; suggestions: number }> {
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
      label: ref.label,
      sortOrder: ref.sortOrder,
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

  await customDb.transaction(
    'rw',
    [
      customDb.people,
      customDb.partners,
      customDb.inbox,
      customDb.sendLogs,
      customDb.meta,
      customDb.fieldDefs,
      customDb.suggestions,
    ],
    async () => {
      const idRemap = new Map<string, string>();

      if (mode === 'replace') {
        await customDb.people.clear();
        await customDb.partners.clear();
        await customDb.inbox.clear();
        await customDb.sendLogs.clear();

        if (manifest.tables.fieldDefs && manifest.tables.fieldDefs.length > 0) {
          await customDb.fieldDefs.clear();
          await customDb.fieldDefs.bulkAdd(manifest.tables.fieldDefs);
        }
        if (manifest.tables.suggestions && manifest.tables.suggestions.length > 0) {
          await customDb.suggestions.clear();
          await customDb.suggestions.bulkAdd(manifest.tables.suggestions);
        }

        await customDb.people.bulkAdd(restoredPeople);
        await customDb.partners.bulkAdd(manifest.tables.partners);
        await customDb.inbox.bulkAdd(restoredInbox);
        await customDb.sendLogs.bulkAdd(manifest.tables.sendLogs);
      } else {
        // mode === 'merge'
        // Merge FieldDefs by normLabel
        if (manifest.tables.fieldDefs && manifest.tables.fieldDefs.length > 0) {
          const existingFieldDefs = await customDb.fieldDefs.toArray();
          const normToExistingDef = new Map<string, FieldDef>();
          const idToExistingDef = new Map<string, FieldDef>();

          for (const def of existingFieldDefs) {
            normToExistingDef.set(def.normLabel, def);
            idToExistingDef.set(def.id, def);
          }

          for (const importedDef of manifest.tables.fieldDefs) {
            const match = normToExistingDef.get(importedDef.normLabel);
            if (match) {
              if (importedDef.id !== match.id) {
                idRemap.set(importedDef.id, match.id);
              }
              match.useCount = (match.useCount || 0) + (importedDef.useCount || 0);
              match.lastUsedAt = Math.max(match.lastUsedAt || 0, importedDef.lastUsedAt || 0);
              await customDb.fieldDefs.put(match);
            } else if (idToExistingDef.has(importedDef.id)) {
              // Collides with existing ID but has different normLabel
              const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `fd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
              idRemap.set(importedDef.id, newId);
              const newDef: FieldDef = { ...importedDef, id: newId };
              await customDb.fieldDefs.put(newDef);
              normToExistingDef.set(newDef.normLabel, newDef);
              idToExistingDef.set(newId, newDef);
            } else {
              await customDb.fieldDefs.put(importedDef);
              normToExistingDef.set(importedDef.normLabel, importedDef);
              idToExistingDef.set(importedDef.id, importedDef);
            }
          }
        }

        // Merge Suggestions by [list+text]
        if (manifest.tables.suggestions && manifest.tables.suggestions.length > 0) {
          for (const s of manifest.tables.suggestions) {
            const existingSug = await customDb.suggestions
              .where('[list+text]')
              .equals([s.list, s.text])
              .first();

            if (existingSug) {
              existingSug.useCount = (existingSug.useCount || 0) + (s.useCount || 0);
              existingSug.lastUsedAt = Math.max(existingSug.lastUsedAt || 0, s.lastUsedAt || 0);
              await customDb.suggestions.put(existingSug);
            } else {
              const existingById = await customDb.suggestions.get(s.id);
              if (existingById) {
                const newSugId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sug_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                await customDb.suggestions.put({ ...s, id: newSugId });
              } else {
                await customDb.suggestions.put(s);
              }
            }
          }
        }

        // Remap custom values for restored people if IDs collided or merged
        if (idRemap.size > 0) {
          for (const p of restoredPeople) {
            if (p.extra && Array.isArray(p.extra)) {
              p.extra = p.extra.map((cv) => {
                const targetId = idRemap.get(cv.fieldId);
                return targetId ? { ...cv, fieldId: targetId } : cv;
              });
            }
          }
        }

        // Merge people by ID (SPEC 5.11)
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
    }
  );

  // Align counters so newly generated codes never conflict
  await syncCounterWithExistingPeople(customDb);

  return {
    people: restoredPeople.length,
    partners: manifest.tables.partners.length,
    inbox: restoredInbox.length,
    fieldDefs: manifest.tables.fieldDefs?.length || 0,
    suggestions: manifest.tables.suggestions?.length || 0,
  };
}
