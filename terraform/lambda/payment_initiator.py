# payment_initiator.py
import json
import os
import uuid
import boto3
from datetime import datetime

DDB_TABLE = os.environ.get("TRANSACTIONS_TABLE", "LOCAL-TransactionsTable")
# If running inside LocalStack Lambda, boto3 will normally hit LocalStack endpoints automatically.
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(DDB_TABLE)

def handler(event, context):
    # expect JSON body with e.g. { "amount": 100, ... }
    try:
        body = event.get("body")
        if isinstance(body, str):
            payload = json.loads(body) if body else {}
        else:
            payload = body or {}
    except Exception:
        payload = {}

    tx_id = str(uuid.uuid4())
    item = {
        "transaction_id": tx_id,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "meta": payload
    }
    table.put_item(Item=item)

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"transaction_id": tx_id, "status": "pending"})
    }
