const Redis = require('ioredis');

let redis = null;

// Redis is optional — if the URL isn't set or the connection fails,
// we just skip caching rather than crashing the whole app
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    // don't retry forever if redis is down
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    // just log it — we don't want redis failures to take down the api
    console.warn('Redis error (caching disabled):', err.message);
  });

  redis.connect().catch(() => {
    console.warn('Could not connect to Redis — running without cache');
    redis = null;
  });
}

const get = async (key) => {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

const set = async (key, value, ttlSeconds = 60) => {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // silent — caching is best-effort
  }
};

const del = async (key) => {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {}
};

const delPattern = async (pattern) => {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {}
};

module.exports = { get, set, del, delPattern };
