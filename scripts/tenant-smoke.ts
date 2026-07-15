import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { POST as signup } from "../src/app/api/signup/route";
import { db, experienceCards, jobPostings } from "../src/db";
import { auth } from "../src/lib/auth";
import { bootstrapOperator } from "../src/lib/operator-bootstrap";
import { runPipeline } from "../src/lib/pipeline/run";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const operatorEmail = process.env.OPERATOR_EMAIL ?? "operator@example.com";
const operatorPassword =
  process.env.OPERATOR_BOOTSTRAP_PASSWORD ?? "operator-password-123";
const userEmail = "member@example.com";
const userPassword = "member-password-123";

function jsonRequest(pathname: string, body: unknown, cookie?: string) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: baseURL,
    "x-forwarded-for": "127.0.0.42",
  });
  if (cookie) headers.set("cookie", cookie);
  return new Request(`${baseURL}${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function getRequest(pathname: string, cookie: string) {
  return new Request(`${baseURL}${pathname}`, {
    headers: { cookie, origin: baseURL },
  });
}

function cookieHeader(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [
    response.headers.get("set-cookie") ?? "",
  ];
  return values
    .filter(Boolean)
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

async function signIn(email: string, password: string) {
  const response = await auth.handler(
    jsonRequest("/api/auth/sign-in/email", {
      email,
      password,
      rememberMe: true,
    })
  );
  assert.equal(response.status, 200, await response.text());
  const cookie = cookieHeader(response);
  assert.match(cookie, /session_token=/);
  return cookie;
}

function insertCard(userId: string, title: string) {
  return db
    .insert(experienceCards)
    .values({
      userId,
      title,
      situation: `${title} 상황`,
      role: "백엔드 개발자",
      action: `${title} 행동`,
      resultMetrics: "응답 시간 30% 개선",
      learned: "격리의 중요성",
      evidenceSentence: `${title} 근거`,
      claimable: `${title}를 수행함`,
      notClaimable: "조직 전체 성과",
      tags: "테스트,격리",
    })
    .returning()
    .get();
}

async function main() {
  const bootstrapped = await bootstrapOperator();
  assert.equal(bootstrapped?.operator.role, "admin");

  process.env.SIGNUP_MODE = "open";
  const signupResponse = await signup(
    jsonRequest("/api/signup", {
      name: "Member",
      email: userEmail,
      password: userPassword,
      role: "admin",
    })
  );
  const signupBody = await signupResponse.json();
  assert.equal(signupResponse.status, 201, JSON.stringify(signupBody));
  const member = signupBody.user as {
    id: string;
    role: string;
  };
  assert.equal(member.role, "user");

  const operatorCookie = await signIn(operatorEmail, operatorPassword);
  let memberCookie = await signIn(userEmail, userPassword);

  const operatorCard = insertCard(bootstrapped.operator.id, "운영자 카드");
  const memberCard = insertCard(member.id, "일반 사용자 카드");
  const operatorCards = db
    .select({ id: experienceCards.id })
    .from(experienceCards)
    .where(eq(experienceCards.userId, bootstrapped.operator.id))
    .all();
  const memberCards = db
    .select({ id: experienceCards.id })
    .from(experienceCards)
    .where(eq(experienceCards.userId, member.id))
    .all();
  assert.deepEqual(operatorCards.map((card) => card.id), [operatorCard.id]);
  assert.deepEqual(memberCards.map((card) => card.id), [memberCard.id]);

  const foreignUpdate = db
    .update(experienceCards)
    .set({ title: "탈취 시도" })
    .where(
      and(
        eq(experienceCards.id, operatorCard.id),
        eq(experienceCards.userId, member.id)
      )
    )
    .run();
  assert.equal(foreignUpdate.changes, 0);

  const posting = db
    .insert(jobPostings)
    .values({
      userId: bootstrapped.operator.id,
      rawText:
        "운영자만 볼 수 있는 채용 공고 본문입니다. 백엔드 개발과 데이터 격리 경험을 요구하며 충분히 긴 테스트 입력을 제공합니다.",
    })
    .returning()
    .get();
  await assert.rejects(
    runPipeline(posting.id, member.id),
    /찾을 수 없습니다/
  );

  const memberListAttempt = await auth.handler(
    getRequest("/api/auth/admin/list-users", memberCookie)
  );
  assert.equal(memberListAttempt.status, 403);
  const adminList = await auth.handler(
    getRequest("/api/auth/admin/list-users", operatorCookie)
  );
  assert.equal(adminList.status, 200, await adminList.text());

  const selfBan = await auth.handler(
    jsonRequest(
      "/api/auth/admin/ban-user",
      { userId: bootstrapped.operator.id, banReason: "self test" },
      operatorCookie
    )
  );
  assert.equal(selfBan.status, 400);

  const ban = await auth.handler(
    jsonRequest(
      "/api/auth/admin/ban-user",
      { userId: member.id, banReason: "isolation smoke" },
      operatorCookie
    )
  );
  assert.equal(ban.status, 200, await ban.text());
  const revokedByBan = await auth.handler(
    getRequest("/api/auth/get-session", memberCookie)
  );
  assert.equal(await revokedByBan.json(), null);
  const bannedLogin = await auth.handler(
    jsonRequest("/api/auth/sign-in/email", {
      email: userEmail,
      password: userPassword,
    })
  );
  assert.equal(bannedLogin.status, 403);
  assert.equal((await bannedLogin.json()).code, "BANNED_USER");

  const unban = await auth.handler(
    jsonRequest(
      "/api/auth/admin/unban-user",
      { userId: member.id },
      operatorCookie
    )
  );
  assert.equal(unban.status, 200, await unban.text());
  memberCookie = await signIn(userEmail, userPassword);

  const revoke = await auth.handler(
    jsonRequest(
      "/api/auth/admin/revoke-user-sessions",
      { userId: member.id },
      operatorCookie
    )
  );
  assert.equal(revoke.status, 200, await revoke.text());
  const revokedSession = await auth.handler(
    getRequest("/api/auth/get-session", memberCookie)
  );
  assert.equal(await revokedSession.json(), null);

  console.log("tenant-smoke-ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
