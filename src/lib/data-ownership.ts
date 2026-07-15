import { eq, isNull, sql } from "drizzle-orm";
import {
  applications,
  askbacks,
  authUsers,
  db,
  drafts,
  draftSentences,
  draftSentenceSources,
  experienceCards,
  interviewAnswerPoints,
  interviewQuestions,
  jobPostings,
  matches,
  requirements,
} from "@/db";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type OwnershipExecutor = typeof db | DbTransaction;

export type DomainDataCounts = {
  experienceCards: number;
  jobPostings: number;
  requirements: number;
  matches: number;
  drafts: number;
  draftSentences: number;
  draftSentenceSources: number;
  askbacks: number;
  interviewQuestions: number;
  interviewAnswerPoints: number;
  applications: number;
  total: number;
};

export type DataOwnershipReadiness = {
  ready: boolean;
  unclaimed: DomainDataCounts;
};

export type ClaimLegacyDataResult = DataOwnershipReadiness & {
  claimed: DomainDataCounts;
};

function withTotal(counts: Omit<DomainDataCounts, "total">): DomainDataCounts {
  return {
    ...counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
}

/**
 * Counts domain rows that have not yet been assigned to an authenticated user.
 * NULL-owned rows are never exposed by application queries, but deployment must
 * still fail closed until the operator has claimed all of them.
 */
export function getUnclaimedDomainDataCounts(
  executor: OwnershipExecutor = db
): DomainDataCounts {
  const count = sql<number>`count(*)`;

  return withTotal({
    experienceCards: Number(
      executor
        .select({ count })
        .from(experienceCards)
        .where(isNull(experienceCards.userId))
        .get()?.count ?? 0
    ),
    jobPostings: Number(
      executor
        .select({ count })
        .from(jobPostings)
        .where(isNull(jobPostings.userId))
        .get()?.count ?? 0
    ),
    requirements: Number(
      executor
        .select({ count })
        .from(requirements)
        .where(isNull(requirements.userId))
        .get()?.count ?? 0
    ),
    matches: Number(
      executor
        .select({ count })
        .from(matches)
        .where(isNull(matches.userId))
        .get()?.count ?? 0
    ),
    drafts: Number(
      executor
        .select({ count })
        .from(drafts)
        .where(isNull(drafts.userId))
        .get()?.count ?? 0
    ),
    draftSentences: Number(
      executor
        .select({ count })
        .from(draftSentences)
        .where(isNull(draftSentences.userId))
        .get()?.count ?? 0
    ),
    draftSentenceSources: Number(
      executor
        .select({ count })
        .from(draftSentenceSources)
        .where(isNull(draftSentenceSources.userId))
        .get()?.count ?? 0
    ),
    askbacks: Number(
      executor
        .select({ count })
        .from(askbacks)
        .where(isNull(askbacks.userId))
        .get()?.count ?? 0
    ),
    interviewQuestions: Number(
      executor
        .select({ count })
        .from(interviewQuestions)
        .where(isNull(interviewQuestions.userId))
        .get()?.count ?? 0
    ),
    interviewAnswerPoints: Number(
      executor
        .select({ count })
        .from(interviewAnswerPoints)
        .where(isNull(interviewAnswerPoints.userId))
        .get()?.count ?? 0
    ),
    applications: Number(
      executor
        .select({ count })
        .from(applications)
        .where(isNull(applications.userId))
        .get()?.count ?? 0
    ),
  });
}

export function getDataOwnershipReadiness(
  executor: OwnershipExecutor = db
): DataOwnershipReadiness {
  const unclaimed = getUnclaimedDomainDataCounts(executor);
  return { ready: unclaimed.total === 0, unclaimed };
}

export function hasUnclaimedDomainData(
  executor: OwnershipExecutor = db
): boolean {
  return !getDataOwnershipReadiness(executor).ready;
}

export function claimLegacyDataForOperator(
  userId: string
): ClaimLegacyDataResult;
export function claimLegacyDataForOperator(
  executor: OwnershipExecutor,
  userId: string
): ClaimLegacyDataResult;
export function claimLegacyDataForOperator(
  executorOrUserId: OwnershipExecutor | string,
  explicitUserId?: string
): ClaimLegacyDataResult {
  const executor =
    typeof executorOrUserId === "string" ? db : executorOrUserId;
  const userId =
    typeof executorOrUserId === "string" ? executorOrUserId : explicitUserId;

  if (!userId?.trim()) {
    throw new Error("기존 데이터를 귀속할 운영자 userId가 필요합니다.");
  }

  return executor.transaction((tx) => {
    const operator = tx
      .select({ id: authUsers.id, role: authUsers.role })
      .from(authUsers)
      .where(eq(authUsers.id, userId))
      .get();
    if (!operator) {
      throw new Error(`기존 데이터를 귀속할 사용자 ${userId}를 찾을 수 없습니다.`);
    }
    if (
      !operator.role
        ?.split(",")
        .some((role) => role.trim().toLowerCase() === "admin")
    ) {
      throw new Error("기존 데이터는 admin 운영자에게만 귀속할 수 있습니다.");
    }

    const claimed = withTotal({
      experienceCards: tx
        .update(experienceCards)
        .set({ userId })
        .where(isNull(experienceCards.userId))
        .run().changes,
      jobPostings: tx
        .update(jobPostings)
        .set({ userId })
        .where(isNull(jobPostings.userId))
        .run().changes,
      requirements: tx
        .update(requirements)
        .set({ userId })
        .where(isNull(requirements.userId))
        .run().changes,
      matches: tx
        .update(matches)
        .set({ userId })
        .where(isNull(matches.userId))
        .run().changes,
      askbacks: tx
        .update(askbacks)
        .set({ userId })
        .where(isNull(askbacks.userId))
        .run().changes,
      drafts: tx
        .update(drafts)
        .set({ userId })
        .where(isNull(drafts.userId))
        .run().changes,
      draftSentences: tx
        .update(draftSentences)
        .set({ userId })
        .where(isNull(draftSentences.userId))
        .run().changes,
      draftSentenceSources: tx
        .update(draftSentenceSources)
        .set({ userId })
        .where(isNull(draftSentenceSources.userId))
        .run().changes,
      interviewQuestions: tx
        .update(interviewQuestions)
        .set({ userId })
        .where(isNull(interviewQuestions.userId))
        .run().changes,
      interviewAnswerPoints: tx
        .update(interviewAnswerPoints)
        .set({ userId })
        .where(isNull(interviewAnswerPoints.userId))
        .run().changes,
      applications: tx
        .update(applications)
        .set({ userId })
        .where(isNull(applications.userId))
        .run().changes,
    });

    const { ready, unclaimed } = getDataOwnershipReadiness(tx);
    if (!ready) {
      throw new Error(
        `기존 데이터 귀속 후에도 user_id가 없는 행 ${unclaimed.total}개가 남았습니다.`
      );
    }

    return { claimed, ready, unclaimed };
  });
}
