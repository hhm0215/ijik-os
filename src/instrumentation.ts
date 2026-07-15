export async function register() {
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_RUNTIME !== "nodejs"
  ) {
    return;
  }

  const { bootstrapOperator } = await import("@/lib/operator-bootstrap");
  const result = await bootstrapOperator();
  if (!result) {
    throw new Error(
      "운영자를 준비할 수 없습니다. OPERATOR_EMAIL, OPERATOR_NAME, OPERATOR_PASSWORD_FILE을 확인하세요."
    );
  }
}
