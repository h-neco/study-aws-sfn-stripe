import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { Env } from '../types';

export class StepFunctionRepository {
  private lambda: LambdaClient;

  constructor(public env: Env) {
    let endpoint;
    if (env.isLocal) {
      endpoint = 'http://localstack:4566';
    } else if (env.isJest) {
      endpoint = 'http://localhost:4566';
    } else {
      endpoint = undefined;
    }
    // Lambda Client
    this.lambda = new LambdaClient({
      endpoint: endpoint,
      region: 'us-east-1',
      apiVersion: '2015-03-31',
    });
  }

  /**
   * localstackでStep Functionを扱えなかったため、普通のLambdaをキックする
   */
  async invokeStepFunction(
    transactionId: string,
    stripeUserId: string,
    amount: number,
  ): Promise<void> {
    try {
      await this.lambda.send(
        new InvokeCommand({
          FunctionName: this.env.stepFunctionLambdaArn,
          InvocationType: 'Event', // 非同期呼び出し
          Payload: Buffer.from(
            JSON.stringify({
              transactionId,
              stripeUserId,
              amount,
            }),
          ),
        }),
      );
    } catch (err) {
      console.error('Failed to invoke mock step function', err);
      throw err;
    }
  }
}
