import type { Person, FieldDef } from '../types';
import { bn } from '../i18n/bn';
import { banglaDigitsToEnglish } from './normalizer';

/**
 * Returns formatted education summary (SPEC-UPDATE-1 section 2):
 * Returns the first two entries as "MBBS (ঢাকা মেডিকেল), এইচএসসি".
 * Cards, share text, and search use it.
 */
export function educationSummary(person: Person): string {
  if (person.educations && person.educations.length > 0) {
    const formatted = person.educations
      .slice(0, 2)
      .map((entry) => {
        const lvl = entry.level?.trim() || '';
        const inst = entry.institution?.trim();
        if (inst) {
          return `${lvl} (${inst})`;
        }
        return lvl;
      })
      .filter(Boolean);

    if (formatted.length > 0) {
      return formatted.join(', ');
    }
  }

  return person.education?.trim() || '';
}

export interface ShareSummaryOptions {
  includeBasic?: boolean;
  includeEducation?: boolean;
  selectedExtraFieldIds?: string[];
  fieldDefsMap?: Map<string, FieldDef>;
  redacted?: boolean;
  /** Granular redaction options (only applied when redacted=true) */
  redactCode?: boolean;      // hide code (default false for code, or true if user wants it hidden)
  redactName?: boolean;      // hide name & alias (default true)
  redactParents?: boolean;   // hide father & mother (default true)
  redactVillage?: boolean;   // hide village (default true)
  redactContact?: boolean;   // scrub phone/email/links in all values (default true)
}

export function redactSensitiveText(text: string): string {
  if (!text) return '';
  // 1. Normalize Bangla numerals to ASCII digits first
  let cleaned = banglaDigitsToEnglish(text);

  // 2. Redact email addresses
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '▇▇▇▇');

  // 3. Redact messaging & social links (wa.me, facebook.com, fb.com, t.me, telegram.me, instagram.com, instagr.am)
  cleaned = cleaned.replace(
    /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|facebook\.com|fb\.com|t\.me|telegram\.me|instagram\.com|instagr\.am)\/[^\s,।॥]+/gi,
    '▇▇▇▇'
  );

  // 4. Redact Bangladeshi mobile numbers with optional country code (+88 / 88 / +880) and separators (spaces, dashes, dots)
  // E.g.: 01712-345678, 0171 234 5678, +880 1712 345678, +88 01712 345678, 01712.345678, etc.
  const bdMobilePattern = /(?:\+?\(?88\)?[\s.-]*0?[\s.-]*|0)1[3-9](?:[\s.-]*\d){8}\b/g;
  cleaned = cleaned.replace(bdMobilePattern, '▇▇▇▇');

  // 5. Redact generic digit runs of 10+ digits with spaces, dashes, or dots without over-redacting
  // ages (e.g. 28), heights (e.g. 5'6", 5.6), years (e.g. 1998, 2024), or year ranges (e.g. 2018-2022)
  const genericPhonePattern = /\b(?:\+?\d[\d\s().-]{8,}\d)\b/g;
  cleaned = cleaned.replace(genericPhonePattern, (match) => {
    const digitCount = match.replace(/\D/g, '').length;
    return digitCount >= 10 ? '▇▇▇▇' : match;
  });

  return cleaned;
}

/**
 * Generates formatted Bangla biodata text for sharing (SPEC 5.10 & SPEC-UPDATE-1 3.7).
 * - Lists sections: মূল তথ্য, শিক্ষা, then each custom field individually.
 * - In redacted mode: applies granular field hiding based on redactName/redactParents/redactVillage/redactContact.
 * - Never includes: phoneLast4, memo, source, status.
 */
export function generateBiodataSummary(
  person: Person,
  options: ShareSummaryOptions = {}
): string {
  const {
    includeBasic = true,
    includeEducation = true,
    selectedExtraFieldIds = [],
    fieldDefsMap,
    redacted = false,
    redactCode = true,
    redactName = true,
    redactParents = true,
    redactVillage = true,
    redactContact = true,
  } = options;

  const lines: string[] = [];
  const genderLabel = bn.gender[person.gender];

  if (redacted) {
    if (!redactCode) {
      lines.push(`বায়োডাটা (${person.code}) - ${genderLabel}`);
    } else {
      lines.push(`বায়োডাটা - ${genderLabel}`);
    }
    lines.push('─────────────────────');

    if (includeBasic) {
      if (!redactCode) {
        lines.push(`${bn.fields.code}: ${person.code}`);
      }
      // Name & alias — omit entirely if redactName
      if (!redactName) {
        if (person.name) lines.push(`${bn.fields.name}: ${person.name}`);
        if (person.alias) lines.push(`${bn.fields.alias}: ${person.alias}`);
      }
      if (person.age) lines.push(`${bn.fields.age}: ${person.age} বছর`);
      if (person.height) lines.push(`${bn.fields.height}: ${person.height}`);
      if (person.profession) {
        const prof = redactContact ? redactSensitiveText(person.profession) : person.profession;
        // Only include if something remains after scrubbing
        if (prof.trim() && !/^▇+$/.test(prof.trim())) lines.push(`${bn.fields.profession}: ${prof}`);
      }
      // Parents — omit entirely if redactParents
      if (!redactParents) {
        if (person.father) lines.push(`${bn.fields.father}: ${person.father}`);
        if (person.mother) lines.push(`${bn.fields.mother}: ${person.mother}`);
      }
      if (person.district) {
        const dist = redactContact ? redactSensitiveText(person.district) : person.district;
        if (dist.trim() && !/^▇+$/.test(dist.trim())) lines.push(`${bn.fields.district}: ${dist}`);
      }
      if (person.upazila) {
        const up = redactContact ? redactSensitiveText(person.upazila) : person.upazila;
        if (up.trim() && !/^▇+$/.test(up.trim())) lines.push(`${bn.fields.upazila}: ${up}`);
      }
      if (person.postOffice) {
        const po = redactContact ? redactSensitiveText(person.postOffice) : person.postOffice;
        if (po.trim() && !/^▇+$/.test(po.trim())) lines.push(`${bn.fields.postOffice}: ${po}`);
      }
      // Village — omit entirely if redactVillage
      if (!redactVillage) {
        if (person.village) {
          const vill = redactContact ? redactSensitiveText(person.village) : person.village;
          if (vill.trim() && !/^▇+$/.test(vill.trim())) lines.push(`${bn.fields.village}: ${vill}`);
        }
      }
      if (person.tags && person.tags.length > 0) {
        const scrubbedTags = person.tags
          .map((t) => (redactContact ? redactSensitiveText(t) : t))
          .filter((t) => t.trim() && !/^▇+$/.test(t.trim()));
        if (scrubbedTags.length > 0) {
          lines.push(`${bn.fields.tags}: ${scrubbedTags.join(', ')}`);
        }
      }
    }
  } else {
    lines.push(`বায়োডাটা (${person.code}) - ${genderLabel}`);
    lines.push('─────────────────────');

    if (includeBasic) {
      if (person.name) lines.push(`${bn.fields.name}: ${person.name}`);
      if (person.alias) lines.push(`${bn.fields.alias}: ${person.alias}`);
      if (person.age) lines.push(`${bn.fields.age}: ${person.age} বছর`);
      if (person.height) lines.push(`${bn.fields.height}: ${person.height}`);
      if (person.profession) lines.push(`${bn.fields.profession}: ${person.profession}`);
      if (person.father) lines.push(`${bn.fields.father}: ${person.father}`);
      if (person.mother) lines.push(`${bn.fields.mother}: ${person.mother}`);
      if (person.district) lines.push(`${bn.fields.district}: ${person.district}`);
      if (person.upazila) lines.push(`${bn.fields.upazila}: ${person.upazila}`);
      if (person.postOffice) lines.push(`${bn.fields.postOffice}: ${person.postOffice}`);
      if (person.village) lines.push(`${bn.fields.village}: ${person.village}`);
      if (person.tags && person.tags.length > 0) {
        lines.push(`${bn.fields.tags}: ${person.tags.join(', ')}`);
      }
    }
  }

  if (includeEducation) {
    const edu = educationSummary(person);
    if (edu) {
      lines.push(`${bn.fields.education}: ${redacted && redactContact ? redactSensitiveText(edu) : edu}`);
    }
  }

  if (person.extra && selectedExtraFieldIds.length > 0) {
    for (const item of person.extra) {
      if (selectedExtraFieldIds.includes(item.fieldId) && item.value?.trim()) {
        const def = fieldDefsMap?.get(item.fieldId);
        const label = def?.label || 'অতিরিক্ত তথ্য';
        let val = item.value.trim();
        if (redacted && redactContact) {
          const isContactField =
            /নম্বর|যোগাযোগ|ফোন|মোবাইল|phone|contact|mobile/i.test(label) ||
            /নম্বর|যোগাযোগ|ফোন|মোবাইল/i.test(def?.normLabel || '');
          if (isContactField) {
            // Omit contact fields entirely — no placeholder
            continue;
          } else {
            val = redactSensitiveText(val);
            // If scrubbing removed everything meaningful, skip the line
            if (!val.replace(/▇+/g, '').trim()) continue;
          }
        }
        lines.push(`${label}: ${val}`);
      }
    }
  }

  return lines.join('\n');
}
