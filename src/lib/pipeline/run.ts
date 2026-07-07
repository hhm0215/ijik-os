import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
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
import { getClient, MODEL } from "@/lib/anthropic";
import {
  analysisSchema,
  extractionSchema,
  verificationSchema,
  type Analysis,
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

    const client = getClient();

    // 1) 공고에서 요구사항 추출
    const extractRes = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system:
        "채용 공고 분석가. 공고 원문에서 제목, 회사명, 그리고 지원자에게 요구되는 사항을 추출한다. 요구사항은 기술(tech), 도메인 지식(domain), 협업/리딩(collab), 성과/임팩트(impact)로 분류한다. 중복 없이 핵심 요구사항 4~10개로 정리. 모든 텍스트는 한국어로.",
      messages: [{ role: "user", content: `공고 원문:\n\n${posting.rawText}` }],
      output_config: { format: zodOutputFormat(extractionSchema) },
    });
    const extraction = extractRes.parsed_output;
    if (!extraction) throw new Error("요구사항 추출 결과 파싱 실패");

    db.update(jobPostings)
      .set({ title: extraction.title, company: extraction.company })
      .where(eq(jobPostings.id, postingId))
      .run();

    const reqRows = extraction.requirements.map((r) =>
      db
        .insert(requirements)
        .values({ jobPostingId: postingId, category: r.category, text: r.text })
        .returning()
        .get()
    );

    // 2) 매칭 + 적합도 + 초안 + 되묻기 + 면접 질문 (경험 카드 기반)
    const reqList = reqRows
      .map((r, i) => `${i}. [${r.category}] ${r.text}`)
      .join("\n");
    const analyzeRes = await client.messages.parse({
      model: MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      system: `지원 전략 조수. 사용자의 경험 카드와 채용 공고 요구사항을 비교 분석한다. 모든 출력은 한국어.

${AUTHORSHIP_RULE}

작업:
1. matches: 각 요구사항(requirementIndex)에 근거가 되는 카드를 연결. 근거 강도는 strong(직접 경험)/medium(유사 경험)/weak(간접·부분 경험). 근거 없는 요구사항은 matches에 넣지 않는다.
2. fit: 카테고리별 0~100 점수(근거 강도 기반)와 overall(단순 평균). 근거 없는 카테고리는 낮게.
3. verdict: "지원 가치 있음 — 단, X 보강 필요" 같은 판정 한 줄.
4. introDraft: 지원 동기/자기소개 초안. 문장 단위로, 각 문장에 primaryCardId(필수)와 additionalCardIds. strong/medium 근거만 문장 생성, weak 근거 문장은 weakEvidence=true. 근거 없는 요구사항은 문장을 만들지 않는다. 사용자의 "증거 문장" 말투를 살려서.
5. resumePoints: 이 공고에 맞춰 이력서에서 강조할 bullet 후보. 각각 primaryCardId 필수.
6. askbacks: 근거가 없거나 약한 요구사항마다 사용자에게 되물을 질문. why에는 어떤 요구사항 때문인지. requirementIndex 연결(일반 질문이면 null).
7. interview: 공고 기반 예상 질문 최대 10개(qtype=posting) + 약점 질문 3개(qtype=weakness, 근거가 부족해 보이는 부분을 면접관이 찌른다면). answerPoints의 각 bullet은 근거 카드 cardId 필수 — 카드에 근거가 없으면 cardId=null로 두고 text에는 "준비 필요: (무엇을 준비할지)"만 쓴다.`,
      messages: [
        {
          role: "user",
          content: `## 채용 공고: ${extraction.title} (${extraction.company})

## 요구사항 목록
${reqList}

## 내 경험 카드
${serializeCards(cards)}`,
        },
      ],
      output_config: { format: zodOutputFormat(analysisSchema) },
    });
    const analysis = analyzeRes.parsed_output;
    if (!analysis) throw new Error("분석 결과 파싱 실패");

    // LLM이 존재하지 않는 카드 ID를 만들어냈을 가능성 차단
    const validCardIds = new Set(cards.map((c) => c.id));
    const sane = sanitize(analysis, validCardIds, reqRows.length);

    // 3) 정합성 2차 검증 — 생성 문장이 출처 카드의 "주장해도 되는 것" 범위 안인가
    const sentencesToVerify = [
      ...sane.introDraft.map((s) => ({ text: s.text, cardId: s.primaryCardId })),
      ...sane.resumePoints.map((s) => ({ text: s.text, cardId: s.primaryCardId })),
    ];
    let overClaims = new Set<number>();
    if (sentencesToVerify.length > 0) {
      const verifyRes = await client.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: `검증자. 각 문장이 출처 카드의 내용과 "주장해도 되는 것" 범위 안에 있는지 판정한다. 카드 내용을 넘어선 과장, "주장하면 안 되는 것"에 해당하는 주장, 카드에 없는 수치는 withinClaimable=false. reason은 한국어 한 문장.`,
        messages: [
          {
            role: "user",
            content: `## 경험 카드
${serializeCards(cards)}

## 검증할 문장 (sentenceIndex. [출처 카드ID] 문장)
${sentencesToVerify.map((s, i) => `${i}. [카드 #${s.cardId}] ${s.text}`).join("\n")}`,
          },
        ],
        output_config: { format: zodOutputFormat(verificationSchema) },
      });
      const verification = verifyRes.parsed_output;
      if (verification) {
        overClaims = new Set(
          verification.results
            .filter((r) => !r.withinClaimable)
            .map((r) => r.sentenceIndex)
        );
      }
    }

    // 4) 저장
    persist(postingId, reqRows, sane, overClaims);

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
    interview: analysis.interview.map((q) => ({
      ...q,
      answerPoints: q.answerPoints.map((p) =>
        p.cardId !== null && !validCardIds.has(p.cardId)
          ? { ...p, cardId: null, text: `준비 필요: ${p.text}` }
          : p
      ),
    })),
  };
}

function persist(
  postingId: number,
  reqRows: (typeof requirements.$inferSelect)[],
  sane: Analysis,
  overClaims: Set<number>
): void {
  for (const m of sane.matches) {
    db.insert(matches)
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
    const row = db
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
  const introDraft = db
    .insert(drafts)
    .values({ jobPostingId: postingId, kind: "intro" })
    .returning()
    .get();
  let order = 0;
  let verifyIdx = 0;
  for (const s of sane.introDraft) {
    const sentence = db
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
      db.insert(draftSentenceSources)
        .values({ sentenceId: sentence.id, cardId: extra })
        .run();
    }
  }
  for (const [reqIdx, askbackId] of askbackIdByReq) {
    db.insert(draftSentences)
      .values({
        draftId: introDraft.id,
        orderIdx: order++,
        text: `"${reqRows[reqIdx].text}" 요구사항은 근거 카드가 없어 문장을 생성하지 않았습니다. 되묻기에 답하면 이 자리가 채워집니다.`,
        type: "placeholder",
        askbackId,
      })
      .run();
  }

  const resumeDraft = db
    .insert(drafts)
    .values({ jobPostingId: postingId, kind: "resume_points" })
    .returning()
    .get();
  sane.resumePoints.forEach((s, i) => {
    db.insert(draftSentences)
      .values({
        draftId: resumeDraft.id,
        orderIdx: i,
        text: s.text,
        type: "ai",
        primarySourceCardId: s.primaryCardId,
        warning: overClaims.has(sane.introDraft.length + i) ? "over_claim" : null,
      })
      .run();
  });

  sane.interview.forEach((q, qi) => {
    const question = db
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
      db.insert(interviewAnswerPoints)
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
}
