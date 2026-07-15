import assert from "node:assert/strict";
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
} from "../src/db";
import {
  claimLegacyDataForOperator,
  hasUnclaimedDomainData,
} from "../src/lib/data-ownership";

const operatorId = "legacy-operator";
const now = new Date();

db.insert(authUsers)
  .values({
    id: operatorId,
    name: "Legacy Operator",
    email: "legacy-operator@example.com",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    role: "admin",
  })
  .run();

assert.equal(hasUnclaimedDomainData(), true);
const result = claimLegacyDataForOperator(operatorId);
assert.equal(result.ready, true);
assert.equal(result.unclaimed.total, 0);
assert.deepEqual(
  {
    experienceCards: result.claimed.experienceCards,
    jobPostings: result.claimed.jobPostings,
    requirements: result.claimed.requirements,
    matches: result.claimed.matches,
    askbacks: result.claimed.askbacks,
    drafts: result.claimed.drafts,
    draftSentences: result.claimed.draftSentences,
    draftSentenceSources: result.claimed.draftSentenceSources,
    interviewQuestions: result.claimed.interviewQuestions,
    interviewAnswerPoints: result.claimed.interviewAnswerPoints,
    applications: result.claimed.applications,
  },
  {
    experienceCards: 1,
    jobPostings: 1,
    requirements: 1,
    matches: 1,
    askbacks: 1,
    drafts: 1,
    draftSentences: 1,
    draftSentenceSources: 1,
    interviewQuestions: 1,
    interviewAnswerPoints: 1,
    applications: 1,
  }
);

for (const rows of [
  db.select().from(experienceCards).all(),
  db.select().from(jobPostings).all(),
  db.select().from(requirements).all(),
  db.select().from(matches).all(),
  db.select().from(askbacks).all(),
  db.select().from(drafts).all(),
  db.select().from(draftSentences).all(),
  db.select().from(draftSentenceSources).all(),
  db.select().from(interviewQuestions).all(),
  db.select().from(interviewAnswerPoints).all(),
  db.select().from(applications).all(),
]) {
  assert.ok(rows.every((row) => row.userId === operatorId));
}

const placeholder = db.select().from(draftSentences).get();
const askback = db.select().from(askbacks).get();
assert.equal(placeholder?.type, "placeholder");
assert.equal(placeholder?.askbackId, askback?.id);
assert.equal(hasUnclaimedDomainData(), false);

console.log("data-ownership-smoke-ok");
