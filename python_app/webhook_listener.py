"""
webhook_listener.py
===================
Multi-Platform Webhook Server for AI Shop Agent.
Receives real-time customer messaging events from:
  1. Facebook Messenger (Meta Graph API)
  2. Instagram Direct Messages (Instagram Graph API)
  3. WhatsApp Cloud API (WhatsApp Business Platform)
  4. TikTok Shop / Business Webhooks

Verifies incoming webhook challenges, processes customer queries using `GeminiAgent`,
and logs live requests. Can be launched standalone or from the desktop application.
"""

import os
import sys
import json
import logging
import uvicorn
from typing import Dict, Any, Optional
from fastapi import FastAPI, Request, Response, Query, BackgroundTasks
from fastapi.responses import PlainTextResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from database_handler import DatabaseHandler
from gemini_agent import GeminiAgent
from notification_manager import safe_gemini_call

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("WebhookListener")

app = FastAPI(
    title="AI Shop Agent Webhook Gateway",
    description="Multi-Tenant Webhook Dispatcher for Facebook, Instagram, WhatsApp, and TikTok",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active tenant agent cache
_AGENT_CACHE: Dict[str, GeminiAgent] = {}
DEFAULT_TENANT_ID = os.environ.get("TENANT_ID", "tenant_fashion_01")


def get_agent_for_tenant(tenant_id: str) -> GeminiAgent:
    if tenant_id not in _AGENT_CACHE:
        _AGENT_CACHE[tenant_id] = GeminiAgent(tenant_id=tenant_id)
    return _AGENT_CACHE[tenant_id]


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "AI-Powered Shop Sales Agent Webhook Gateway",
        "supported_channels": ["facebook", "instagram", "whatsapp", "tiktok"],
        "endpoints": {
            "facebook": "/webhook/facebook",
            "instagram": "/webhook/instagram",
            "whatsapp": "/webhook/whatsapp",
            "tiktok": "/webhook/tiktok"
        }
    }


# -------------------------------------------------------------
# 1. Facebook Messenger Webhook
# -------------------------------------------------------------
@app.get("/webhook/facebook")
def verify_facebook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    tenant_id: str = DEFAULT_TENANT_ID
):
    """Handles Meta Messenger webhook verification handshake."""
    db = DatabaseHandler(tenant_id=tenant_id)
    configs = db.get_social_configs()
    saved_token = configs.get("facebook", {}).get("verify_token") or "ai_shop_secret_token"

    if hub_mode == "subscribe" and hub_verify_token == saved_token:
        logger.info(f"[Facebook] Webhook handshake verified for tenant {tenant_id}")
        return PlainTextResponse(content=hub_challenge or "VERIFIED")
    return Response(content="Verification token mismatch", status_code=403)


@app.post("/webhook/facebook")
async def receive_facebook(request: Request, background_tasks: BackgroundTasks, tenant_id: str = DEFAULT_TENANT_ID):
    """Processes incoming Facebook Messenger messages."""
    payload = await request.json()
    logger.info(f"[Facebook] Received event: {json.dumps(payload)[:200]}...")

    # Parse Meta messaging entry
    entries = payload.get("entry", [])
    for entry in entries:
        for messaging in entry.get("messaging", []):
            sender_id = messaging.get("sender", {}).get("id", "fb_user")
            message = messaging.get("message", {})
            text = message.get("text", "")
            attachments = message.get("attachments", [])

            image_url = None
            if attachments and attachments[0].get("type") == "image":
                image_url = attachments[0].get("payload", {}).get("url")

            if text or image_url:
                agent = get_agent_for_tenant(tenant_id)
                background_tasks.add_task(
                    safe_gemini_call,
                    agent.generate_reply,
                    customer_message=text or "Please check this photo",
                    image_input=image_url,
                    platform="Facebook Messenger",
                    customer_name=f"FB User {sender_id[-4:]}",
                    tenant_id=tenant_id
                )

    return JSONResponse(content={"status": "EVENT_RECEIVED"}, status_code=200)


# -------------------------------------------------------------
# 2. Instagram Direct Messages Webhook
# -------------------------------------------------------------
@app.get("/webhook/instagram")
def verify_instagram(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    tenant_id: str = DEFAULT_TENANT_ID
):
    db = DatabaseHandler(tenant_id=tenant_id)
    configs = db.get_social_configs()
    saved_token = configs.get("instagram", {}).get("verify_token") or "ai_shop_secret_token"

    if hub_mode == "subscribe" and hub_verify_token == saved_token:
        logger.info(f"[Instagram] Webhook verified for tenant {tenant_id}")
        return PlainTextResponse(content=hub_challenge or "VERIFIED")
    return Response(content="Forbidden", status_code=403)


@app.post("/webhook/instagram")
async def receive_instagram(request: Request, background_tasks: BackgroundTasks, tenant_id: str = DEFAULT_TENANT_ID):
    payload = await request.json()
    logger.info(f"[Instagram] Event: {json.dumps(payload)[:200]}...")

    entries = payload.get("entry", [])
    for entry in entries:
        for messaging in entry.get("messaging", []):
            sender_id = messaging.get("sender", {}).get("id", "ig_user")
            message = messaging.get("message", {})
            text = message.get("text", "")
            if text:
                agent = get_agent_for_tenant(tenant_id)
                background_tasks.add_task(
                    safe_gemini_call,
                    agent.generate_reply,
                    customer_message=text,
                    platform="Instagram DM",
                    customer_name=f"IG User {sender_id[-4:]}",
                    tenant_id=tenant_id
                )

    return JSONResponse(content={"status": "EVENT_RECEIVED"}, status_code=200)


# -------------------------------------------------------------
# 3. WhatsApp Cloud API Webhook
# -------------------------------------------------------------
@app.get("/webhook/whatsapp")
def verify_whatsapp(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    tenant_id: str = DEFAULT_TENANT_ID
):
    db = DatabaseHandler(tenant_id=tenant_id)
    configs = db.get_social_configs()
    saved_token = configs.get("whatsapp", {}).get("verify_token") or "ai_shop_secret_token"

    if hub_mode == "subscribe" and hub_verify_token == saved_token:
        logger.info(f"[WhatsApp] Webhook verified for tenant {tenant_id}")
        return PlainTextResponse(content=hub_challenge or "VERIFIED")
    return Response(content="Forbidden", status_code=403)


@app.post("/webhook/whatsapp")
async def receive_whatsapp(request: Request, background_tasks: BackgroundTasks, tenant_id: str = DEFAULT_TENANT_ID):
    payload = await request.json()
    logger.info(f"[WhatsApp] Event: {json.dumps(payload)[:200]}...")

    entries = payload.get("entry", [])
    for entry in entries:
        for change in entry.get("changes", []):
            value = change.get("value", {})
            contacts = value.get("contacts", [{}])
            customer_name = contacts[0].get("profile", {}).get("name", "WhatsApp Customer")
            for msg in value.get("messages", []):
                msg_type = msg.get("type")
                text = ""
                if msg_type == "text":
                    text = msg.get("text", {}).get("body", "")
                elif msg_type == "image":
                    text = msg.get("image", {}).get("caption", "Inquiring about this product image")

                if text:
                    agent = get_agent_for_tenant(tenant_id)
                    background_tasks.add_task(
                        safe_gemini_call,
                        agent.generate_reply,
                        customer_message=text,
                        platform="WhatsApp Business",
                        customer_name=customer_name,
                        tenant_id=tenant_id
                    )

    return JSONResponse(content={"status": "EVENT_RECEIVED"}, status_code=200)


# -------------------------------------------------------------
# 4. TikTok Shop Webhook
# -------------------------------------------------------------
@app.post("/webhook/tiktok")
async def receive_tiktok(request: Request, background_tasks: BackgroundTasks, tenant_id: str = DEFAULT_TENANT_ID):
    payload = await request.json()
    logger.info(f"[TikTok] Received event: {json.dumps(payload)[:200]}...")

    event_type = payload.get("event")
    data = payload.get("data", {})
    text = data.get("content") or data.get("text") or ""
    sender_name = data.get("sender_nickname", "TikTok Shopper")

    if text:
        agent = get_agent_for_tenant(tenant_id)
        background_tasks.add_task(
            safe_gemini_call,
            agent.generate_reply,
            customer_message=text,
            platform="TikTok Shop",
            customer_name=sender_name,
            tenant_id=tenant_id
        )

    return JSONResponse(content={"code": 0, "message": "success"}, status_code=200)


def run_server(port: int = 8000, host: str = "0.0.0.0"):
    logger.info(f"Starting AI Shop Webhook server on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port=port)
