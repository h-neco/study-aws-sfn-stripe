import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Env, Transaction, Product } from '../types';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

export class DynamoDBRepository {
  private ddb: DynamoDBDocumentClient;
  private lambda: LambdaClient;

  constructor(public env: Env) {
    const isLocal = env.targetEnv === 'local';

    // DynamoDB Client
    this.ddb = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        endpoint: isLocal ? 'http://localstack:4566' : undefined,
        region: 'ap-northeast-1',
        maxAttempts: 3,
        requestHandler: new NodeHttpHandler({
          connectionTimeout: 500,
          socketTimeout: 500,
        }),
      }),
    );

    // Lambda Client
    this.lambda = new LambdaClient({
      endpoint: isLocal ? 'http://localstack:4566' : undefined,
      region: 'ap-northeast-1',
      apiVersion: '2015-03-31',
    });
  }

  /** 商品取得 */
  async getProduct(productId: string): Promise<Product | null> {
    const result = await this.ddb.send(
      new GetCommand({
        TableName: this.env.productsTable,
        Key: { productsId: productId },
      }),
    );

    if (!result.Item) return null;

    return result.Item as Product;
  }

  /** トランザクション作成 */
  async createTransaction(
    transaction: Omit<Transaction, 'createdAt' | 'updatedAt'>,
  ): Promise<Transaction> {
    const now = dayjs().tz().format('YYYY-MM-DD HH:mm:ss');

    const item: Transaction = {
      ...transaction,
      createdAt: now,
      updatedAt: now,
    };

    await this.ddb.send(
      new PutCommand({
        TableName: this.env.transactionsTable,
        Item: item,
      }),
    );

    return item;
  }

  /** トランザクション更新 */
  async updateTransaction(
    transactionId: string,
    updates: Partial<Omit<Transaction, 'transactionId' | 'createdAt'>>,
  ): Promise<void> {
    const now = dayjs().tz().format('YYYY-MM-DD HH:mm:ss');

    const updateExpr: string[] = [];
    const exprAttrNames: Record<string, string> = {};
    const exprAttrValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      const attrName = `#${key}`;
      const attrValue = `:${key}`;
      updateExpr.push(`${attrName} = ${attrValue}`);
      exprAttrNames[attrName] = key;
      exprAttrValues[attrValue] = value;
    });

    // updatedAt を必ず更新
    updateExpr.push('#ua = :ua');
    exprAttrNames['#ua'] = 'updatedAt';
    exprAttrValues[':ua'] = now;

    await this.ddb.send(
      new UpdateCommand({
        TableName: this.env.transactionsTable,
        Key: { transaction_id: transactionId },
        UpdateExpression: `SET ${updateExpr.join(', ')}`,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
      }),
    );
  }

  /** モック Step Function を Lambda で呼び出す */
  async invokeMockStepFunction(transactionId: string): Promise<void> {
    try {
      await this.lambda.send(
        new InvokeCommand({
          FunctionName: this.env.stepFunctionLambdaArn,
          InvocationType: 'Event', // 非同期呼び出し
          Payload: Buffer.from(JSON.stringify({ transactionId })),
        }),
      );
    } catch (err) {
      console.error('Failed to invoke mock step function', err);
      throw err;
    }
  }
}
