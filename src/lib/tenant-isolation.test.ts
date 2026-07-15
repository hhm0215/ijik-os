import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";

describe("multi-user data and operator boundaries", () => {
  it("isolates domain rows and supports the restricted operator lifecycle", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        path.join(process.cwd(), "scripts/tenant-smoke.ts"),
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
            "tenant-test-8LqR7w2N5kV3xP9mC1bF6hJ4sD0zA2uE7yT5nM9pQ3rW1",
          OPERATOR_EMAIL: "operator@example.com",
          OPERATOR_NAME: "Operator",
          OPERATOR_BOOTSTRAP_PASSWORD: "operator-password-123",
          SIGNUP_MODE: "closed",
        },
      }
    );

    assert.equal(
      result.status,
      0,
      `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
    assert.match(result.stdout, /tenant-smoke-ok/);
  });
});
