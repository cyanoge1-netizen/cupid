import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { parseBiodataText, splitEducationText } from './parser';
import { norm } from './normalizer';
import { findOrCreateFieldDef } from './catalog';
import { db } from '../db';

describe('Biodata Text Parser', () => {
  it('parses realistic multi-line Bangla biodata with Bangla digits', () => {
    const raw = `
পাত্রের বায়োডাটা:
নাম: মোহাম্মদ তানভীর আহমেদ
পিতার নাম: হাজী রফিক উদ্দিন
মাতার নাম: শামীমা বেগম
জেলা: সিলেট
উপজেলা: বিয়ানীবাজার
গ্রাম: চারখাই
বয়স: ২৮ বছর
উচ্চতা: ৫ ফুট ৮ ইঞ্চি
শিক্ষাগত যোগ্যতা: বিএসসি ইন কম্পিউটার সায়েন্স
পেশা: সফটওয়্যার ইঞ্জিনিয়ার
মোবাইল: ০১৭৮৭৬৫৪৩২১
অতিরিক্ত তথ্য: ধার্মিক ও নামাজী পরিবার।
`;
    const parsed = parseBiodataText(raw);

    expect(parsed.name).toBe('মোহাম্মদ তানভীর আহমেদ');
    expect(parsed.father).toBe('হাজী রফিক উদ্দিন');
    expect(parsed.mother).toBe('শামীমা বেগম');
    expect(parsed.district).toBe('সিলেট');
    expect(parsed.upazila).toBe('বিয়ানীবাজার');
    expect(parsed.village).toBe('চারখাই');
    expect(parsed.age).toBe(28);
    expect(parsed.height).toBe('5 ফুট 8 ইঞ্চি');
    expect(parsed.education).toBe('বিএসসি ইন কম্পিউটার সায়েন্স');
    expect(parsed.profession).toBe('সফটওয়্যার ইঞ্জিনিয়ার');
    expect(parsed.phoneLast4).toBe('4321');
    expect(parsed.rawText).toBe(raw);
  });

  it('parses mixed Bangla and English labels with various separators', () => {
    const raw = `
Name - Sabrina Chowdhury
Father's Name = MD. Kabir Chowdhury
Mother: Rabeya Khatun
District – মৌলভীবাজার
Thana: শ্রীমঙ্গল
Village: কমলগঞ্জ
Age - 24
Height: 5'3"
Education = BBA, SUST
Profession: Banker
Contact: 01811223344
`;
    const parsed = parseBiodataText(raw);

    expect(parsed.name).toBe('Sabrina Chowdhury');
    expect(parsed.father).toBe('MD. Kabir Chowdhury');
    expect(parsed.mother).toBe('Rabeya Khatun');
    expect(parsed.district).toBe('মৌলভীবাজার');
    expect(parsed.upazila).toBe('শ্রীমঙ্গল');
    expect(parsed.village).toBe('কমলগঞ্জ');
    expect(parsed.age).toBe(24);
    expect(parsed.height).toBe('5\'3"');
    expect(parsed.education).toBe('BBA, SUST');
    expect(parsed.profession).toBe('Banker');
    expect(parsed.phoneLast4).toBe('3344');
  });

  it('extracts phoneLast4 even if embedded in unlabelled text', () => {
    const raw = `
নাম: রাসেল
বাবার নাম: কালাম মিয়া
জেলা: ঢাকা
যোগাযোগের জন্য ০১৭১২-৯৮৭৬৫৪ নম্বরে কথা বলতে পারেন।
`;
    const parsed = parseBiodataText(raw);

    expect(parsed.name).toBe('রাসেল');
    expect(parsed.father).toBe('কালাম মিয়া');
    expect(parsed.district).toBe('ঢাকা');
    expect(parsed.phoneLast4).toBe('7654');
  });

  it('handles empty and partial text safely', () => {
    expect(parseBiodataText('')).toEqual({ rawText: '', leftovers: [] });
    expect(parseBiodataText('শুধু একটি সাধারণ বার্তা')).toEqual({
      rawText: 'শুধু একটি সাধারণ বার্তা',
      leftovers: [],
    });
  });

  describe('Parser Leftover Extraction (SPEC-UPDATE-1 3.5)', () => {
    it('extracts non-built-in lines as leftovers with original labels and values', () => {
      const raw = `
নাম: রাসেল আহমেদ
পিতার নাম: রফিক আহমেদ
ভাই: ২ জন
বোন: ১ জন
রক্তের গ্রুপ: B+
পিতার পেশা: অবসরপ্রাপ্ত সরকারি কর্মকর্তা
`;
      const parsed = parseBiodataText(raw);

      expect(parsed.name).toBe('রাসেল আহমেদ');
      expect(parsed.father).toBe('রফিক আহমেদ');
      expect(parsed.leftovers).toHaveLength(4);
      expect(parsed.leftovers).toEqual([
        { label: 'ভাই', value: '২ জন' },
        { label: 'বোন', value: '১ জন' },
        { label: 'রক্তের গ্রুপ', value: 'B+' },
        { label: 'পিতার পেশা', value: 'অবসরপ্রাপ্ত সরকারি কর্মকর্তা' },
      ]);
    });

    it('handles various separators and stripped bullet points in leftovers', () => {
      const raw = `
১. শখ: বই পড়া
২. বিশেষ নোট - শান্ত স্বভাবের
* নিজস্ব বাড়ি = আছে
`;
      const parsed = parseBiodataText(raw);

      expect(parsed.leftovers).toEqual([
        { label: 'শখ', value: 'বই পড়া' },
        { label: 'বিশেষ নোট', value: 'শান্ত স্বভাবের' },
        { label: 'নিজস্ব বাড়ি', value: 'আছে' },
      ]);
    });
  });

  describe('splitEducationText (SPEC-UPDATE-1 3.5)', () => {
    it('splits education entries on commas, semicolons, and newlines', () => {
      expect(splitEducationText('এসএসসি, এইচএসসি, বিএসসি')).toEqual([
        'এসএসসি',
        'এইচএসসি',
        'বিএসসি',
      ]);

      expect(splitEducationText('দাখিল; আলিম\nকামিল')).toEqual([
        'দাখিল',
        'আলিম',
        'কামিল',
      ]);
    });

    it('returns single item or empty array cleanly', () => {
      expect(splitEducationText('এমবিবিএস')).toEqual(['এমবিবিএস']);
      expect(splitEducationText('')).toEqual([]);
    });
  });

  describe('Checklist catalog pre-check lifecycle (SPEC-UPDATE-1 4 Acceptance)', () => {
    it('is unchecked initially if label is not in catalog, and pre-checked on next paste after being saved', async () => {
      await db.fieldDefs.clear();

      // Paste 1: "শখ: বই পড়া"
      const parsed1 = parseBiodataText('শখ: বই পড়া');
      expect(parsed1.leftovers).toHaveLength(1);
      const item1 = parsed1.leftovers![0];

      // Check if matches catalog
      const defs1 = await db.fieldDefs.toArray();
      const match1 = defs1.find((d) => d.normLabel === norm(item1.label));
      expect(match1).toBeUndefined(); // Not in catalog -> unchecked by default

      // User saves it -> catalog entry created
      await findOrCreateFieldDef(item1.label, 'other', 'text');

      // Paste 2: Another biodata with same label "শখ: বাগান করা"
      const parsed2 = parseBiodataText('শখ: বাগান করা');
      expect(parsed2.leftovers).toHaveLength(1);
      const item2 = parsed2.leftovers![0];

      const defs2 = await db.fieldDefs.toArray();
      const match2 = defs2.find((d) => d.normLabel === norm(item2.label));
      expect(match2).toBeDefined(); // Found in catalog -> pre-checked by default!
      expect(match2?.label).toBe('শখ');
    });
  });
});
