import dotenv from "dotenv";
import path from "path";

const envFile = process.env.NODE_ENV
  ? `.env.${process.env.NODE_ENV}`
  : ".env.local";

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

type Env = {
  TARGET_ENV: "local" | "production";
  AWS_REGION: string;
  DYNAMODB_ENDPOINT?: string;
  DYNAMODB_LOG_TABLE: string;
  COGNITO_ENDPOINT: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  MAIL_PROVIDER?: "mailhog" | "ses";
  MAILHOG_HOST?: string;
  MAILHOG_PORT?: string;
  FRONTEND_URL: string;
};

function getEnv(): Env {
  const {
    TARGET_ENV,
    AWS_REGION,
    DYNAMODB_ENDPOINT,
    DYNAMODB_LOG_TABLE,
    COGNITO_ENDPOINT,
    COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID,
    MAIL_PROVIDER,
    MAILHOG_HOST,
    MAILHOG_PORT,
    FRONTEND_URL,
  } = process.env;

  if (!TARGET_ENV) throw new Error("Missing TARGET_ENV");
  if (!AWS_REGION) throw new Error("Missing AWS_REGION");
  if (!DYNAMODB_LOG_TABLE) throw new Error("Missing USER_TABLE");
  if (!COGNITO_ENDPOINT) throw new Error("Missing COGNITO_ENDPOINT");
  if (!COGNITO_USER_POOL_ID) throw new Error("Missing COGNITO_USER_POOL_ID");
  if (!COGNITO_CLIENT_ID) throw new Error("Missing COGNITO_CLIENT_ID");
  if (!FRONTEND_URL) throw new Error("Missing FRONTEND_URL");

  return {
    TARGET_ENV: TARGET_ENV as "local" | "production",
    AWS_REGION,
    DYNAMODB_ENDPOINT,
    DYNAMODB_LOG_TABLE,
    COGNITO_ENDPOINT,
    COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID,
    MAIL_PROVIDER: MAIL_PROVIDER as "mailhog" | "ses",
    MAILHOG_HOST,
    MAILHOG_PORT,
    FRONTEND_URL,
  };
}

export const env = getEnv();
