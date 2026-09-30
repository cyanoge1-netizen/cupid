import { describe, it, expect } from 'vitest';
import { searchPeople } from './search';
import type { Person, Partner } from '../types';

describe('Search Functionality (SPEC 5.9)', () => {
  const partnersMap = new Map<string, Partner>([
    [
      'partner-mokbul',
      {
        id: 'partner-mokbul',
        name: 'মকবুল ভাই',
        phone: '01811223344',
        createdAt: 100,
      },
    ],
  ]);

  const testPeople: Person[] = [
    {
      id: 'p1',
      code: 'G-0143',
      gender: 'G',
      name: 'তন্ময় ইসলাম',
      father: 'রহিম উল্লাহ',
      mother: 'ফাতিমা বেগম',
      district: 'সিলেট',
      upazila: 'গোলাপগঞ্জ',
      village: 'ফুলবাড়ি',
      profession: 'শিক্ষক',
      status: 'active',
      sourceId: 'partner-mokbul',
      tags: ['নম্র', 'প্রবাসী'],
      photos: [],
      docs: [],
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'p2',
      code: 'B-0087',
      gender: 'B',
      name: 'ফারজানা আক্তার',
      father: 'আব্দুল করিম',
      district: 'ঢাকা',
      profession: 'ডাক্তার',
      status: 'active',
      sourceId: null,
      tags: [],
      photos: [],
      docs: [],
      createdAt: 2000,
      updatedAt: 2000,
    },
    {
      id: 'p3',
      code: 'G-0020',
      gender: 'G',
      name: 'জহিরুল হক',
      father: 'রহিম উল্লাহ',
      district: 'চট্টগ্রাম',
      status: 'married',
      sourceId: null,
      tags: [],
      photos: [],
      docs: [],
      createdAt: 3000,
      updatedAt: 3000,
    },
    {
      id: 'p4',
      code: 'B-0099',
      gender: 'B',
      name: 'শায়লা বেগম',
      father: 'কাসেম',
      district: 'সিলেট',
      status: 'active',
      sourceId: null,
      tags: [],
      photos: [],
      docs: [],
      createdAt: 4000,
      updatedAt: 4000,
      deletedAt: 5000, // Deleted, must be ignored
    },
  ];

  it('finds record by partial word (e.g. "তন্ম" -> তন্ময়)', () => {
    const res = searchPeople('তন্ম', testPeople, {}, partnersMap);
    expect(res).toHaveLength(1);
    expect(res[0].person.code).toBe('G-0143');
  });

  it('finds record with two-token query across multiple fields ("সিলেট রহিম")', () => {
    // "সিলেট রহিম" matches district "সিলেট" and father "রহিম উল্লাহ"
    const res = searchPeople('সিলেট রহিম', testPeople, {}, partnersMap);
    expect(res).toHaveLength(1);
    expect(res[0].person.code).toBe('G-0143');
  });

  it('treats Bangla and English digits the same (e.g. "০১৪৩" matches "0143")', () => {
    const resBanglaDigits = searchPeople('০১৪৩', testPeople, {}, partnersMap);
    expect(resBanglaDigits).toHaveLength(1);
    expect(resBanglaDigits[0].person.code).toBe('G-0143');

    const resEnglishDigits = searchPeople('0143', testPeople, {}, partnersMap);
    expect(resEnglishDigits).toHaveLength(1);
    expect(resEnglishDigits[0].person.code).toBe('G-0143');
  });

  it('matches with typo tolerance (edit distance <= 1 for tokens >= 3 chars)', () => {
    // Search "ডাক্তার" with a typo: "ডাক্তর" (edit distance 1)
    const res = searchPeople('ডাক্তর', testPeople, {}, partnersMap);
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0].person.code).toBe('B-0087');
  });

  it('falls back to dropping last token when multi-token query has no exact match', () => {
    // "সিলেট" matches, but "অজানাশব্দ" matches nothing
    const res = searchPeople('সিলেট অজানাশব্দ', testPeople, {}, partnersMap);
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0].isNearMatch).toBe(true);
    expect(res[0].person.district).toBe('সিলেট');
  });

  it('finds record by source partner name', () => {
    const res = searchPeople('মকবুল', testPeople, {}, partnersMap);
    expect(res).toHaveLength(1);
    expect(res[0].person.code).toBe('G-0143');
  });

  it('respects status filter and married records behavior', () => {
    // Default filter for active records
    const activeResults = searchPeople('', testPeople, { status: 'active' }, partnersMap);
    const codes = activeResults.map((r) => r.person.code);
    expect(codes).toContain('G-0143');
    expect(codes).toContain('B-0087');
    expect(codes).not.toContain('G-0020'); // married
    expect(codes).not.toContain('B-0099'); // deleted

    // All status includes married
    const allResults = searchPeople('', testPeople, { status: 'all' }, partnersMap);
    const allCodes = allResults.map((r) => r.person.code);
    expect(allCodes).toContain('G-0020');
  });
});
