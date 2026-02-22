import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(16).default("replace_me_access_secret"),
  JWT_REFRESH_SECRET: z.string().min(16).default("replace_me_refresh_secret")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${formatted.join("\n")}`);
}

export const env = parsed.data;
