import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as apigwv2_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda_event_sources from "aws-cdk-lib/aws-lambda-event-sources";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { DynamoDBStack } from "../lib/dynamodb-stack";
import { StepFunctionsStack } from "../lib/stepfunctions-stack";
import { ApiGatewayStack } from "../lib/apigw-stack";
import { LambdaStack } from "../lib/lambda-stack";
import { WebSocketStack } from "../lib/websocket-stack";

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;

// 環境名を context から取得 (例: cdk deploy -c envName=local)
const envName = app.node.tryGetContext("envName") || "local"; // デフォルトは 'dev'

// 1. DynamoDBスタック
const ddbStack = new DynamoDBStack(app, `${envName}-DDBStack`, {
  // スタックIDにenvNameを適用
  env: { account, region },
  envName: envName, // envNameをpropsとして渡す
});
/*
// 2. Step Functionsスタックに環境名を追加
const sfnStack = new StepFunctionsStack(app, `${envName}-StepFunctionsStack`, {
  ddbStack,
  env: { account, region },
  envName: envName,
});

// 3. WebSocketスタック
const wsStack = new WebSocketStack(app, `${envName}-WebSocketStack`, {
  // スタックIDにenvNameを適用
  env: { account, region },
  ddbStack,
  envName: envName, // envNameをpropsとして渡す
});

// 4. Lambdaスタック (StepFunctionsとWebSocketの情報を参照)
const lambdaStack = new LambdaStack(app, `${envName}-LambdaStack`, {
  // スタックIDにenvNameを適用
  ddbStack,
  stateMachineArn: sfnStack.stateMachine.stateMachineArn,
  websocketApiId: wsStack.webSocketApi.apiId,
  websocketApiEndpoint: wsStack.webSocketApiEndpoint,
  env: { account, region },
  envName: envName, // envNameをpropsとして渡す
});

// DynamoDB StreamイベントソースをLambdaに追加
// lambda.StartingPosition は aws-cdk-lib/aws-lambda からのインポート (lambda) を使用
lambdaStack.ddbStreamProcessorLambda.addEventSource(
  new lambda_event_sources.DynamoEventSource(ddbStack.transactionsTable, {
    startingPosition: lambda.StartingPosition.LATEST,
  })
);

// WebSocket接続ハンドラをAPIにアタッチ
// cdk.aws_apigatewayv2_integrations から apigwv2_integrations に修正
wsStack.webSocketApi.addRoute("$connect", {
  integration: new apigwv2_integrations.WebSocketLambdaIntegration(
    "ConnectIntegration",
    lambdaStack.wsConnectDisconnectLambda
  ),
});
wsStack.webSocketApi.addRoute("$disconnect", {
  integration: new apigwv2_integrations.WebSocketLambdaIntegration(
    "DisconnectIntegration",
    lambdaStack.wsConnectDisconnectLambda
  ),
});

// EventBridge Rule: DDBStreamProcessorからのイベントをWebSocketBroadcastLambdaにルーティング
new events.Rule(app, "BroadcastRule", {
  eventBus: events.EventBus.fromEventBusName(app, "DefaultEventBus", "default"),
  eventPattern: {
    source: ["custom.payment-service"],
    detailType: ["TRANSACTION_STATUS_UPDATE"],
  },
  targets: [new targets.LambdaFunction(lambdaStack.wsBroadcastLambda)],
});

// 5. API Gatewayスタック (Lambdaを参照)
new ApiGatewayStack(app, `${envName}-ApiGatewayStack`, {
  // スタックIDにenvNameを適用
  startPaymentLambda: lambdaStack.startPaymentLambda,
  stripeWebhookLambda: lambdaStack.stripeWebhookLambda,
  env: { account, region },
});

// Step Functions StackのpaymentProcessorLambdaに関数名を依存性注入 (循環参照回避)
sfnStack.paymentProcessorLambda.addEnvironment(
  "PAYMENT_PROCESSOR_FUNCTION_NAME",
  sfnStack.paymentProcessorLambda.functionName
);
*/
