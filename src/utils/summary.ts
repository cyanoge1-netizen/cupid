import type { Person, Partner } from '../types';
import { bn } from '../i18n/bn';

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
  if (person.education) lines.push(`${bn.fields.education}: ${person.education}`);
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
