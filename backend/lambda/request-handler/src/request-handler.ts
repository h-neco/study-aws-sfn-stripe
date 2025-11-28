import { StepFunctions } from "aws-sdk";
import { DynamoDB } from "aws-sdk";
import { v4 as uuid } from "uuid";

const ddb = new DynamoDB.DocumentClient();
const sfn = new StepFunctions();

export const handler = async () => {
  const paymentId = uuid();

  await ddb
    .put({
      TableName: "Payments",
      Item: { paymentId, status: "PENDING" },
    })
    .promise();

  await sfn
    .startExecution({
      stateMachineArn: process.env.STATE_MACHINE_ARN!,
      input: JSON.stringify({ paymentId }),
    })
    .promise();

  return { paymentId };
};
