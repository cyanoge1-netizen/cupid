import { describe, it, expect } from 'vitest';
import { parseBiodataText } from './parser';

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
    expect(parseBiodataText('')).toEqual({ rawText: '' });
    expect(parseBiodataText('শুধু একটি সাধারণ বার্তা')).toEqual({
      rawText: 'শুধু একটি সাধারণ বার্তা',
    });
  });
});
