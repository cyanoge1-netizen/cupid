import { describe, it, expect } from 'vitest';
import { checkDuplicates } from './duplicates';
import type { Person, Partner } from '../types';

describe('Duplicate Detection', () => {
  const partnersMap = new Map<string, Partner>([
    [
      'part-1',
      {
        id: 'part-1',
        name: 'কাশেম ঘটক',
        phone: '01700000000',
        createdAt: Date.now(),
      },
    ],
  ]);

  const existingPeople: Person[] = [
    {
      id: 'p1',
      code: 'G-0001',
      gender: 'G',
      name: 'আব্দুর রহিম',
      father: 'আব্দুল করিম',
      district: 'সিলেট',
      village: 'জালালাবাদ',
      phoneLast4: '1234',
      status: 'active',
      sourceId: 'part-1',
      tags: [],
      photos: [],
      docs: [],
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'p2',
      code: 'G-0002',
      gender: 'G',
      name: 'ফারহান আহমেদ',
      father: 'মোবারক হোসেন',
      district: 'ঢাকা',
      status: 'active',
      sourceId: null,
      tags: [],
      photos: [],
      docs: [],
      createdAt: 2000,
      updatedAt: 2000,
      deletedAt: 3000, // Deleted
    },
  ];

  it('triggers duplicate warning when score >= 4 (same father + same district)', () => {
    // Father (+3) + district (+1) = 4
    const candidate = {
      name: 'আলাউদ্দিন',
      father: 'আব্দুল করিম',
      district: 'সিলেট',
    };

    const matches = checkDuplicates(candidate, existingPeople, partnersMap);

    expect(matches).toHaveLength(1);
    expect(matches[0].person.code).toBe('G-0001');
    expect(matches[0].score).toBe(4);
    expect(matches[0].partnerName).toBe('কাশেম ঘটক');
    expect(matches[0].matchedFields).toContain('পিতার নাম');
    expect(matches[0].matchedFields).toContain('জেলা');
  });

  it('triggers duplicate when same name (+2) + same phoneLast4 (+2) = 4', () => {
    const candidate = {
      name: 'আব্দুর রহিম',
      phoneLast4: '1234',
    };

    const matches = checkDuplicates(candidate, existingPeople, partnersMap);

    expect(matches).toHaveLength(1);
    expect(matches[0].score).toBe(4);
    expect(matches[0].matchedFields).toContain('নাম');
    expect(matches[0].matchedFields).toContain('মোবাইল নম্বর');
  });

  it('does not warn when score < 4 (e.g. only father matches +3)', () => {
    const candidate = {
      father: 'আব্দুল করিম',
    };

    const matches = checkDuplicates(candidate, existingPeople, partnersMap);
    expect(matches).toHaveLength(0);
  });

  it('ignores deleted people', () => {
    const candidate = {
      name: 'ফারহান আহমেদ',
      father: 'মোবারক হোসেন',
      district: 'ঢাকা',
    };

    const matches = checkDuplicates(candidate, existingPeople, partnersMap);
    expect(matches).toHaveLength(0);
  });
});
