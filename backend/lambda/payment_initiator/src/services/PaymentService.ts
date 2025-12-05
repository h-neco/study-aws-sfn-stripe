import { DynamoDBRepository } from '../repositories/DynamoDBRepository';
import { StepFunctionRepository } from '../repositories/StepFunctionRepository';
import { RequestBody, Env, ok, err, Result } from '../types';
import { v4 as uuid } from 'uuid';
import axios from 'axios';

export class PaymentService {
  constructor(
    private db: DynamoDBRepository,
    private sfn: StepFunctionRepository,
  ) {}

  async createPayment(
    body: RequestBody,
    env: Env,
  ): Promise<Result<{ transactionId: string; amount: number }>> {
    const { stripeUserId, productId, quantity } = body;
    const transactionId = uuid();

    // 商品取得
    const product = await this.db.getProduct(productId);
    if (!product) {
      return err('PRODUCT_NOT_FOUND', 'Product not found');
    }

    const amount = product.price * quantity;

    // 在庫確保 + Transaction作成
    const tx = await this.db.createTransactionWithStock({
      transactionId,
      stripeUserId,
      productId,
      quantity,
      amount,
      status: 'pending',
    });

    if (!tx.ok) return err(tx.code, tx.message);

    // Stripe 検証（ローカル/Jest ではスキップ）
    if (!env.isJest && !env.isLocal) {
      try {
        const stripe = axios.create({
          baseURL: 'https://api.stripe.com/v1',
          headers: { Authorization: `Bearer ${env.stripeSecretKey}` },
          timeout: 3000,
        });

        await stripe.get(`/customers/${stripeUserId}`);
      } catch (e) {
        await this.db.updateTransactionStatus(
          transactionId,
          'failed',
          'INVALID_STRIPE_USER',
          productId,
          quantity,
        );
        return err('INVALID_STRIPE_USER', 'Stripe userId is invalid');
      }
    }
    // StepFunctions起動
    try {
      await this.sfn.invokeStepFunction(transactionId, stripeUserId);
    } catch (e) {
      await this.db.updateTransactionStatus(
        transactionId,
        'failed',
        'STEP_FUNCTION_ERROR',
        productId,
        quantity,
      );
      return err('STEP_FUNCTION_ERROR', 'Failed to start Step Function');
    }

    // 成功
    return ok({ transactionId, amount });
  }
}
