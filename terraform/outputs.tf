output "rest_api_url" {
  value       = "http://${aws_api_gateway_rest_api.payment_api.id}.execute-api.us-east-1.amazonaws.com/${aws_api_gateway_deployment.deployment.id}"
  description = "Invoke URL of the REST API (LocalStack style)"
}

output "rest_api_aws_style" {
  value       = "https://${aws_api_gateway_rest_api.payment_api.id}.execute-api.us-east-1.amazonaws.com/${aws_api_gateway_deployment.deployment.id}"
  description = "Invoke URL (AWS style)"
}
