export const CARD_TEXT_FIELDS = [
  "title",
  "situation",
  "role",
  "action",
  "resultMetrics",
  "learned",
  "evidenceSentence",
  "claimable",
  "notClaimable",
  "tags",
] as const;

export type CardTextField = (typeof CARD_TEXT_FIELDS)[number];

export type MergeableImportCandidate = Record<CardTextField, string> & {
  sourceQuote: string;
  sourceQuoteVerified: boolean;
  needsReview: CardTextField[];
};

export type ExperienceIdentity = {
  project: string;
  role: string;
  period: string;
};

function normalize(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function uniqueValues(values: readonly string[]): string[] {
  const seen = new Set<string>();

  return values.flatMap((value) => {
    const trimmed = value.trim();
    const key = normalize(trimmed);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
}

function mergeText(values: readonly string[]): string {
  return uniqueValues(values).join("\n\n");
}

function mergeTags(values: readonly string[]): string {
  return uniqueValues(values.flatMap((value) => value.split(/[,，\n]/))).join(", ");
}

function contextFieldsWithMultipleValues<T extends MergeableImportCandidate>(
  candidates: readonly T[]
): CardTextField[] {
  return (["title", "situation", "role"] as const).filter((field) => {
    return uniqueValues(candidates.map((candidate) => candidate[field])).length > 1;
  });
}

export function mergeImportCandidates<T extends MergeableImportCandidate>(
  candidates: readonly T[]
): T {
  if (candidates.length === 0) {
    throw new Error("합칠 경험 후보가 필요합니다.");
  }

  const first = candidates[0];
  const needsReview = new Set<CardTextField>(
    candidates.flatMap((candidate) => candidate.needsReview)
  );
  contextFieldsWithMultipleValues(candidates).forEach((field) => needsReview.add(field));
  const sourceQuotes = uniqueValues(candidates.map((candidate) => candidate.sourceQuote));

  return {
    ...first,
    title: uniqueValues(candidates.map((candidate) => candidate.title)).join(" / "),
    situation: mergeText(candidates.map((candidate) => candidate.situation)),
    role: mergeText(candidates.map((candidate) => candidate.role)),
    action: mergeText(candidates.map((candidate) => candidate.action)),
    resultMetrics: mergeText(candidates.map((candidate) => candidate.resultMetrics)),
    learned: mergeText(candidates.map((candidate) => candidate.learned)),
    evidenceSentence: mergeText(candidates.map((candidate) => candidate.evidenceSentence)),
    claimable: mergeText(candidates.map((candidate) => candidate.claimable)),
    notClaimable: mergeText(candidates.map((candidate) => candidate.notClaimable)),
    tags: mergeTags(candidates.map((candidate) => candidate.tags)),
    sourceQuote: sourceQuotes.join("\n\n"),
    sourceQuoteVerified:
      sourceQuotes.length === 1 && candidates.every((candidate) => candidate.sourceQuoteVerified),
    needsReview: CARD_TEXT_FIELDS.filter((field) => needsReview.has(field)),
  };
}

function normalizeIdentity(identity: ExperienceIdentity): string {
  return JSON.stringify(
    [identity.project, identity.role, identity.period].map((part, index) => {
      const normalized = normalize(part);
      return index === 2
        ? normalized.replace(/\s*([~./:-])\s*/g, "$1")
        : normalized;
    })
  );
}

export function consolidateImportCandidates<
  T extends MergeableImportCandidate & { experienceIdentity: ExperienceIdentity },
>(candidates: readonly T[]): T[] {
  const grouped = new Map<string, T[]>();

  candidates.forEach((candidate) => {
    const key = normalizeIdentity(candidate.experienceIdentity);
    const group = grouped.get(key);
    if (group) group.push(candidate);
    else grouped.set(key, [candidate]);
  });

  return Array.from(grouped.values(), (group) => mergeImportCandidates(group));
}

export function finalizeImportCandidates<
  T extends MergeableImportCandidate & { experienceIdentity: ExperienceIdentity },
>(candidates: readonly T[]): Omit<T, "experienceIdentity">[] {
  return consolidateImportCandidates(candidates).map((candidate) => {
    const card = { ...candidate };
    Reflect.deleteProperty(card, "experienceIdentity");
    return card;
  });
}

export function mergeSelectedImportCandidates<
  T extends MergeableImportCandidate & { selected: boolean },
>(candidates: readonly T[]): { candidates: T[]; mergedCount: number } {
  const selected = candidates.filter((candidate) => candidate.selected);
  if (selected.length < 2) {
    return { candidates: [...candidates], mergedCount: 0 };
  }

  const firstSelected = candidates.findIndex((candidate) => candidate.selected);
  const merged = { ...mergeImportCandidates(selected), selected: true };

  return {
    candidates: candidates.flatMap((candidate, index) => {
      if (index === firstSelected) return [merged];
      return candidate.selected ? [] : [candidate];
    }),
    mergedCount: selected.length,
  };
}
