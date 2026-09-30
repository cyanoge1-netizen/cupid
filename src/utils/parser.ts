import { banglaDigitsToEnglish } from './normalizer';

export interface ParserLeftover {
  label: string;
  value: string;
}

export interface ParsedBiodata {
  name?: string;
  father?: string;
  mother?: string;
  district?: string;
  upazila?: string;
  village?: string;
  age?: number;
  height?: string;
  education?: string;
  profession?: string;
  phoneLast4?: string;
  rawText: string;
  leftovers?: ParserLeftover[];
}

/**
 * Splits education text containing multiple degrees (separated by commas, semicolons, or newlines)
 * into distinct degree strings (SPEC-UPDATE-1 3.5).
 */
export function splitEducationText(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[,;\n\r،]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Ordered label patterns: more specific labels first
const LABEL_RULES: Array<{
  field: keyof Omit<ParsedBiodata, 'age' | 'rawText' | 'phoneLast4'> | 'age' | 'phone';
  labels: string[];
}> = [
  { field: 'father', labels: ['পিতার নাম', 'বাবার নাম', "father's name", 'father name', 'father'] },
  { field: 'mother', labels: ['মাতার নাম', 'মায়ের নাম', "mother's name", 'mother name', 'mother'] },
  { field: 'education', labels: ['শিক্ষাগত যোগ্যতা', 'শিক্ষা', 'qualification', 'educational qualification', 'education'] },
  { field: 'profession', labels: ['পেশা', 'occupation', 'profession', 'job'] },
  { field: 'upazila', labels: ['উপজেলা', 'থানা', 'upazila', 'thana', 'police station'] },
  { field: 'district', labels: ['জেলা', 'district'] },
  { field: 'village', labels: ['গ্রাম', 'ঠিকানা', 'village', 'address'] },
  { field: 'height', labels: ['উচ্চতা', 'height'] },
  { field: 'age', labels: ['বয়স', 'age'] },
  { field: 'phone', labels: ['মোবাইল', 'ফোন', 'ফোন নম্বর', 'মোবাইল নম্বর', 'phone', 'mobile', 'contact'] },
  { field: 'name', labels: ['নাম', 'name'] },
];

/**
 * Deterministic label-based parser (no AI calls) according to SPEC.md section 5.6.
 */
export function parseBiodataText(rawInput: string): ParsedBiodata {
  const result: ParsedBiodata = {
    rawText: rawInput,
    leftovers: [],
  };

  if (!rawInput || !rawInput.trim()) {
    return result;
  }

  // Pre-process lines: normalize unicode and zero-width chars
  const cleanInput = rawInput
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');

  const lines = cleanInput.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Convert Bangla digits to English for uniform parsing
    const normalizedLine = banglaDigitsToEnglish(line);

    // Look for separator: ':', '-', '–' (\u2013), '—' (\u2014), '='
    const sepMatch = normalizedLine.match(/^([^:\-–—=]+)[:\-–—=]\s*(.*)$/);
    if (!sepMatch) {
      continue;
    }

    // Get original Bangla label from line
    const rawSepMatch = line.match(/^([^:\-–—=]+)[:\-–—=]\s*(.*)$/);
    const rawLabel = rawSepMatch ? rawSepMatch[1].trim() : sepMatch[1].trim();
    // Strip leading numbering or bullet symbols (e.g. "১. ", "1. ", "* ", "- ")
    const cleanLabel = rawLabel.replace(/^[\d\s.\-•*০-৯]+/, '').trim() || rawLabel;

    const potentialLabel = cleanLabel.toLowerCase();
    const rawVal = sepMatch[2].trim();
    if (!rawVal) continue;

    let matchedRule = false;

    // Check against label rules
    for (const rule of LABEL_RULES) {
      const isMatch = rule.labels.some((l) => {
        const lowerLabel = l.toLowerCase();
        if (potentialLabel === lowerLabel) return true;
        // Allow common candidate prefixes like 'পাত্রের ', 'পাত্রীর ', 'প্রার্থীর ', 'বর্তমান ', 'full '
        if (
          potentialLabel === `পাত্রের ${lowerLabel}` ||
          potentialLabel === `পাত্রীর ${lowerLabel}` ||
          potentialLabel === `প্রার্থীর ${lowerLabel}` ||
          potentialLabel === `বর্তমান ${lowerLabel}` ||
          potentialLabel === `full ${lowerLabel}` ||
          potentialLabel === `candidate ${lowerLabel}`
        ) {
          return true;
        }
        return false;
      });

      if (isMatch) {
        matchedRule = true;
        if (rule.field === 'age') {
          if (!result.age) {
            const ageDigits = banglaDigitsToEnglish(rawVal).match(/\d+/);
            if (ageDigits) {
              const num = parseInt(ageDigits[0], 10);
              if (num > 0 && num < 120) {
                result.age = num;
              }
            }
          }
        } else if (rule.field === 'phone') {
          if (!result.phoneLast4) {
            const digits = banglaDigitsToEnglish(rawVal).replace(/\D/g, '');
            if (digits.length >= 4) {
              result.phoneLast4 = digits.slice(-4);
            }
          }
        } else {
          const currentField = rule.field as keyof Omit<ParsedBiodata, 'age' | 'rawText' | 'phoneLast4' | 'leftovers'>;
          if (!result[currentField]) {
            result[currentField] = rawVal;
          }
        }
        break; // Matched a rule for this line
      }
    }

    if (!matchedRule) {
      result.leftovers!.push({
        label: cleanLabel,
        value: rawSepMatch ? rawSepMatch[2].trim() : rawVal,
      });
    }
  }

  // If phoneLast4 was not found by label, check for any 11-digit Bangladeshi phone number anywhere in the text
  if (!result.phoneLast4) {
    const engText = banglaDigitsToEnglish(cleanInput);
    const phoneMatch = engText.match(/(?:\+?88\s*[-]?\s*)?01[3-9][0-9\s-]{7,11}\d/);
    if (phoneMatch) {
      const cleanDigits = phoneMatch[0].replace(/\D/g, '');
      if (cleanDigits.length >= 10) {
        result.phoneLast4 = cleanDigits.slice(-4);
      }
    }
  }

  return result;
}
