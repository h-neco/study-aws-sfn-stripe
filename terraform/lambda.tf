data "archive_file" "status_checker_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/status_checker.py"
  output_path = "${path.module}/build/status_checker.zip"
}

data "archive_file" "stripe_webhook_handler" {
  type        = "zip"
  source_file = "${path.module}/lambda/stripe_webhook_handler.js"
  output_path = "${path.module}/build/stripe_webhook_handler.zip"
}

resource "aws_lambda_function" "payment_initiator" {
  filename         = "${path.module}/lambda/payment_initiator.zip"
  function_name    = "${terraform.workspace}-payment-initiator"
  source_code_hash = filebase64sha256("${path.module}/lambda/payment_initiator.zip")
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_role.arn
  environment {
    variables = {
      TARGET_ENV               = terraform.workspace
      TRANSACTIONS_TABLE       = aws_dynamodb_table.transactions.name
      PRODUCTS_TABLE           = aws_dynamodb_table.products.name
      STEP_FUNCTION_LAMBDA_ARN = "dummy"
      STRIPE_SECRET_KEY        = "dummy"
    }
  }

  depends_on = [aws_iam_role_policy.lambda_ddb_policy]
}


resource "aws_lambda_function" "payment_invoke" {
  filename         = "${path.module}/lambda/payment_invoke.zip"
  function_name    = "${terraform.workspace}-payment-invoke"
  source_code_hash = filebase64sha256("${path.module}/lambda/payment_invoke.zip")
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_role.arn
  environment {
    variables = {
      TARGET_ENV         = terraform.workspace
      TRANSACTIONS_TABLE = aws_dynamodb_table.transactions.name
      STRIPE_SECRET_KEY  = "dummy"
    }
  }
  depends_on = [aws_iam_role_policy.lambda_ddb_policy]
}

resource "aws_lambda_function" "stripe_webhook" {
  filename      = data.archive_file.stripe_webhook_handler.output_path
  function_name = "${terraform.workspace}-stripe-webhook"
  runtime       = "nodejs18.x"
  handler       = "index.handler"
  role          = aws_iam_role.lambda_role.arn
  depends_on    = [aws_iam_role_policy.lambda_ddb_policy]
}

resource "aws_lambda_function" "status_checker" {
  filename      = data.archive_file.status_checker_zip.output_path
  function_name = "${terraform.workspace}-status-checker"
  handler       = "status_checker.handler"
  runtime       = "python3.11"
  role          = aws_iam_role.lambda_role.arn
  depends_on    = [aws_iam_role_policy.lambda_ddb_policy]
}
