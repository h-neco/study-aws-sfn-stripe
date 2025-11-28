import { APIGatewayProxyResult, APIGatewayProxyEventV2 } from 'aws-lambda';
import { PaymentService } from './services/PaymentService';
import { DynamoDBRepository } from './repositories/DynamoDBRepository';
import { getEnv, isValidBody, respondError } from './types';

const env = getEnv();
const repository = new DynamoDBRepository(env);
const service = new PaymentService(repository);

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  if (!event.body) return respondError(400, 2, 'Body is required');

  const body = JSON.parse(event.body);
  if (!isValidBody(body)) return respondError(400, 3, 'Invalid body');

  try {
    const result = await service.createPayment(body);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    console.error(err);
    return respondError(500, 99, err.message);
  }
};
