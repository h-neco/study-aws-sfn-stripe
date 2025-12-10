import { APIGatewayProxyResult } from 'aws-lambda';

export interface Env {
  targetEnv: string;
  transactionsTable: string;
  stripeSecretKey: string;
  isLocal: boolean;
  isJest: boolean;
}

export interface PaymentInvokeEvent {
  transactionId: string;
  stripeUserId: string;
  amount: number;
}

export interface Transaction {
  transactionId: string;
  stripeUserId: string;
  productId: string;
  quantity: number;
  amount: number;
  status: 'pending' | 'failed' | 'success';
  failedCode?: string; // エラーコードや理由を格納
  createdAt: string; // 'YYYY-MM-DD HH:mm:ss'
  updatedAt: string; // 'YYYY-MM-DD HH:mm:ss'
  expiresAt?: number; // UNIXタイムスタンプ (TTL 用)
}

export function getEnv(): Env {
  const requiredEnvVars = [
    'TARGET_ENV',
    'TRANSACTIONS_TABLE',
    'STRIPE_SECRET_KEY',
  ];
  for (const v of requiredEnvVars) {
    if (!process.env[v]) throw new Error(`${v} is not defined`);
  }

  return {
    targetEnv: process.env.TARGET_ENV!,
    transactionsTable: process.env.TRANSACTIONS_TABLE!,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    isLocal: process.env.TARGET_ENV === 'local',
    isJest: process.env.TARGET_ENV === 'jest',
  };
}

export function respondError(
  statusCode: number,
  errorCode: number,
  message: string,
): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify({ errorCode, message }),
  };
}

export function isValidBody(e: any): e is PaymentInvokeEvent {
  if (!e) return false;
  return (
    typeof e.amount === 'number' &&
    typeof e.stripeUserId === 'string' &&
    typeof e.transactionId === 'string'
  );
}

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; code: string; message: string };

export type Result<T> = Ok<T> | Err;

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
export const err = (code: string, message: string): Err => ({
  ok: false,
  code,
  message,
});
