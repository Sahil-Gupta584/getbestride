import { config } from "dotenv";
config();
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
});

export const env = envSchema.parse({
  PORT: process.env.PORT,
});
