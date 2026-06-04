import { Redis } from "@upstash/redis";

import type { CachedRoast, CacheModule } from "../modules/types";

const REQUIRED_ENV_VARS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

type UpstashEnv = Record<(typeof REQUIRED_ENV_VARS)[number], string>;

function readUpstashEnv(): UpstashEnv {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `CacheModule is not configured. Missing environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(
        ", ",
      )}.`,
    );
  }

  return {
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  } as UpstashEnv;
}

export class UpstashCacheModule implements CacheModule {
  private redis: Redis | null = null;

  async get(key: string): Promise<CachedRoast | null> {
    return this.getRedis().get<CachedRoast>(key);
  }

  async set(
    key: string,
    value: CachedRoast,
    ttlSeconds: number,
  ): Promise<void> {
    await this.getRedis().set(key, value, { ex: ttlSeconds });
  }

  async incrementHits(key: string): Promise<void> {
    await this.getRedis().incr(`hits:${key}`);
  }

  private getRedis(): Redis {
    if (this.redis) {
      return this.redis;
    }

    const env = readUpstashEnv();
    this.redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    return this.redis;
  }
}

export const cache: CacheModule = new UpstashCacheModule();
