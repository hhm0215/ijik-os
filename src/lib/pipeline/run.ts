import { eq } from "drizzle-orm";
import {
  askbacks,
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
import { generateStructured } from "@/lib/llm";
import {
  analysisSchema,
  extractionSchema,
  postingInterviewSchema,
  verificationSchema,
  weaknessInterviewSchema,
  type Analysis,
  type Interview,
} from "./schemas";

type Card = typeof experienceCards.$inferSelect;

function serializeCards(cards: Card[]): string {
  return cards
    .map(
      (c) => `[카드 #${c.id}] ${c.title}
- 상황: ${c.situation}
- 내 역할: ${c.role}
- 행동: ${c.action}
- 결과 수치: ${c.resultMetrics || "(없음)"}
- 배운 점: ${c.learned || "(없음)"}
- 증거 문장: ${c.evidenceSentence || "(없음)"}
- 주장해도 되는 것: ${c.claimable || "(없음)"}
- 주장하면 안 되는 것: ${c.notClaimable || "(없음)"}
- 태그: ${c.tags || "(없음)"}`
    )
    .join("\n\n");
}

const AUTHORSHIP_RULE = `절대 원칙: 너는 작가가 아니라 편집자다. 사용자의 경험 카드에 명시된 내용만 재구성할 수 있다.
- 카드에 없는 경험, 수치, 기술, 성과를 창작하거나 부풀리지 마라.
- 각 문장은 반드시 근거가 되는 카드 ID를 명시해야 한다.
- 카드의 "주장해도 되는 것" 범위를 넘는 주장을 만들지 마라. "주장하면 안 되는 것"은 절대 쓰지 마라.
- 근거 카드가 없는 요구사항에는 문장을 만들지 말고, 대신 되묻기 질문을 만들어라.`;

export async function runPipeline(postingId: number): Promise<void> {
  const posting = db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.id, postingId))
    .get();
  if (!posting) throw new Error(`공고 #${postingId}를 찾을 수 없습니다`);

  db.update(jobPostings)
    .set({ analysisStatus: "running", analysisError: null })
    .where(eq(jobPostings.id, postingId))
    .run();

  try {
    const cards = db
      .select()
      .from(experienceCards)
      .where(eq(experienceCards.archived, false))
      .all();
    if (cards.length === 0)
      throw new Error("경험 카드가 없습니다. 먼저 경험 뱅크에 카드를 추가하세요.");

    // 1) 공고에서 요구사항 추출
    const extraction = await generateStructured({
      schema: extractionSchema,
      maxTokens: 8000,
      system:
        "채용 공고 분석가. 공고 원문에서 제목, 회사명, 그리고 지원자에게 요구되는 사항을 추출한다. 요구사항은 기술(tech), 도메인 지식(domain), 협업/리딩(collab), 성과/임팩트(impact)로 분류한다. 중복 없이 핵심 요구사항 4~10개로 정리. 모든 텍스트는 한국어로.",
      user: `공고 원문:\n\n${posting.rawText}`,
    });

    db.update(jobPostings)
      .set({ title: extraction.title, company: extraction.company })
      .where(eq(jobPostings.id, postingId))
      .run();

    // 요구사항은 아직 DB에 넣지 않는다 — 저장은 persist에서 기존 결과 삭제와
    // 한 트랜잭션으로 처리 (재분석 시 중복 누적 방지 + 실패 시 이전 결과 보존)
    const reqDefs = extraction.requirements;

    // 2) 매칭 + 적합도 + 초안 + 되묻기 (경험 카드 기반)
    const reqList = reqDefs
      .map((r, i) => `${i}. [${r.category}] ${r.text}`)
      .join("\n");
    const analysis = await generateStructured({
      schema: analysisSchema,
      maxTokens: 16000,
      system: `지원 전략 조수. 사용자의 경험 카드와 채용 공고 요구사항을 비교 분석한다. 모든 출력은 한국어.

${AUTHORSHIP_RULE}

작업:
1. matches: 각 요구사항(requirementIndex)에 근거가 되는 카드를 연결. 근거 강도는 strong(직접 경험)/medium(유사 경험)/weak(간접·부분 경험). 근거 없는 요구사항은 matches에 넣지 않는다.
2. fit: 카테고리별 0~100 점수와 overall(단순 평균). 채점 규칙 — strong 근거 위주면 80~100, medium 위주면 50~79, weak뿐이면 20~49, 근거 없으면 0~19. 단, 요구사항이 어떤 카드의 "주장하면 안 되는 것"에 해당하면 그 요구사항은 근거 없음으로 취급하고 해당 카테고리를 감점한다 (예: 공고가 결제 도메인을 요구하는데 카드가 결제 경험 주장을 금지하면 domain은 49를 넘을 수 없다).
3. verdict: "지원 가치 있음 — 단, X 보강 필요" 같은 판정 한 줄.
4. introDraft: 지원 동기/자기소개 초안. 문장 단위로, 각 문장에 primaryCardId(필수)와 additionalCardIds. strong/medium 근거만 문장 생성, weak 근거 문장은 weakEvidence=true. 근거 없는 요구사항은 문장을 만들지 않는다. 사용자의 "증거 문장" 말투를 살려서.
5. resumePoints: 이 공고에 맞춰 이력서에서 강조할 bullet 후보. 각각 primaryCardId 필수.
6. askbacks: 근거가 없거나 약한 요구사항마다 사용자에게 되물을 질문. why에는 어떤 요구사항 때문인지. requirementIndex 연결(일반 질문이면 null).`,
      user: `## 채용 공고: ${extraction.title} (${extraction.company})

## 요구사항 목록
${reqList}

## 내 경험 카드
${serializeCards(cards)}`,
    });

    // LLM이 존재하지 않는 카드 ID를 만들어냈을 가능성 차단
    const validCardIds = new Set(cards.map((c) => c.id));
    const sane = sanitize(analysis, validCardIds, reqDefs.length);

    // 3) 면접 질문 — posting/weakness를 분리한다. 로컬 8B 모델은 한 호출에서
    // weakness 3개를 함께 요구하면 간헐적으로 생략하므로, 각각 스키마로 개수를 강제한다.
    const matchSummary = reqDefs
      .map((r, i) => {
        const ms = sane.matches.filter((m) => m.requirementIndex === i);
        const evidence = ms.length
          ? ms.map((m) => `카드 #${m.cardId}(${m.strength})`).join(", ")
          : "근거 없음";
        return `${i}. [${r.category}] ${r.text} — 근거: ${evidence}`;
      })
      .join("\n");
    const interviewContext = `## 채용 공고: ${extraction.title} (${extraction.company})

## 요구사항과 근거 현황
${matchSummary}

## 내 경험 카드
${serializeCards(cards)}`;

    const postingInterview = await generateStructured({
      schema: postingInterviewSchema,
      maxTokens: 8000,
      system: `면접 준비 조수. 채용 공고와 지원자의 경험 카드를 바탕으로 공고 기반 예상 면접 질문과 답변 포인트를 만든다. 모든 출력은 한국어.

${AUTHORSHIP_RULE}

작업:
1. 공고 기반 예상 질문(qtype=posting)을 반드시 6개 이상, 최대 10개. 요구사항 목록을 골고루 커버할 것.
2. 각 질문의 answerPoints: 근거 카드 cardId 필수. 카드에 근거가 없으면 cardId=null로 두고 text에는 "준비 필요: (무엇을 준비할지)"만 쓴다.`,
      user: interviewContext,
    });
    const weaknessInterview = await generateWeaknessInterview(interviewContext);
    const saneInterview: Interview["questions"] = [
      ...postingInterview.questions,
      ...weaknessInterview.questions,
    ].map(
      (q) => ({
        ...q,
        answerPoints: q.answerPoints.map((p) =>
          p.cardId !== null && !validCardIds.has(p.cardId)
            ? { ...p, cardId: null, text: `준비 필요: ${p.text}` }
            : p
        ),
      })
    );

    // 4) 정합성 2차 검증 — 생성 문장이 출처 카드의 "주장해도 되는 것" 범위 안인가
    const sentencesToVerify = [
      ...sane.introDraft.map((s) => ({ text: s.text, cardId: s.primaryCardId })),
      ...sane.resumePoints.map((s) => ({ text: s.text, cardId: s.primaryCardId })),
    ];
    let overClaims = new Set<number>();
    if (sentencesToVerify.length > 0) {
      const verification = await generateStructured({
        schema: verificationSchema,
        maxTokens: 8000,
        system: `검증자. 각 문장이 출처 카드의 내용과 "주장해도 되는 것" 범위 안에 있는지 판정한다. 카드 내용을 넘어선 과장, "주장하면 안 되는 것"에 해당하는 주장, 카드에 없는 수치는 withinClaimable=false. reason은 한국어 한 문장.`,
        user: `## 경험 카드
${serializeCards(cards)}

## 검증할 문장 (sentenceIndex. [출처 카드ID] 문장)
${sentencesToVerify.map((s, i) => `${i}. [카드 #${s.cardId}] ${s.text}`).join("\n")}`,
      });
      overClaims = new Set(
        verification.results
          .filter((r) => !r.withinClaimable)
          .map((r) => r.sentenceIndex)
      );
    }

    // 5) 저장 — 기존 결과 삭제 + 신규 저장을 한 트랜잭션으로
    persist(postingId, reqDefs, sane, saneInterview, overClaims);

    db.update(jobPostings)
      .set({
        analysisStatus: "done",
        pipelineStatus: "reviewing",
        fitJson: JSON.stringify(sane.fit),
        verdict: sane.verdict,
      })
      .where(eq(jobPostings.id, postingId))
      .run();
  } catch (e) {
    db.update(jobPostings)
      .set({
        analysisStatus: "error",
        analysisError: e instanceof Error ? e.message : String(e),
      })
      .where(eq(jobPostings.id, postingId))
      .run();
    throw e;
  }
}

async function generateWeaknessInterview(
  interviewContext: string
): Promise<{ questions: Interview["questions"] }> {
  let lastError: unknown;

  // JSON 스키마의 정확히 3개 제약을 통과하지 못한 출력만 한 번 재시도한다.
  // 계속 실패하면 분석 전체를 저장하지 않아 이전 분석 결과가 보존된다.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await generateStructured({
        schema: weaknessInterviewSchema,
        maxTokens: 4000,
        system: `면접 준비 조수. 채용 공고와 지원자의 경험 카드를 바탕으로 약점 면접 질문과 답변 포인트를 만든다. 모든 출력은 한국어.

${AUTHORSHIP_RULE}

작업:
1. 근거가 없거나 weak인 요구사항을 면접관이 찌르는 약점 질문(qtype=weakness)을 정확히 3개 만든다.
2. 세 질문은 가능한 한 서로 다른 부족한 요구사항을 다룬다.
3. 각 질문의 answerPoints: 근거 카드가 있으면 cardId를 넣는다. 카드에 근거가 없으면 cardId=null로 두고 text에는 "준비 필요: (무엇을 준비할지)"만 쓴다.`,
        user: interviewContext,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `약점 면접 질문 3개 생성에 두 번 실패했습니다. ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

function sanitize(
  analysis: Analysis,
  validCardIds: Set<number>,
  reqCount: number
): Analysis {
  return {
    ...analysis,
    matches: analysis.matches.filter(
      (m) =>
        validCardIds.has(m.cardId) &&
        m.requirementIndex >= 0 &&
        m.requirementIndex < reqCount
    ),
    // 출처 카드가 실존하지 않는 AI 문장은 저장하지 않는다 (원칙의 코드 레벨 방어선)
    introDraft: analysis.introDraft
      .filter((s) => validCardIds.has(s.primaryCardId))
      .map((s) => ({
        ...s,
        additionalCardIds: s.additionalCardIds.filter((id) =>
          validCardIds.has(id)
        ),
      })),
    resumePoints: analysis.resumePoints.filter((s) =>
      validCardIds.has(s.primaryCardId)
    ),
    askbacks: analysis.askbacks.map((a) => ({
      ...a,
      requirementIndex:
        a.requirementIndex !== null &&
        a.requirementIndex >= 0 &&
        a.requirementIndex < reqCount
          ? a.requirementIndex
          : null,
    })),
  };
}

function persist(
  postingId: number,
  reqDefs: { category: string; text: string }[],
  sane: Analysis,
  interview: Interview["questions"],
  overClaims: Set<number>
): void {
  db.transaction((tx) => {
    // 재분석 시 이전 결과 정리 — 삭제와 신규 저장이 같은 트랜잭션이므로
    // 중간 실패 시 이전 결과가 그대로 남는다 (중복 누적 방지, IDEAS 2026-07-11)
    // cascade: requirements→matches, drafts→sentences→sources, questions→answer_points
    tx.delete(requirements)
      .where(eq(requirements.jobPostingId, postingId))
      .run();
    tx.delete(askbacks).where(eq(askbacks.jobPostingId, postingId)).run();
    tx.delete(drafts).where(eq(drafts.jobPostingId, postingId)).run();
    tx.delete(interviewQuestions)
      .where(eq(interviewQuestions.jobPostingId, postingId))
      .run();

    const reqRows = reqDefs.map((r) =>
      tx
        .insert(requirements)
        .values({ jobPostingId: postingId, category: r.category, text: r.text })
        .returning()
        .get()
    );

    for (const m of sane.matches) {
      tx.insert(matches)
        .values({
          requirementId: reqRows[m.requirementIndex].id,
          cardId: m.cardId,
          strength: m.strength,
          rationale: m.rationale,
        })
        .run();
    }

    const askbackIdByReq = new Map<number, number>();
    for (const a of sane.askbacks) {
      const row = tx
        .insert(askbacks)
        .values({
          jobPostingId: postingId,
          requirementId:
            a.requirementIndex !== null ? reqRows[a.requirementIndex].id : null,
          question: a.question,
          why: a.why,
        })
        .returning()
        .get();
      if (a.requirementIndex !== null)
        askbackIdByReq.set(a.requirementIndex, row.id);
    }

    // 지원 초안 — 근거 없는 요구사항 자리는 placeholder 행으로
    const introDraft = tx
      .insert(drafts)
      .values({ jobPostingId: postingId, kind: "intro" })
      .returning()
      .get();
    let order = 0;
    let verifyIdx = 0;
    for (const s of sane.introDraft) {
      const sentence = tx
        .insert(draftSentences)
        .values({
          draftId: introDraft.id,
          orderIdx: order++,
          text: s.text,
          type: "ai",
          primarySourceCardId: s.primaryCardId,
          warning: overClaims.has(verifyIdx)
            ? "over_claim"
            : s.weakEvidence
              ? "weak_evidence"
              : null,
        })
        .returning()
        .get();
      verifyIdx++;
      for (const extra of s.additionalCardIds) {
        tx.insert(draftSentenceSources)
          .values({ sentenceId: sentence.id, cardId: extra })
          .run();
      }
    }
    for (const [reqIdx, askbackId] of askbackIdByReq) {
      tx.insert(draftSentences)
        .values({
          draftId: introDraft.id,
          orderIdx: order++,
          text: `"${reqRows[reqIdx].text}" 요구사항은 근거 카드가 없어 문장을 생성하지 않았습니다. 되묻기에 답하면 이 자리가 채워집니다.`,
          type: "placeholder",
          askbackId,
        })
        .run();
    }

    const resumeDraft = tx
      .insert(drafts)
      .values({ jobPostingId: postingId, kind: "resume_points" })
      .returning()
      .get();
    sane.resumePoints.forEach((s, i) => {
      tx.insert(draftSentences)
        .values({
          draftId: resumeDraft.id,
          orderIdx: i,
          text: s.text,
          type: "ai",
          primarySourceCardId: s.primaryCardId,
          warning: overClaims.has(sane.introDraft.length + i)
            ? "over_claim"
            : null,
        })
        .run();
    });

    interview.forEach((q, qi) => {
      const question = tx
        .insert(interviewQuestions)
        .values({
          jobPostingId: postingId,
          question: q.question,
          qtype: q.qtype,
          orderIdx: qi,
        })
        .returning()
        .get();
      q.answerPoints.forEach((p, pi) => {
        tx.insert(interviewAnswerPoints)
          .values({
            questionId: question.id,
            orderIdx: pi,
            text: p.text,
            type: p.cardId === null ? "placeholder" : "ai",
            primarySourceCardId: p.cardId,
          })
          .run();
      });
    });
  });
}
