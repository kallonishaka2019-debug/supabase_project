import json
import os
import hmac
import hashlib
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()

WEBHOOK_SECRET = os.getenv("MONIME_WEBHOOK_SECRET")


@app.post("/api/webhooks/monime")
async def monime_webhook(request: Request):
    body = await request.body()

    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="MONIME_WEBHOOK_SECRET is not configured")

    signature = (
        request.headers.get("x-monime-signature")
        or request.headers.get("x-signature")
        or request.headers.get("monime-signature")
        or request.headers.get("Monime-signature")
    )

    if signature:
        received = signature.strip()
        if received.startswith("sha256="):
            received = received[7:]

        expected = hmac.new(WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, received):
            raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = str(
        payload.get("type")
        or payload.get("event")
        or payload.get("status")
        or payload.get("state")
        or ""
    ).lower()

    if event_type in {"payment.completed", "paid", "success", "completed"}:
        reference = (
            payload.get("merchantReference")
            or payload.get("merchant_reference")
            or payload.get("reference")
            or payload.get("transactionReference")
        )
        print("Monime payment completed:", reference)

    return {"status": True}
