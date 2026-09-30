/**
 * Converts Bangla numerals to ASCII English digits.
 */
export function banglaDigitsToEnglish(str: string): string {
  if (!str) return '';
  const bMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return str.replace(/[০-৯]/g, (ch) => bMap[ch] || ch);
}

/**
 * Normalisation norm(s) as defined in SPEC.md section 5.9:
 * NFC, remove zero-width chars, Bangla digits to English, punctuation to spaces, lowercase, trim.
 */
export function norm(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .normalize('NFC')
    // Remove zero-width characters (ZWSP, ZWNJ, ZWJ, BOM)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Convert Bangla digits to English
    .replace(/[০-৯]/g, (ch) => {
      const bMap: Record<string, string> = {
        '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
        '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
      };
      return bMap[ch] || ch;
    })
    // Punctuation to spaces (including Bangla danda । and double danda ॥)
    .replace(/[.,/#!$%^&*;:{}=\-_`~()।॥?<>'"@+[\]\\/|]/g, ' ')
    .toLowerCase()
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Levenshtein edit distance between two strings.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
    }
    prev = [...curr];
  }
  return prev[n];
}
