import { APIGatewayProxyResult } from 'aws-lambda';

export interface Env {
  targetEnv: string;
  transactionsTable: string;
  productsTable: string;
  stepFunctionLambdaArn: string;
  stripeSecretKey: string;
  isLocal: boolean;
}

export interface RequestBody {
  stripeUserId: string;
  productId: string;
  quantity: number;
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

export interface Product {
  productsId: string;
  name: string;
  price: number;
}

// --------------------
// ユーティリティ
// --------------------
export function getEnv(): Env {
  const requiredEnvVars = [
    'TARGET_ENV',
    'TRANSACTIONS_TABLE',
    'PRODUCTS_TABLE',
    'STEP_FUNCTION_LAMBDA_ARN',
    'STRIPE_SECRET_KEY',
  ];
  for (const v of requiredEnvVars) {
    if (!process.env[v]) throw new Error(`${v} is not defined`);
  }

  const targetEnv = process.env.TARGET_ENV!;
  return {
    targetEnv,
    transactionsTable: process.env.TRANSACTIONS_TABLE!,
    productsTable: process.env.PRODUCTS_TABLE!,
    stepFunctionLambdaArn: process.env.STEP_FUNCTION_LAMBDA_ARN!,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    isLocal: targetEnv === 'local',
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

export function isValidBody(body: any): boolean {
  if (!body || typeof body !== 'object') return false;
  if (typeof body.stripeUserId !== 'string') return false;
  if (typeof body.productId !== 'string') return false;
  if (typeof body.quantity !== 'number') return false;
  return true;
}
