- 立ち上げ

```bash
  # localstack立ち上げ
  docker compose up -d
  # Lambdaのビルド
  cd backend && ./01-lambda.sh && cd ..
  # awsの環境構築
  cd terraform && ./01-terraform.sh

  # dummy データ挿入
  aws --endpoint-url=http://localhost:4566 dynamodb put-item \
 --table-name local-ProductsTable \
 --item '{
"productsId": {"S": "hogehoge1234"},
"name": {"S": "Sample Product B"},
"price": {"N": "3000"}
}'
```

- クローズ

```
  docker compose down
```

terraform で localstack 内にテーブル作ろうとするとたまにぶっ壊れる。untaint しとくと良い。

```bash
terraform untaint aws_dynamodb_table.transactions
terraform untaint aws_dynamodb_table.products
```

メモ

- lambda 1
  - payment_initiator: ユーザーの認証簡易と step func をキックし、トランザクションテーブルに pendding ステータスを書き込む
- step func
  - ユーザー正当性確認、決済処理など一通り行い、トランザクションテーブルに pendding ステータスを書き込む
- lambda 2
  - ステータスポーリング用の lambda

dynamodb stream,apigw v2 websoket,AppSync を使いたかったが、localstack 無料版では難しかった
