import { ApiGatewayManagementApi } from "aws-sdk";

export const handler = async (event: any) => {
  const wsEndpoint = process.env.WS_ENDPOINT!;
  const api = new ApiGatewayManagementApi({ endpoint: wsEndpoint });

  const detail = event.detail.dynamodb.NewImage;
  const connectionId = detail.connectionId.S;

  await api
    .postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        paymentId: detail.paymentId.S,
        status: detail.status.S,
      }),
    })
    .promise();
};
