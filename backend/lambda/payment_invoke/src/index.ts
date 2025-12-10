import { APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import {
  Env,
  PaymentInvokeEvent,
  getEnv,
  isValidBody,
  respondError,
} from './types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

const env = getEnv();
const stripe = new Stripe(env.stripeSecretKey, {
  apiVersion: '2023-10-16',
});
const ddb: DynamoDBDocumentClient = ddbClient(env);

export const handler = async (
  event: PaymentInvokeEvent,
): Promise<APIGatewayProxyResult> => {
  if (!isValidBody(event)) return respondError(400, 1, 'Invalid body');
  let pi;
  try {
    // Stripe 検証（ローカル/Jest ではスキップ）
    if (!env.isJest && !env.isLocal) {
      pi = await stripe.paymentIntents.create({
        amount: event.amount,
        currency: 'jpy',
        customer: event.stripeUserId,
        automatic_payment_methods: { enabled: true },
        metadata: { transactionId: event.transactionId },
      });
    }
    console.log('PaymentIntent created:', pi?.id);
    await updateTransaction(event.transactionId, 'invoked');
  } catch (err) {
    console.error('PaymentIntent create failed:', err);
    await updateTransaction(
      event.transactionId,
      'invoke_error',
      'STEP_FUNCTION_INVOKE_ERROR',
    );
    return { statusCode: 500, body: 'Payment failed' };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Payment started',
      paymentIntentId: pi?.id,
    }),
  };
};

function ddbClient(env: Env): DynamoDBDocumentClient {
  let endpoint;
  if (env.isLocal) {
    endpoint = 'http://localstack:4566';
  } else if (env.isJest) {
    endpoint = 'http://localhost:4566';
  } else {
    endpoint = undefined;
  }
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({
      endpoint: endpoint,
      region: 'us-east-1',
      maxAttempts: 3,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 500,
        socketTimeout: 500,
      }),
    }),
  );
}

async function updateTransaction(
  transactionId: string,
  status: 'invoked' | 'invoke_error',
  errorCode?: string,
) {
  const values: Record<string, any> = {
    status,
    updatedAt: dayjs().tz().format('YYYY-MM-DD HH:mm:ss'),
  };

  if (errorCode) {
    values.failedCode = errorCode;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: env.transactionsTable,
      Key: { transactionId },
      UpdateExpression: `
        SET #status = :status,
            #updatedAt = :updatedAt
            ${errorCode ? ', #failedCode = :failedCode' : ''}
      `,
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        ...(errorCode ? { '#failedCode': 'failedCode' } : {}),
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': values.updatedAt,
        ...(errorCode ? { ':failedCode': errorCode } : {}),
      },
    }),
  );
}
