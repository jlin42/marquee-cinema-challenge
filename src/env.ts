import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  HOLD_TTL_SECONDS: z.coerce.number().int().positive().default(480),
});

export const env = EnvSchema.parse(process.env);
