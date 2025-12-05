### 概要

```bash
aws --endpoint-url=http://localhost:4566 dynamodb put-item \
 --table-name local-ProductsTable \
 --item '{
"productsId": {"S": "hogehoge1234"},
"name": {"S": "Sample Product B"},
"price": {"N": "3000"},
"stock": {"N": "13"}
}'
```

```bash
# build
$ npm run build

# local実行
$ sam local invoke paymentInitiator --event events/event.json --docker-network localstack_stripe_lab
```
