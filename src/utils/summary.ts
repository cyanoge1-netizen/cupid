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
}

/**
 * Generates formatted Bangla biodata text for sharing (SPEC 5.10 & SPEC-UPDATE-1 3.7).
 * - Lists sections: মূল তথ্য, শিক্ষা, then each custom field individually.
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
  } = options;

  const lines: string[] = [];

  const genderLabel = bn.gender[person.gender];
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

  if (includeEducation) {
    const edu = educationSummary(person);
    if (edu) lines.push(`${bn.fields.education}: ${edu}`);
  }

  if (person.extra && selectedExtraFieldIds.length > 0) {
    for (const item of person.extra) {
      if (selectedExtraFieldIds.includes(item.fieldId) && item.value?.trim()) {
        const label = fieldDefsMap?.get(item.fieldId)?.label || 'অতিরিক্ত তথ্য';
        lines.push(`${label}: ${item.value.trim()}`);
      }
    }
  }

  return lines.join('\n');
}
