import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("file:/tmp/submitready/dev.db"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("/tmp/submitready"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PRICE_ID: z.string().default(""),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
});

export const env = envSchema.parse(process.env);

export const isS3Configured =
  env.STORAGE_DRIVER === "s3" &&
  Boolean(
    env.S3_BUCKET &&
      env.S3_REGION &&
      env.S3_ACCESS_KEY_ID &&
      env.S3_SECRET_ACCESS_KEY,
  );

export const isEmailConfigured =
  Boolean(env.SMTP_HOST) &&
  Boolean(env.SMTP_PORT) &&
  Boolean(env.SMTP_USER) &&
  Boolean(env.SMTP_PASS) &&
  Boolean(env.SMTP_FROM_EMAIL);
