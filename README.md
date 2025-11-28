docker compose up -d
docker compose down

```bash
cd cdk
cdk bootstrap --context localstack=true
cdk deploy --all --context localstack=true
```
