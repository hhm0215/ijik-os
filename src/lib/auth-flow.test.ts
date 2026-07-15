import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

describe("single-owner authentication flow", () => {
  it("bootstraps once and supports the complete owner account lifecycle", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        path.join(process.cwd(), "scripts/auth-smoke.ts"),
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATABASE_PATH: ":memory:",
          BETTER_AUTH_URL: "http://localhost:3000",
          BETTER_AUTH_SECRET:
            "test-only-7VgV2m3u6qQf4y8P1b9C5x0N2k6R3s8Z0j4L7w1A",
          OWNER_EMAIL: "owner@example.com",
          OWNER_SETUP_TOKEN: "test-setup-x8P1b9C5x0N2k6R3s8Z0",
        },
      }
    );

    assert.equal(
      result.status,
      0,
      `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
    assert.match(result.stdout, /auth-smoke-ok/);
  });
});
