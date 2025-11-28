resource "aws_dynamodb_table" "transactions" {
  name         = "${terraform.workspace}-TransactionsTable"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "transaction_id"

  attribute {
    name = "transaction_id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "products" {
  name         = "${terraform.workspace}-ProductsTable"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "productsId"

  attribute {
    name = "productsId"
    type = "S"
  }
}

