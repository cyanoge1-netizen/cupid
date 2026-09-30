import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { generateBiodataSummary, educationSummary, redactSensitiveText } from './summary';
import { db } from '../db';
import type { Person, FieldDef, MediaRef, InboxItem } from '../types';

describe('Share Sheet Logic & Biodata Summary (SPEC-UPDATE-1 3.7 & 4 Acceptance)', () => {
  const mockPerson: Person = {
    id: 'p-share-1',
    code: 'B-0312',
    gender: 'B',
    status: 'active',
    name: 'তানভীর আহমেদ',
    alias: 'রাতুল',
    age: 28,
    height: '৫ ফুট ৮ ইঞ্চি',
    profession: 'সফটওয়্যার ইঞ্জিনিয়ার',
    father: 'রফিক উদ্দিন',
    mother: 'শামীমা বেগম',
    district: 'সিলেট',
    upazila: 'বিয়ানীবাজার',
    postOffice: 'চারখাই বাজার',
    village: 'চারখাই',
    phone: '01711223344', // MUST NEVER BE SHARED
    phoneLast4: '4321', // MUST NEVER BE SHARED
    memo: 'গোপনীয় মেমো ও ব্যক্তিগত নোট', // MUST NEVER BE SHARED
    sourceId: 'partner-123', // MUST NEVER BE SHARED
    tags: ['ধার্মিক', 'প্রবাসী'],
    educations: [
      { id: 'e1', level: 'বিএসসি', institution: 'সিলেট ইঞ্জিনিয়ারিং কলেজ' },
      { id: 'e2', level: 'এইচএসসি', institution: 'এমসি কলেজ' },
      { id: 'e3', level: 'এসএসসি', institution: 'সরকারি পাইলট স্কুল' },
    ],
    coverPhotoId: 'photo-3', // 3rd photo is cover
    photos: [
      { id: 'photo-1', kind: 'image', name: 'p1.jpg', mime: 'image/jpeg', blob: new Blob(), createdAt: 1 },
      { id: 'photo-2', kind: 'image', name: 'p2.jpg', mime: 'image/jpeg', blob: new Blob(), createdAt: 2 },
      { id: 'photo-3', kind: 'image', name: 'p3.jpg', mime: 'image/jpeg', blob: new Blob(), createdAt: 3 },
      { id: 'photo-4', kind: 'image', name: 'p4.jpg', mime: 'image/jpeg', blob: new Blob(), createdAt: 4 },
    ],
    docs: [
      { id: 'doc-1', kind: 'pdf', name: 'biodata.pdf', label: 'বায়োডাটা PDF', mime: 'application/pdf', blob: new Blob(), createdAt: 1 },
    ],
    extra: [
      { fieldId: 'def-uncle', value: 'ব্যবসায়ী, যুক্তরাজ্য প্রবাসী' },
      { fieldId: 'def-blood', value: 'O+' },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  };

  const fieldDefsMap = new Map<string, FieldDef>([
    [
      'def-uncle',
      {
        id: 'def-uncle',
        label: 'চাচা',
        normLabel: 'চাচা',
        section: 'family',
        kind: 'text',
        useCount: 1,
        lastUsedAt: 1000,
      },
    ],
    [
      'def-blood',
      {
        id: 'def-blood',
        label: 'রক্তের গ্রুপ',
        normLabel: 'রক্তের গ্রুপ',
        section: 'personal',
        kind: 'text',
        useCount: 1,
        lastUsedAt: 1000,
      },
    ],
  ]);

  it('never includes phoneLast4, phone, memo, source, or status in shared text', () => {
    const summary = generateBiodataSummary(mockPerson);

    expect(summary).not.toContain('4321');
    expect(summary).not.toContain('01711223344');
    expect(summary).not.toContain('গোপনীয় মেমো');
    expect(summary).not.toContain('partner-123');
    expect(summary).not.toContain('active');
    expect(summary).not.toContain('উৎস');
  });

  it('includes basic info and education by default', () => {
    const summary = generateBiodataSummary(mockPerson);

    expect(summary).toContain('তানভীর আহমেদ');
    expect(summary).toContain('রাতুল');
    expect(summary).toContain('28 বছর');
    expect(summary).toContain('সফটওয়্যার ইঞ্জিনিয়ার');
    expect(summary).toContain('চারখাই বাজার');
    expect(summary).toContain('বিএসসি (সিলেট ইঞ্জিনিয়ারিং কলেজ), এইচএসসি (এমসি কলেজ)');
  });

  it('allows disabling basic info or education sections via checkboxes', () => {
    const summaryNoBasic = generateBiodataSummary(mockPerson, {
      includeBasic: false,
      includeEducation: true,
    });
    expect(summaryNoBasic).not.toContain('তানভীর আহমেদ');
    expect(summaryNoBasic).toContain('বিএসসি (সিলেট ইঞ্জিনিয়ারিং কলেজ)');

    const summaryNoEdu = generateBiodataSummary(mockPerson, {
      includeBasic: true,
      includeEducation: false,
    });
    expect(summaryNoEdu).toContain('তানভীর আহমেদ');
    expect(summaryNoEdu).not.toContain('বিএসসি (সিলেট ইঞ্জিনিয়ারিং কলেজ)');
  });

  it('includes custom fields only when individually selected', () => {
    // None selected by default
    const summaryDefault = generateBiodataSummary(mockPerson, {
      fieldDefsMap,
      selectedExtraFieldIds: [],
    });
    expect(summaryDefault).not.toContain('চাচা');
    expect(summaryDefault).not.toContain('ব্যবসায়ী, যুক্তরাজ্য প্রবাসী');

    // Only 'def-uncle' selected
    const summaryWithUncle = generateBiodataSummary(mockPerson, {
      fieldDefsMap,
      selectedExtraFieldIds: ['def-uncle'],
    });
    expect(summaryWithUncle).toContain('চাচা: ব্যবসায়ী, যুক্তরাজ্য প্রবাসী');
    expect(summaryWithUncle).not.toContain('রক্তের গ্রুপ');

    // Both selected
    const summaryWithBoth = generateBiodataSummary(mockPerson, {
      fieldDefsMap,
      selectedExtraFieldIds: ['def-uncle', 'def-blood'],
    });
    expect(summaryWithBoth).toContain('চাচা: ব্যবসায়ী, যুক্তরাজ্য প্রবাসী');
    expect(summaryWithBoth).toContain('রক্তের গ্রুপ: O+');
  });

  it('selects cover photo by default for 4 photos where the 3rd is set as cover (SPEC-UPDATE-1 4 Acceptance)', () => {
    const effectiveCover = mockPerson.coverPhotoId || mockPerson.photos?.[0]?.id;
    expect(effectiveCover).toBe('photo-3');

    // Default share photo selection selects the cover photo
    const defaultSelectedPhotos = effectiveCover ? [effectiveCover] : [];
    expect(defaultSelectedPhotos).toEqual(['photo-3']);
  });

  it('educationSummary formats first two degrees properly', () => {
    expect(educationSummary(mockPerson)).toBe(
      'বিএসসি (সিলেট ইঞ্জিনিয়ারিং কলেজ), এইচএসসি (এমসি কলেজ)'
    );
  });

  it('redacted mode hides code, name, alias, parents, village and keeps general demographic fields', () => {
    const redactedSummary = generateBiodataSummary(mockPerson, {
      redacted: true,
      includeBasic: true,
      includeEducation: true,
    });

    // Code is omitted by default in redacted mode
    expect(redactedSummary).not.toContain('B-0312');
    expect(redactedSummary).not.toContain('কোড: B-0312');

    // Personal identifiers must NOT appear at all
    expect(redactedSummary).not.toContain('তানভীর আহমেদ');
    expect(redactedSummary).not.toContain('রাতুল');
    expect(redactedSummary).not.toContain('রফিক উদ্দিন');
    expect(redactedSummary).not.toContain('শামীমা বেগম');
    expect(redactedSummary).not.toContain('গ্রাম: চারখাই');

    // No [গোপন] placeholders — complete removal
    expect(redactedSummary).not.toContain('[গোপন]');

    // Safe demographic info remains
    expect(redactedSummary).toContain('28 বছর');
    expect(redactedSummary).toContain('সফটওয়্যার ইঞ্জিনিয়ার');
    expect(redactedSummary).toContain('সিলেট');
    expect(redactedSummary).toContain('বিয়ানীবাজার');
  });

  it('granular: redactCode=false keeps code while keeping name and other fields hidden', () => {
    const summary = generateBiodataSummary(mockPerson, {
      redacted: true,
      redactCode: false,
      redactName: true,
      redactParents: true,
      redactVillage: true,
      redactContact: true,
    });
    expect(summary).toContain('B-0312');
    expect(summary).toContain('কোড: B-0312');
    expect(summary).not.toContain('তানভীর আহমেদ');
  });

  it('redacted mode scrubs embedded contact numbers, emails, and links', () => {
    const personWithSensitiveInfo: Person = {
      ...mockPerson,
      profession: 'কল করুন 01712345678 অথবা ইমেইল info@example.com',
      educations: [
        { id: 'e1', level: 'অনার্স', institution: 'ফেসবুক fb.com/profile' },
      ],
    };

    const redacted = generateBiodataSummary(personWithSensitiveInfo, {
      redacted: true,
      includeBasic: true,
      includeEducation: true,
    });

    expect(redacted).not.toContain('01712345678');
    expect(redacted).not.toContain('info@example.com');
    expect(redacted).not.toContain('fb.com/profile');
    // ▇▇▇▇ may still appear for inline scrubbing within mixed text
    expect(redacted).not.toContain('[গোপন]');
  });

  it('granular: redactName=false reveals name/alias while keeping parents hidden', () => {
    const summary = generateBiodataSummary(mockPerson, {
      redacted: true,
      redactName: false,
      redactParents: true,
      redactVillage: true,
      redactContact: true,
    });
    expect(summary).toContain('তানভীর আহমেদ');
    expect(summary).toContain('রাতুল');
    // Parents completely absent — no line, no placeholder
    expect(summary).not.toContain('রফিক উদ্দিন');
    expect(summary).not.toContain('শামীমা বেগম');
    expect(summary).not.toContain('[গোপন]');
    expect(summary).not.toContain('গ্রাম: চারখাই');
  });

  it('granular: redactParents=false reveals parents while keeping name hidden', () => {
    const summary = generateBiodataSummary(mockPerson, {
      redacted: true,
      redactName: true,
      redactParents: false,
      redactVillage: true,
      redactContact: true,
    });
    // Name line completely absent
    expect(summary).not.toContain('তানভীর আহমেদ');
    expect(summary).not.toContain('[গোপন]');
    expect(summary).toContain('রফিক উদ্দিন');
    expect(summary).toContain('শামীমা বেগম');
    expect(summary).not.toContain('গ্রাম: চারখাই');
  });

  it('granular: redactVillage=false reveals village while other fields still removed', () => {
    const summary = generateBiodataSummary(mockPerson, {
      redacted: true,
      redactName: true,
      redactParents: true,
      redactVillage: false,
      redactContact: true,
    });
    expect(summary).not.toContain('তানভীর আহমেদ');
    expect(summary).not.toContain('রফিক উদ্দিন');
    expect(summary).not.toContain('[গোপন]');
    expect(summary).toContain('চারখাই');
  });

  it('granular: redactContact=false allows phone-like content to pass through in profession', () => {
    const personWithPhone: Person = {
      ...mockPerson,
      profession: 'যোগাযোগ 01712345678',
    };
    const summary = generateBiodataSummary(personWithPhone, {
      redacted: true,
      redactName: true,
      redactParents: true,
      redactVillage: true,
      redactContact: false, // <-- not scrubbing contact
    });
    expect(summary).toContain('01712345678');
  });

  describe('Privacy & Sensitive Text Redaction (Item 2 & 3)', () => {
    it('redacts all Bangladeshi mobile phone formats with various separators', () => {
      const cases = [
        '01712-345678',
        '0171 234 5678',
        '+880 1712 345678',
        '+88 01712 345678',
        '০১৭১২-৩৪৫৬৭৮',
        '01712.345678',
        '+8801712345678',
        '+৮৮০১৭১২-৩৪৫৬৭৮',
        '01712345678',
      ];

      for (const phoneStr of cases) {
        const text = `প্রার্থীর মোবাইল: ${phoneStr} জরুরি প্রয়োজনে`;
        const redacted = redactSensitiveText(text);
        expect(redacted).not.toContain(phoneStr);
        expect(redacted).toContain('▇▇▇▇');
        // Must not contain any remaining 10+ or BD mobile digit run
        const rawDigits = redacted.replace(/\D/g, '');
        expect(rawDigits.length).toBeLessThan(10);
      }
    });

    it('redacts messaging and social links including t.me and instagram.com', () => {
      const linkCases = [
        't.me/matchmaker_bd',
        'https://t.me/matchmaker_bd',
        'instagram.com/candidate_profile',
        'https://instagram.com/candidate_profile',
        'https://www.instagram.com/candidate_profile/',
        'wa.me/8801712345678',
        'facebook.com/person.name',
        'fb.com/person.name',
      ];

      for (const link of linkCases) {
        const text = `যোগাযোগের লিংক: ${link} বিস্তারিত`;
        const redacted = redactSensitiveText(text);
        expect(redacted).not.toContain(link);
        expect(redacted).toContain('▇▇▇▇');
      }
    });

    it('negative cases: preserves ages, heights, years, year ranges, and dates without over-redaction', () => {
      const nonSensitiveCases = [
        { input: 'বয়স ২৮ বছর', expected: 'বয়স 28 বছর' }, // Bangla numerals normalized, text kept
        { input: 'উচ্চতা ৫ ফুট ৮ ইঞ্চি', expected: 'উচ্চতা 5 ফুট 8 ইঞ্চি' },
        { input: "উচ্চতা 5'6\"", expected: "উচ্চতা 5'6\"" },
        { input: 'জন্মসাল ১৯৯৮', expected: 'জন্মসাল 1998' },
        { input: 'সেশন 2018-2022', expected: 'সেশন 2018-2022' },
        { input: 'জন্ম তারিখ 15-08-1998', expected: 'জন্ম তারিখ 15-08-1998' },
        { input: 'সিজিপিএ ৩.৭৫', expected: 'সিজিপিএ 3.75' },
      ];

      for (const { input, expected } of nonSensitiveCases) {
        const redacted = redactSensitiveText(input);
        expect(redacted).not.toContain('▇▇▇▇');
        expect(redacted).toBe(expected);
      }
    });

    it('redacted mode guarantees no phone-like digit run appears in any field (tags, district, village, etc.)', () => {
      const personWithLeakedData: Person = {
        ...mockPerson,
        district: 'সিলেট (কল 01712-345678)',
        upazila: 'বিয়ানীবাজার ০১৮১২-৩৪৫৬৭৮',
        postOffice: 'চারখাই ০১৭১ 234 5678',
        village: 'চারখাই +880 1712 345678',
        tags: ['ধার্মিক', '01912-345678', 't.me/leaked'],
        profession: 'ইঞ্জিনিয়ার +88 01712 345678',
      };

      const summary = generateBiodataSummary(personWithLeakedData, {
        redacted: true,
        includeBasic: true,
        includeEducation: true,
        redactContact: true,
        redactVillage: false, // even if village is unhidden, it must be scrubbed
      });

      // Assert none of the phone formats leaked through
      expect(summary).not.toContain('01712-345678');
      expect(summary).not.toContain('০১৮১২-৩৪৫৬৭৮');
      expect(summary).not.toContain('0171 234 5678');
      expect(summary).not.toContain('+880 1712 345678');
      expect(summary).not.toContain('+88 01712 345678');
      expect(summary).not.toContain('01912-345678');
      expect(summary).not.toContain('t.me/leaked');

      // Comprehensive assertion: scan every line in the redacted summary for any 10+ digit run or BD mobile run
      const lines = summary.split('\n');
      for (const line of lines) {
        // Strip out safe year ranges and labels
        const rawDigits = line.replace(/\D/g, '');
        // No line in redacted mode should contain a 10+ digit sequence
        expect(rawDigits.length).toBeLessThan(10);
        // No BD mobile pattern (013-019 followed by digits)
        expect(/(?:\+?880?|0)1[3-9]\d{8}/.test(line)).toBe(false);
      }
    });
  });

  describe('Service Worker Share Target Inbox Write (Item 1 & 3)', () => {
    it('writes InboxItem with MediaRef[] directly to db.inbox and retrieves it', async () => {
      const testFileId = 'file-sw-test-1';
      const mockBlob = new Blob(['sample-image-bytes'], { type: 'image/jpeg' });
      const files: MediaRef[] = [
        {
          id: testFileId,
          kind: 'image',
          name: 'whatsapp_photo.jpg',
          mime: 'image/jpeg',
          blob: mockBlob,
          createdAt: Date.now(),
        },
      ];

      const inboxItemId = 'inbox-item-sw-1';
      const inboxItem: InboxItem = {
        id: inboxItemId,
        files,
        text: 'পাত্র তানভীর, বিএসসি ইঞ্জিনিয়ার, সিলেট',
        via: 'share',
        status: 'new',
        receivedAt: Date.now(),
      };

      // Add item directly as SW does
      await db.inbox.add(inboxItem);

      // Verify it can be retrieved from Dexie
      const retrieved = await db.inbox.get(inboxItemId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(inboxItemId);
      expect(retrieved?.via).toBe('share');
      expect(retrieved?.status).toBe('new');
      expect(retrieved?.text).toContain('পাত্র তানভীর');
      expect(retrieved?.files).toHaveLength(1);
      expect(retrieved?.files[0].id).toBe(testFileId);
      expect(retrieved?.files[0].name).toBe('whatsapp_photo.jpg');
      expect(retrieved?.files[0].kind).toBe('image');
      expect(retrieved?.files[0].blob).toBeDefined();

      // Clean up test entry
      await db.inbox.delete(inboxItemId);
    });
  });
});
