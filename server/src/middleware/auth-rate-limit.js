const createAuthRateLimit = (limit, windowMs) => {
  const clients = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of clients) {
      if (bucket.resetAt <= now) clients.delete(ip);
    }
  }, windowMs);
  cleanup.unref();

  return (request, response, next) => {
    const now = Date.now();
    const ip = request.ip || request.socket.remoteAddress || "unknown";
    let bucket = clients.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      clients.set(ip, bucket);
    }

    if (bucket.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      response.set("Retry-After", String(retryAfter));
      return response.status(429).json({
        status: "error",
        message: "Terlalu banyak percobaan. Coba lagi nanti.",
      });
    }

    bucket.count += 1;
    return next();
  };
};

module.exports = createAuthRateLimit;
