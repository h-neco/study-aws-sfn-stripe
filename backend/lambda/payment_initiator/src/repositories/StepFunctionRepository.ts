import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { Env } from '../types';

export class StepFunctionRepository {
  private lambda: LambdaClient;

  constructor(public env: Env) {
    const isLocal = env.targetEnv === 'local';
    // Lambda Client
    this.lambda = new LambdaClient({
      endpoint: isLocal ? 'http://localstack:4566' : undefined,
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
