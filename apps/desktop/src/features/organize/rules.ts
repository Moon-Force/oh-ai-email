export type Split = "important" | "other";
export type Rule = { domain?: string; keyword?: string; split: Split };

export function classify(from: string, subject: string, rules: Rule[]): Split {
  const lowerFrom = from.toLowerCase();
  const lowerSub = subject.toLowerCase();
  for (const r of rules) {
    if (r.domain && lowerFrom.includes(r.domain.toLowerCase())) return r.split;
    if (
      r.keyword &&
      (lowerFrom.includes(r.keyword.toLowerCase()) || lowerSub.includes(r.keyword.toLowerCase()))
    )
      return r.split;
  }
  return "other";
}
