function lev(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

function isSubsequence(q: string, s: string): boolean {
  let i = 0;
  for (const c of s) if (c === q[i]) i++;
  return i === q.length;
}

function termScore(term: string, word: string): number {
  if (word === term) return 4;
  if (word.startsWith(term)) return 3;
  if (word.includes(term)) return 2;
  if (term.length >= 4 && lev(term, word.slice(0, term.length + 1)) <= 1) return 1.5;
  if (term.length >= 6 && lev(term, word) <= 2) return 1.2;
  if (term.length >= 3 && isSubsequence(term, word)) return 0.8;
  return 0;
}

/** Fuzzy score of `query` against haystack fields; 0 means no match. Every query term must match. */
export function fuzzyScore(query: string, fields: string[]): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const words = fields
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let total = 0;
  for (const t of terms) {
    let best = 0;
    for (const w of words) best = Math.max(best, termScore(t, w));
    if (best === 0) return 0;
    total += best;
  }
  return total;
}
