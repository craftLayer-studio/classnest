export interface Score {
  studentId: string;
  score: number;
}

export function validateScore(score: number, maxMarks: number): string | null {
  if (!Number.isFinite(score)) return "Score must be a number";
  if (score < 0) return "Score cannot be negative";
  if (score > maxMarks) return `Score cannot be more than ${maxMarks}`;
  if (Math.round(score * 2) !== score * 2) return "Use whole or half marks";
  return null;
}

/** Standard competition ranking: equal scores share a rank, the next rank skips (1, 2, 2, 4). */
export function rankScores(scores: Score[]): (Score & { rank: number })[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score || a.studentId.localeCompare(b.studentId));
  let rank = 0;
  return sorted.map((s, i) => {
    if (i === 0 || s.score !== sorted[i - 1].score) rank = i + 1;
    return { ...s, rank };
  });
}

export function percent(score: number, maxMarks: number): number {
  return maxMarks > 0 ? Math.round((score * 1000) / maxMarks) / 10 : 0;
}

/** Simple grade bands for the report card. */
export function grade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 75) return "A";
  if (pct >= 60) return "B";
  if (pct >= 45) return "C";
  if (pct >= 33) return "D";
  return "Needs support";
}

export function classAverage(scores: Score[]): number | null {
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((s, x) => s + x.score, 0) * 10) / scores.length) / 10;
}

/** Trend between the two most recent percentages. */
export function trend(pcts: number[]): "up" | "down" | "flat" | null {
  if (pcts.length < 2) return null;
  const d = pcts[pcts.length - 1] - pcts[pcts.length - 2];
  if (Math.abs(d) < 2) return "flat";
  return d > 0 ? "up" : "down";
}
