import { readFoucAuthConfig } from '../identity/config';
import { z } from 'zod';

const urlFor = (protocols: readonly string[]) => z.url().refine(value => {
  try { return protocols.includes(new URL(value).protocol); } catch { return false; }
});
const httpUrl = urlFor(['http:', 'https:']);
const baseEnvironmentSchema = z.object({
  DATABASE_URL: urlFor(['postgres:', 'postgresql:']),
  FOUC_SERVICE_HOST: z.string().min(1).default('127.0.0.1'),
  FOUC_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(8711),
  BETTER_AUTH_URL: httpUrl,
  BETTER_AUTH_SECRET: z.string().min(32),
  S3_ENDPOINT: httpUrl.optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(3).max(63).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
}).superRefine((environment, context) => {
  const fields = ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;
  if (fields.some(field => environment[field])) for (const field of fields) {
    if (!environment[field]) context.addIssue({ code: 'custom', path: [field], message: 'Required for object storage' });
  }
});

export function readFoucServiceConfig(environment: Record<string, string | undefined> = process.env) {
  const parsed = baseEnvironmentSchema.safeParse(environment);
  if (!parsed.success) throw new Error(`Invalid Fouc service configuration: ${[...new Set(parsed.error.issues.map(issue => issue.path.join('.')))].join(', ')}`);
  const config = parsed.data;
  return Object.freeze({
    databaseUrl: config.DATABASE_URL,
    hostname: config.FOUC_SERVICE_HOST,
    port: config.FOUC_SERVICE_PORT,
    auth: readFoucAuthConfig(environment),
    storage: config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT, region: config.S3_REGION!, bucket: config.S3_BUCKET!, accessKeyId: config.S3_ACCESS_KEY_ID!, secretAccessKey: config.S3_SECRET_ACCESS_KEY! } : undefined,
  });
}

export type FoucServiceConfig = ReturnType<typeof readFoucServiceConfig>;
