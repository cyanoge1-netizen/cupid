import { describe, it, expect } from 'vitest';
import { searchPeople } from './search';
import type { Person, Partner } from '../types';

describe('Search Functionality - Six Cases from SPEC 5.9', () => {
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
      phoneLast4: '5678',
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
      phoneLast4: '1234',
      status: 'active',
      sourceId: null, // নিজের (Own)
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

  // Case 1: partial word
  it('Case 1: partial word search matches substring of words in record', () => {
    // "তন্ম" is a partial word of "তন্ময়"
    const res = searchPeople('তন্ম', testPeople, {}, partnersMap);
    expect(res).toHaveLength(1);
    expect(res[0].person.code).toBe('G-0143');
    expect(res[0].isNearMatch).toBeFalsy();

    // Partial match on profession: "শিক্" in "শিক্ষক"
    const resProf = searchPeople('শিক্', testPeople, {}, partnersMap);
    expect(resProf.length).toBeGreaterThanOrEqual(1);
    expect(resProf[0].person.code).toBe('G-0143');
  });

  // Case 2: two-token query
  it('Case 2: two-token query requires both tokens to match across fields (AND logic)', () => {
    // "সিলেট রহিম" matches district "সিলেট" and father "রহিম উল্লাহ"
    const res = searchPeople('সিলেট রহিম', testPeople, {}, partnersMap);
    expect(res).toHaveLength(1);
    expect(res[0].person.code).toBe('G-0143');

    // If one of the two tokens does not exist in any record, no direct match
    const resNone = searchPeople('সিলেট অকার্যকরশব্দ', testPeople, {}, partnersMap);
    // Since fallback drops the last token, the fallback matches "সিলেট" with isNearMatch = true
    expect(resNone.every((r) => r.isNearMatch)).toBe(true);
  });

  // Case 3: Bangla vs English digits
  it('Case 3: Bangla vs English digits treated identically for code, phoneLast4, and fields', () => {
    // Code in Bangla digits "০১৪৩"
    const resBanglaCode = searchPeople('০১৪৩', testPeople, {}, partnersMap);
    expect(resBanglaCode).toHaveLength(1);
    expect(resBanglaCode[0].person.code).toBe('G-0143');

    // Code in English digits "0143"
    const resEnglishCode = searchPeople('0143', testPeople, {}, partnersMap);
    expect(resEnglishCode).toHaveLength(1);
    expect(resEnglishCode[0].person.code).toBe('G-0143');

    // Phone last 4 in Bangla digits "১২৩৪"
    const resBanglaPhone = searchPeople('১২৩৪', testPeople, {}, partnersMap);
    expect(resBanglaPhone).toHaveLength(1);
    expect(resBanglaPhone[0].person.code).toBe('B-0087');

    // Phone last 4 in English digits "1234"
    const resEnglishPhone = searchPeople('1234', testPeople, {}, partnersMap);
    expect(resEnglishPhone).toHaveLength(1);
    expect(resEnglishPhone[0].person.code).toBe('B-0087');
  });

  // Case 4: typo tolerance
  it('Case 4: typo tolerance matches words within edit distance <= 1 for tokens of 3 or more chars', () => {
    // "ডাক্তার" queried with 1-character typo: "ডাক্তর" (edit distance 1, token length >= 3)
    const res = searchPeople('ডাক্তর', testPeople, {}, partnersMap);
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0].person.code).toBe('B-0087');
    expect(res[0].score).toBeGreaterThan(0);

    // Edit distance > 1 should not match directly
    const resBigTypo = searchPeople('ডকত্র', testPeople, {}, partnersMap);
    expect(resBigTypo).toHaveLength(0);
  });

  // Case 5: no-match fallback
  it('Case 5: no-match fallback retries once with the last token dropped and labels "কাছাকাছি মিল"', () => {
    // "ঢাকা" matches B-0087, but "অজানাশব্দ" matches nothing
    const res = searchPeople('ঢাকা অজানাশব্দ', testPeople, {}, partnersMap);
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0].isNearMatch).toBe(true);
    expect(res[0].person.district).toBe('ঢাকা');
    expect(res[0].person.code).toBe('B-0087');
  });

  // Case 6: source name search
  it('Case 6: source name search finds records supplied by that partner or own records', () => {
    // Search partner's name "মকবুল"
    const resPartner = searchPeople('মকবুল', testPeople, {}, partnersMap);
    expect(resPartner).toHaveLength(1);
    expect(resPartner[0].person.code).toBe('G-0143');
    expect(resPartner[0].person.sourceId).toBe('partner-mokbul');

    // Search "নিজের" (Own)
    const resOwn = searchPeople('নিজের', testPeople, {}, partnersMap);
    const ownCodes = resOwn.map((r) => r.person.code);
    expect(ownCodes).toContain('B-0087');
  });

  // Additional behavior: status filtering and married ranking
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

  describe('Rich Biodata Search Index (SPEC-UPDATE-1 3.6 & 4 Acceptance)', () => {
    const richPeople: Person[] = [
      {
        id: 'rp1',
        code: 'B-0201',
        gender: 'B',
        name: 'সাকিব আল হাসান',
        status: 'active',
        sourceId: null,
        tags: [],
        photos: [],
        docs: [
          {
            id: 'doc-1',
            kind: 'pdf',
            name: 'biodata_v1.pdf',
            label: 'অফিসিয়াল বায়োডাটা',
            mime: 'application/pdf',
            blob: new Blob(),
            createdAt: 1,
          },
        ],
        educations: [
          {
            id: 'edu-1',
            level: 'এমবিবিএস',
            subject: 'চিকিৎসা বিজ্ঞান',
            institution: 'ঢাকা মেডিকেল কলেজ',
            result: 'উত্তীর্ণ',
            year: '২০২২',
          },
          {
            id: 'edu-2',
            level: 'এইচএসসি',
            institution: 'নটর ডেম কলেজ',
          },
        ],
        extra: [
          {
            fieldId: 'field-blood-group',
            value: 'ও পজিটিভ (O+)',
          },
          {
            fieldId: 'field-father-job',
            value: 'অবসরপ্রাপ্ত সেনা কর্মকর্তা',
          },
        ],
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'rp2',
        code: 'G-0202',
        gender: 'G',
        name: 'নুসরাত জাহান',
        status: 'active',
        sourceId: null,
        tags: [],
        photos: [],
        docs: [],
        educations: [
          {
            id: 'edu-3',
            level: 'বিএসসি',
            subject: 'কম্পিউটার সায়েন্স',
            institution: 'শাহজালাল প্রযুক্তি বিশ্ববিদ্যালয়',
          },
        ],
        extra: [
          {
            fieldId: 'field-blood-group',
            value: 'এ পজিটিভ (A+)',
          },
        ],
        createdAt: 2000,
        updatedAt: 2000,
      },
    ];

    it('finds a person by education institution name', () => {
      // Searching "ঢাকা মেডিকেল" finds B-0201
      const resDMC = searchPeople('ঢাকা মেডিকেল', richPeople);
      expect(resDMC).toHaveLength(1);
      expect(resDMC[0].person.code).toBe('B-0201');

      // Searching "শাহজালাল" or "সাস্ট" (sust) finds G-0202
      const resSUST = searchPeople('শাহজালাল', richPeople);
      expect(resSUST).toHaveLength(1);
      expect(resSUST[0].person.code).toBe('G-0202');
    });

    it('finds a person by education subject, level, and year', () => {
      const resSubject = searchPeople('চিকিৎসা বিজ্ঞান', richPeople);
      expect(resSubject).toHaveLength(1);
      expect(resSubject[0].person.code).toBe('B-0201');

      const resYear = searchPeople('২০২২', richPeople);
      expect(resYear).toHaveLength(1);
      expect(resYear[0].person.code).toBe('B-0201');
    });

    it('finds a person by custom value but does not index field labels', () => {
      // Custom value "অবসরপ্রাপ্ত সেনা কর্মকর্তা" matches B-0201
      const resArmy = searchPeople('সেনা কর্মকর্তা', richPeople);
      expect(resArmy).toHaveLength(1);
      expect(resArmy[0].person.code).toBe('B-0201');

      // Blood group value "ও পজিটিভ" matches B-0201
      const resBlood = searchPeople('ও পজিটিভ', richPeople);
      expect(resBlood).toHaveLength(1);
      expect(resBlood[0].person.code).toBe('B-0201');

      // Searching field label "field-blood-group" or internal key should NOT match
      const resLabel = searchPeople('field-blood-group', richPeople);
      expect(resLabel).toHaveLength(0);
    });

    it('finds a person by document label', () => {
      const resDoc = searchPeople('অফিসিয়াল বায়োডাটা', richPeople);
      expect(resDoc).toHaveLength(1);
      expect(resDoc[0].person.code).toBe('B-0201');
    });
  });
});
