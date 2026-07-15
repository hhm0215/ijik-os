import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type OwnerSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export const getOptionalSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
);

export async function requirePageSession() {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  return session;
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

type OwnerHandler<TContext> = (
  request: Request,
  context: TContext,
  session: OwnerSession
) => Response | Promise<Response>;

export function ownerRoute<TContext = unknown>(handler: OwnerHandler<TContext>) {
  return async (request: Request, context: TContext) => {
    const session = await getSessionForRequest(request);
    if (!session) return unauthorizedResponse();
    return handler(request, context, session);
  };
}
