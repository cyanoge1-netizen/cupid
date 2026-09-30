import { describe, it, expect } from 'vitest';
import { norm, banglaDigitsToEnglish, editDistance } from './normalizer';

describe('Normalizer Utilities', () => {
  describe('banglaDigitsToEnglish', () => {
    it('converts Bangla numerals to ASCII digits', () => {
      expect(banglaDigitsToEnglish('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
      expect(banglaDigitsToEnglish('বয়স ২৫ বছর, ফোন ০১৭১২৩৪৫৬৭৮')).toBe('বয়স 25 বছর, ফোন 01712345678');
    });

    it('leaves English digits untouched', () => {
      expect(banglaDigitsToEnglish('B-0143 and 9876')).toBe('B-0143 and 9876');
    });
  });

  describe('norm', () => {
    it('applies NFC and removes zero-width characters', () => {
      const textWithZW = 'সিলেট\u200B\u200C\u200D\uFEFF';
      expect(norm(textWithZW)).toBe('সিলেট');
    });

    it('converts Bangla digits to English digits and lowers case', () => {
      expect(norm('Code B-০১৪৩')).toBe('code b 0143');
    });

    it('replaces punctuation and Bangla danda with spaces', () => {
      expect(norm('সিলেট, মৌলভীবাজার; ঠিকানা: গ্রাম-আম্বরখানা।')).toBe('সিলেট মৌলভীবাজার ঠিকানা গ্রাম আম্বরখানা');
    });

    it('trims leading/trailing and collapses multiple spaces', () => {
      expect(norm('   ঢাকা    মিরপুর   ')).toBe('ঢাকা মিরপুর');
    });
  });

  describe('editDistance', () => {
    it('calculates 0 for identical strings', () => {
      expect(editDistance('রহিম', 'রহিম')).toBe(0);
      expect(editDistance('sylhet', 'sylhet')).toBe(0);
    });

    it('calculates 1 for single insertion, deletion, or substitution', () => {
      expect(editDistance('sylhet', 'sylet')).toBe(1);
      expect(editDistance('karim', 'kareem')).toBe(2);
      expect(editDistance('rahim', 'rahin')).toBe(1);
    });
  });
});
