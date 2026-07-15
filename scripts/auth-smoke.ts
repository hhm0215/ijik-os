import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { POST as setupOwner } from "../src/app/api/setup/route";
import { db } from "../src/db";
import { auth } from "../src/lib/auth";
import { getOwnerCount } from "../src/lib/owner";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const ownerEmail = process.env.OWNER_EMAIL ?? "";
const setupToken = process.env.OWNER_SETUP_TOKEN ?? "";
const password = "initial-password-123";
const newPassword = "changed-password-456";

function jsonRequest(pathname: string, body: unknown, cookie?: string) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: baseURL,
  });
  if (cookie) headers.set("cookie", cookie);
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

async function main() {
  const unauthenticatedAdminCreate = await auth.handler(
    jsonRequest("/api/auth/admin/create-user", {
      name: "Bypass Owner",
      email: ownerEmail,
      password,
      role: "admin",
    })
  );
  assert.equal(unauthenticatedAdminCreate.status, 404);

  const rejectedSetup = await setupOwner(
    jsonRequest("/api/setup", {
      name: "Owner",
      password,
      setupToken: "wrong-token",
    })
  );
  assert.equal(rejectedSetup.status, 403);

  db.run(
    sql.raw(`
      CREATE TRIGGER fail_owner_credential
      BEFORE INSERT ON account
      BEGIN
        SELECT RAISE(ABORT, 'forced credential failure');
      END
    `)
  );
  const interruptedSetup = await setupOwner(
    jsonRequest("/api/setup", {
      name: "Owner",
      password,
      setupToken,
    })
  );
  assert.equal(interruptedSetup.status, 500);
  assert.equal(getOwnerCount(), 0);
  db.run(sql.raw("DROP TRIGGER fail_owner_credential"));

  const created = await setupOwner(
    jsonRequest("/api/setup", {
      name: "Owner",
      password,
      setupToken,
    })
  );
  assert.equal(created.status, 201, await created.text());

  const duplicate = await setupOwner(
    jsonRequest("/api/setup", {
      name: "Second Owner",
      password,
      setupToken,
    })
  );
  assert.equal(duplicate.status, 409);

  const publicSignup = await auth.handler(
    jsonRequest("/api/auth/sign-up/email", {
      name: "Another User",
      email: "another@example.com",
      password,
    })
  );
  assert.equal(publicSignup.status, 403);

  const signIn = await auth.handler(
    jsonRequest("/api/auth/sign-in/email", {
      email: ownerEmail,
      password,
      rememberMe: true,
    })
  );
  assert.equal(signIn.status, 200, await signIn.text());
  const cookie = cookieHeader(signIn);
  assert.match(cookie, /session_token=/);

  const authenticatedSecondUser = await auth.handler(
    jsonRequest(
      "/api/auth/admin/create-user",
      {
        name: "Second User",
        email: "another@example.com",
        password,
        role: "user",
      },
      cookie
    )
  );
  assert.equal(authenticatedSecondUser.status, 404);

  const sessionResponse = await auth.handler(
    new Request(`${baseURL}/api/auth/get-session`, {
      headers: { cookie },
    })
  );
  const session = await sessionResponse.json();
  assert.equal(session.user.email, ownerEmail);

  const updateProfile = await auth.handler(
    jsonRequest("/api/auth/update-user", { name: "Updated Owner" }, cookie)
  );
  assert.equal(updateProfile.status, 200, await updateProfile.text());

  const sessionsResponse = await auth.handler(
    new Request(`${baseURL}/api/auth/list-sessions`, {
      headers: { cookie },
    })
  );
  const sessions = await sessionsResponse.json();
  assert.equal(sessionsResponse.status, 200);
  assert.equal(sessions.length, 1);

  const changePassword = await auth.handler(
    jsonRequest(
      "/api/auth/change-password",
      {
        currentPassword: password,
        newPassword,
        revokeOtherSessions: true,
      },
      cookie
    )
  );
  assert.equal(changePassword.status, 200, await changePassword.text());

  const signOut = await auth.handler(
    jsonRequest("/api/auth/sign-out", {}, cookie)
  );
  assert.equal(signOut.status, 200);
  const revokedSession = await auth.handler(
    new Request(`${baseURL}/api/auth/get-session`, {
      headers: { cookie },
    })
  );
  assert.equal(await revokedSession.json(), null);

  const signInWithChangedPassword = await auth.handler(
    jsonRequest("/api/auth/sign-in/email", {
      email: ownerEmail,
      password: newPassword,
      rememberMe: true,
    })
  );
  assert.equal(
    signInWithChangedPassword.status,
    200,
    await signInWithChangedPassword.text()
  );

  console.log("auth-smoke-ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
