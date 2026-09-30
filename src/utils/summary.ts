import type { Person, FieldDef } from '../types';
import { bn } from '../i18n/bn';

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
}

const SENSITIVE_PATTERNS = [
  // Bangladeshi mobile numbers: 013-019, with optional +88 / 88, English or Bangla digits
  /(?:\+?88\s*|৮৮\s*)?01[3-9]\d{8}/g,
  /(?:\+?88\s*|৮৮\s*)?০১[৩-৯][০-৯]{8}/g,
  // Generic 11 digit numbers
  /\b\d{11}\b/g,
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Links: wa.me, facebook.com, fb.com
  /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|facebook\.com|fb\.com)\/[^\s]+/gi,
];

export function redactSensitiveText(text: string): string {
  let cleaned = text;
  for (const regex of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(regex, '▇▇▇▇');
  }
  return cleaned;
}

/**
 * Generates formatted Bangla biodata text for sharing (SPEC 5.10 & SPEC-UPDATE-1 3.7).
 * - Lists sections: মূল তথ্য, শিক্ষা, then each custom field individually.
 * - In redacted mode: hides name, alias, parents, village, and redacts contact info/links.
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
  } = options;

  const lines: string[] = [];
  const genderLabel = bn.gender[person.gender];

  if (redacted) {
    lines.push(`বায়োডাটা কোড: ${person.code} (${genderLabel}) [রেডাক্টেড]`);
    lines.push('─────────────────────');

    if (includeBasic) {
      lines.push(`${bn.fields.code}: ${person.code}`);
      lines.push(`${bn.fields.name}: [গোপন]`);
      if (person.age) lines.push(`${bn.fields.age}: ${person.age} বছর`);
      if (person.height) lines.push(`${bn.fields.height}: ${person.height}`);
      if (person.profession) lines.push(`${bn.fields.profession}: ${redactSensitiveText(person.profession)}`);
      lines.push(`${bn.fields.father}: [গোপন]`);
      lines.push(`${bn.fields.mother}: [গোপন]`);
      if (person.district) lines.push(`${bn.fields.district}: ${person.district}`);
      if (person.upazila) lines.push(`${bn.fields.upazila}: ${person.upazila}`);
      lines.push(`${bn.fields.village}: [গোপন]`);
      if (person.tags && person.tags.length > 0) {
        lines.push(`${bn.fields.tags}: ${person.tags.join(', ')}`);
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
      lines.push(`${bn.fields.education}: ${redacted ? redactSensitiveText(edu) : edu}`);
    }
  }

  if (person.extra && selectedExtraFieldIds.length > 0) {
    for (const item of person.extra) {
      if (selectedExtraFieldIds.includes(item.fieldId) && item.value?.trim()) {
        const def = fieldDefsMap?.get(item.fieldId);
        const label = def?.label || 'অতিরিক্ত তথ্য';
        let val = item.value.trim();
        if (redacted) {
          if (
            /নম্বর|যোগাযোগ|ফোন|মোবাইল|phone|contact|mobile/i.test(label) ||
            /নম্বর|যোগাযোগ|ফোন|মোবাইল/i.test(def?.normLabel || '')
          ) {
            val = '[গোপন]';
          } else {
            val = redactSensitiveText(val);
          }
        }
        lines.push(`${label}: ${val}`);
      }
    }
  }

  return lines.join('\n');
}
