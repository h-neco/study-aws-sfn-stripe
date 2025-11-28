import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import { DynamoDBStack } from "./dynamodb-stack";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as path from "path";

interface LambdaStackProps extends StackProps {
  ddbStack: DynamoDBStack;
  stateMachineArn: string;
  websocketApiId: string;
  websocketApiEndpoint: string;
  // 環境名プロパティを追加
  envName: string;
}

// Lambdaコードのルートディレクトリを、CDKプロジェクトのlibディレクトリから見た 'backend' に設定
// (cdk/lib から ../.. でルートへ行き、そこから backend へ)
const LAMBDA_PROJECT_ROOT = path.join(__dirname, "..", "..", "backend");

// 共通のNodejsFunctionプロパティ
const commonNodejsProps = {
  runtime: Runtime.NODEJS_20_X,
  entry: "", // NodejsFunctionで上書きされる
  // projectRootをルートのbackendディレクトリに変更
  //projectRoot: LAMBDA_PROJECT_ROOT,
  bundling: {
    externalModules: ["aws-sdk"], // AWS SDKはLambdaランタイムに内蔵されているためバンドル対象外
  },
  environment: {
    AWS_ENDPOINT_URL: "http://localhost:4566", // LocalStackアクセス用 (デフォルト値)
  },
};

export class LambdaStack extends Stack {
  public readonly startPaymentLambda: NodejsFunction;
  public readonly stripeWebhookLambda: NodejsFunction;
  public readonly ddbStreamProcessorLambda: NodejsFunction;
  public readonly wsConnectDisconnectLambda: NodejsFunction;
  public readonly wsBroadcastLambda: NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const {
      ddbStack,
      stateMachineArn,
      websocketApiId,
      websocketApiEndpoint,
      envName,
    } = props;

    const isLocal = envName === "local";
    const envPrefix = envName.toUpperCase();

    // LocalStack以外ではエンドポイントURLを削除
    const awsEndpointUrl = isLocal ? "http://localhost:4566" : undefined;
    const baseEnv = {
      ...(awsEndpointUrl && { AWS_ENDPOINT_URL: awsEndpointUrl }),
    };

    // --- 1. 決済開始 Lambda (REST API経由) ---
    this.startPaymentLambda = new NodejsFunction(this, "StartPaymentHandler", {
      ...commonNodejsProps,
      functionName: `${envPrefix}-StartPaymentHandler`, // 物理名に環境名を適用
      //      entry: "lambda/ws-broadcast/dist/index.js",
      //entry: "index.js", // projectRootからの相対パス
      //projectRoot: LAMBDA_PROJECT_ROOT, // backendを参照
      entry: "index.ts",
      //entry: "lambda/payment-processor/src/webhook-handler.ts", // projectRootからの相対パス
      handler: "handler",
      environment: {
        ...baseEnv,
        TRANSACTIONS_TABLE: ddbStack.transactionsTable.tableName,
        PRODUCTS_TABLE: ddbStack.productsTable.tableName,
        STATE_MACHINE_ARN: stateMachineArn,
      },
    });
    ddbStack.transactionsTable.grantWriteData(this.startPaymentLambda);
    ddbStack.productsTable.grantReadData(this.startPaymentLambda);
    this.startPaymentLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["states:StartExecution"],
        resources: [stateMachineArn],
      })
    );

    // --- 2. Stripe Webhook 受信 Lambda (REST API経由) ---
    this.stripeWebhookLambda = new NodejsFunction(
      this,
      "StripeWebhookHandler",
      {
        ...commonNodejsProps,
        functionName: `${envPrefix}-StripeWebhookHandler`, // 物理名に環境名を適用
        //projectRoot: LAMBDA_PROJECT_ROOT, // backendを参照
        //entry: "lambda/ws-broadcast/dist/index.js",
        entry: "index.ts",
        handler: "handler",
        environment: {
          ...baseEnv,
          STATE_MACHINE_ARN: stateMachineArn,
          STRIPE_WEBHOOK_SECRET: "whsec_local_test", // LocalStackでのテスト値
        },
      }
    );
    this.stripeWebhookLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["states:SendTaskSuccess", "states:SendTaskFailure"],
        resources: [stateMachineArn],
      })
    );

    // --- 3. DynamoDB Stream Processor Lambda (EventBridgeへルーティング) ---
    this.ddbStreamProcessorLambda = new NodejsFunction(
      this,
      "DDBStreamProcessorHandler",
      {
        ...commonNodejsProps,
        functionName: `${envPrefix}-DDBStreamProcessorHandler`, // 物理名に環境名を適用
        //projectRoot: LAMBDA_PROJECT_ROOT, // backendを参照
        //entry: "lambda/payment-processor/src/webhook-handler.ts", // projectRootからの相対パス
        entry: "index.ts",
        handler: "handler",
        environment: {
          ...baseEnv,
          EVENT_BUS_NAME: "default", // LocalStackのデフォルトイベントバス
        },
      }
    );
    this.ddbStreamProcessorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: ["*"],
      })
    );

    // --- 4. WebSocket接続/切断 Lambda ($connect/$disconnect) ---
    this.wsConnectDisconnectLambda = new NodejsFunction(
      this,
      "WSConnectDisconnectHandler",
      {
        ...commonNodejsProps,
        functionName: `${envPrefix}-WSConnectDisconnectHandler`, // 物理名に環境名を適用
        //entry: "lambda/ws-broadcast/dist/index.js",
        //projectRoot: LAMBDA_PROJECT_ROOT, // backendを参照
        //entry: "lambda/payment-processor/src/webhook-handler.ts", // projectRootからの相対パス
        entry: "index.ts", // projectRootからの相対パス
        handler: "handler",
        environment: {
          ...baseEnv,
          CONNECTIONS_TABLE: ddbStack.connectionsTable.tableName,
        },
      }
    );
    ddbStack.connectionsTable.grantReadWriteData(
      this.wsConnectDisconnectLambda
    );

    // --- 5. WebSocketブロードキャスト Lambda (EventBridgeから起動) ---
    this.wsBroadcastLambda = new NodejsFunction(this, "WSBroadcastHandler", {
      ...commonNodejsProps,
      functionName: `${envPrefix}-WSBroadcastHandler`, // 物理名に環境名を適用
      //projectRoot: LAMBDA_PROJECT_ROOT, // backendを参照
      //entry: "lambda/payment-processor/src/webhook-handler.ts", // projectRootからの相対パス
      entry: "index.ts",
      handler: "handler",
      environment: {
        ...baseEnv,
        CONNECTIONS_TABLE: ddbStack.connectionsTable.tableName,
        WS_API_ENDPOINT: websocketApiEndpoint,
      },
    });
    ddbStack.connectionsTable.grantReadData(this.wsBroadcastLambda);

    // API Gateway Management API (WebSocketへのメッセージ送信) の実行権限
    this.wsBroadcastLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${websocketApiId}/*`,
        ],
      })
    );
  }
}
