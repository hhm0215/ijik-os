import crypto from "node:crypto";
import { z } from "zod";
import {
  createOwnerAccount,
  getOwnerSetupState,
  OwnerAlreadyExistsError,
} from "@/lib/owner";
import { MIN_OWNER_PASSWORD_LENGTH } from "@/lib/owner-signup-policy";

const setupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  password: z.string().min(MIN_OWNER_PASSWORD_LENGTH).max(128),
  setupToken: z.string().min(1),
});

function setupTokenMatches(input: string) {
  const expected = process.env.OWNER_SETUP_TOKEN?.trim() ?? "";
  const inputDigest = crypto.createHash("sha256").update(input.trim()).digest();
  const expectedDigest = crypto.createHash("sha256").update(expected).digest();
  return Boolean(expected) && crypto.timingSafeEqual(inputDigest, expectedDigest);
}

export async function POST(request: Request) {
  const state = getOwnerSetupState();
  if (state.initialized) {
    return Response.json(
      { error: "소유자 계정이 이미 설정되었습니다.", code: "OWNER_EXISTS" },
      { status: 409 }
    );
  }
  if (!state.configured) {
    return Response.json(
      {
        error: "서버에 OWNER_EMAIL과 OWNER_SETUP_TOKEN 설정이 필요합니다.",
        code: "SETUP_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "올바른 JSON 요청이 필요합니다." }, { status: 400 });
  }
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `이름, 설정 코드, ${MIN_OWNER_PASSWORD_LENGTH}자 이상의 비밀번호가 필요합니다.` },
      { status: 400 }
    );
  }
  if (!setupTokenMatches(parsed.data.setupToken)) {
    return Response.json(
      { error: "초기 설정 코드를 확인해 주세요.", code: "INVALID_SETUP_TOKEN" },
      { status: 403 }
    );
  }

  try {
    const user = await createOwnerAccount({
      name: parsed.data.name,
      email: state.ownerEmail,
      password: parsed.data.password,
    });
    return Response.json(
      { user },
      { status: 201 }
    );
  } catch (error) {
    const latest = getOwnerSetupState();
    if (error instanceof OwnerAlreadyExistsError || latest.initialized) {
      return Response.json(
        { error: "소유자 계정이 이미 설정되었습니다.", code: "OWNER_EXISTS" },
        { status: 409 }
      );
    }
    console.error("Owner setup failed", error);
    return Response.json(
      { error: "소유자 계정을 만들지 못했습니다." },
      { status: 500 }
    );
  }
}
