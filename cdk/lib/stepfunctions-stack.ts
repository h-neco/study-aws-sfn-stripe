import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as sfn_tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { DynamoDBStack } from "./dynamodb-stack";
import * as cdk from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as path from "path";

interface StepFunctionsStackProps extends StackProps {
  ddbStack: DynamoDBStack;
  // 環境名 (local, stg, prodなど) を受け取るプロパティを追加
  envName: string;
}

// Lambdaコードのルートディレクトリを、CDKプロジェクトのlibディレクトリから見た 'backend' に設定
// (cdk/lib から ../.. でルートへ行き、そこから backend へ)
const LAMBDA_PROJECT_ROOT = path.join(__dirname, "..", "..", "backend");
const ROOT_DEPS_LOCK_FILE_PATH = path.join(
  LAMBDA_PROJECT_ROOT,
  "..",
  "package-lock.json"
);

export class StepFunctionsStack extends Stack {
  public readonly stateMachine: sfn.StateMachine;
  public readonly paymentProcessorLambda: NodejsFunction;

  constructor(scope: Construct, id: string, props: StepFunctionsStackProps) {
    super(scope, id, props);

    // 環境名に基づいて設定を定義
    const isLocal = props.envName === "local";

    // 環境ごとの設定
    const stripeSecretKey = isLocal
      ? "sk_test_local_xxxxxxxxxx" // LocalStack/テスト用のキー
      : process.env.STRIPE_SECRET_KEY_PROD; // 環境変数から本番/ステージングキーを取得 (CDK実行時に渡す想定)

    const awsEndpointUrl = isLocal
      ? "http://localhost:4566" // LocalStackのDockerホストアドレス
      : undefined; // AWS環境では設定不要

    // --- 1. Stripe決済処理 Lambda (TS NodejsFunctionとして定義) ---
    const envPrefix = props.envName.toUpperCase();
    this.paymentProcessorLambda = new NodejsFunction(
      this,
      "PaymentProcessorLambda",
      {
        functionName: `${envPrefix}-PaymentProcessorLambda`, // 物理名に環境名を適用
        runtime: Runtime.NODEJS_22_X,
        //projectRoot: LAMBDA_PROJECT_ROOT, // backendを参照
        entry: "index.ts",
        //entry: "lambda/payment-processor/src/index.ts", // projectRootからの相対パス
        //depsLockFilePath: ROOT_DEPS_LOCK_FILE_PATH,
        handler: "handler",
        bundling: {
          externalModules: ["aws-sdk"],
        },
        timeout: cdk.Duration.seconds(30),
        environment: {
          TRANSACTIONS_TABLE: props.ddbStack.transactionsTable.tableName,
          STRIPE_SECRET_KEY: stripeSecretKey!, // 定義されたキーを使用
          // LocalStackの場合のみエンドポイントを設定
          ...(awsEndpointUrl && { AWS_ENDPOINT_URL: awsEndpointUrl }),
        },
      }
    );
    props.ddbStack.transactionsTable.grantWriteData(
      this.paymentProcessorLambda
    );

    // --- 2. Step Functions 定義 ---

    // 2.1. 決済ステータスをPENDINGに初期更新
    const updateStatusPending = new sfn_tasks.DynamoUpdateItem(
      this,
      "UpdateStatusToPending",
      {
        // [修正] キーの値をDynamoAttributeValueでラップ
        key: {
          transactionId: sfn_tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.transactionId")
          ),
        },
        table: props.ddbStack.transactionsTable,
        updateExpression: "SET #st = :pending",
        expressionAttributeNames: { "#st": "status" },
        expressionAttributeValues: {
          ":pending": sfn_tasks.DynamoAttributeValue.fromString("PENDING"),
        },
        resultPath: "$.UpdateResult",
      }
    );

    // 2.2. Stripe決済処理を実行し、Webhookによるコールバックを待機 (.waitForTaskTokenパターン)
    const processPaymentAndAwaitWebhook = new sfn_tasks.LambdaInvoke(
      this,
      "ProcessPaymentAndAwaitWebhook",
      {
        lambdaFunction: this.paymentProcessorLambda,
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        payload: sfn.TaskInput.fromObject({
          taskToken: sfn.JsonPath.taskToken,
          input: sfn.JsonPath.entirePayload,
        }),
        resultPath: "$.PaymentResult",
      }
    );

    // 2.3. 決済ステータスをSUCCESSに最終更新
    const updateStatusSuccess = new sfn_tasks.DynamoUpdateItem(
      this,
      "UpdateStatusToSuccess",
      {
        // [修正] キーの値をDynamoAttributeValueでラップ
        key: {
          transactionId: sfn_tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.transactionId")
          ),
        },
        table: props.ddbStack.transactionsTable,
        updateExpression: "SET #st = :success, #pi = :piid",
        expressionAttributeNames: { "#st": "status", "#pi": "paymentIntentId" },
        expressionAttributeValues: {
          ":success": sfn_tasks.DynamoAttributeValue.fromString("SUCCESS"),
          // SFNの出力JSONから paymentIntentId を取得
          ":piid": sfn_tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.PaymentResult.output.paymentIntentId")
          ),
        },
        resultPath: "$.FinalResult",
      }
    );

    // 2.4. 失敗時のステータス更新
    const updateStatusFailure = new sfn_tasks.DynamoUpdateItem(
      this,
      "UpdateStatusToFailure",
      {
        // [修正] キーの値をDynamoAttributeValueでラップ
        key: {
          transactionId: sfn_tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.transactionId")
          ),
        },
        table: props.ddbStack.transactionsTable,
        updateExpression: "SET #st = :failure, #err = :error",
        expressionAttributeNames: { "#st": "status", "#err": "error" },
        expressionAttributeValues: {
          ":failure": sfn_tasks.DynamoAttributeValue.fromString("FAILED"),
          ":error": sfn_tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.ErrorDetails.Error")
          ),
        },
        resultPath: "$.FinalResult",
      }
    );

    // エラーハンドリングを含むワークフロー定義
    const definition = updateStatusPending.next(
      processPaymentAndAwaitWebhook
        .addCatch(updateStatusFailure, {
          errors: ["States.TaskFailed", "StripePaymentError"],
          resultPath: "$.ErrorDetails", // エラー詳細を保存
        })
        .next(updateStatusSuccess)
        .next(new sfn.Succeed(this, "Payment Complete"))
    );

    this.stateMachine = new sfn.StateMachine(
      this,
      "PaymentProcessorStateMachine",
      {
        stateMachineName: `${envPrefix}-PaymentProcessorStateMachine`, // 物理名に環境名を適用
        definitionBody: sfn.DefinitionBody.fromChainable(definition),
        timeout: cdk.Duration.minutes(10),
      }
    );

    new CfnOutput(this, "StateMachineArn", {
      value: this.stateMachine.stateMachineArn,
    });
  }
}
