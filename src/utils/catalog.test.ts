import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { GhotkaliDatabase } from '../db';
import {
  findOrCreateFieldDef,
  getSuggestionsForSection,
  recordFieldUsage,
  renameFieldDef,
  setFieldDefHidden,
  deleteFieldDef,
  getAllFieldDefsGrouped,
  getSuggestions,
  recordSuggestion,
} from './catalog';

describe('Field Catalog and Suggestion System', () => {
  let testDb: GhotkaliDatabase;

  beforeEach(async () => {
    testDb = new GhotkaliDatabase(`test-catalog-${Date.now()}-${Math.random()}`);
    await testDb.open();
  });

  afterEach(async () => {
    await testDb.delete();
  });

  describe('findOrCreateFieldDef & Uniqueness by normLabel', () => {
    it('creates a new field definition if it does not exist', async () => {
      const def = await findOrCreateFieldDef('চাচা', 'family', 'text', testDb);
      expect(def).toBeDefined();
      expect(def.label).toBe('চাচা');
      expect(def.normLabel).toBe('চাচা');
      expect(def.section).toBe('family');
      expect(def.useCount).toBe(0);
      expect(def.hidden).toBe(false);

      const count = await testDb.fieldDefs.count();
      expect(count).toBe(1);
    });

    it('returns existing field definition when matching by normalized label', async () => {
      const def1 = await findOrCreateFieldDef('চাচা', 'family', 'text', testDb);
      // Variations with spaces, punctuation, or different whitespace
      const def2 = await findOrCreateFieldDef('  চাচা  ', 'family', 'text', testDb);
      const def3 = await findOrCreateFieldDef('চাচা।', 'family', 'text', testDb);

      expect(def2.id).toBe(def1.id);
      expect(def3.id).toBe(def1.id);

      const count = await testDb.fieldDefs.count();
      expect(count).toBe(1);
    });

    it('throws error when label is empty or only whitespace', async () => {
      await expect(findOrCreateFieldDef('', 'family', 'text', testDb)).rejects.toThrow();
      await expect(findOrCreateFieldDef('   ', 'family', 'text', testDb)).rejects.toThrow();
    });
  });

  describe('useCount and recordFieldUsage', () => {
    it('increments useCount and updates lastUsedAt for specified fields', async () => {
      const f1 = await findOrCreateFieldDef('ভাই', 'family', 'text', testDb);
      const f2 = await findOrCreateFieldDef('বোন', 'family', 'text', testDb);

      expect(f1.useCount).toBe(0);
      expect(f2.useCount).toBe(0);

      await recordFieldUsage([f1.id, f2.id], testDb);

      const updated1 = await testDb.fieldDefs.get(f1.id);
      const updated2 = await testDb.fieldDefs.get(f2.id);
      expect(updated1?.useCount).toBe(1);
      expect(updated2?.useCount).toBe(1);

      // Usage recorded again for f1 only
      await recordFieldUsage([f1.id], testDb);
      const updated1Again = await testDb.fieldDefs.get(f1.id);
      expect(updated1Again?.useCount).toBe(2);
    });

    it('ranks suggestions by useCount descending', async () => {
      const f1 = await findOrCreateFieldDef('ভাই', 'family', 'text', testDb);
      const f2 = await findOrCreateFieldDef('বোন', 'family', 'text', testDb);

      await recordFieldUsage([f2.id], testDb); // f2 useCount = 1

      const suggestions = await getSuggestionsForSection('family', [], testDb);
      expect(suggestions[0].id).toBe(f2.id);
      expect(suggestions[1].id).toBe(f1.id);
    });

    it('excludes specified field IDs from suggestions', async () => {
      const f1 = await findOrCreateFieldDef('ভাই', 'family', 'text', testDb);
      const f2 = await findOrCreateFieldDef('বোন', 'family', 'text', testDb);

      const suggestions = await getSuggestionsForSection('family', [f1.id], testDb);
      expect(suggestions.some((s) => s.id === f1.id)).toBe(false);
      expect(suggestions.some((s) => s.id === f2.id)).toBe(true);
    });
  });

  describe('Hide and Unhide', () => {
    it('hides field from suggestions while retaining definition', async () => {
      const def = await findOrCreateFieldDef('রক্তের গ্রুপ', 'personal', 'text', testDb);

      let suggestions = await getSuggestionsForSection('personal', [], testDb);
      expect(suggestions.some((s) => s.id === def.id)).toBe(true);

      await setFieldDefHidden(def.id, true, testDb);

      suggestions = await getSuggestionsForSection('personal', [], testDb);
      expect(suggestions.some((s) => s.id === def.id)).toBe(false);

      // Unhide
      await setFieldDefHidden(def.id, false, testDb);
      suggestions = await getSuggestionsForSection('personal', [], testDb);
      expect(suggestions.some((s) => s.id === def.id)).toBe(true);
    });
  });

  describe('Rename Field Definition', () => {
    it('renames label and updates normLabel', async () => {
      const def = await findOrCreateFieldDef('চাচা', 'family', 'text', testDb);
      const renamed = await renameFieldDef(def.id, 'বড় চাচা', testDb);

      expect(renamed.label).toBe('বড় চাচা');
      expect(renamed.normLabel).toBe('বড় চাচা');

      const persisted = await testDb.fieldDefs.get(def.id);
      expect(persisted?.label).toBe('বড় চাচা');
      expect(persisted?.normLabel).toBe('বড় চাচা');
    });

    it('rejects rename if new label collides with an existing field', async () => {
      await findOrCreateFieldDef('চাচা', 'family', 'text', testDb);
      const def2 = await findOrCreateFieldDef('মামা', 'family', 'text', testDb);

      await expect(renameFieldDef(def2.id, 'চাচা', testDb)).rejects.toThrow();
    });
  });

  describe('Delete Field Definition', () => {
    it('prevents deletion if useCount > 0', async () => {
      const def = await findOrCreateFieldDef('ভাই', 'family', 'text', testDb);
      await recordFieldUsage([def.id], testDb);

      await expect(deleteFieldDef(def.id, testDb)).rejects.toThrow();
      expect(await testDb.fieldDefs.get(def.id)).toBeDefined();
    });

    it('allows deletion if useCount === 0', async () => {
      const def = await findOrCreateFieldDef('অন্যকিছু', 'other', 'text', testDb);
      expect(def.useCount).toBe(0);

      await deleteFieldDef(def.id, testDb);
      expect(await testDb.fieldDefs.get(def.id)).toBeUndefined();
    });
  });

  describe('Grouped Field Definitions', () => {
    it('returns all field defs grouped by section', async () => {
      await findOrCreateFieldDef('পিতার পেশা', 'family', 'text', testDb);
      await findOrCreateFieldDef('ওজন', 'personal', 'text', testDb);
      await findOrCreateFieldDef('কর্মস্থল', 'professional', 'text', testDb);

      const grouped = await getAllFieldDefsGrouped(testDb);
      expect(grouped.family.length).toBe(1);
      expect(grouped.personal.length).toBe(1);
      expect(grouped.professional.length).toBe(1);
      expect(grouped.preference.length).toBe(0);
    });
  });

  describe('Suggestion Lists (eduLevel & docLabel)', () => {
    it('records and updates suggestions ranking by useCount', async () => {
      await recordSuggestion('eduLevel', 'ডিপ্লোমা', testDb);
      await recordSuggestion('eduLevel', 'ডিপ্লোমা', testDb);
      await recordSuggestion('eduLevel', 'মাস্টার্স', testDb);

      const eduList = await getSuggestions('eduLevel', testDb);
      expect(eduList).toHaveLength(2);
      expect(eduList[0].text).toBe('ডিপ্লোমা');
      expect(eduList[0].useCount).toBe(2);
      expect(eduList[1].text).toBe('মাস্টার্স');
      expect(eduList[1].useCount).toBe(1);
    });
  });
});
