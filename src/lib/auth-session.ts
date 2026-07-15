import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type AuthSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export type AdminSession = AuthSession & {
  user: AuthSession["user"] & { role: "admin" };
};

export function isAdminRole(role: unknown): role is "admin" {
  return (
    typeof role === "string" &&
    role.split(",").some((value) => value.trim() === "admin")
  );
}

export const getOptionalSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
);

export async function requirePageSession() {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdminPageSession(): Promise<AdminSession> {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  if (!isAdminRole(session.user.role)) redirect("/");
  return session as AdminSession;
}

export async function getSessionForRequest(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

export function unauthorizedResponse() {
  return Response.json(
    { error: "로그인이 필요합니다.", code: "UNAUTHORIZED" },
    { status: 401 }
  );
}

type UserHandler<TContext> = (
  request: Request,
  context: TContext,
  session: AuthSession
) => Response | Promise<Response>;

export function userRoute<TContext = unknown>(handler: UserHandler<TContext>) {
  return async (request: Request, context: TContext) => {
    const session = await getSessionForRequest(request);
    if (!session) return unauthorizedResponse();
    return handler(request, context, session);
  };
}
