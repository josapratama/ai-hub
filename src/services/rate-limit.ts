interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function checkRateLimit(keyId: string, limitRpm: number): {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
  limit: number;
} {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const entry = rateLimitMap.get(keyId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(keyId, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: Math.max(0, limitRpm - 1),
      resetSeconds: 60,
      limit: limitRpm,
    };
  }

  if (entry.count >= limitRpm) {
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetSeconds,
      limit: limitRpm,
    };
  }

  entry.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return {
    allowed: true,
    remaining: Math.max(0, limitRpm - entry.count),
    resetSeconds,
    limit: limitRpm,
  };
}
