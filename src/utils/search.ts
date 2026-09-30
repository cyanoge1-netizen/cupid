import type { Person, Partner, Gender, Status } from '../types';
import { norm, editDistance } from './normalizer';

export interface SearchFilters {
  status?: Status | 'all';
  gender?: Gender | 'all';
  sourceId?: string | null | 'all'; // 'all', null (own), or partner.id
  district?: string | 'all';
}

export interface SearchResult {
  person: Person;
  score: number;
  isNearMatch?: boolean;
}

const STATUS_LABELS: Record<Status, string> = {
  active: 'সক্রিয় active',
  proposal: 'প্রস্তাব proposal',
  fixed: 'নির্ধারিত fixed',
  married: 'বিবাহিত married',
  hold: 'হোল্ড hold',
};

/**
 * Builds the searchable normalized text string and word list for a person record.
 */
export function buildRecordSearchIndex(
  person: Person,
  partnersMap?: Map<string, Partner>
): { joinedText: string; words: string[] } {
  const partnerName = person.sourceId && partnersMap?.get(person.sourceId)?.name;
  const sourceText = partnerName || 'নিজের own';
  const statusText = STATUS_LABELS[person.status] || '';

  // Education entries (SPEC-UPDATE-1 3.6: all education entry fields)
  const educationPieces: string[] = [];
  if (person.educations) {
    for (const edu of person.educations) {
      if (edu.level) educationPieces.push(edu.level);
      if (edu.subject) educationPieces.push(edu.subject);
      if (edu.institution) educationPieces.push(edu.institution);
      if (edu.result) educationPieces.push(edu.result);
      if (edu.year) educationPieces.push(edu.year);
      if (edu.note) educationPieces.push(edu.note);
    }
  }

  // Custom values (SPEC-UPDATE-1 3.6: index custom values, but DO NOT index field labels)
  const customValues: string[] = [];
  if (person.extra) {
    for (const item of person.extra) {
      if (item.value) customValues.push(item.value);
    }
  }

  // Document labels (SPEC-UPDATE-1 3.6)
  const docLabels: string[] = [];
  if (person.docs) {
    for (const doc of person.docs) {
      if (doc.label) docLabels.push(doc.label);
      if (doc.name) docLabels.push(doc.name);
    }
  }

  const rawPieces = [
    person.code,
    person.name,
    person.alias,
    person.father,
    person.mother,
    person.village,
    person.postOffice,
    person.upazila,
    person.district,
    person.profession,
    person.education,
    ...educationPieces,
    ...customValues,
    ...docLabels,
    person.memo,
    person.phoneLast4,
    person.phone,
    ...(person.tags || []),
    sourceText,
    statusText,
  ];

  const joinedText = norm(rawPieces.filter(Boolean).join(' '));
  const words = joinedText.split(' ').filter(Boolean);

  return { joinedText, words };
}

/**
 * Executes in-memory search against people records following SPEC.md section 5.9.
 */
export function searchPeople(
  query: string,
  people: Person[],
  filters: SearchFilters = {},
  partnersMap?: Map<string, Partner>
): SearchResult[] {
  // 1. Apply strict filters first
  const filtered = people.filter((p) => {
    // Only search non-deleted people
    if (p.deletedAt) return false;

    // Filter by status
    if (filters.status && filters.status !== 'all') {
      if (p.status !== filters.status) return false;
    }

    // Filter by gender
    if (filters.gender && filters.gender !== 'all') {
      if (p.gender !== filters.gender) return false;
    }

    // Filter by source
    if (filters.sourceId !== undefined && filters.sourceId !== 'all') {
      if (p.sourceId !== filters.sourceId) return false;
    }

    // Filter by district
    if (filters.district && filters.district !== 'all') {
      if (!p.district || norm(p.district) !== norm(filters.district)) return false;
    }

    return true;
  });

  const rawQuery = query.trim();
  const normalizedQuery = norm(rawQuery);

  // If query is empty, return filtered list ranked by status & updatedAt
  if (!normalizedQuery) {
    return filtered
      .map((person) => {
        let score = 0;
        if (person.status === 'married') score -= 1;
        return { person, score };
      })
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return b.person.updatedAt - a.person.updatedAt;
      });
  }

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  // Precompute search index for each candidate
  const indexedList = filtered.map((p) => ({
    person: p,
    index: buildRecordSearchIndex(p, partnersMap),
  }));

  function executeSearch(queryTokens: string[], isNearMatch = false): SearchResult[] {
    const results: SearchResult[] = [];

    for (const item of indexedList) {
      const { joinedText, words } = item.index;
      let recordScore = 0;
      let allMatched = true;

      for (const token of queryTokens) {
        let tokenScore = 0;

        // Substring match (+2)
        if (joinedText.includes(token)) {
          tokenScore = 2;
        } else if (token.length >= 3) {
          // Edit distance <= 1 on any word (+1)
          const hasTypoMatch = words.some((w) => editDistance(token, w) <= 1);
          if (hasTypoMatch) {
            tokenScore = 1;
          }
        }

        if (tokenScore === 0) {
          allMatched = false;
          break;
        } else {
          recordScore += tokenScore;
        }
      }

      if (allMatched) {
        if (item.person.status === 'married') {
          recordScore -= 1;
        }
        results.push({
          person: item.person,
          score: recordScore,
          isNearMatch,
        });
      }
    }

    results.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.person.updatedAt - a.person.updatedAt;
    });

    return results;
  }

  // First attempt: all tokens
  const directMatches = executeSearch(tokens, false);
  if (directMatches.length > 0 || tokens.length <= 1) {
    return directMatches;
  }

  // Fallback: Drop the last token and retry once
  const fallbackTokens = tokens.slice(0, -1);
  return executeSearch(fallbackTokens, true);
}
