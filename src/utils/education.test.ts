import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { GhotkaliDatabase } from '../db';
import { recordSuggestion, getSuggestions } from './catalog';
import { educationSummary } from './summary';
import type { EducationEntry, Person } from '../types';

describe('Education Operations and Logic (SPEC-UPDATE-1 3.3)', () => {
  let testDb: GhotkaliDatabase;

  beforeEach(async () => {
    testDb = new GhotkaliDatabase(`test-edu-${Date.now()}-${Math.random()}`);
    await testDb.open();
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('reorders entries with move up and move down operations', () => {
    const entries: EducationEntry[] = [
      { id: '1', level: 'এসএসসি' },
      { id: '2', level: 'এইচএসসি' },
      { id: '3', level: 'অনার্স' },
    ];

    // Move down index 0
    const moveDown = (list: EducationEntry[], index: number) => {
      if (index === list.length - 1) return list;
      const copy = [...list];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    };

    const afterDown = moveDown(entries, 0);
    expect(afterDown.map((e) => e.level)).toEqual(['এইচএসসি', 'এসএসসি', 'অনার্স']);

    // Move up index 2
    const moveUp = (list: EducationEntry[], index: number) => {
      if (index === 0) return list;
      const copy = [...list];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    };

    const afterUp = moveUp(afterDown, 2);
    expect(afterUp.map((e) => e.level)).toEqual(['এইচএসসি', 'অনার্স', 'এসএসসি']);
  });

  it('handles delete and undo restoration at exact index', () => {
    let list: EducationEntry[] = [
      { id: '1', level: 'এসএসসি' },
      { id: '2', level: 'এইচএসসি' },
      { id: '3', level: 'অনার্স' },
    ];

    const toDeleteIndex = 1;
    const deletedItem = list[toDeleteIndex];
    list = list.filter((_, i) => i !== toDeleteIndex);
    expect(list.map((e) => e.level)).toEqual(['এসএসসি', 'অনার্স']);

    // Undo restoration
    const restored = [...list];
    restored.splice(toDeleteIndex, 0, deletedItem);
    expect(restored.map((e) => e.level)).toEqual(['এসএসসি', 'এইচএসসি', 'অনার্স']);
  });

  it('records suggestions for education levels on save and ranks them', async () => {
    await recordSuggestion('eduLevel', 'এমবিবিএস', testDb);
    await recordSuggestion('eduLevel', 'এমবিবিএস', testDb);
    await recordSuggestion('eduLevel', 'ডিপ্লোমা', testDb);

    const suggestions = await getSuggestions('eduLevel', testDb);
    expect(suggestions[0].text).toBe('এমবিবিএস');
    expect(suggestions[0].useCount).toBe(2);
    expect(suggestions[1].text).toBe('ডিপ্লোমা');
    expect(suggestions[1].useCount).toBe(1);
  });

  it('updates educationSummary correctly when education entries are added or changed', () => {
    const person: Person = {
      id: 'p-1',
      code: 'G-0001',
      gender: 'G',
      status: 'active',
      tags: [],
      photos: [],
      docs: [],
      sourceId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      educations: [
        { id: '1', level: 'বিএসসি', institution: 'সিলেট ইঞ্জিনিয়ারিং কলেজ' },
        { id: '2', level: 'এইচএসসি', institution: 'এমসি কলেজ' },
        { id: '3', level: 'এসএসসি', institution: 'সরকারি পাইলট স্কুল' },
      ],
    };

    // First two entries used in summary
    expect(educationSummary(person)).toBe(
      'বিএসসি (সিলেট ইঞ্জিনিয়ারিং কলেজ), এইচএসসি (এমসি কলেজ)'
    );
  });
});
