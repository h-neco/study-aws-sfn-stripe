data "archive_file" "payment_initiator_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/payment_initiator.py"
  output_path = "${path.module}/build/payment_initiator.zip"
}

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
  filename      = data.archive_file.payment_initiator_zip.output_path
  function_name = "${terraform.workspace}-payment-initiator"
  handler       = "payment_initiator.handler"
  runtime       = "python3.11"
  role          = aws_iam_role.lambda_role.arn

  depends_on = [aws_iam_role_policy.lambda_ddb_policy]
}

resource "aws_lambda_function" "status_checker" {
  filename      = data.archive_file.status_checker_zip.output_path
  function_name = "${terraform.workspace}-status-checker"
  handler       = "status_checker.handler"
  runtime       = "python3.11"
  role          = aws_iam_role.lambda_role.arn

  depends_on = [aws_iam_role_policy.lambda_ddb_policy]
}

resource "aws_lambda_function" "stripe_webhook_handler" {
  filename      = data.archive_file.stripe_webhook_handler.output_path
  function_name = "${terraform.workspace}-stripe-webhook-handler"
  runtime       = "nodejs18.x"
  handler       = "index.handler"
  role          = aws_iam_role.lambda_role.arn

  depends_on = [aws_iam_role_policy.lambda_ddb_policy]
}

