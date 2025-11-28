import { DynamoDBRepository } from '../repositories/DynamoDBRepository';
import { RequestBody, Transaction } from '../types';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.tz.setDefault('Asia/Tokyo');

export class PaymentService {
  constructor(private repository: DynamoDBRepository) {}

  private now(): string {
    return dayjs().tz().format('YYYY-MM-DD HH:mm:ss');
  }

  async createPayment(
    body: RequestBody,
  ): Promise<{ transactionId: string; amount: number }> {
    const { stripeUserId, productId, quantity } = body;
    // Stripe User 検証（axios + リトライ）
    if (!this.repository.env.isLocal) {
      const stripeClient = axios.create({
        baseURL: 'https://api.stripe.com/v1',
        headers: {
          Authorization: `Bearer ${this.repository.env.stripeSecretKey}`,
        },
        timeout: 3000,
      });
      try {
        await stripeClient.get(`/customers/${stripeUserId}`);
      } catch (err) {
        throw new Error('Invalid stripe userId');
      }
    }

    console.log('test');
    // 商品情報取得
    const product = await this.repository.getProduct(productId);
    if (!product) throw new Error('Product not found');
    const amount = product.price * quantity;

    console.log('test2');

    // Transaction 登録
    const transaction: Transaction = {
      transactionId: uuid(),
      stripeUserId,
      productId,
      quantity,
      amount,
      status: 'pending',
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    await this.repository.createTransaction(transaction);

    // Step Functions モック Lambda 呼び出し
    await this.repository.invokeMockStepFunction(transaction.transactionId);

    return { transactionId: transaction.transactionId, amount };
  }
}
