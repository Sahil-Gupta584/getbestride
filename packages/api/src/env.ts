import { config } from "dotenv";
config();
import { z } from "zod";

const envSchema = z.object({
  SOLARI_API_KEY: z.string().min(1),
  SOLARI_PROFILE_ID: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
});

export const env = envSchema.parse({
  SOLARI_API_KEY: process.env.SOLARI_API_KEY,
  SOLARI_PROFILE_ID:
    process.env.SOLARI_PROFILE_ID ??
    process.env.INSTAMART_PROFILE_ID ??
    process.env.FLIPKART_PROFILE_ID,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
});
