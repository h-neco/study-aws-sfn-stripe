import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { DynamoDBStack } from "./dynamodb-stack";

interface WebSocketStackProps extends StackProps {
  ddbStack: DynamoDBStack;
  // 環境名プロパティを追加
  envName: string;
}

export class WebSocketStack extends Stack {
  public readonly webSocketApi: apigwv2.WebSocketApi;
  public readonly webSocketApiEndpoint: string;

  constructor(scope: Construct, id: string, props: WebSocketStackProps) {
    super(scope, id, props);

    const envPrefix = props.envName.toUpperCase();

    // WebSocket API Gateway
    this.webSocketApi = new apigwv2.WebSocketApi(this, "PaymentWSAPI", {
      apiName: `${envPrefix}-PaymentWebSocketAPI`,
    });

    new apigwv2.WebSocketStage(this, "ProductionStage", {
      webSocketApi: this.webSocketApi,
      stageName: "prod",
      autoDeploy: true,
    });

    // WebSocket Endpoint URLを格納
    this.webSocketApiEndpoint = `${this.webSocketApi.apiEndpoint}/prod`;

    new CfnOutput(this, "WebSocketApiEndpoint", {
      value: this.webSocketApiEndpoint,
    });
    new CfnOutput(this, "WebSocketApiId", { value: this.webSocketApi.apiId });
  }
}
