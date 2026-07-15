export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export function isPublicSignupEnabled() {
  return process.env.SIGNUP_MODE === "open";
}
