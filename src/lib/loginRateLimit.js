import crypto from 'crypto';

// Keep a lightweight abuse guard without blocking normal login testing or
// users who mistype credentials a few times.
const WINDOW_MS = 5 * 60 * 1000;
const BLOCK_MS = 60 * 1000;
const MAX_FAILURES = 20;
const attempts = globalThis.__dbAtdcLoginAttempts || new Map();
globalThis.__dbAtdcLoginAttempts = attempts;

function buildKey(request, identifier) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  return crypto.createHash('sha256').update(`${ip}|${String(identifier).toLowerCase()}`).digest('hex');
}

export function checkLoginRateLimit(request, identifier) {
  const key = buildKey(request, identifier);
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.windowStartedAt > WINDOW_MS) {
    attempts.set(key, { failures: 0, windowStartedAt: now, blockedUntil: 0 });
    return { allowed: true, key, retryAfter: 0 };
  }

  if (record.blockedUntil > now) {
    return { allowed: false, key, retryAfter: Math.ceil((record.blockedUntil - now) / 1000) };
  }

  return { allowed: true, key, retryAfter: 0 };
}

export function recordLoginFailure(key) {
  const now = Date.now();
  const record = attempts.get(key) || { failures: 0, windowStartedAt: now, blockedUntil: 0 };
  record.failures += 1;
  if (record.failures >= MAX_FAILURES) record.blockedUntil = now + BLOCK_MS;
  attempts.set(key, record);
}

export function clearLoginFailures(key) {
  attempts.delete(key);
}
