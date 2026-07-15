const LOCAL_ORIGIN = "http://ijik.local";
const AUTH_ENTRY_PATHS = new Set(["/login", "/signup", "/setup"]);

function repeatedlyDecode(value: string) {
  let decoded = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) return decoded;
    decoded = next;
  }
  return decoded;
}

/** Keeps post-login navigation on this application's path space. */
export function safeNextPath(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";

  try {
    const decoded = repeatedlyDecode(value);
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(decoded)
    ) {
      return "/";
    }

    const target = new URL(value, LOCAL_ORIGIN);
    if (
      target.origin !== LOCAL_ORIGIN ||
      target.pathname.startsWith("//") ||
      target.pathname.includes("\\")
    ) {
      return "/";
    }
    if (AUTH_ENTRY_PATHS.has(target.pathname)) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
