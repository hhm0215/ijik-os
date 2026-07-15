import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { POST as signup } from "../src/app/api/signup/route";
import { authAccounts, authUsers, db } from "../src/db";
import { auth as betterAuth } from "../src/lib/auth";
import { createCredentialUserAtomic } from "../src/lib/credential-users";
import { bootstrapOperator } from "../src/lib/operator-bootstrap";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const operatorEmail = process.env.OPERATOR_EMAIL ?? "operator@example.com";
const operatorPassword = process.env.OPERATOR_BOOTSTRAP_PASSWORD ?? "operator-password-123";
const userPassword = "user-password-123";

function jsonRequest(
  pathname: string,
  body: unknown,
  cookie?: string,
  clientIp?: string,
  forwardedFor?: string
) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: baseURL,
  });
  if (cookie) headers.set("cookie", cookie);
  if (clientIp) headers.set("x-real-ip", clientIp);
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  return new Request(`${baseURL}${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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

function userCount(email?: string) {
  const query = db.select({ id: authUsers.id }).from(authUsers);
  return email
    ? query.where(eq(authUsers.email, email)).all().length
    : query.all().length;
}

async function signIn(email: string, password: string) {
  const response = await betterAuth.handler(
    jsonRequest("/api/auth/sign-in/email", { email, password, rememberMe: true })
  );
  assert.equal(response.status, 200, await response.text());
  return cookieHeader(response);
}

async function main() {
  process.env.SIGNUP_MODE = "OPEN";
  const nonExactMode = await signup(
    jsonRequest("/api/signup", {
      name: "Closed User",
      email: "closed@example.com",
      password: userPassword,
    })
  );
  assert.equal(nonExactMode.status, 403);

  process.env.SIGNUP_MODE = "closed";
  const closedRateLimitIp = "203.0.113.20";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const closed = await signup(
      jsonRequest(
        "/api/signup",
        {
          name: "Closed User",
          email: "closed@example.com",
          password: userPassword,
        },
        undefined,
        closedRateLimitIp
      )
    );
    assert.equal(closed.status, 403);
    assert.equal((await closed.json()).code, "SIGNUP_CLOSED");
  }

  db.run(
    sql.raw(`
      CREATE TRIGGER fail_operator_credential
      BEFORE INSERT ON account
      BEGIN
        SELECT RAISE(ABORT, 'forced credential failure');
      END
    `)
  );
  await assert.rejects(bootstrapOperator());
  assert.equal(userCount(), 0, "failed operator credential must roll back user");
  db.run(sql.raw("DROP TRIGGER fail_operator_credential"));

  const bootstraps = await Promise.all([
    bootstrapOperator(),
    bootstrapOperator(),
    bootstrapOperator(),
  ]);
  assert.equal(userCount(operatorEmail), 1);
  assert.equal(
    bootstraps.filter((result) => result?.action === "created").length,
    1
  );
  assert.ok(bootstraps.every((result) => result?.operator.role === "admin"));

  delete process.env.OPERATOR_BOOTSTRAP_PASSWORD;
  const restarted = await bootstrapOperator();
  assert.equal(restarted?.action, "existing");

  process.env.SIGNUP_MODE = "open";
  const closedRequestsWereNotConsumed = await signup(
    jsonRequest("/api/signup", {}, undefined, closedRateLimitIp)
  );
  assert.equal(closedRequestsWereNotConsumed.status, 400);

  const created = await signup(
    jsonRequest("/api/signup", {
      name: "Regular User",
      email: "user@example.com",
      password: userPassword,
      role: "admin",
    })
  );
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.user.role, "user");

  const duplicate = await signup(
    jsonRequest("/api/signup", {
      name: "Duplicate",
      email: "USER@example.com",
      password: userPassword,
    })
  );
  assert.equal(duplicate.status, 400);
  assert.deepEqual(await duplicate.json(), {
    error: "계정을 만들 수 없습니다. 입력 정보를 확인해 주세요.",
    code: "SIGNUP_FAILED",
  });

  db.run(
    sql.raw(`
      CREATE TRIGGER fail_signup_credential
      BEFORE INSERT ON account
      BEGIN
        SELECT RAISE(ABORT, 'forced signup credential failure');
      END
    `)
  );
  const interrupted = await signup(
    jsonRequest("/api/signup", {
      name: "Interrupted",
      email: "interrupted@example.com",
      password: userPassword,
    })
  );
  assert.equal(interrupted.status, 400);
  assert.equal(userCount("interrupted@example.com"), 0);
  db.run(sql.raw("DROP TRIGGER fail_signup_credential"));

  const rateLimitIp = "198.51.100.25";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await signup(
      jsonRequest("/api/signup", {}, undefined, rateLimitIp)
    );
    assert.equal(response.status, 400);
  }
  const rateLimited = await signup(
    jsonRequest("/api/signup", {}, undefined, rateLimitIp)
  );
  assert.equal(rateLimited.status, 429);
  assert.equal((await rateLimited.json()).code, "RATE_LIMITED");
  assert.ok(Number(rateLimited.headers.get("retry-after")) > 0);

  const trustedProxyAddress = "198.51.100.44";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await signup(
      jsonRequest(
        "/api/signup",
        {},
        undefined,
        `203.0.113.${attempt + 1}`,
        `192.0.2.${attempt + 1}, ${trustedProxyAddress}`
      )
    );
    assert.equal(response.status, 400);
  }
  const spoofedHeadersCannotBypass = await signup(
    jsonRequest(
      "/api/signup",
      {},
      undefined,
      "203.0.113.99",
      `192.0.2.99, ${trustedProxyAddress}`
    )
  );
  assert.equal(spoofedHeadersCannotBypass.status, 429);

  const publicBuiltInSignup = await betterAuth.handler(
    jsonRequest("/api/auth/sign-up/email", {
      name: "Bypass",
      email: "bypass@example.com",
      password: userPassword,
    })
  );
  assert.equal(publicBuiltInSignup.status, 403);

  const operatorCookie = await signIn(operatorEmail, operatorPassword);
  const operatorSessionResponse = await betterAuth.handler(
    new Request(`${baseURL}/api/auth/get-session`, {
      headers: { cookie: operatorCookie },
    })
  );
  assert.equal((await operatorSessionResponse.json()).user.role, "admin");

  const userCookie = await signIn("user@example.com", userPassword);
  const userSessionResponse = await betterAuth.handler(
    new Request(`${baseURL}/api/auth/get-session`, {
      headers: { cookie: userCookie },
    })
  );
  assert.equal((await userSessionResponse.json()).user.role, "user");

  const userCannotList = await betterAuth.handler(
    new Request(`${baseURL}/api/auth/admin/list-users`, {
      headers: { cookie: userCookie },
    })
  );
  assert.equal(userCannotList.status, 403);

  const blockedCreate = await betterAuth.handler(
    jsonRequest(
      "/api/auth/admin/create-user",
      {
        name: "Admin Bypass",
        email: "admin-bypass@example.com",
        password: userPassword,
        role: "admin",
      },
      operatorCookie
    )
  );
  assert.equal(blockedCreate.status, 403);

  const blockedSetRole = await betterAuth.handler(
    jsonRequest(
      "/api/auth/admin/set-role",
      { userId: createdBody.user.id, role: "admin" },
      operatorCookie
    )
  );
  assert.equal(blockedSetRole.status, 403);

  const allowedList = await betterAuth.handler(
    new Request(`${baseURL}/api/auth/admin/list-users`, {
      headers: { cookie: operatorCookie },
    })
  );
  assert.equal(allowedList.status, 200, await allowedList.text());

  db.delete(authAccounts).run();
  db.delete(authUsers).run();
  const legacy = await createCredentialUserAtomic({
    name: "Legacy Owner",
    email: "legacy@example.com",
    password: userPassword,
    role: "user",
  });
  process.env.OPERATOR_EMAIL = legacy.email;
  delete process.env.OPERATOR_NAME;
  delete process.env.OPERATOR_PASSWORD_FILE;
  delete process.env.OPERATOR_BOOTSTRAP_PASSWORD;
  const promoted = await bootstrapOperator();
  assert.equal(promoted?.action, "promoted");
  assert.equal(promoted?.operator.role, "admin");
  await signIn(legacy.email, userPassword);

  const credential = db
    .select({ id: authAccounts.id })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.userId, legacy.id),
        eq(authAccounts.providerId, "credential")
      )
    )
    .get();
  assert.ok(credential);

  db.delete(authAccounts)
    .where(eq(authAccounts.userId, legacy.id))
    .run();
  assert.equal(
    db
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(eq(authAccounts.userId, legacy.id))
      .get(),
    undefined
  );
  const orphanAdminSignup = await signup(
    jsonRequest(
      "/api/signup",
      {
        name: "Must Wait For Recovery",
        email: "wait-for-recovery@example.com",
        password: userPassword,
      },
      undefined,
      "192.0.2.44"
    )
  );
  assert.equal(orphanAdminSignup.status, 503);
  assert.equal((await orphanAdminSignup.json()).code, "SERVICE_NOT_READY");
  process.env.OPERATOR_BOOTSTRAP_PASSWORD = userPassword;
  const recoveredAdmin = await bootstrapOperator();
  assert.equal(recoveredAdmin?.action, "recovered");
  assert.equal(recoveredAdmin?.operator.id, legacy.id);
  await signIn(legacy.email, userPassword);
  delete process.env.OPERATOR_BOOTSTRAP_PASSWORD;
  assert.equal((await bootstrapOperator())?.action, "existing");

  console.log("auth-smoke-ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
