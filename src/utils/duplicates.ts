import type { Person, Partner } from '../types';
import { norm, editDistance } from './normalizer';

export interface DuplicateMatch {
  person: Person;
  partnerName?: string;
  score: number;
  matchedFields: string[];
}

export interface CandidatePerson {
  name?: string;
  father?: string;
  district?: string;
  village?: string;
  phoneLast4?: string;
}

/**
 * Duplicate detection algorithm from SPEC.md section 5.7:
 * - +3 same normalised father name
 * - +2 same normalised name (or edit distance <= 1)
 * - +2 same phoneLast4
 * - +1 same district or village
 *
 * Warn when score >= 4.
 */
export function checkDuplicates(
  candidate: CandidatePerson,
  existingPeople: Person[],
  partnersMap?: Map<string, Partner>
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  const cFather = norm(candidate.father);
  const cName = norm(candidate.name);
  const cPhone = candidate.phoneLast4?.trim();
  const cDistrict = norm(candidate.district);
  const cVillage = norm(candidate.village);

  // If candidate has no identifiable fields, no duplicate check possible
  if (!cFather && !cName && !cPhone && !cDistrict && !cVillage) {
    return matches;
  }

  for (const person of existingPeople) {
    // Only check against non-deleted people
    if (person.deletedAt) continue;

    let score = 0;
    const matchedFields: string[] = [];

    // 1. Father name (+3)
    const pFather = norm(person.father);
    if (cFather && pFather && cFather === pFather) {
      score += 3;
      matchedFields.push('পিতার নাম');
    }

    // 2. Name (+2): exact match or edit distance <= 1
    const pName = norm(person.name);
    if (cName && pName) {
      if (cName === pName || (cName.length >= 3 && pName.length >= 3 && editDistance(cName, pName) <= 1)) {
        score += 2;
        matchedFields.push('নাম');
      }
    }

    // 3. Phone last 4 digits (+2)
    if (cPhone && person.phoneLast4 && cPhone.length === 4 && person.phoneLast4.length === 4) {
      if (cPhone === person.phoneLast4) {
        score += 2;
        matchedFields.push('মোবাইল নম্বর');
      }
    }

    // 4. District or Village (+1)
    const pDistrict = norm(person.district);
    const pVillage = norm(person.village);
    let locationMatched = false;

    if (cDistrict && pDistrict && cDistrict === pDistrict) {
      locationMatched = true;
      matchedFields.push('জেলা');
    }
    if (cVillage && pVillage && cVillage === pVillage) {
      locationMatched = true;
      matchedFields.push('গ্রাম');
    }
    if (locationMatched) {
      score += 1;
    }

    if (score >= 4) {
      const partner = person.sourceId && partnersMap ? partnersMap.get(person.sourceId) : undefined;
      matches.push({
        person,
        partnerName: partner?.name,
        score,
        matchedFields,
      });
    }
  }

  // Sort by highest score first
  matches.sort((a, b) => b.score - a.score);
  return matches;
}
