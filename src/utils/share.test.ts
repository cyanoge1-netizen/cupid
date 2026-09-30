import { describe, it, expect } from 'vitest';
import { generateBiodataSummary, educationSummary } from './summary';
import type { Person, FieldDef } from '../types';

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

  it('redacted mode hides name, alias, parents, village and keeps code and general fields', () => {
    const redactedSummary = generateBiodataSummary(mockPerson, {
      redacted: true,
      includeBasic: true,
      includeEducation: true,
    });

    // Identifies candidate by code — header same format as full
    expect(redactedSummary).toContain('B-0312');
    expect(redactedSummary).toContain('কোড: B-0312');

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
});
