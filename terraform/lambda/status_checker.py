# status_checker.py
import json
import os
import boto3

DDB_TABLE = os.environ.get("TRANSACTIONS_TABLE", "LOCAL-TransactionsTable")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(DDB_TABLE)

def handler(event, context):
    # GET /api/status?transaction_id=xxx
    params = event.get("queryStringParameters") or {}
    txid = params.get("transaction_id")
    if not txid:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"message": "transaction_id required"})
        }

    resp = table.get_item(Key={"transaction_id": txid})
    item = resp.get("Item")
    if not item:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"message": "not found"})
        }

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"transaction_id": item["transaction_id"], "status": item.get("status")})
    }
