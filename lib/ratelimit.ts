import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import type { RateLimitModule } from "../modules/types";

const REQUIRED_ENV_VARS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

const FREE_ROAST_LIMIT = 5;
const FREE_ROAST_WINDOW = "1 d";

type UpstashEnv = Record<(typeof REQUIRED_ENV_VARS)[number], string>;

function readUpstashEnv(): UpstashEnv {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `RateLimitModule is not configured. Missing environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(
        ", ",
      )}.`,
    );
  }

  return {
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  } as UpstashEnv;
}

export class UpstashRateLimitModule implements RateLimitModule {
  private ratelimit: Ratelimit | null = null;

  async check(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
  }> {
    const result = await this.getRatelimit().limit(identifier);

    return {
      allowed: result.success,
      remaining: result.remaining,
    };
  }

  private getRatelimit(): Ratelimit {
    if (this.ratelimit) {
      return this.ratelimit;
    }

    const env = readUpstashEnv();
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(FREE_ROAST_LIMIT, FREE_ROAST_WINDOW),
      prefix: "ratelimit:free-roast",
    });

    return this.ratelimit;
  }
}

export const rateLimit: RateLimitModule = new UpstashRateLimitModule();
