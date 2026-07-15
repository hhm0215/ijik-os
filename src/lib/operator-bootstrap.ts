import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import { and, eq, isNotNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { authAccounts, authUsers, db } from "@/db";
import {
  claimLegacyDataForOperator,
  hasUnclaimedDomainData,
} from "@/lib/data-ownership";
import {
  type CredentialUser,
  normalizeEmail,
} from "@/lib/credential-users";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/signup-policy";

type AuthUserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
};

export type OperatorBootstrapResult = {
  operator: CredentialUser;
  action: "existing" | "promoted" | "created" | "recovered";
};

export class OperatorBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperatorBootstrapError";
  }
}

function hasAdminRole(role: string | null) {
  return role?.split(",").some((value) => value.trim() === "admin") ?? false;
}

function configuredOperatorEmail() {
  const email = normalizeEmail(process.env.OPERATOR_EMAIL ?? "");
  if (!email) return "";
  if (!z.email().safeParse(email).success) {
    throw new OperatorBootstrapError("OPERATOR_EMAIL 형식이 올바르지 않습니다.");
  }
  return email;
}

function configuredOperatorName() {
  const name = process.env.OPERATOR_NAME?.trim() ?? "";
  if (!name || name.length > 80) {
    throw new OperatorBootstrapError(
      "새 운영자 생성에는 1~80자의 OPERATOR_NAME이 필요합니다."
    );
  }
  return name;
}

function readBootstrapPassword() {
  const passwordFile = process.env.OPERATOR_PASSWORD_FILE?.trim();
  let password = "";

  if (passwordFile) {
    try {
      password = fs
        .readFileSync(/* turbopackIgnore: true */ passwordFile, "utf8")
        .replace(/\r?\n$/, "");
    } catch (error) {
      throw new OperatorBootstrapError(
        `OPERATOR_PASSWORD_FILE을 읽을 수 없습니다: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    }
  } else {
    const fallback = process.env.OPERATOR_BOOTSTRAP_PASSWORD ?? "";
    if (fallback && process.env.NODE_ENV === "production") {
      throw new OperatorBootstrapError(
        "운영 환경에서는 OPERATOR_BOOTSTRAP_PASSWORD 대신 OPERATOR_PASSWORD_FILE을 사용해야 합니다."
      );
    }
    password = fallback;
  }

  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new OperatorBootstrapError(
      `운영자 비밀번호는 ${MIN_PASSWORD_LENGTH}~${MAX_PASSWORD_LENGTH}자여야 합니다.`
    );
  }
  return password;
}

function toOperator(user: AuthUserRow): CredentialUser {
  return { ...user, role: "admin" };
}

function assertSingleConfiguredAdmin(users: AuthUserRow[], email: string) {
  const admins = users.filter((user) => hasAdminRole(user.role));
  if (admins.length > 1) {
    throw new OperatorBootstrapError(
      "운영자 계정이 둘 이상입니다. 서버 시작을 중단합니다."
    );
  }
  const admin = admins[0];
  if (admin && email && normalizeEmail(admin.email) !== email) {
    throw new OperatorBootstrapError(
      "기존 운영자 이메일과 OPERATOR_EMAIL이 일치하지 않습니다."
    );
  }
  return admin;
}

function matchingConfiguredUser(users: AuthUserRow[], email: string) {
  const matches = users.filter(
    (user) => normalizeEmail(user.email) === email
  );
  if (matches.length > 1) {
    throw new OperatorBootstrapError(
      "OPERATOR_EMAIL과 대소문자만 다른 계정이 둘 이상입니다."
    );
  }
  return matches[0];
}

function listAuthUsers() {
  return db
    .select({
      id: authUsers.id,
      name: authUsers.name,
      email: authUsers.email,
      role: authUsers.role,
    })
    .from(authUsers)
    .all();
}

export function isOperatorReadyForSignup() {
  const email = configuredOperatorEmail();
  const users = listAuthUsers();
  const admin = assertSingleConfiguredAdmin(users, email);
  if (!admin) return false;
  const credential = db
    .select({ id: authAccounts.id })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.userId, admin.id),
        eq(authAccounts.providerId, "credential"),
        isNotNull(authAccounts.password)
      )
    )
    .limit(1)
    .get();
  return Boolean(credential) && !hasUnclaimedDomainData();
}

function claimFor(operator: CredentialUser, action: OperatorBootstrapResult["action"]) {
  claimLegacyDataForOperator(operator.id);
  return { operator, action } satisfies OperatorBootstrapResult;
}

/**
 * Ensures a single trusted operator exists before serving requests.
 *
 * An older /setup credential user with OPERATOR_EMAIL is promoted without
 * changing its password. A newly created or credential-less row uses a secret
 * only for the one missing credential, never to reset an existing password.
 */
export async function bootstrapOperator(): Promise<OperatorBootstrapResult | null> {
  let email = configuredOperatorEmail();

  const withoutPassword = db.transaction((tx) => {
    const users = tx
      .select({
        id: authUsers.id,
        name: authUsers.name,
        email: authUsers.email,
        role: authUsers.role,
      })
      .from(authUsers)
      .all();
    const admin = assertSingleConfiguredAdmin(users, email);
    if (admin) {
      const credential = tx
        .select({ id: authAccounts.id })
        .from(authAccounts)
        .where(
          and(
            eq(authAccounts.userId, admin.id),
            eq(authAccounts.providerId, "credential"),
            isNotNull(authAccounts.password)
          )
        )
        .limit(1)
        .get();
      return credential
        ? { operator: toOperator(admin), action: "existing" as const }
        : null;
    }
    if (!email) return null;

    const user = matchingConfiguredUser(users, email);
    if (!user) return null;
    const credential = tx
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.userId, user.id),
          eq(authAccounts.providerId, "credential"),
          isNotNull(authAccounts.password)
        )
      )
      .limit(1)
      .get();
    if (!credential) return null;

    tx.update(authUsers)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(authUsers.id, user.id))
      .run();
    return { operator: toOperator(user), action: "promoted" as const };
  }, { behavior: "immediate" });

  if (withoutPassword) {
    return claimFor(withoutPassword.operator, withoutPassword.action);
  }
  if (!email) {
    const admin = assertSingleConfiguredAdmin(listAuthUsers(), "");
    if (!admin) return null;
    email = normalizeEmail(admin.email);
  }

  const passwordHash = await hashPassword(readBootstrapPassword());
  const now = new Date();

  const created = db.transaction((tx) => {
    const users = tx
      .select({
        id: authUsers.id,
        name: authUsers.name,
        email: authUsers.email,
        role: authUsers.role,
      })
      .from(authUsers)
      .all();
    const admin = assertSingleConfiguredAdmin(users, email);
    if (admin) {
      const credential = tx
        .select({ id: authAccounts.id, password: authAccounts.password })
        .from(authAccounts)
        .where(
          and(
            eq(authAccounts.userId, admin.id),
            eq(authAccounts.providerId, "credential")
          )
        )
        .limit(1)
        .get();
      if (credential?.password) {
        return { operator: toOperator(admin), action: "existing" as const };
      }
      if (credential) {
        tx.update(authAccounts)
          .set({ password: passwordHash, updatedAt: now })
          .where(eq(authAccounts.id, credential.id))
          .run();
      } else {
        tx.insert(authAccounts)
          .values({
            id: crypto.randomUUID(),
            accountId: admin.id,
            providerId: "credential",
            userId: admin.id,
            password: passwordHash,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
      return { operator: toOperator(admin), action: "recovered" as const };
    }

    const existing = matchingConfiguredUser(users, email);
    if (existing) {
      const credential = tx
        .select({ id: authAccounts.id, password: authAccounts.password })
        .from(authAccounts)
        .where(
          and(
            eq(authAccounts.userId, existing.id),
            eq(authAccounts.providerId, "credential")
          )
        )
        .limit(1)
        .get();
      if (credential) {
        if (!credential.password) {
          tx.update(authAccounts)
            .set({ password: passwordHash, updatedAt: now })
            .where(eq(authAccounts.id, credential.id))
            .run();
        }
      } else {
        tx.insert(authAccounts)
          .values({
            id: crypto.randomUUID(),
            accountId: existing.id,
            providerId: "credential",
            userId: existing.id,
            password: passwordHash,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
      tx.update(authUsers)
        .set({ role: "admin", updatedAt: now })
        .where(eq(authUsers.id, existing.id))
        .run();
      return {
        operator: toOperator(existing),
        action: credential?.password
          ? ("promoted" as const)
          : ("recovered" as const),
      };
    }

    const userId = crypto.randomUUID();
    const name = configuredOperatorName();
    const user = tx
      .insert(authUsers)
      .values({
        id: userId,
        name,
        email,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
        role: "admin",
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
    return { operator: toOperator(user), action: "created" as const };
  }, { behavior: "immediate" });

  return claimFor(created.operator, created.action);
}
