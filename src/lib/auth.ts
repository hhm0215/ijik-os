import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
  db,
} from "@/db";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/signup-policy";

const ALLOWED_ADMIN_PATHS = new Set([
  "/admin/list-users",
  "/admin/list-user-sessions",
  "/admin/ban-user",
  "/admin/unban-user",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
]);

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
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        throw new APIError("FORBIDDEN", {
          message: "공개 가입은 사용할 수 없습니다.",
        });
      }
      if (
        ctx.path.startsWith("/admin/") &&
        !ALLOWED_ADMIN_PATHS.has(ctx.path)
      ) {
        throw new APIError("FORBIDDEN", {
          message: "이 관리자 작업은 사용할 수 없습니다.",
        });
      }
    }),
  },
});
