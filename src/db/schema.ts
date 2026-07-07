import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = () => new Date().toISOString();

// 경험 뱅크 — 이 앱의 원본 데이터. AI는 여기 있는 내용만 재구성할 수 있다.
export const experienceCards = sqliteTable("experience_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  situation: text("situation").notNull(),
  role: text("role").notNull(),
  action: text("action").notNull(),
  resultMetrics: text("result_metrics").notNull().default(""),
  learned: text("learned").notNull().default(""),
  evidenceSentence: text("evidence_sentence").notNull().default(""),
  claimable: text("claimable").notNull().default(""),
  notClaimable: text("not_claimable").notNull().default(""),
  tags: text("tags").notNull().default(""),
  // hard delete 금지 — 초안 문장들이 출처로 참조하므로 보관 처리만 한다
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export const jobPostings = sqliteTable("job_postings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default(""),
  company: text("company").notNull().default(""),
  source: text("source").notNull().default("manual"), // manual | wanted | ...
  url: text("url").notNull().default(""),
  rawText: text("raw_text").notNull(),
  // 파이프라인 상태만 담당. 지원 이후 결과는 applications가 단일 source of truth
  pipelineStatus: text("pipeline_status").notNull().default("new"), // new | reviewing | applied | skipped
  analysisStatus: text("analysis_status").notNull().default("pending"), // pending | running | done | error
  analysisError: text("analysis_error"),
  fitJson: text("fit_json"), // {tech, domain, collab, impact, overall}
  verdict: text("verdict"), // 판정 한 줄
  collectedAt: text("collected_at").notNull().$defaultFn(now),
});

export const requirements = sqliteTable("requirements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobPostingId: integer("job_posting_id")
    .notNull()
    .references(() => jobPostings.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // tech | domain | collab | impact
  text: text("text").notNull(),
});

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requirementId: integer("requirement_id")
    .notNull()
    .references(() => requirements.id, { onDelete: "cascade" }),
  cardId: integer("card_id")
    .notNull()
    .references(() => experienceCards.id),
  strength: text("strength").notNull(), // strong | medium | weak
  rationale: text("rationale").notNull().default(""),
});

export const drafts = sqliteTable("drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobPostingId: integer("job_posting_id")
    .notNull()
    .references(() => jobPostings.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // intro | resume_points
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const draftSentences = sqliteTable(
  "draft_sentences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    draftId: integer("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    orderIdx: integer("order_idx").notNull().default(0),
    text: text("text").notNull(),
    type: text("type").notNull(), // ai | user | placeholder
    warning: text("warning"), // weak_evidence | over_claim | null
    primarySourceCardId: integer("primary_source_card_id").references(
      () => experienceCards.id
    ),
    askbackId: integer("askback_id"), // placeholder일 때 연결된 되묻기
    edited: integer("edited", { mode: "boolean" }).notNull().default(false),
    // 출처 카드가 나중에 수정되면 표시 → 다음 열람 시 재검증 대상
    sourceChanged: integer("source_changed", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    // 핵심 원칙의 스키마 레벨 강제: AI 생성 문장은 출처 카드 없이 저장될 수 없다
    check(
      "ai_sentence_requires_source",
      sql`${t.type} != 'ai' OR ${t.primarySourceCardId} IS NOT NULL`
    ),
  ]
);

// 한 문장이 카드 2개 이상을 근거로 할 때의 추가 출처
export const draftSentenceSources = sqliteTable("draft_sentence_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sentenceId: integer("sentence_id")
    .notNull()
    .references(() => draftSentences.id, { onDelete: "cascade" }),
  cardId: integer("card_id")
    .notNull()
    .references(() => experienceCards.id),
});

export const askbacks = sqliteTable("askbacks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobPostingId: integer("job_posting_id")
    .notNull()
    .references(() => jobPostings.id, { onDelete: "cascade" }),
  requirementId: integer("requirement_id").references(() => requirements.id, {
    onDelete: "set null",
  }),
  question: text("question").notNull(),
  why: text("why").notNull().default(""),
  answer: text("answer"),
  resultCardId: integer("result_card_id").references(() => experienceCards.id),
  resultType: text("result_type"), // new_card | card_update
  status: text("status").notNull().default("open"), // open | answered | dismissed
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const interviewQuestions = sqliteTable("interview_questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobPostingId: integer("job_posting_id")
    .notNull()
    .references(() => jobPostings.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  qtype: text("qtype").notNull(), // posting | weakness
  orderIdx: integer("order_idx").notNull().default(0),
});

export const interviewAnswerPoints = sqliteTable(
  "interview_answer_points",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questionId: integer("question_id")
      .notNull()
      .references(() => interviewQuestions.id, { onDelete: "cascade" }),
    orderIdx: integer("order_idx").notNull().default(0),
    text: text("text").notNull(),
    type: text("type").notNull(), // ai | user | placeholder("준비 필요")
    primarySourceCardId: integer("primary_source_card_id").references(
      () => experienceCards.id
    ),
  },
  (t) => [
    // 면접 답변 bullet에도 동일한 출처 규칙 적용
    check(
      "ai_answer_requires_source",
      sql`${t.type} != 'ai' OR ${t.primarySourceCardId} IS NOT NULL`
    ),
  ]
);

// 지원 이후 결과의 단일 source of truth
export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobPostingId: integer("job_posting_id")
    .notNull()
    .references(() => jobPostings.id, { onDelete: "cascade" }),
  appliedAt: text("applied_at").notNull().$defaultFn(now),
  result: text("result").notNull().default("pending"), // pending | docs_pass | interview | final_pass | rejected
  notes: text("notes").notNull().default(""),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});
