import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateOwnerSignup,
  isOwnerSetupConfigured,
  MIN_OWNER_SETUP_TOKEN_LENGTH,
} from "./owner-signup-policy";

describe("evaluateOwnerSignup", () => {
  it("allows only the configured first owner email", () => {
    assert.deepEqual(
      evaluateOwnerSignup({
        configuredOwnerEmail: " Owner@Example.com ",
        attemptedEmail: "owner@example.com",
        existingOwnerCount: 0,
      }),
      { allowed: true }
    );
  });

  it("blocks a different email and every account after the first", () => {
    assert.equal(
      evaluateOwnerSignup({
        configuredOwnerEmail: "owner@example.com",
        attemptedEmail: "attacker@example.com",
        existingOwnerCount: 0,
      }).allowed,
      false
    );
    assert.deepEqual(
      evaluateOwnerSignup({
        configuredOwnerEmail: "owner@example.com",
        attemptedEmail: "owner@example.com",
        existingOwnerCount: 1,
      }),
      { allowed: false, reason: "owner-exists" }
    );
  });

  it("requires both an owner email and a high-entropy setup token", () => {
    assert.equal(
      isOwnerSetupConfigured({ ownerEmail: "owner@example.com", setupToken: "short" }),
      false
    );
    assert.equal(
      isOwnerSetupConfigured({
        ownerEmail: "owner@example.com",
        setupToken: "x".repeat(MIN_OWNER_SETUP_TOKEN_LENGTH),
      }),
      true
    );
  });
});
