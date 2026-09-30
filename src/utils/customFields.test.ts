import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { GhotkaliDatabase, createPerson } from '../db';
import {
  findOrCreateFieldDef,
  recordFieldUsage,
  renameFieldDef,
  setFieldDefHidden,
  deleteFieldDef,
  getSuggestionsForSection,
} from './catalog';

describe('Custom Fields & Catalog Management (SPEC-UPDATE-1 3.4)', () => {
  let testDb: GhotkaliDatabase;

  beforeEach(async () => {
    testDb = new GhotkaliDatabase(`test-custom-fields-${Date.now()}-${Math.random()}`);
    await testDb.open();
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('creates custom field once, and it appears as a suggestion chip on subsequent lookups', async () => {
    // 1. First person: User creates "চাচা" in family section
    const chachaDef = await findOrCreateFieldDef('চাচা', 'family', 'text', testDb);
    expect(chachaDef.label).toBe('চাচা');
    expect(chachaDef.useCount).toBe(0);

    // Save person with this custom field
    const p1 = await createPerson(
      {
        gender: 'G',
        name: 'Tariq',
        status: 'active',
        tags: [],
        photos: [],
        docs: [],
        sourceId: null,
        extra: [{ fieldId: chachaDef.id, value: 'ইঞ্জিনিয়ার' }],
      },
      testDb
    );

    // Record usage on person save
    await recordFieldUsage(p1.extra!.map((e) => e.fieldId), testDb);

    // 2. Second person: Check suggestion chips for family section
    const suggestions = await getSuggestionsForSection('family', [], testDb);
    const suggestedChacha = suggestions.find((s) => s.id === chachaDef.id);
    expect(suggestedChacha).toBeDefined();
    expect(suggestedChacha?.useCount).toBe(1);
    expect(suggestedChacha?.label).toBe('চাচা');
  });

  it('renaming a label in catalog updates display everywhere because values reference fieldId', async () => {
    const fDef = await findOrCreateFieldDef('মামার পেশা', 'family', 'text', testDb);

    const person = await createPerson(
      {
        gender: 'B',
        name: 'Sadia',
        status: 'active',
        tags: [],
        photos: [],
        docs: [],
        sourceId: null,
        extra: [{ fieldId: fDef.id, value: 'ডাক্তার' }],
      },
      testDb
    );

    // Rename definition in catalog
    await renameFieldDef(fDef.id, 'বড় মামার পেশা', testDb);

    // Fetch updated definition
    const updatedDef = await testDb.fieldDefs.get(fDef.id);
    expect(updatedDef?.label).toBe('বড় মামার পেশা');

    // Person's extra value still maps to the same ID
    expect(person.extra?.[0].fieldId).toBe(fDef.id);
    expect(person.extra?.[0].value).toBe('ডাক্তার');
  });

  it('hiding a label excludes it from suggestions while keeping existing person values intact', async () => {
    const fDef = await findOrCreateFieldDef('শখ', 'personal', 'text', testDb);

    const person = await createPerson(
      {
        gender: 'G',
        name: 'Nayeem',
        status: 'active',
        tags: [],
        photos: [],
        docs: [],
        sourceId: null,
        extra: [{ fieldId: fDef.id, value: 'বই পড়া' }],
      },
      testDb
    );

    // Hide field
    await setFieldDefHidden(fDef.id, true, testDb);

    // Suggestions should no longer include it
    const suggestions = await getSuggestionsForSection('personal', [], testDb);
    expect(suggestions.some((s) => s.id === fDef.id)).toBe(false);

    // Person data still retains the field and definition
    const persistedDef = await testDb.fieldDefs.get(person.extra![0].fieldId);
    expect(persistedDef).toBeDefined();
    expect(persistedDef?.label).toBe('শখ');
    expect(persistedDef?.hidden).toBe(true);
  });

  it('enforces deletion restriction when useCount > 0 and allows deletion when useCount == 0', async () => {
    const usedDef = await findOrCreateFieldDef('বোন', 'family', 'text', testDb);
    await recordFieldUsage([usedDef.id], testDb);

    await expect(deleteFieldDef(usedDef.id, testDb)).rejects.toThrow();

    const unusedDef = await findOrCreateFieldDef('অপ্রয়োজনীয়', 'other', 'text', testDb);
    expect(unusedDef.useCount).toBe(0);

    await deleteFieldDef(unusedDef.id, testDb);
    expect(await testDb.fieldDefs.get(unusedDef.id)).toBeUndefined();
  });
});
