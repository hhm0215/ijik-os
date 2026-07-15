import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
  db,
} from "@/db";
import { getOwnerCount } from "@/lib/owner";
import {
  evaluateOwnerSignup,
  MIN_OWNER_PASSWORD_LENGTH,
} from "@/lib/owner-signup-policy";

function getAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;

  if (process.env.NODE_ENV === "production" && !isProductionBuild()) {
    throw new Error("운영 환경에는 BETTER_AUTH_SECRET이 필요합니다.");
  }
  return "ijik-os-development-only-secret-change-before-deploy";
}

function isProductionBuild() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function getAuthBaseURL() {
  const baseURL = process.env.BETTER_AUTH_URL?.trim();
  if (baseURL) return baseURL;

  if (process.env.NODE_ENV === "production" && !isProductionBuild()) {
    throw new Error("운영 환경에는 BETTER_AUTH_URL이 필요합니다.");
  }
  return "http://localhost:3000";
}

export const auth = betterAuth({
  appName: "이직 OS",
  secret: getAuthSecret(),
  baseURL: getAuthBaseURL(),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: authUsers,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: MIN_OWNER_PASSWORD_LENGTH,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const decision = evaluateOwnerSignup({
            configuredOwnerEmail: process.env.OWNER_EMAIL,
            attemptedEmail: user.email,
            existingOwnerCount: getOwnerCount(),
          });
          if (decision.allowed) return;

          if (decision.reason === "owner-email-missing") {
            throw new APIError("SERVICE_UNAVAILABLE", {
              message: "서버에 OWNER_EMAIL 설정이 필요합니다.",
            });
          }
          throw new APIError("FORBIDDEN", {
            message: "새 계정 등록이 허용되지 않습니다.",
          });
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        throw new APIError("FORBIDDEN", {
          message: "공개 가입은 사용할 수 없습니다.",
        });
      }
    }),
  },
});
