import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

interface ApiGatewayStackProps extends StackProps {
  startPaymentLambda: NodejsFunction;
  stripeWebhookLambda: NodejsFunction;
}

export class ApiGatewayStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const api = new apigw.RestApi(this, "PaymentApi", {
      restApiName: "Payment Service API",
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
      },
    });

    // 1. 決済開始エンドポイント (POST /payment/start)
    const paymentResource = api.root.addResource("payment");
    const startResource = paymentResource.addResource("start");

    startResource.addMethod(
      "POST",
      new apigw.LambdaIntegration(props.startPaymentLambda),
      {
        operationName: "StartPayment",
      }
    );

    // 2. Stripe Webhook エンドポイント (POST /webhook/stripe)
    const webhookResource = api.root.addResource("webhook");
    const stripeResource = webhookResource.addResource("stripe");

    stripeResource.addMethod(
      "POST",
      new apigw.LambdaIntegration(props.stripeWebhookLambda),
      {
        operationName: "StripeWebhook",
      }
    );

    new CfnOutput(this, "ApiUrl", { value: api.url });
  }
}
