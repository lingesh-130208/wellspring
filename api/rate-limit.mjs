const windows = new Map();

/**
 * Best-effort, per-runtime rate limiter. Serverless workers do not share this map;
 * deployments handling real patient data must use a centralized rate-limit store.
 */
export function clientKey(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '');
  const fromHeader = raw.split(',')[0].trim();
  return fromHeader || String(req?.socket?.remoteAddress || 'unknown');
}

export function consumeRateLimit(key, limit, windowMs, now = Date.now()) {
  let entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    windows.set(key, entry);
  }
  entry.count += 1;

  if (windows.size > 10000) {
    for (const [storedKey, value] of windows) {
      if (value.resetAt <= now) windows.delete(storedKey);
    }
    while (windows.size > 10000) windows.delete(windows.keys().next().value);
  }

  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
  };
}

export function applyRateLimit(req, res, { bucket, limit, windowMs }) {
  const result = consumeRateLimit(bucket + ':' + clientKey(req), limit, windowMs);
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
    return false;
  }
  return true;
}
