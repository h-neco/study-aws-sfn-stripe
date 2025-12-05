import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Env, Transaction, Product, ok, err, Result } from '../types';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

export class DynamoDBRepository {
  private ddb: DynamoDBDocumentClient;

  constructor(public env: Env) {
    let endpoint;
    if (env.isLocal) {
      endpoint = 'http://localstack:4566';
    } else if (env.isJest) {
      endpoint = 'http://localhost:4566';
    } else {
      endpoint = undefined;
    }

    this.ddb = DynamoDBDocumentClient.from(
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

  /** 商品取得 */
  async getProduct(productId: string): Promise<Product | null> {
    const result = await this.ddb.send(
      new GetCommand({
        TableName: this.env.productsTable,
        Key: { productId: productId },
      }),
    );
    if (!result.Item) return null;
    return result.Item as Product;
  }

  /**
   * トランザクション作成 + 在庫を減らす
   * （Atomic: 在庫確保と購入トランザクション作成を同時に）
   */
  async createTransactionWithStock(
    transaction: Omit<Transaction, 'createdAt' | 'updatedAt' | 'expiresAt'>,
  ): Promise<Result<Transaction>> {
    const now = dayjs().tz().format('YYYY-MM-DD HH:mm:ss');
    const ttlSeconds = 24 * 60 * 60 * 90;
    const expiresAt = dayjs().add(ttlSeconds, 'second').unix();

    const item: Transaction = {
      ...transaction,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    try {
      await this.ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.env.productsTable,
                Key: { productId: transaction.productId },
                UpdateExpression: 'SET stock = stock - :q',
                ConditionExpression: 'stock >= :q',
                ExpressionAttributeValues: {
                  ':q': transaction.quantity,
                },
              },
            },
            {
              Put: {
                TableName: this.env.transactionsTable,
                Item: item,
              },
            },
          ],
        }),
      );
    } catch (e: any) {
      const reason = e.CancellationReasons?.[0]?.Code;
      if (reason === 'ConditionalCheckFailed') {
        return err('STOCK_NOT_ENOUGH', 'Stock is not enough');
      }
      return err('DB_ERROR', e.message);
    }

    return ok(item);
  }

  /**
   * トランザクション更新
   */
  async updateTransactionStatus(
    transactionId: string,
    status: 'pending' | 'success' | 'failed',
    failedCode?: string,
    productId?: string,
    quantity?: number,
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

    // 通常の更新
    await this.ddb.send(
      new UpdateCommand({
        TableName: this.env.transactionsTable,
        Key: { transactionId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );

    // failed → 在庫を戻す
    if (status === 'failed' && productId && quantity) {
      await this.ddb.send(
        new UpdateCommand({
          TableName: this.env.productsTable,
          Key: { productId: productId },
          UpdateExpression: 'SET stock = stock + :q',
          ExpressionAttributeValues: {
            ':q': quantity,
          },
        }),
      );
    }
  }
}
