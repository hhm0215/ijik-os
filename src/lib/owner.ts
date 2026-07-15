import "server-only";

import crypto from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { authAccounts, authUsers, db } from "@/db";
import {
  isOwnerSetupConfigured,
  normalizeOwnerEmail,
} from "@/lib/owner-signup-policy";

export class OwnerAlreadyExistsError extends Error {}
export class OwnerSetupConflictError extends Error {}

export function getOwnerCount() {
  return db.select({ id: authUsers.id }).from(authUsers).limit(2).all().length;
}

function getCredentialOwners() {
  return db
    .select({ id: authUsers.id, email: authUsers.email })
    .from(authAccounts)
    .innerJoin(authUsers, eq(authAccounts.userId, authUsers.id))
    .where(
      and(
        eq(authAccounts.providerId, "credential"),
        isNotNull(authAccounts.password)
      )
    )
    .limit(2)
    .all();
}

export function getOwnerSetupState() {
  const configuredOwnerEmail = normalizeOwnerEmail(process.env.OWNER_EMAIL);
  const ownerCount = getOwnerCount();
  const credentialOwners = getCredentialOwners();

  return {
    configured: isOwnerSetupConfigured({
      ownerEmail: configuredOwnerEmail,
      setupToken: process.env.OWNER_SETUP_TOKEN,
    }),
    initialized: credentialOwners.length > 0,
    ownerCount,
    ownerEmail: normalizeOwnerEmail(
      credentialOwners[0]?.email ?? configuredOwnerEmail
    ),
  };
}

export async function createOwnerAccount(input: {
  name: string;
  email: string;
  password: string;
}) {
  // Hashing is intentionally completed before opening the synchronous SQLite
  // transaction. The two database inserts themselves then commit or roll back
  // together, so a credential-link failure cannot leave an unusable owner row.
  const passwordHash = await hashPassword(input.password);
  const normalizedEmail = normalizeOwnerEmail(input.email);
  const now = new Date();
  const userId = crypto.randomUUID();

  return db.transaction((tx) => {
    const credential = tx
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.providerId, "credential"),
          isNotNull(authAccounts.password)
        )
      )
      .limit(1)
      .get();
    if (credential) throw new OwnerAlreadyExistsError();

    const existingUsers = tx
      .select({ id: authUsers.id, email: authUsers.email })
      .from(authUsers)
      .limit(2)
      .all();
    if (existingUsers.length > 0) {
      const orphan = existingUsers[0];
      if (
        existingUsers.length !== 1 ||
        !orphan ||
        normalizeOwnerEmail(orphan.email) !== normalizedEmail
      ) {
        throw new OwnerSetupConflictError();
      }
      // Recover a user row left by an interrupted older setup attempt. Its
      // dependent rows are removed by the cascade before the atomic retry.
      tx.delete(authUsers).where(eq(authUsers.id, orphan.id)).run();
    }

    const user = tx
      .insert(authUsers)
      .values({
        id: userId,
        name: input.name,
        email: normalizedEmail,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
        role: "user",
        banned: false,
      })
      .returning({ name: authUsers.name, email: authUsers.email })
      .get();

    tx.insert(authAccounts)
      .values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return user;
  });
}
