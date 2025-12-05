import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { handler } from '../src/index';

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    maxAttempts: 3,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 500,
      socketTimeout: 500,
    }),
  }),
);

describe('Purchase Lambda – Stock Transaction Test', () => {
  beforeAll(async () => {
    // 初期データ投入 (stock=13)
    await ddb.send(
      new PutCommand({
        TableName: process.env.PRODUCTS_TABLE,
        Item: {
          productId: 'hogehoge1234',
          name: 'Sample Product B',
          price: 3000,
          stock: 13,
        },
      }),
    );
  });

  const invokeLambda = async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        stripeUserId: '12345678',
        productId: 'hogehoge1234',
        quantity: 5,
      }),
    };

    return handler(event as any);
  };

  test('1st purchase should succeed (stock: 13 → 8)', async () => {
    const res = await invokeLambda();
    expect(res.statusCode).toBe(200);

    const result = await ddb.send(
      new GetCommand({
        TableName: process.env.PRODUCTS_TABLE,
        Key: { productId: 'hogehoge1234' },
      }),
    );
    expect(result.Item?.stock).toBe(8);
  });

  test('2nd purchase should succeed (stock: 8 → 3)', async () => {
    const res = await invokeLambda();
    expect(res.statusCode).toBe(200);

    const result = await ddb.send(
      new GetCommand({
        TableName: process.env.PRODUCTS_TABLE,
        Key: { productId: 'hogehoge1234' },
      }),
    );
    expect(result.Item?.stock).toBe(3);
  });

  test('3rd purchase should fail (stock: 3 < 5)', async () => {
    const res = await invokeLambda();
    expect(res.statusCode).toBe(400);

    const result = await ddb.send(
      new GetCommand({
        TableName: process.env.PRODUCTS_TABLE,
        Key: { productId: 'hogehoge1234' },
      }),
    );
    expect(result.Item?.stock).toBe(3); // 変わらないはず
  });
});
