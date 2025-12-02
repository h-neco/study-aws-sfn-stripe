import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
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

  constructor(public env: Env) {
    const isLocal = env.targetEnv === 'local';

    // DynamoDB Client
    this.ddb = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        endpoint: isLocal ? 'http://localstack:4566' : undefined,
        region: 'us-east-1',
        maxAttempts: 3,
        requestHandler: new NodeHttpHandler({
          connectionTimeout: 500,
          socketTimeout: 500,
        }),
      }),
    );
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
    transaction: Omit<Transaction, 'createdAt' | 'updatedAt' | 'expiresAt'>,
  ): Promise<Transaction> {
    const now = dayjs().tz().format('YYYY-MM-DD HH:mm:ss');
    const ttlSeconds: number = 24 * 60 * 60 * 90; // 90days
    const expiresAt = dayjs().add(ttlSeconds, 'second').unix(); // TTL 秒後

    const item: Transaction = {
      ...transaction,
      createdAt: now,
      updatedAt: now,
      expiresAt: expiresAt,
    };
    await this.ddb.send(
      new PutCommand({
        TableName: this.env.transactionsTable,
        Item: item,
      }),
    );
    return item;
  }

  async updateTransactionStatus(
    transactionId: string,
    status: 'pending' | 'success' | 'failed',
    failedCode?: string, // オプショナル
  ): Promise<void> {
    const now = dayjs().tz().format('YYYY-MM-DD HH:mm:ss');
    const expressionAttributeNames: Record<string, string> = {
      '#s': 'status',
      '#ua': 'updatedAt',
    };
    const expressionAttributeValues: Record<string, any> = {
      ':s': status,
      ':ua': now,
    };
    let updateExpression = 'SET #s = :s, #ua = :ua';
    if (failedCode !== undefined) {
      updateExpression += ', #fc = :fc';
      expressionAttributeNames['#fc'] = 'failedCode';
      expressionAttributeValues[':fc'] = failedCode;
    }

    await this.ddb.send(
      new UpdateCommand({
        TableName: this.env.transactionsTable,
        Key: { transactionId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );
  }
}
