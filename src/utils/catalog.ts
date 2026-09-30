import { db, GhotkaliDatabase } from '../db';
import type { FieldDef, FieldSection, Suggestion } from '../types';
import { norm } from './normalizer';

/**
 * Returns field definitions for a specific section suitable for suggestions:
 * - Unhidden only
 * - Excludes specified field IDs (e.g. already added to this person)
 * - Ranked by useCount desc, then lastUsedAt desc
 */
export async function getSuggestionsForSection(
  section: FieldSection,
  excludeFieldIds: string[] = [],
  customDb: GhotkaliDatabase = db
): Promise<FieldDef[]> {
  const defs = await customDb.fieldDefs
    .where('section')
    .equals(section)
    .toArray();

  const excludeSet = new Set(excludeFieldIds);

  return defs
    .filter((d) => !d.hidden && !excludeSet.has(d.id))
    .sort((a, b) => {
      if (b.useCount !== a.useCount) {
        return b.useCount - a.useCount;
      }
      return b.lastUsedAt - a.lastUsedAt;
    });
}

/**
 * Finds an existing FieldDef by norm(label) or creates a new one immediately (SPEC-UPDATE-1 3.4).
 * Returns the existing FieldDef if matched, otherwise creates and returns the new one.
 */
export async function findOrCreateFieldDef(
  label: string,
  section: FieldSection,
  kind: 'text' | 'longtext' | 'number' = 'text',
  customDb: GhotkaliDatabase = db
): Promise<FieldDef> {
  const trimmed = label.trim();
  const normLabel = norm(trimmed);
  if (!normLabel) {
    throw new Error('Label cannot be empty');
  }

  const existing = await customDb.fieldDefs
    .where('normLabel')
    .equals(normLabel)
    .first();

  if (existing) {
    return existing;
  }

  const newDef: FieldDef = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    label: trimmed,
    normLabel,
    section,
    kind,
    useCount: 0,
    lastUsedAt: Date.now(),
    seeded: false,
    hidden: false,
  };

  await customDb.fieldDefs.add(newDef);
  return newDef;
}

/**
 * Increments useCount and updates lastUsedAt for a list of field IDs on save.
 */
export async function recordFieldUsage(
  fieldIds: string[],
  customDb: GhotkaliDatabase = db
): Promise<void> {
  if (fieldIds.length === 0) return;

  const now = Date.now();
  const uniqueIds = Array.from(new Set(fieldIds));

  await customDb.transaction('rw', customDb.fieldDefs, async () => {
    for (const id of uniqueIds) {
      const def = await customDb.fieldDefs.get(id);
      if (def) {
        await customDb.fieldDefs.update(id, {
          useCount: (def.useCount || 0) + 1,
          lastUsedAt: now,
        });
      }
    }
  });
}

/**
 * Renames a FieldDef across the catalog.
 * Throws if another field already exists with the same normalized label.
 */
export async function renameFieldDef(
  fieldId: string,
  newLabel: string,
  customDb: GhotkaliDatabase = db
): Promise<FieldDef> {
  const trimmed = newLabel.trim();
  const newNorm = norm(trimmed);
  if (!newNorm) {
    throw new Error('Label cannot be empty');
  }

  const def = await customDb.fieldDefs.get(fieldId);
  if (!def) {
    throw new Error(`Field definition with id ${fieldId} not found`);
  }

  // Check uniqueness if normLabel is changing
  if (def.normLabel !== newNorm) {
    const conflict = await customDb.fieldDefs
      .where('normLabel')
      .equals(newNorm)
      .first();

    if (conflict && conflict.id !== fieldId) {
      throw new Error(`A field with label "${trimmed}" already exists`);
    }
  }

  await customDb.fieldDefs.update(fieldId, {
    label: trimmed,
    normLabel: newNorm,
  });

  return {
    ...def,
    label: trimmed,
    normLabel: newNorm,
  };
}

/**
 * Toggles hidden status of a FieldDef.
 */
export async function setFieldDefHidden(
  fieldId: string,
  hidden: boolean,
  customDb: GhotkaliDatabase = db
): Promise<void> {
  await customDb.fieldDefs.update(fieldId, { hidden });
}

/**
 * Deletes a FieldDef only if useCount == 0 (SPEC-UPDATE-1 3.4).
 * Throws if useCount > 0.
 */
export async function deleteFieldDef(
  fieldId: string,
  customDb: GhotkaliDatabase = db
): Promise<void> {
  const def = await customDb.fieldDefs.get(fieldId);
  if (!def) return;

  if (def.useCount > 0) {
    throw new Error('Cannot delete a field that is currently in use. Hide it instead.');
  }

  await customDb.fieldDefs.delete(fieldId);
}

/**
 * Returns all FieldDefs grouped by section, ordered by section and useCount desc.
 */
export async function getAllFieldDefsGrouped(
  customDb: GhotkaliDatabase = db
): Promise<Record<FieldSection, FieldDef[]>> {
  const all = await customDb.fieldDefs.toArray();

  const grouped: Record<FieldSection, FieldDef[]> = {
    family: [],
    personal: [],
    professional: [],
    preference: [],
    other: [],
  };

  for (const def of all) {
    if (grouped[def.section]) {
      grouped[def.section].push(def);
    } else {
      grouped.other.push(def);
    }
  }

  for (const section of Object.keys(grouped) as FieldSection[]) {
    grouped[section].sort((a, b) => {
      if (b.useCount !== a.useCount) {
        return b.useCount - a.useCount;
      }
      return b.lastUsedAt - a.lastUsedAt;
    });
  }

  return grouped;
}

// ---------------- Suggestion List Helpers (SPEC-UPDATE-1 3.2, 3.3) ----------------

/**
 * Gets suggestions for a list ('eduLevel' | 'docLabel') ranked by useCount desc.
 */
export async function getSuggestions(
  list: 'eduLevel' | 'docLabel',
  customDb: GhotkaliDatabase = db
): Promise<Suggestion[]> {
  const items = await customDb.suggestions
    .where('list')
    .equals(list)
    .toArray();

  return items.sort((a, b) => {
    if (b.useCount !== a.useCount) {
      return b.useCount - a.useCount;
    }
    return b.lastUsedAt - a.lastUsedAt;
  });
}

/**
 * Records or updates a suggestion entry upon saving.
 */
export async function recordSuggestion(
  list: 'eduLevel' | 'docLabel',
  text: string,
  customDb: GhotkaliDatabase = db
): Promise<Suggestion> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Suggestion text cannot be empty');
  }

  const existing = await customDb.suggestions
    .where('[list+text]')
    .equals([list, trimmed])
    .first();

  const now = Date.now();

  if (existing) {
    const updatedCount = (existing.useCount || 0) + 1;
    await customDb.suggestions.update(existing.id, {
      useCount: updatedCount,
      lastUsedAt: now,
    });
    return {
      ...existing,
      useCount: updatedCount,
      lastUsedAt: now,
    };
  }

  const newSuggestion: Suggestion = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    list,
    text: trimmed,
    useCount: 1,
    lastUsedAt: now,
  };

  await customDb.suggestions.add(newSuggestion);
  return newSuggestion;
}
