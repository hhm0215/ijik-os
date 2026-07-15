import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

describe("auth proxy", () => {
  it("matches app and API routes but skips framework assets", () => {
    assert.equal(
      unstable_doesMiddlewareMatch({ config, url: "/cards" }),
      true
    );
    assert.equal(
      unstable_doesMiddlewareMatch({ config, url: "/api/cards" }),
      true
    );
    assert.equal(
      unstable_doesMiddlewareMatch({ config, url: "/_next/static/app.js" }),
      false
    );
    assert.equal(
      unstable_doesMiddlewareMatch({ config, url: "/favicon.ico" }),
      false
    );
  });

  it("redirects an unauthenticated page request to login", () => {
    const response = proxy(new NextRequest("http://localhost:3000/cards/4?edit=1"));
    assert.equal(response.status, 307);
    assert.equal(
      getRedirectUrl(response),
      "http://localhost:3000/login?next=%2Fcards%2F4%3Fedit%3D1"
    );
  });

  it("returns JSON 401 before an unauthenticated domain API reaches its handler", async () => {
    const response = proxy(new NextRequest("http://localhost:3000/api/cards"));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "로그인이 필요합니다.",
      code: "UNAUTHORIZED",
    });
  });

  it("leaves the gated signup API and Better Auth API reachable", () => {
    assert.equal(
      proxy(new NextRequest("http://localhost:3000/api/signup")).status,
      200
    );
    assert.equal(
      proxy(new NextRequest("http://localhost:3000/api/auth/get-session")).status,
      200
    );
  });

  it("uses the cookie only as an optimistic pass-through", () => {
    const request = new NextRequest("http://localhost:3000/api/cards", {
      headers: { cookie: "better-auth.session_token=forged" },
    });
    assert.equal(proxy(request).status, 200);
  });
});
