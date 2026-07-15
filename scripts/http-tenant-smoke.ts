import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const serverEntry = path.join(standaloneDir, "server.js");
const operatorEmail = "operator-http@example.com";
const operatorPassword = "operator-http-password-123";
const memberEmail = "member-http@example.com";
const memberPassword = "member-http-password-123";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function availablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

function responseCookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [
    response.headers.get("set-cookie") ?? "",
  ];
  return values
    .filter(Boolean)
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

async function responseJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`JSON 응답이 아닙니다 (${response.status}): ${text.slice(0, 500)}`);
  }
}

function cardBody(title: string) {
  return {
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
  };
}

async function main() {
  if (!fs.existsSync(serverEntry)) {
    throw new Error("먼저 npm run build를 실행해 standalone 서버를 만들어 주세요.");
  }

  fs.cpSync(path.join(root, "drizzle"), path.join(standaloneDir, "drizzle"), {
    recursive: true,
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ijik-http-tenant-"));
  const databasePath = path.join(tempDir, "app.db");
  const passwordFile = path.join(tempDir, "operator-password");
  fs.writeFileSync(passwordFile, `${operatorPassword}\n`, { mode: 0o600 });
  const port = await availablePort();
  const baseURL = `http://127.0.0.1:${port}`;
  let output = "";

  const child = spawn(process.execPath, ["server.js"], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      DATABASE_PATH: databasePath,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET:
        "http-tenant-smoke-9vB4mQ2xF8kL6pR1sT7wC3nH5jD0yE2uA4gZ8",
      OPERATOR_EMAIL: operatorEmail,
      OPERATOR_NAME: "HTTP Operator",
      OPERATOR_PASSWORD_FILE: passwordFile,
      SIGNUP_MODE: "open",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  const capture = (chunk: string) => {
    output = `${output}${chunk}`.slice(-30_000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);

  const request = (
    pathname: string,
    options: {
      method?: string;
      body?: unknown;
      cookie?: string;
      ip?: string;
      redirect?: RequestRedirect;
    } = {}
  ) => {
    const headers = new Headers({ origin: baseURL });
    if (options.cookie) headers.set("cookie", options.cookie);
    if (options.ip) {
      headers.set("x-forwarded-for", options.ip);
      headers.set("x-real-ip", options.ip);
    }
    if (options.body !== undefined) headers.set("content-type", "application/json");
    return fetch(`${baseURL}${pathname}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: options.redirect,
    });
  };

  async function waitUntilReady() {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (child.exitCode !== null) {
        throw new Error(`standalone 서버가 조기 종료됐습니다.\n${output}`);
      }
      try {
        const response = await request("/api/auth/get-session");
        if (response.status === 200) return;
      } catch {
        // Server socket is not ready yet.
      }
      await delay(250);
    }
    throw new Error(`standalone 서버 준비 시간이 초과됐습니다.\n${output}`);
  }

  async function signIn(email: string, password: string, ip: string) {
    const response = await request("/api/auth/sign-in/email", {
      body: { email, password, rememberMe: true },
      ip,
    });
    const body = await responseJson(response.clone());
    assert.equal(response.status, 200, JSON.stringify(body));
    const cookie = responseCookies(response);
    assert.match(cookie, /session_token=/);
    return cookie;
  }

  try {
    await waitUntilReady();

    const unauthenticated = await request("/api/cards");
    assert.equal(unauthenticated.status, 401);

    const setupRedirect = await request("/setup", { redirect: "manual" });
    assert.equal(setupRedirect.status, 308);
    assert.equal(new URL(setupRedirect.headers.get("location") ?? "", baseURL).pathname, "/signup");

    const signup = await request("/api/signup", {
      body: {
        name: "HTTP Member",
        email: memberEmail,
        password: memberPassword,
        role: "admin",
      },
    });
    const signupBody = await responseJson(signup);
    assert.equal(signup.status, 201, JSON.stringify(signupBody));
    assert.equal(signupBody.user.role, "user");

    const builtInSignup = await request("/api/auth/sign-up/email", {
      body: {
        name: "Bypass",
        email: "bypass-http@example.com",
        password: memberPassword,
      },
    });
    assert.equal(builtInSignup.status, 403);

    const operatorCookie = await signIn(
      operatorEmail,
      operatorPassword,
      "198.51.100.10"
    );
    let memberCookie = await signIn(
      memberEmail,
      memberPassword,
      "198.51.100.20"
    );

    const operatorCardResponse = await request("/api/cards", {
      body: cardBody("운영자 HTTP 카드"),
      cookie: operatorCookie,
    });
    const operatorCard = await responseJson(operatorCardResponse);
    assert.equal(operatorCardResponse.status, 201, JSON.stringify(operatorCard));

    const memberCardResponse = await request("/api/cards", {
      body: cardBody("일반 사용자 HTTP 카드"),
      cookie: memberCookie,
    });
    const memberCard = await responseJson(memberCardResponse);
    assert.equal(memberCardResponse.status, 201, JSON.stringify(memberCard));

    const operatorCards = await responseJson(
      await request("/api/cards", { cookie: operatorCookie })
    );
    const memberCards = await responseJson(
      await request("/api/cards", { cookie: memberCookie })
    );
    assert.deepEqual(operatorCards.map((card: { id: number }) => card.id), [operatorCard.id]);
    assert.deepEqual(memberCards.map((card: { id: number }) => card.id), [memberCard.id]);

    for (const [method, body] of [
      ["GET", undefined],
      ["PUT", cardBody("탈취 시도")],
      ["DELETE", {}],
    ] as const) {
      const response = await request(`/api/cards/${operatorCard.id}`, {
        method,
        body,
        cookie: memberCookie,
      });
      assert.equal(response.status, 404, `${method} foreign card`);
    }
    const foreignCardPage = await request(`/cards/${operatorCard.id}`, {
      cookie: memberCookie,
      redirect: "manual",
    });
    assert.equal(foreignCardPage.status, 404);

    const postingResponse = await request("/api/postings", {
      body: {
        rawText:
          "운영자만 볼 수 있는 채용 공고 본문입니다. 백엔드 개발과 데이터 격리 경험을 요구하며 충분히 긴 테스트 입력을 제공합니다.",
      },
      cookie: operatorCookie,
    });
    const posting = await responseJson(postingResponse);
    assert.equal(postingResponse.status, 201, JSON.stringify(posting));
    assert.equal(
      (
        await request(`/api/postings/${posting.id}`, {
          cookie: memberCookie,
        })
      ).status,
      404
    );
    assert.equal(
      (
        await request(`/api/postings/${posting.id}/analyze`, {
          method: "POST",
          body: {},
          cookie: memberCookie,
        })
      ).status,
      404
    );

    const userAdminList = await request("/api/auth/admin/list-users", {
      cookie: memberCookie,
    });
    assert.equal(userAdminList.status, 403);
    const operatorAdminList = await request("/api/auth/admin/list-users", {
      cookie: operatorCookie,
    });
    assert.equal(operatorAdminList.status, 200);

    const selfBan = await request("/api/auth/admin/ban-user", {
      body: { userId: operatorCard.userId, banReason: "self test" },
      cookie: operatorCookie,
    });
    assert.equal(selfBan.status, 400);

    const ban = await request("/api/auth/admin/ban-user", {
      body: { userId: signupBody.user.id, banReason: "HTTP isolation smoke" },
      cookie: operatorCookie,
    });
    assert.equal(ban.status, 200, JSON.stringify(await responseJson(ban.clone())));
    assert.equal(
      await responseJson(
        await request("/api/auth/get-session", { cookie: memberCookie })
      ),
      null
    );
    const bannedLogin = await request("/api/auth/sign-in/email", {
      body: { email: memberEmail, password: memberPassword },
      ip: "198.51.100.21",
    });
    assert.equal(bannedLogin.status, 403);
    assert.equal((await responseJson(bannedLogin)).code, "BANNED_USER");

    const unban = await request("/api/auth/admin/unban-user", {
      body: { userId: signupBody.user.id },
      cookie: operatorCookie,
    });
    assert.equal(unban.status, 200);
    memberCookie = await signIn(
      memberEmail,
      memberPassword,
      "198.51.100.22"
    );
    const revoke = await request("/api/auth/admin/revoke-user-sessions", {
      body: { userId: signupBody.user.id },
      cookie: operatorCookie,
    });
    assert.equal(revoke.status, 200);
    assert.equal(
      await responseJson(
        await request("/api/auth/get-session", { cookie: memberCookie })
      ),
      null
    );

    console.log("http-tenant-smoke-ok");
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      delay(5_000).then(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }),
    ]);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
