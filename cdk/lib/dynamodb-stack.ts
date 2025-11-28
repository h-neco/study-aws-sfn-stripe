import { Stack, StackProps, RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

interface DynamoDBStackProps extends StackProps {
  envName: string; // 環境名を受け取るためのプロパティを追加
}

export class DynamoDBStack extends Stack {
  public readonly transactionsTable: dynamodb.Table;
  public readonly productsTable: dynamodb.Table;
  public readonly connectionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoDBStackProps) {
    super(scope, id, props);

    const isLocal = props.envName === "local";
    const removalPolicy = isLocal
      ? RemovalPolicy.DESTROY
      : RemovalPolicy.RETAIN;
    const envPrefix = props.envName.toUpperCase();

    // 1. 取引履歴テーブル (Step Functionsのステータス管理)
    this.transactionsTable = new dynamodb.Table(this, "TransactionsTable", {
      tableName: `${envPrefix}-TransactionsTable`, // 環境名プレフィックスを物理名に適用
      partitionKey: {
        name: "transactionId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: removalPolicy, // Local環境では削除、その他は保持
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // DynamoDB Streamを有効化
    });

    // 2. 商品マスタテーブル (価格情報を保持)
    this.productsTable = new dynamodb.Table(this, "ProductsTable", {
      tableName: `${envPrefix}-ProductsTable`, // 環境名プレフィックスを物理名に適用
      partitionKey: { name: "productId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: removalPolicy, // Local環境では削除、その他は保持
    });

    // 3. WebSocket接続テーブル (ConnectionIdを保持)
    this.connectionsTable = new dynamodb.Table(this, "ConnectionsTable", {
      tableName: `${envPrefix}-ConnectionsTable`, // 環境名プレフィックスを物理名に適用
      partitionKey: {
        name: "connectionId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: removalPolicy, // Local環境では削除、その他は保持
      timeToLiveAttribute: "ttl", // TTL属性を設定
    });

    new CfnOutput(this, "TransactionsTableName", {
      value: this.transactionsTable.tableName,
    });
    new CfnOutput(this, "ProductsTableName", {
      value: this.productsTable.tableName,
    });
    new CfnOutput(this, "ConnectionsTableName", {
      value: this.connectionsTable.tableName,
    });
  }
}
