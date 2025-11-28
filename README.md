- 立ち上げ

```bash
  docker compose up -d
  docker compose down
  ./backend-build.sh (TODO)
  cd terraform && ./01-terraform.sh
```

terraform で localstack 内にテーブル作ろうとするとたまにぶっ壊れる。untaint しとくと良い。

```bash
terraform untaint aws_dynamodb_table.transactions
terraform untaint aws_dynamodb_table.products
```
