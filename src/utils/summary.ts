import type { Person, Partner } from '../types';
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

/**
 * Generates formatted Bangla biodata text for sharing (SPEC 5.10).
 */
export function generateBiodataSummary(person: Person, partner?: Partner): string {
  const lines: string[] = [];

  const genderLabel = bn.gender[person.gender];
  lines.push(`বায়োডাটা (${person.code}) - ${genderLabel}`);
  lines.push('─────────────────────');

  if (person.name) lines.push(`${bn.fields.name}: ${person.name}`);
  if (person.alias) lines.push(`${bn.fields.alias}: ${person.alias}`);
  if (person.age) lines.push(`${bn.fields.age}: ${person.age} বছর`);
  if (person.height) lines.push(`${bn.fields.height}: ${person.height}`);
  if (person.profession) lines.push(`${bn.fields.profession}: ${person.profession}`);
  const edu = educationSummary(person);
  if (edu) lines.push(`${bn.fields.education}: ${edu}`);
  if (person.father) lines.push(`${bn.fields.father}: ${person.father}`);
  if (person.mother) lines.push(`${bn.fields.mother}: ${person.mother}`);
  if (person.district) lines.push(`${bn.fields.district}: ${person.district}`);
  if (person.upazila) lines.push(`${bn.fields.upazila}: ${person.upazila}`);
  if (person.village) lines.push(`${bn.fields.village}: ${person.village}`);
  if (person.memo) lines.push(`${bn.fields.memo}: ${person.memo}`);

  if (person.tags && person.tags.length > 0) {
    lines.push(`${bn.fields.tags}: ${person.tags.join(', ')}`);
  }

  if (partner) {
    lines.push(`উৎস: ${partner.name}`);
  }

  return lines.join('\n');
}
