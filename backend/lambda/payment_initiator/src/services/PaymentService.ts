import { DynamoDBRepository } from '../repositories/DynamoDBRepository';
import { StepFunctionRepository } from '../repositories/StepFunctionRepository';
import { RequestBody } from '../types';
import { v4 as uuid } from 'uuid';
import axios from 'axios';

export class PaymentService {
  constructor(
    private db: DynamoDBRepository,
    private sfn: StepFunctionRepository,
  ) {}

  async createPayment(
    body: RequestBody,
  ): Promise<{ transactionId: string; amount: number }> {
    const { stripeUserId, productId, quantity } = body;
    const transactionId = uuid();

    // 商品情報取得
    const product = await this.db.getProduct(productId);
    if (!product) throw new Error('Product not found');
    const amount = product.price * quantity;

    // Transaction 登録
    await this.db.createTransaction({
      transactionId,
      stripeUserId,
      productId,
      quantity,
      amount,
      status: 'pending',
    });

    // Stripe User 検証
    if (!this.db.env.isLocal) {
      const stripeClient = axios.create({
        baseURL: 'https://api.stripe.com/v1',
        headers: {
          Authorization: `Bearer ${this.db.env.stripeSecretKey}`,
        },
        timeout: 3000,
      });
      try {
        await stripeClient.get(`/customers/${stripeUserId}`);
      } catch (err) {
        await this.db.updateTransactionStatus(transactionId, 'failed', 'S00X');
        console.error('Invalid stripe userId');
        return { transactionId: transactionId, amount };
      }
    }

    // Step Functions Lambda 呼び出し
    await this.sfn
      .invokeStepFunction(transactionId, stripeUserId)
      .catch(async (err) => {
        console.error('Step Function invocation failed:', err);
        await this.db.updateTransactionStatus(transactionId, 'failed', 'E001');
      });

    return { transactionId: transactionId, amount };
  }
}
