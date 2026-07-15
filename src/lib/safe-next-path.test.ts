import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("keeps normal app paths and query strings", () => {
    assert.equal(safeNextPath("/cards/4?edit=1"), "/cards/4?edit=1");
    assert.equal(safeNextPath("/cards?tag=%ED%95%9C%EA%B8%80"), "/cards?tag=%ED%95%9C%EA%B8%80");
  });

  it("rejects external, encoded, backslash, control, and auth-loop targets", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/%5cevil.example",
      "/%252f%252fevil.example",
      "/%2e%2e//evil.example",
      "/x/..//evil.example",
      "/cards%0d%0aLocation:evil",
      "/login",
      "/signup",
      "/setup",
    ]) {
      assert.equal(safeNextPath(value), "/", value);
    }
  });
});
