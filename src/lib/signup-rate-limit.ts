import "server-only";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_BUCKETS = 10_000;

type Bucket = {
  attempts: number;
  resetAt: number;
};

export type SignupRateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

// The supported deployment is a single long-lived Next.js process. This map is
// intentionally process-local; moving to multiple replicas requires a shared
// limiter. Its size is capped so spoofed headers cannot grow memory without bound.
const buckets = new Map<string, Bucket>();
let requestsSinceSweep = 0;

function normalizeAddress(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "";
  if (normalized.startsWith("::ffff:")) return normalized.slice(7, 135);
  const bracketedIpv6 = normalized.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6) return bracketedIpv6[1].slice(0, 128);
  const ipv4WithPort = normalized.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) return ipv4WithPort[1];
  return normalized.slice(0, 128);
}

function clientAddress(request: Request) {
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    // nginx's $proxy_add_x_forwarded_for appends its trusted remote address.
    // With the supported single reverse proxy, the last hop cannot be supplied
    // by the public client while the first hop can be spoofed.
    .at(-1);
  const realIp = request.headers.get("x-real-ip") ?? undefined;
  return normalizeAddress(forwardedFor) || normalizeAddress(realIp) || "unknown";
}

function retryAfterSeconds(resetAt: number, now: number) {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function consumeSignupRateLimit(
  request: Request,
  now = Date.now()
): SignupRateLimitResult {
  requestsSinceSweep += 1;
  if (requestsSinceSweep >= 128 || buckets.size >= MAX_BUCKETS) {
    requestsSinceSweep = 0;
    sweepExpired(now);
  }

  const key = clientAddress(request);
  const existing = buckets.get(key);
  if (existing && existing.resetAt > now) {
    if (existing.attempts >= MAX_ATTEMPTS) {
      return {
        allowed: false,
        retryAfterSeconds: retryAfterSeconds(existing.resetAt, now),
      };
    }
    existing.attempts += 1;
    return { allowed: true, remaining: MAX_ATTEMPTS - existing.attempts };
  }

  if (buckets.size >= MAX_BUCKETS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
    };
  }

  buckets.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
  return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
}
