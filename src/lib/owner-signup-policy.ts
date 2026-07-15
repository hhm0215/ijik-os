export const MIN_OWNER_PASSWORD_LENGTH = 12;
export const MIN_OWNER_SETUP_TOKEN_LENGTH = 24;

export type OwnerSignupDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "owner-email-missing" | "owner-exists" | "email-not-allowed";
    };

export function normalizeOwnerEmail(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function isOwnerSetupConfigured(input: {
  ownerEmail: string | undefined;
  setupToken: string | undefined;
}) {
  return (
    Boolean(normalizeOwnerEmail(input.ownerEmail)) &&
    (input.setupToken?.trim().length ?? 0) >= MIN_OWNER_SETUP_TOKEN_LENGTH
  );
}

export function evaluateOwnerSignup(input: {
  configuredOwnerEmail: string | undefined;
  attemptedEmail: string | undefined;
  existingOwnerCount: number;
}): OwnerSignupDecision {
  const configured = normalizeOwnerEmail(input.configuredOwnerEmail);
  if (!configured) return { allowed: false, reason: "owner-email-missing" };
  if (input.existingOwnerCount > 0) {
    return { allowed: false, reason: "owner-exists" };
  }
  if (normalizeOwnerEmail(input.attemptedEmail) !== configured) {
    return { allowed: false, reason: "email-not-allowed" };
  }
  return { allowed: true };
}
