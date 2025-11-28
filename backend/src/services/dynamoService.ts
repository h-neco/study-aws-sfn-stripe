import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { env } from "../config/env";
import { v4 as uuid } from "uuid";

export type LogRecord = {
  log_id: string;
  user_id: string;
  action:
    | "login"
    | "logout"
    | "signup"
    | "delete"
    | "approve"
    | "promoteAdmin"
    | "demoteAdmin"
    | "updateEmail"
    | "changePassword"
    | "refresh";
  timestamp: string;
  meta?: Record<string, any>;
  ttl?: number;
};

function initDynamoDBClient() {
  const isLocal = env.TARGET_ENV === "local";

  const client = new DynamoDBClient({
    apiVersion: "2012-08-10",
    endpoint: isLocal ? env.DYNAMODB_ENDPOINT : undefined,
    region: env.AWS_REGION,
    maxAttempts: 3,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 500,
      socketTimeout: 500,
    }),
  });

  return DynamoDBDocumentClient.from(client);
}

const docClient = initDynamoDBClient();

/**
 * ログを保存
 */
export async function saveLog(
  userId: string,
  action: LogRecord["action"],
  meta?: Record<string, any>
) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = now + 60 * 60 * 24 * 30; // 30日後（秒単位）

  const log: LogRecord = {
    log_id: uuid(),
    user_id: userId,
    action,
    timestamp: new Date(now * 1000).toISOString(),
    meta,
    ttl,
  };

  await docClient.send(
    new PutItemCommand({
      TableName: env.DYNAMODB_LOG_TABLE,
      Item: {
        log_id: { S: log.log_id },
        user_id: { S: log.user_id },
        action: { S: log.action },
        timestamp: { S: log.timestamp },
        meta: { S: JSON.stringify(meta || {}) },
        ttl: { N: String(ttl) },
      },
    })
  );

  return log;
}
