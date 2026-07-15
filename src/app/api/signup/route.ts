import { z } from "zod";
import {
  createCredentialUserAtomic,
  CredentialUserAlreadyExistsError,
} from "@/lib/credential-users";
import {
  isPublicSignupEnabled,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/signup-policy";
import { isOperatorReadyForSignup } from "@/lib/operator-bootstrap";
import { consumeSignupRateLimit } from "@/lib/signup-rate-limit";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(320),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

const signupFailedResponse = () =>
  Response.json(
    {
      error: "계정을 만들 수 없습니다. 입력 정보를 확인해 주세요.",
      code: "SIGNUP_FAILED",
    },
    { status: 400 }
  );

export async function POST(request: Request) {
  if (!isPublicSignupEnabled()) {
    return Response.json(
      { error: "현재 회원가입을 받지 않습니다.", code: "SIGNUP_CLOSED" },
      { status: 403 }
    );
  }

  const rateLimit = consumeSignupRateLimit(request);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: "가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  if (!isOperatorReadyForSignup()) {
    return Response.json(
      {
        error: "서비스 초기 설정이 완료되지 않았습니다.",
        code: "SERVICE_NOT_READY",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "올바른 가입 정보를 입력해 주세요.", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "올바른 가입 정보를 입력해 주세요.", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  try {
    const user = await createCredentialUserAtomic({
      ...parsed.data,
      role: "user",
    });
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (!(error instanceof CredentialUserAlreadyExistsError)) {
      console.error("Signup failed", error);
    }
    return signupFailedResponse();
  }
}
