import "server-only";

import crypto from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { authAccounts, authUsers, db } from "@/db";

export type UserRole = "user" | "admin";

export type CredentialUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export class CredentialUserAlreadyExistsError extends Error {
  constructor() {
    super("A user with that email already exists.");
    this.name = "CredentialUserAlreadyExistsError";
  }
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("SQLITE_CONSTRAINT")
  );
}

/**
 * Creates the Better Auth user and credential rows as one synchronous SQLite
 * transaction. Password hashing intentionally happens before the transaction.
 */
export async function createCredentialUserAtomic(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<CredentialUser> {
  const passwordHash = await hashPassword(input.password);
  const email = normalizeEmail(input.email);
  const now = new Date();
  const userId = crypto.randomUUID();

  try {
    return db.transaction((tx) => {
      const user = tx
        .insert(authUsers)
        .values({
          id: userId,
          name: input.name.trim(),
          email,
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
          role: input.role,
          banned: false,
        })
        .returning({
          id: authUsers.id,
          name: authUsers.name,
          email: authUsers.email,
          role: authUsers.role,
        })
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

      return {
        ...user,
        role: input.role,
      };
    }, { behavior: "immediate" });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new CredentialUserAlreadyExistsError();
    }
    throw error;
  }
}
